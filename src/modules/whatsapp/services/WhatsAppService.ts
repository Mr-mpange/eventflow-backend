import { WhatsAppMessageRepository } from '../repositories/WhatsAppMessageRepository';
import { WhatsAppCampaignRepository } from '../repositories/WhatsAppCampaignRepository';
import { WhatsAppTemplateRepository } from '../repositories/WhatsAppTemplateRepository';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/errors/AppError';
import { auditService } from '@/shared/services/AuditService';
import { getWhatsAppQueue } from '@/queues/whatsapp.queue';
import { ghalaRailsService } from '@/infrastructure/whatsapp/GhalaRailsService';
import type { SendMessageDto, BulkMessageDto, ScheduleCampaignDto, SendInvitationDto, BulkInviteDto } from '../validators/whatsapp.validator';
import { MessageStatus } from '@prisma/client';
import { prisma } from '@/config/database';
import { env } from '@/config/env';

export class WhatsAppService {
  constructor(
    private readonly messageRepo: WhatsAppMessageRepository,
    private readonly campaignRepo: WhatsAppCampaignRepository,
    private readonly templateRepo: WhatsAppTemplateRepository,
    private readonly guestRepo: GuestRepository,
    private readonly eventRepo: EventRepository,
  ) {}

  private async assertEventAccess(eventId: string, userId: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event', eventId);
    if (event.organizerId !== userId) throw new ForbiddenError();
    return event;
  }

  async sendSingle(userId: string, dto: SendMessageDto) {
    const guest = await this.guestRepo.findById(dto.guestId);
    if (!guest) throw new NotFoundError('Guest', dto.guestId);
    if (!guest.phone) throw new ValidationError('Guest has no phone number');

    await this.assertEventAccess(guest.eventId, userId);

    const message = await this.messageRepo.create({
      guest: { connect: { id: guest.id } },
      phone: guest.phone,
      message: dto.message,
      status: MessageStatus.QUEUED,
    });

    await getWhatsAppQueue().add('send-message', { messageId: message.id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    await auditService.log('SEND', 'WhatsAppMessage', message.id, { userId });
    return message;
  }

  async sendBulk(userId: string, dto: BulkMessageDto) {
    await this.assertEventAccess(dto.eventId, userId);

    let guests;
    if (dto.guestIds?.length) {
      guests = await prisma.guest.findMany({
        where: { id: { in: dto.guestIds }, eventId: dto.eventId, deletedAt: null, phone: { not: null } },
      });
    } else if (dto.groupId) {
      guests = await prisma.guest.findMany({
        where: { groupId: dto.groupId, eventId: dto.eventId, deletedAt: null, phone: { not: null } },
      });
    } else {
      guests = await prisma.guest.findMany({
        where: { eventId: dto.eventId, deletedAt: null, phone: { not: null } },
      });
    }

    if (guests.length === 0) throw new ValidationError('No guests with phone numbers found');

    const campaign = await this.campaignRepo.create({
      name: `Bulk send ${new Date().toISOString()}`,
      message: dto.message,
      status: 'sending',
      event: { connect: { id: dto.eventId } },
    });

    const messages = await Promise.all(
      guests.map((guest) =>
        this.messageRepo.create({
          guest: { connect: { id: guest.id } },
          campaign: { connect: { id: campaign.id } },
          phone: guest.phone!,
          message: dto.message,
          status: MessageStatus.QUEUED,
        }),
      ),
    );

    await Promise.all(
      messages.map((msg) =>
        getWhatsAppQueue().add('send-message', { messageId: msg.id }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }),
      ),
    );

    await this.campaignRepo.update(campaign.id, { status: 'sent', sentAt: new Date() });
    await auditService.log('SEND', 'WhatsAppCampaign', campaign.id, { userId }, undefined, { count: messages.length });

    return { campaignId: campaign.id, queued: messages.length };
  }

  async scheduleCampaign(userId: string, dto: ScheduleCampaignDto) {
    await this.assertEventAccess(dto.eventId, userId);

    const campaign = await this.campaignRepo.create({
      name: dto.name,
      message: dto.message,
      status: 'scheduled',
      scheduledAt: new Date(dto.scheduledAt),
      event: { connect: { id: dto.eventId } },
      ...(dto.templateId ? { template: { connect: { id: dto.templateId } } } : {}),
    });

    await getWhatsAppQueue().add(
      'process-campaign',
      { campaignId: campaign.id, guestIds: dto.guestIds },
      { delay: new Date(dto.scheduledAt).getTime() - Date.now(), attempts: 3 },
    );

    return campaign;
  }

  async getDeliveryTracking(campaignId: string, userId: string) {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) throw new NotFoundError('WhatsAppCampaign', campaignId);
    await this.assertEventAccess(campaign.eventId, userId);

    const messages = await this.messageRepo.findByCampaign(campaignId);
    const stats = {
      total: messages.length,
      queued: messages.filter((m) => m.status === 'QUEUED').length,
      sent: messages.filter((m) => m.status === 'SENT').length,
      delivered: messages.filter((m) => m.status === 'DELIVERED').length,
      failed: messages.filter((m) => m.status === 'FAILED').length,
    };

    return { campaign, stats, messages };
  }

