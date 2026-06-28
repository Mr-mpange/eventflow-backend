import { prisma } from '@/config/database';
import { ValidationError, NotFoundError } from '@/shared/errors/AppError';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { RsvpService } from '@modules/rsvp/services/RsvpService';
import { PaymentService } from '@modules/payments/payment.service';
import { PledgeService } from '@modules/pledges/pledge.service';
import { CardService } from '@modules/cards/card.service';
import { ContributionService } from '@modules/contributions/contribution.service';
import { AnalyticsService } from '@modules/analytics/services/AnalyticsService';
import { TicketService } from '@modules/qr/services/TicketService';
import { getAutomationQueue } from '@/queues/automation.queue';
import { McpExecutionContext, McpToolName } from './mcp.types';

export class McpService {
  constructor(
    private readonly eventRepo: EventRepository,
    private readonly guestRepo: GuestRepository,
    private readonly rsvpService: RsvpService,
    private readonly paymentService: PaymentService,
    private readonly pledgeService: PledgeService,
    private readonly cardService: CardService,
    private readonly contributionService: ContributionService,
    private readonly analyticsService: AnalyticsService,
    private readonly ticketService: TicketService,
  ) {}

  private async logCall(toolName: McpToolName, context: McpExecutionContext, input: unknown, handler: () => Promise<unknown>) {
    try {
      const output = await handler();
      await prisma.mcpToolCall.create({
        data: {
          toolName,
          requestId: context.requestId,
          actor: context.actor,
          success: true,
          input: input as object,
          output: output as object,
        },
      });
      return output;
    } catch (error) {
      await prisma.mcpToolCall.create({
        data: {
          toolName,
          requestId: context.requestId,
          actor: context.actor,
          success: false,
          input: input as object,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  private async resolveGuest(eventCode: string, guestPhone: string) {
    const event = await this.eventRepo.findByCode(eventCode);
    if (!event) throw new NotFoundError('Event');
    const guest = await this.guestRepo.findByPhoneAndEvent(guestPhone, event.id);
    if (!guest) throw new NotFoundError('Guest');
    return { event, guest };
  }

  async execute(toolName: McpToolName, payload: any, context: McpExecutionContext) {
    return this.logCall(toolName, context, payload, async () => {
      switch (toolName) {
        case 'getGuestContext': {
          const { event, guest } = await this.resolveGuest(payload.eventCode, payload.guestPhone);
          const balance = await this.contributionService.getBalance(event.id, guest.id);
          return { success: true, data: { event, guest, balance } };
        }
        case 'getEventDetails': {
          const event = await this.eventRepo.findByCode(payload.eventCode);
          if (!event) throw new NotFoundError('Event');
          return {
            success: true,
            data: {
              id: event.id,
              title: event.title,
              date: event.eventDate,
              venue: event.venue,
              settings: event.settings,
            },
          };
        }
        case 'getGuestBalance': {
          const { event, guest } = await this.resolveGuest(payload.eventCode, payload.guestPhone);
          const balance = await this.contributionService.getBalance(event.id, guest.id);
          return { success: true, data: balance };
        }
        case 'updateRSVP': {
          const { guest } = await this.resolveGuest(payload.eventCode, payload.guestPhone);
          if (!guest.qrCode) throw new ValidationError('Guest has no RSVP token');
          const response = await this.rsvpService.respond({
            qrCode: guest.qrCode,
            status: payload.status,
            note: payload.note,
            plusOnes: payload.plusOnes ?? 0,
          });
          return { success: true, data: response };
        }
        case 'createPaymentRequest': {
          const { event, guest } = await this.resolveGuest(payload.eventCode, payload.guestPhone);
          return this.paymentService.createPaymentRequest(event.organizerId, {
            eventId: event.id,
            guestId: guest.id,
            amount: payload.amount,
            paymentType: payload.paymentType,
            phoneNumber: guest.phone ?? undefined,
            idempotencyKey: payload.idempotencyKey,
          });
        }
        case 'checkPaymentStatus': {
          const payment = await this.paymentService.getStatusByReference(payload.internalReference);
          return { success: true, data: payment };
        }
        case 'recordPledge': {
          const { event, guest } = await this.resolveGuest(payload.eventCode, payload.guestPhone);
          const pledge = await this.pledgeService.create(event.organizerId, {
            eventId: event.id,
            guestId: guest.id,
            amount: payload.amount,
            promisedDate: payload.promisedDate,
            notes: payload.notes,
          });
          return { success: true, data: pledge };
        }
        case 'sendInvitationCard': {
          const { event, guest } = await this.resolveGuest(payload.eventCode, payload.guestPhone);
          const balance = await this.contributionService.getBalance(event.id, guest.id);
          const result = await this.cardService.sendInvitationCard(event.id, guest.id, balance.requiredAmount);
          return { success: true, data: result };
        }
        case 'issueTicket': {
          const { event, guest } = await this.resolveGuest(payload.eventCode, payload.guestPhone);
          const ticket = await this.ticketService.issueTicket(event.id, guest.id);
          return { success: true, data: ticket };
        }
        case 'sendPaymentReminder': {
          const { event, guest } = await this.resolveGuest(payload.eventCode, payload.guestPhone);
          await getAutomationQueue().add('sendPaymentReminderJob', { eventId: event.id, guestId: guest.id }, {
            jobId: `payment-reminder:${event.id}:${guest.id}`,
          });
          return { success: true, message: 'Payment reminder queued' };
        }
        case 'verifyQRCode': {
          const result = await this.ticketService.verifyToken(payload.ticketToken);
          return { success: true, data: result };
        }
        case 'getEventAnalytics': {
          const event = await this.eventRepo.findByCode(payload.eventCode);
          if (!event) throw new NotFoundError('Event');
          const data = await this.analyticsService.getPaymentAnalyticsInternal(event.id);
          return { success: true, data };
        }
        case 'handoffToOrganizer': {
          const { event, guest } = await this.resolveGuest(payload.eventCode, payload.guestPhone);
          return {
              success: true,
              data: {
              organizerId: event.organizerId,
              guest: { id: guest.id, fullName: guest.fullName },
              reason: payload.reason,
              message: 'Conversation handed off to organizer',
            },
          };
        }
        default:
          throw new ValidationError(`Unsupported MCP tool: ${toolName satisfies never}`);
      }
    });
  }
}
