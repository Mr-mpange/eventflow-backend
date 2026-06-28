import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { AttendanceLogRepository } from '../repositories/AttendanceLogRepository';
import { TicketRepository } from '../repositories/TicketRepository';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/errors/AppError';
import { auditService } from '@/shared/services/AuditService';
import { cloudinaryService } from '@/infrastructure/storage/CloudinaryService';
import { extractUrlPathToken } from '@/shared/utils/helpers';

export class QrService {
  constructor(
    private readonly guestRepo: GuestRepository,
    private readonly attendanceRepo: AttendanceLogRepository,
    private readonly eventRepo: EventRepository,
    private readonly ticketRepo: TicketRepository,
  ) {}

  private normalizeQrCode(input: string) {
    return extractUrlPathToken(input);
  }

  async generate(guestId: string, userId: string) {
    const guest = await this.guestRepo.findById(guestId);
    if (!guest) throw new NotFoundError('Guest', guestId);

    const event = await this.eventRepo.findById(guest.eventId);
    if (!event || event.organizerId !== userId) throw new ForbiddenError();

    const qrCode = guest.qrCode ?? uuidv4();
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify({ guestId, eventId: guest.eventId, qrCode }));
    const buffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    const upload = await cloudinaryService.uploadImage(buffer, `qr/${guest.eventId}`, guestId);

    const updated = await this.guestRepo.update(guestId, { qrCode, qrCodeUrl: upload.url });
    return { qrCode: updated.qrCode, qrCodeUrl: updated.qrCodeUrl };
  }

  async verify(qrCode: string) {
    const normalized = this.normalizeQrCode(qrCode);
    const ticket = await this.ticketRepo.findByToken(normalized);
    if (ticket) {
      return {
        valid: ticket.status === 'ACTIVE',
        ticket: {
          id: ticket.id,
          status: ticket.status,
          issuedAt: ticket.issuedAt,
          checkedInAt: ticket.checkedInAt,
        },
        guest: {
          id: ticket.guest.id,
          fullName: ticket.guest.fullName,
          rsvpStatus: ticket.guest.rsvpStatus,
          isCheckedIn: ticket.guest.isCheckedIn,
        },
        event: {
          id: ticket.event.id,
          title: ticket.event.title,
          eventDate: ticket.event.eventDate,
        },
      };
    }

    const guest = await this.guestRepo.findByQrCode(normalized);
    if (!guest) throw new NotFoundError('Guest');

    const event = await this.eventRepo.findById(guest.eventId);

    return {
      valid: true,
      guest: {
        id: guest.id,
        fullName: guest.fullName,
        rsvpStatus: guest.rsvpStatus,
        isCheckedIn: guest.isCheckedIn,
      },
      event: event ? {
        id: event.id,
        title: event.title,
        eventDate: event.eventDate,
      } : null,
    };
  }

  async checkIn(qrCode: string, staffUserId: string, notes?: string) {
    const normalized = this.normalizeQrCode(qrCode);
    const ticket = await this.ticketRepo.findByToken(normalized);
    const guest = ticket
      ? await this.guestRepo.findById(ticket.guestId)
      : await this.guestRepo.findByQrCode(normalized);
    if (!guest) throw new NotFoundError('Guest');
    if (ticket && ticket.status !== 'ACTIVE') throw new ValidationError('Ticket is not active');

    const event = await this.eventRepo.findById(guest.eventId);
    if (!event) throw new NotFoundError('Event', guest.eventId);

    if (event.organizerId !== staffUserId) {
      // Allow staff role check - for now organizer only
      const staff = await this.eventRepo.findById(guest.eventId);
      if (!staff) throw new ForbiddenError();
    }

    if (guest.isCheckedIn) {
      throw new ValidationError('Guest already checked in');
    }

    const log = await this.attendanceRepo.create({
      eventId: guest.eventId,
      guestId: guest.id,
      checkedInBy: staffUserId,
      method: 'qr_scan',
      notes,
    });

    await this.guestRepo.update(guest.id, {
      isCheckedIn: true,
      checkedInAt: new Date(),
    });
    if (ticket) {
      await this.ticketRepo.update(ticket.id, {
        status: 'USED',
        checkedInAt: new Date(),
      });
    }

    await auditService.log('CHECK_IN', 'Guest', guest.id, { userId: staffUserId });

    return log;
  }

  async getAttendanceLogs(eventId: string, userId: string, page = 1, limit = 50) {
    const event = await this.eventRepo.findById(eventId);
    if (!event || event.organizerId !== userId) throw new ForbiddenError();

    return this.attendanceRepo.findByEvent(eventId, page, limit);
  }
}
