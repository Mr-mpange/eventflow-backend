import { EventRepository } from '../repositories/EventRepository';
import { EventCategoryRepository } from '../repositories/EventCategoryRepository';
import { cloudinaryService } from '@/infrastructure/storage/CloudinaryService';
import { NotFoundError, ForbiddenError } from '@/shared/errors/AppError';
import { auditService } from '@/shared/services/AuditService';
import { paginatedResponse } from '@/shared/utils/helpers';
import { getRedis, CACHE_TTL } from '@/config/redis';
import type { CreateEventDto, UpdateEventDto } from '../validators/event.validator';
import { EventStatus, Prisma } from '@prisma/client';

export class EventService {
  constructor(
    private readonly eventRepo: EventRepository,
    private readonly categoryRepo: EventCategoryRepository,
  ) {}

  async create(organizerId: string, dto: CreateEventDto) {
    if (dto.categoryId) {
      const category = await this.categoryRepo.findById(dto.categoryId);
      if (!category) throw new NotFoundError('EventCategory', dto.categoryId);
    }

    const event = await this.eventRepo.create({
      title: dto.title,
      description: dto.description,
      eventDate: new Date(dto.eventDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      venue: dto.venue,
      latitude: dto.latitude,
      longitude: dto.longitude,
      settings: (dto.settings ?? {}) as Prisma.InputJsonValue,
      organizer: { connect: { id: organizerId } },
      ...(dto.categoryId ? { category: { connect: { id: dto.categoryId } } } : {}),
    });

    await auditService.log('CREATE', 'Event', event.id, { userId: organizerId }, undefined, { title: event.title });
    return event;
  }

  async findById(eventId: string, userId: string) {
    const redis = getRedis();
    const cacheKey = `event:${eventId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event', eventId);
    if (event.organizerId !== userId) throw new ForbiddenError('Access denied');

    await redis.setex(cacheKey, CACHE_TTL.EVENT, JSON.stringify(event));
    return event;
  }

  async list(organizerId: string, page: number, limit: number, status?: EventStatus) {
    const result = await this.eventRepo.findByOrganizer(organizerId, page, limit, status);
    return paginatedResponse(result.data, result.total, result.page, result.limit);
  }

  async update(eventId: string, userId: string, dto: UpdateEventDto) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event', eventId);
    if (event.organizerId !== userId) throw new ForbiddenError('Access denied');

    const updateData: Prisma.EventUpdateInput = {
      title: dto.title,
      description: dto.description,
      venue: dto.venue,
      latitude: dto.latitude,
      longitude: dto.longitude,
      status: dto.status,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      ...(dto.settings ? { settings: dto.settings as Prisma.InputJsonValue } : {}),
      ...(dto.categoryId ? { category: { connect: { id: dto.categoryId } } } : {}),
    };
    const updated = await this.eventRepo.update(eventId, updateData);

    await getRedis().del(`event:${eventId}`);
    await auditService.log('UPDATE', 'Event', eventId, { userId }, { title: event.title }, dto as Record<string, unknown>);
    return updated;
  }

  async delete(eventId: string, userId: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event', eventId);
    if (event.organizerId !== userId) throw new ForbiddenError('Access denied');

    await this.eventRepo.softDelete(eventId);
    await getRedis().del(`event:${eventId}`);
    await auditService.log('DELETE', 'Event', eventId, { userId });
  }

  async uploadCover(eventId: string, userId: string, buffer: Buffer) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event', eventId);
    if (event.organizerId !== userId) throw new ForbiddenError('Access denied');

    const result = await cloudinaryService.uploadImage(buffer, `events/${eventId}`, 'cover');
    const updated = await this.eventRepo.update(eventId, { coverImageUrl: result.url });
    await getRedis().del(`event:${eventId}`);
    return updated;
  }

  async getCategories() {
    return this.categoryRepo.findAll();
  }

  async getSettings(eventId: string, userId: string) {
    const event = await this.findById(eventId, userId);
    return event.settings;
  }

  async updateSettings(eventId: string, userId: string, settings: Record<string, unknown>) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event', eventId);
    if (event.organizerId !== userId) throw new ForbiddenError('Access denied');

    const updated = await this.eventRepo.update(eventId, { settings: settings as Prisma.InputJsonValue });
    await getRedis().del(`event:${eventId}`);
    return updated.settings;
  }
}
