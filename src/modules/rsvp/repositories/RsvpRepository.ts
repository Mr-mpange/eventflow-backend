import { prisma } from '@/config/database';
import { RsvpResponse, RsvpStatus } from '@prisma/client';

export class RsvpRepository {
  async create(data: {
    guestId: string;
    status: RsvpStatus;
    note?: string;
    plusOnes?: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<RsvpResponse> {
    return prisma.rsvpResponse.create({ data });
  }

  async findByGuest(guestId: string): Promise<RsvpResponse[]> {
    return prisma.rsvpResponse.findMany({
      where: { guestId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAnalytics(eventId: string) {
    const guests = await prisma.guest.groupBy({
      by: ['rsvpStatus'],
      where: { eventId, deletedAt: null },
      _count: { id: true },
    });

    const total = guests.reduce((sum, g) => sum + g._count.id, 0);
    const breakdown = guests.map((g) => ({
      status: g.rsvpStatus,
      count: g._count.id,
      percentage: total > 0 ? Math.round((g._count.id / total) * 100) : 0,
    }));

    const recentResponses = await prisma.rsvpResponse.findMany({
      where: { guest: { eventId, deletedAt: null } },
      include: { guest: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return { total, breakdown, recentResponses };
  }
}
