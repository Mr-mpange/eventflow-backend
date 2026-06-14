import { RsvpRepository } from '../repositories/RsvpRepository';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';
import type { RsvpResponseDto } from '../validators/rsvp.validator';
import { RsvpStatus } from '@prisma/client';

export class RsvpService {
  constructor(
    private readonly rsvpRepo: RsvpRepository,
    private readonly guestRepo: GuestRepository,
  ) {}

  async respond(dto: RsvpResponseDto, meta?: { ip?: string; userAgent?: string }) {
    const guest = await this.guestRepo.findByQrCode(dto.qrCode);
    if (!guest) throw new NotFoundError('Guest');

    const response = await this.rsvpRepo.create({
      guestId: guest.id,
      status: dto.status as RsvpStatus,
      note: dto.note,
      plusOnes: dto.plusOnes,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    await this.guestRepo.update(guest.id, {
      rsvpStatus: dto.status as RsvpStatus,
      rsvpNote: dto.note,
      rsvpAt: new Date(),
      plusOnes: dto.plusOnes,
    });

    return { guest: { fullName: guest.fullName }, response };
  }

  async accept(qrCode: string, note?: string, plusOnes = 0, meta?: { ip?: string; userAgent?: string }) {
    return this.respond({ qrCode, status: 'ACCEPTED', note, plusOnes }, meta);
  }

  async decline(qrCode: string, note?: string, meta?: { ip?: string; userAgent?: string }) {
    return this.respond({ qrCode, status: 'DECLINED', note, plusOnes: 0 }, meta);
  }

  async maybe(qrCode: string, note?: string, plusOnes = 0, meta?: { ip?: string; userAgent?: string }) {
    return this.respond({ qrCode, status: 'MAYBE', note, plusOnes }, meta);
  }

  async getAnalytics(eventId: string, userId: string) {
    // Public analytics endpoint validates via event ownership in controller layer
    return this.rsvpRepo.getAnalytics(eventId);
  }

  async getGuestHistory(guestId: string) {
    return this.rsvpRepo.findByGuest(guestId);
  }
}
