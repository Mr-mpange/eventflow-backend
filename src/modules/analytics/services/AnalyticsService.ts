import { EventRepository } from '@modules/event/repositories/EventRepository';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { WhatsAppMessageRepository } from '@modules/whatsapp/repositories/WhatsAppMessageRepository';
import { AttendanceLogRepository } from '@modules/qr/repositories/AttendanceLogRepository';
import { NotFoundError, ForbiddenError } from '@/shared/errors/AppError';
import { getRedis, CACHE_TTL } from '@/config/redis';

export class AnalyticsService {
  constructor(
    private readonly eventRepo: EventRepository,
    private readonly guestRepo: GuestRepository,
    private readonly messageRepo: WhatsAppMessageRepository,
    private readonly attendanceRepo: AttendanceLogRepository,
  ) {}

  private async assertAccess(eventId: string, userId: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event', eventId);
    if (event.organizerId !== userId) throw new ForbiddenError();
    return event;
  }

  async getEventAnalytics(eventId: string, userId: string) {
    const cacheKey = `analytics:event:${eventId}`;
    const redis = getRedis();
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    await this.assertAccess(eventId, userId);

    const [eventStats, messageStats, attendance] = await Promise.all([
      this.eventRepo.getStats(eventId),
      this.messageRepo.getDeliveryStats(eventId),
      this.attendanceRepo.findByEvent(eventId, 1, 1000),
    ]);

    const analytics = {
      rsvp: {
        total: eventStats.guestCount,
        accepted: eventStats.rsvpAccepted,
        declined: eventStats.rsvpDeclined,
        maybe: eventStats.rsvpMaybe,
        pending: eventStats.rsvpPending,
        responseRate: eventStats.guestCount > 0
          ? Math.round(((eventStats.guestCount - eventStats.rsvpPending) / eventStats.guestCount) * 100)
          : 0,
      },
      attendance: {
        checkedIn: eventStats.checkedIn,
        totalGuests: eventStats.guestCount,
        checkInRate: eventStats.guestCount > 0
          ? Math.round((eventStats.checkedIn / eventStats.guestCount) * 100)
          : 0,
        recentCheckIns: attendance.data.slice(0, 10),
      },
      messages: messageStats,
    };

    await redis.setex(cacheKey, CACHE_TTL.ANALYTICS, JSON.stringify(analytics));
    return analytics;
  }

  async getRsvpStatistics(eventId: string, userId: string) {
    await this.assertAccess(eventId, userId);
    return this.eventRepo.getStats(eventId);
  }

  async getAttendanceStatistics(eventId: string, userId: string) {
    await this.assertAccess(eventId, userId);
    const stats = await this.eventRepo.getStats(eventId);
    const logs = await this.attendanceRepo.findByEvent(eventId, 1, 100);
    return { ...stats, logs: logs.data };
  }

  async getMessageStatistics(eventId: string, userId: string) {
    await this.assertAccess(eventId, userId);
    return this.messageRepo.getDeliveryStats(eventId);
  }
}
