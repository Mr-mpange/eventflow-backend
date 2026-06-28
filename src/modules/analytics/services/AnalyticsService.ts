import { EventRepository } from '@modules/event/repositories/EventRepository';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { WhatsAppMessageRepository } from '@modules/whatsapp/repositories/WhatsAppMessageRepository';
import { AttendanceLogRepository } from '@modules/qr/repositories/AttendanceLogRepository';
import { NotFoundError, ForbiddenError } from '@/shared/errors/AppError';
import { getRedis, CACHE_TTL } from '@/config/redis';
import { prisma } from '@/config/database';

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

  async getPaymentAnalytics(eventId: string, userId: string) {
    await this.assertAccess(eventId, userId);
    return this.getPaymentAnalyticsInternal(eventId);
  }

  async getPaymentAnalyticsInternal(eventId: string) {
    const [contributions, pledges, paidPayments, checkedInGuests, messageStats, agentConversations] = await Promise.all([
      prisma.guestContribution.findMany({ where: { eventId } }),
      prisma.pledge.findMany({ where: { eventId } }),
      prisma.payment.findMany({ where: { eventId, status: 'PAID' } }),
      prisma.guest.count({ where: { eventId, isCheckedIn: true, deletedAt: null } }),
      prisma.whatsAppMessage.findMany({ where: { guest: { eventId } } }),
      prisma.agentSession.count({ where: { eventId } }),
    ]);

    const targetAmount = contributions.reduce((sum, item) => sum + Number(item.requiredAmount), 0);
    const collectedAmount = contributions.reduce((sum, item) => sum + Number(item.paidAmount), 0);
    const remainingAmount = contributions.reduce((sum, item) => sum + Number(item.remainingAmount), 0);
    const fullyPaidGuests = contributions.filter((item) => item.status === 'COMPLETED' || item.status === 'WAIVED').length;
    const partialGuests = contributions.filter((item) => item.status === 'PARTIAL').length;
    const unpaidGuests = contributions.filter((item) => item.status === 'UNPAID').length;
    const promisedAmount = pledges
      .filter((item) => item.status === 'ACTIVE' || item.status === 'MISSED')
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const missedPledges = pledges.filter((item) => item.status === 'MISSED').length;
    const invitesSent = messageStats.length;
    const whatsappDelivered = messageStats.filter((item) => item.status === 'DELIVERED' || item.status === 'READ' || item.status === 'SENT').length;
    const smsFallbackSent = messageStats.filter((item) => item.errorMessage?.includes('sms_fallback')).length;
    const paymentSuccessRate = paidPayments.length > 0
      ? Math.round((paidPayments.length / Math.max(paidPayments.length + pledges.filter((item) => item.status === 'MISSED').length, 1)) * 100)
      : 0;

    return {
      targetAmount,
      collectedAmount,
      remainingAmount,
      fullyPaidGuests,
      partialGuests,
      unpaidGuests,
      promisedAmount,
      missedPledges,
      checkedInGuests,
      invitesSent,
      whatsappDelivered,
      smsFallbackSent,
      paymentSuccessRate,
      agentConversations,
    };
  }
}
