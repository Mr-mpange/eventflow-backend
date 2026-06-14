import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { GuestRepository } from '../repositories/GuestRepository';
import { GuestGroupRepository } from '../repositories/GuestGroupRepository';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { NotFoundError, ForbiddenError } from '@/shared/errors/AppError';
import { auditService } from '@/shared/services/AuditService';
import { paginatedResponse } from '@/shared/utils/helpers';
import { cloudinaryService } from '@/infrastructure/storage/CloudinaryService';
import type { CreateGuestDto, UpdateGuestDto } from '../validators/guest.validator';
import { RsvpStatus } from '@prisma/client';

export class GuestService {
  constructor(
    private readonly guestRepo: GuestRepository,
    private readonly groupRepo: GuestGroupRepository,
    private readonly eventRepo: EventRepository,
  ) {}

  private async assertEventAccess(eventId: string, userId: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event', eventId);
    if (event.organizerId !== userId) throw new ForbiddenError('Access denied');
    return event;
  }

  private async generateQrForGuest(guestId: string, eventId: string) {
    const qrCode = uuidv4();
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify({ guestId, eventId, qrCode }));
    const buffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    const upload = await cloudinaryService.uploadImage(buffer, `qr/${eventId}`, guestId);
    return { qrCode, qrCodeUrl: upload.url };
  }

  async create(userId: string, dto: CreateGuestDto) {
    await this.assertEventAccess(dto.eventId, userId);
    const guest = await this.guestRepo.create({
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email || null,
      plusOnes: dto.plusOnes,
      event: { connect: { id: dto.eventId } },
      ...(dto.groupId ? { group: { connect: { id: dto.groupId } } } : {}),
    });

    const qr = await this.generateQrForGuest(guest.id, dto.eventId);
    const updated = await this.guestRepo.update(guest.id, qr);

    await auditService.log('CREATE', 'Guest', guest.id, { userId });
    return updated;
  }

  async list(eventId: string, userId: string, page: number, limit: number, search?: string, groupId?: string, rsvpStatus?: RsvpStatus) {
    await this.assertEventAccess(eventId, userId);
    const result = await this.guestRepo.findByEvent(eventId, page, limit, search, groupId, rsvpStatus);
    return paginatedResponse(result.data, result.total, result.page, result.limit);
  }

  async update(guestId: string, userId: string, dto: UpdateGuestDto) {
    const guest = await this.guestRepo.findById(guestId);
    if (!guest) throw new NotFoundError('Guest', guestId);
    await this.assertEventAccess(guest.eventId, userId);
    return this.guestRepo.update(guestId, {
      ...dto,
      email: dto.email || null,
      ...(dto.groupId ? { group: { connect: { id: dto.groupId } } } : {}),
    });
  }

  async delete(guestId: string, userId: string) {
    const guest = await this.guestRepo.findById(guestId);
    if (!guest) throw new NotFoundError('Guest', guestId);
    await this.assertEventAccess(guest.eventId, userId);
    await this.guestRepo.softDelete(guestId);
    await auditService.log('DELETE', 'Guest', guestId, { userId });
  }

  async importCsv(eventId: string, userId: string, rows: Array<{ fullName: string; phone?: string; email?: string; group?: string }>) {
    await this.assertEventAccess(eventId, userId);
    const groups = await this.groupRepo.findByEvent(eventId);
    const groupMap = new Map(groups.map((g) => [g.name.toLowerCase(), g.id]));

    const guestsData = rows.map((row) => ({
      eventId,
      fullName: row.fullName,
      phone: row.phone,
      email: row.email || null,
      groupId: row.group ? groupMap.get(row.group.toLowerCase()) : undefined,
      qrCode: uuidv4(),
    }));

    const count = await this.guestRepo.createMany(guestsData);
    await auditService.log('IMPORT', 'Guest', eventId, { userId }, undefined, { count });
    return { imported: count };
  }

  async exportCsv(eventId: string, userId: string) {
    await this.assertEventAccess(eventId, userId);
    const guests = await this.guestRepo.findAllForExport(eventId);
    const headers = ['Full Name', 'Phone', 'Email', 'Group', 'RSVP Status', 'Checked In', 'Plus Ones'];
    const rows = guests.map((g) => [
      g.fullName,
      g.phone ?? '',
      g.email ?? '',
      g.groupId ?? '',
      g.rsvpStatus,
      g.isCheckedIn ? 'Yes' : 'No',
      String(g.plusOnes),
    ]);

    await auditService.log('EXPORT', 'Guest', eventId, { userId });
    return { headers, rows };
  }

  async createGroup(userId: string, eventId: string, name: string, color?: string) {
    await this.assertEventAccess(eventId, userId);
    return this.groupRepo.create({ eventId, name, color });
  }

  async listGroups(eventId: string, userId: string) {
    await this.assertEventAccess(eventId, userId);
    return this.groupRepo.findByEvent(eventId);
  }
}
