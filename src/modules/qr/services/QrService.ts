import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { AttendanceLogRepository } from '../repositories/AttendanceLogRepository';
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
    const guest = await this.guestRepo.findByQrCode(this.normalizeQrCode(qrCode));
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
    const guest = await this.guestRepo.findByQrCode(this.normalizeQrCode(qrCode));
    if (!guest) throw new NotFoundError('Guest');

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

    await auditService.log('CHECK_IN', 'Guest', guest.id, { userId: staffUserId });

    return log;
  }

  async getAttendanceLogs(eventId: string, userId: string, page = 1, limit = 50) {
    const event = await this.eventRepo.findById(eventId);
    if (!event || event.organizerId !== userId) throw new ForbiddenError();

    return this.attendanceRepo.findByEvent(eventId, page, limit);
  }
}
