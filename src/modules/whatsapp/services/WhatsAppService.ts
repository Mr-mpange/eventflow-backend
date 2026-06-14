import { WhatsAppMessageRepository } from '../repositories/WhatsAppMessageRepository';
import { WhatsAppCampaignRepository } from '../repositories/WhatsAppCampaignRepository';
import { WhatsAppTemplateRepository } from '../repositories/WhatsAppTemplateRepository';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/errors/AppError';
import { auditService } from '@/shared/services/AuditService';
import { getWhatsAppQueue } from '@/queues/whatsapp.queue';
import type { SendMessageDto, BulkMessageDto, ScheduleCampaignDto } from '../validators/whatsapp.validator';
import { MessageStatus } from '@prisma/client';
import { prisma } from '@/config/database';

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
}