  async getTemplates() {
    return this.templateRepo.findAll();
  }

  async createTemplate(userId: string, data: { name: string; language?: string; category?: string; content: Record<string, unknown> }) {
    const template = await this.templateRepo.create(data);
    await auditService.log('CREATE', 'WhatsAppTemplate', template.id, { userId });
    return template;
  }

  async listCampaigns(eventId: string, userId: string) {
    await this.assertEventAccess(eventId, userId);
    return this.campaignRepo.findByEvent(eventId);
  }

  /**
   * Send a WhatsApp event invitation to a single guest.
   * Uses the approved image template if the number is on WhatsApp,
   * otherwise falls back to plain text with the RSVP + QR links.
   *
   * dto.imageUrl — caller-supplied image for this guest (e.g. a personalised card
   *                uploaded by the frontend). Falls back to event.coverImageUrl when omitted.
   */
  async sendInvitation(guestId: string, userId: string, dto: SendInvitationDto = { language: 'sw' }) {
    const guest = await this.guestRepo.findById(guestId);
    if (!guest) throw new NotFoundError('Guest', guestId);
    if (!guest.phone) throw new ValidationError('Guest has no phone number');

    const event = await this.assertEventAccess(guest.eventId, userId);

    // Build public-facing links using deployed URLs from environment.
    // rsvpLink and qrLink go through the stable /go/ redirect routes on the backend
    // so the WhatsApp template buttons always work even if FRONTEND_URL changes.
    const backendBase  = env.APP_URL;
    const frontendBase = env.FRONTEND_URL;
    const rsvpLink    = `${backendBase}/go/rsvp/${guest.id}`;
    const qrLink      = `${backendBase}/go/qr/${guest.qrCode ?? guest.id}`;
    const acceptLink  = `${backendBase}/go/accept/${guest.qrCode ?? guest.id}`;

    // Format event date nicely
    const eventDate = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(event.eventDate));

    const location = event.venue ?? 'TBA';

    // imageUrl priority: explicit per-guest override → event cover image
    const imageUrl = dto.imageUrl ?? event.coverImageUrl ?? undefined;

    // Try WhatsApp template first — always use eventflow_invite_sw (the only working template)
    const templateResult = await ghalaRailsService.sendInvitationTemplate({
      to: guest.phone,
      guestName: guest.fullName,
      eventName: event.title,
      eventDate,
      location,
      rsvpLink,
      qrLink,
      language: 'sw',
      templateName: 'eventflow_invite_sw',
      imageUrl,
    });

    // Record in DB
    const message = await this.messageRepo.create({
      guest: { connect: { id: guest.id } },
      phone: guest.phone,
      message: `Invitation: ${event.title}`,
      status: templateResult.status === 'failed' ? MessageStatus.FAILED : MessageStatus.QUEUED,
      ...(templateResult.externalId ? { externalId: templateResult.externalId } : {}),
      ...(templateResult.error ? { errorMessage: templateResult.error } : {}),
    });

