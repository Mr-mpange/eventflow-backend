import { AgentChannel, AgentLanguage, AgentIntent, AgentSender, Prisma } from '@prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/shared/errors/AppError';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { McpService } from '@modules/mcp/mcp.service';
import { sarufiProvider } from '@modules/sarufi/sarufi.provider';
import { SarufiContext } from '@modules/sarufi/sarufi.types';
import { AgentRepository } from './agent.repository';
import { AgentMessageInput } from './agent.types';
import { AgentIntentName } from './intent.types';

export class AgentService {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly eventRepo: EventRepository,
    private readonly guestRepo: GuestRepository,
    private readonly mcpService: McpService,
  ) {}

  private inferIntent(message: string): AgentIntentName {
    const text = message.toLowerCase();
    if (/(hello|hi|mambo|habari)/.test(text)) return 'GREETING';
    if (/(details|info|venue|date|wapi|lini)/.test(text)) return 'EVENT_INFO';
    if (/(yes|accept|nitakuja|ndio)/.test(text)) return 'RSVP_YES';
    if (/(no|decline|sitakuja|hapana)/.test(text)) return 'RSVP_NO';
    if (/(balance|salio)/.test(text)) return 'CHECK_BALANCE';
    if (/(pledge|later|kesho|friday|tomorrow)/.test(text)) return 'MAKE_PLEDGE';
    if (/(ticket|qr)/.test(text)) return 'REQUEST_TICKET';
    if (/(invite|card|invitation)/.test(text)) return 'REQUEST_INVITE_CARD';
    if (/(status|payment status)/.test(text)) return 'PAYMENT_STATUS';
    if (/(human|organizer|support)/.test(text)) return 'HUMAN_SUPPORT';
    if (/(pay full|full payment|complete payment)/.test(text)) return 'PAY_FULL';
    if (/(pay|partial|kidogo)/.test(text)) return 'PAY_PARTIAL';
    return 'GREETING';
  }

  private extractAmount(message: string): number | undefined {
    const match = message.replace(/,/g, '').match(/(\d{4,})/);
    if (!match) return undefined;
    return Number(match[1]);
  }

  private resolvePromiseDate(input?: string, message?: string): string | undefined {
    if (input) return input;
    if (!message) return undefined;
    if (/tomorrow|kesho/i.test(message)) {
      return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
    return undefined;
  }

  private async resolveContext(input: AgentMessageInput, sarufiContext?: SarufiContext) {
    const phoneNumber = input.phoneNumber ?? sarufiContext?.userPhone;

    if (!input.eventCode && !phoneNumber) {
      throw new ValidationError('eventCode or phoneNumber is required');
    }

    const event = input.eventCode
      ? await this.eventRepo.findByCode(input.eventCode)
      : null;

    if (input.eventCode && !event) throw new NotFoundError('Event');

    const guest = event && phoneNumber
      ? await this.guestRepo.findByPhoneAndEvent(phoneNumber, event.id)
      : phoneNumber
        ? await this.guestRepo.findByPhone(phoneNumber)
        : input.guestId
          ? await this.guestRepo.findById(input.guestId)
          : null;

    if (!guest) throw new NotFoundError('Guest');

    const resolvedEvent = event ?? await this.eventRepo.findById(guest.eventId);
    if (!resolvedEvent) throw new NotFoundError('Event');

    return { event: resolvedEvent, guest };
  }

  async handleMessage(input: AgentMessageInput, sarufiContext?: SarufiContext) {
    const { event, guest } = await this.resolveContext(input, sarufiContext);
    const intent = (input.intent ?? this.inferIntent(input.message)) as AgentIntent;
    const channel = sarufiContext?.channel ?? input.channel;
    const conversationId = sarufiContext?.conversationId ?? input.conversationId;
    const workspaceId = sarufiContext?.workspaceId ?? input.workspaceId;
    const agentId = sarufiContext?.agentId ?? input.sarufiAgentId;
    if (!channel) throw new ValidationError('channel is required');

    const session = await this.agentRepo.findActiveSession(event.id, guest.id, channel)
      ?? await this.agentRepo.createSession({
        eventId: event.id,
        guestId: guest.id,
        channel,
        language: input.language ?? AgentLanguage.SW,
        currentIntent: intent,
        metadata: {
          sarufi: {
            agentId,
            workspaceId,
            conversationId,
            channel,
          },
        },
      });

    await this.agentRepo.createMessage({
      sessionId: session.id,
      sender: AgentSender.USER,
      message: input.message,
      intent,
      metadata: {
        channel,
        conversationId,
        workspaceId,
        agentId,
        variables: input.variables ?? {},
      } as Prisma.InputJsonValue,
    });

    const actor = agentId ?? 'sarufi-agent';
    let reply = 'Nimepokea ujumbe wako.';
    let data: unknown = null;

    switch (intent) {
      case 'GREETING':
        reply = `Karibu ${guest.fullName}. Naweza kusaidia RSVP, malipo, au tiketi yako.`;
        break;
      case 'EVENT_INFO': {
        const result = await this.mcpService.execute('getEventDetails', { eventCode: input.eventCode ?? event.id }, { actor });
        data = result;
        reply = `${event.title} itafanyika ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(event.eventDate))} at ${event.venue ?? 'TBA'}.`;
        break;
      }
      case 'RSVP_YES':
      case 'RSVP_NO': {
        await this.mcpService.execute('updateRSVP', {
          eventCode: input.eventCode ?? event.id,
          guestPhone: guest.phone,
          status: intent === 'RSVP_YES' ? 'ACCEPTED' : 'DECLINED',
        }, { actor });
        reply = intent === 'RSVP_YES' ? 'RSVP yako imethibitishwa.' : 'RSVP yako ya kutohudhuria imehifadhiwa.';
        break;
      }
      case 'PAY_FULL':
      case 'PAY_PARTIAL': {
        const balance = await this.mcpService.execute('getGuestBalance', {
          eventCode: input.eventCode ?? event.id,
          guestPhone: guest.phone,
        }, { actor }) as { data: { remainingAmount: number } };
        const amount = input.amount ?? this.extractAmount(input.message) ?? balance.data.remainingAmount;
        const payment = await this.mcpService.execute('createPaymentRequest', {
          eventCode: input.eventCode ?? event.id,
          guestPhone: guest.phone,
          amount: intent === 'PAY_FULL' ? balance.data.remainingAmount : amount,
          paymentType: 'mobile_money',
        }, { actor });
        data = payment;
        const checkoutUrl = (payment as { checkoutUrl?: string }).checkoutUrl
          ?? (payment as { data?: { checkoutUrl?: string } }).data?.checkoutUrl;
        reply = `Lipa hapa: ${checkoutUrl}`;
        break;
      }
      case 'CHECK_BALANCE': {
        const balance = await this.mcpService.execute('getGuestBalance', {
          eventCode: input.eventCode ?? event.id,
          guestPhone: guest.phone,
        }, { actor }) as { data: { remainingAmount: number; paidAmount: number; } };
        data = balance;
        reply = `Umelipa TZS ${balance.data.paidAmount.toLocaleString()}. Salio ni TZS ${balance.data.remainingAmount.toLocaleString()}.`;
        break;
      }
      case 'MAKE_PLEDGE': {
        const amount = input.amount ?? this.extractAmount(input.message);
        const promisedDate = this.resolvePromiseDate(input.promisedDate, input.message);
        if (!amount || !promisedDate) throw new ValidationError('Pledge amount and promised date are required');
        const pledge = await this.mcpService.execute('recordPledge', {
          eventCode: input.eventCode ?? event.id,
          guestPhone: guest.phone,
          amount,
          promisedDate,
        }, { actor });
        data = pledge;
        reply = `Tumerekodi ahadi yako ya kulipa TZS ${amount.toLocaleString()}. Tutakukumbusha kwa wakati.`;
        break;
      }
      case 'REQUEST_INVITE_CARD': {
        const result = await this.mcpService.execute('sendInvitationCard', {
          eventCode: input.eventCode ?? event.id,
          guestPhone: guest.phone,
        }, { actor });
        data = result;
        reply = 'Kadi yako ya mwaliko imetumwa tena.';
        break;
      }
      case 'REQUEST_TICKET': {
        const result = await this.mcpService.execute('issueTicket', {
          eventCode: input.eventCode ?? event.id,
          guestPhone: guest.phone,
        }, { actor });
        data = result;
        reply = 'Tiketi yako ya QR imetumwa.';
        break;
      }
      case 'PAYMENT_STATUS': {
        if (!input.paymentReference) throw new ValidationError('paymentReference is required');
        const result = await this.mcpService.execute('checkPaymentStatus', {
          internalReference: input.paymentReference,
        }, { actor });
        data = result;
        reply = `Hali ya malipo ni ${(result as { data: { status: string } }).data.status}.`;
        break;
      }
      case 'HUMAN_SUPPORT': {
        const result = await this.mcpService.execute('handoffToOrganizer', {
          eventCode: input.eventCode ?? event.id,
          guestPhone: guest.phone,
          reason: input.message,
        }, { actor });
        data = result;
        reply = 'Tunakuhamishia kwa organizer.';
        break;
      }
      default:
        throw new UnauthorizedError('Unsupported intent');
    }

    await this.agentRepo.updateSession(session.id, {
      currentIntent: intent,
      currentStep: 'handled',
      language: input.language ?? session.language,
      metadata: {
        sarufi: {
          agentId,
          workspaceId,
          conversationId,
          channel,
        },
      },
    });
    await this.agentRepo.createMessage({
      sessionId: session.id,
      sender: AgentSender.AGENT,
      message: reply,
      intent,
      metadata: {
        payload: data as object | undefined,
        conversationId,
        workspaceId,
        agentId,
        channel,
      } as Prisma.InputJsonValue,
    });
    await sarufiProvider.sendTrace({
      intent: intent as AgentIntentName,
      message: input.message,
      conversationId,
      channel,
      metadata: {
        agentId,
        workspaceId,
      },
    });

    return {
      success: true,
      data: {
        sessionId: session.id,
        intent,
        reply,
        payload: data,
        sarufi: {
          agentId,
          workspaceId,
          conversationId,
          channel,
        },
      },
    };
  }
}
