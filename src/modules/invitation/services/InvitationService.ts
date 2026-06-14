import { Prisma } from '@prisma/client';
import { InvitationRepository } from '../repositories/InvitationRepository';
import { InvitationTemplateRepository } from '../repositories/InvitationTemplateRepository';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { NotFoundError, ForbiddenError } from '@/shared/errors/AppError';
import { auditService } from '@/shared/services/AuditService';
import type { CreateInvitationDto, UpdateInvitationDto } from '../validators/invitation.validator';

export class InvitationService {
  constructor(
    private readonly invitationRepo: InvitationRepository,
    private readonly templateRepo: InvitationTemplateRepository,
    private readonly eventRepo: EventRepository,
  ) {}

  private async assertEventAccess(eventId: string, userId: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event', eventId);
    if (event.organizerId !== userId) throw new ForbiddenError('Access denied');
    return event;
  }

  async getTemplates() {
    return this.templateRepo.findAll();
  }

  async create(userId: string, dto: CreateInvitationDto) {
    await this.assertEventAccess(dto.eventId, userId);
    if (dto.templateId) {
      const template = await this.templateRepo.findById(dto.templateId);
      if (!template) throw new NotFoundError('InvitationTemplate', dto.templateId);
    }

    const invitation = await this.invitationRepo.create({
      title: dto.title,
      content: dto.content as Prisma.InputJsonValue,
      event: { connect: { id: dto.eventId } },
      ...(dto.templateId ? { template: { connect: { id: dto.templateId } } } : {}),
    });

    await auditService.log('CREATE', 'Invitation', invitation.id, { userId });
    return invitation;
  }

  async findByEvent(eventId: string, userId: string) {
    await this.assertEventAccess(eventId, userId);
    return this.invitationRepo.findByEvent(eventId);
  }

  async findById(id: string, userId: string) {
    const invitation = await this.invitationRepo.findById(id);
    if (!invitation) throw new NotFoundError('Invitation', id);
    await this.assertEventAccess(invitation.eventId, userId);
    return invitation;
  }

  async update(id: string, userId: string, dto: UpdateInvitationDto) {
    const invitation = await this.findById(id, userId);
    const updateData: Prisma.InvitationUpdateInput = {
      title: dto.title,
      ...(dto.content ? { content: dto.content as Prisma.InputJsonValue } : {}),
      ...(dto.templateId ? { template: { connect: { id: dto.templateId } } } : {}),
    };
    return this.invitationRepo.update(invitation.id, updateData);
  }

  async preview(id: string, userId: string) {
    const invitation = await this.findById(id, userId);
    const event = await this.eventRepo.findById(invitation.eventId);
    return {
      invitation,
      event: event ? {
        title: event.title,
        eventDate: event.eventDate,
        venue: event.venue,
        coverImageUrl: event.coverImageUrl,
      } : null,
      renderedAt: new Date().toISOString(),
    };
  }

  async publish(id: string, userId: string) {
    await this.findById(id, userId);
    const published = await this.invitationRepo.publish(id);
    await auditService.log('UPDATE', 'Invitation', id, { userId }, undefined, { status: 'PUBLISHED' });
    return published;
  }

  async delete(id: string, userId: string) {
    await this.findById(id, userId);
    await this.invitationRepo.softDelete(id);
    await auditService.log('DELETE', 'Invitation', id, { userId });
  }
}