    // If WhatsApp template failed (e.g. number not on WA), fall back to plain text
    if (templateResult.status === 'failed') {
      const fallbackText =
        `You're invited to *${event.title}*!\n\n` +
        `📅 Date: ${eventDate}\n` +
        `📍 Location: ${location}\n\n` +
        `✅ RSVP here: ${rsvpLink}\n` +
        `🎫 Your QR code: ${qrLink}\n` +
        `✔️  Accept invitation: ${acceptLink}\n\n` +
        `We look forward to seeing you!`;

      await getWhatsAppQueue().add('send-message', { messageId: message.id, fallbackText }, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
      });
    }

    await auditService.log('SEND', 'WhatsAppMessage', message.id, { userId });

    return {
      messageId: message.id,
      channel: templateResult.status !== 'failed' ? 'whatsapp_template' : 'fallback_text',
      status: message.status,
      rsvpLink,
      qrLink,
      acceptLink,
    };
  }

  /**
   * Send the approved WhatsApp invitation template to multiple guests at once.
   *
   * Per-guest image resolution order:
   *   1. dto.imageUrls[guestId]   — individual image uploaded by the frontend for that guest
   *   2. dto.imageUrl             — single image supplied for the whole batch
   *   3. event.coverImageUrl      — event's own cover image (existing behaviour)
   *
   * Returns a summary of queued / failed counts plus per-guest results.
   */
  async sendBulkInvitations(userId: string, dto: BulkInviteDto) {
    const event = await this.assertEventAccess(dto.eventId, userId);

    // Resolve target guests
    let guests;
    if (dto.guestIds?.length) {
      guests = await prisma.guest.findMany({
        where: { id: { in: dto.guestIds }, eventId: dto.eventId, deletedAt: null, phone: { not: null } },
      });
    } else if (dto.groupId) {
      guests = await prisma.guest.findMany({
        where: { groupId: dto.groupId, eventId: dto.eventId, deletedAt: null, phone: { not: null } },
      });
    } else {
      guests = await prisma.guest.findMany({
        where: { eventId: dto.eventId, deletedAt: null, phone: { not: null } },
      });
    }

    if (guests.length === 0) throw new ValidationError('No guests with phone numbers found');

    const frontendBase = env.FRONTEND_URL;
    const backendBase  = env.APP_URL;
    const language     = dto.language ?? 'sw';

    const eventDate = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(event.eventDate));

    const location    = event.venue ?? 'TBA';
    const batchFallbackImage = dto.imageUrl ?? event.coverImageUrl ?? undefined;

    const results: Array<{
      guestId: string;
      guestName: string;
      phone: string;
      messageId: string;
      channel: string;
      status: string;
      imageUrl: string | undefined;
    }> = [];

    for (const guest of guests) {
      // Use stable /go/ redirect URLs for template buttons — domain never changes
      const rsvpLink        = `${backendBase}/go/rsvp/${guest.id}`;
      const qrLink          = `${backendBase}/go/qr/${guest.qrCode ?? guest.id}`;
      const guestAcceptLink = `${backendBase}/go/accept/${guest.qrCode ?? guest.id}`;

      // Per-guest image: individual override → batch override → event cover
      const imageUrl = dto.imageUrls?.[guest.id] ?? batchFallbackImage;

      const templateResult = await ghalaRailsService.sendInvitationTemplate({
        to: guest.phone!,
        guestName: guest.fullName,
        eventName: event.title,
        eventDate,
        location,
        rsvpLink,
        qrLink,
        language: 'sw',
        templateName: 'eventflow_invite_sw',
        imageUrl,
      });

      const message = await this.messageRepo.create({
        guest: { connect: { id: guest.id } },
        phone: guest.phone!,
        message: `Invitation: ${event.title}`,
        status: templateResult.status === 'failed' ? MessageStatus.FAILED : MessageStatus.QUEUED,
        ...(templateResult.externalId ? { externalId: templateResult.externalId } : {}),
        ...(templateResult.error ? { errorMessage: templateResult.error } : {}),
      });

      // Fall back to plain text if template send failed
      if (templateResult.status === 'failed') {
        const fallbackText =
          `You're invited to *${event.title}*!\n\n` +
          `📅 Date: ${eventDate}\n` +
          `📍 Location: ${location}\n\n` +
          `✅ RSVP here: ${rsvpLink}\n` +
          `🎫 Your QR code: ${qrLink}\n` +
          `✔️  Accept invitation: ${guestAcceptLink}\n\n` +
          `We look forward to seeing you!`;

        await getWhatsAppQueue().add('send-message', { messageId: message.id, fallbackText }, {
          attempts: 2,
          backoff: { type: 'exponential', delay: 3000 },
        });
      }

      results.push({
        guestId: guest.id,
        guestName: guest.fullName,
        phone: guest.phone!,
        messageId: message.id,
        channel: templateResult.status !== 'failed' ? 'whatsapp_template' : 'fallback_text',
        status: message.status,
        imageUrl,
      });
    }

    await auditService.log('SEND', 'WhatsAppCampaign', dto.eventId, { userId }, undefined, {
      count: results.length,
      type: 'bulk_invite',
    });

    const queued   = results.filter((r) => r.channel === 'whatsapp_template').length;
    const fallback = results.filter((r) => r.channel === 'fallback_text').length;

    return {
      total: results.length,
      queued,
      fallback,
      acceptLinkPattern: `${backendBase}/go/accept/{qrCode}`,
      results,
    };
  }
}
