import { prisma } from '@/config/database';
import { ContributionStatus, Prisma } from '@prisma/client';

export class ContributionRepository {
  findByGuest(eventId: string, guestId: string) {
    return prisma.guestContribution.findUnique({
      where: { eventId_guestId: { eventId, guestId } },
    });
  }

  create(data: Prisma.GuestContributionCreateInput) {
    return prisma.guestContribution.create({ data });
  }

  update(eventId: string, guestId: string, data: Prisma.GuestContributionUpdateInput) {
    return prisma.guestContribution.update({
      where: { eventId_guestId: { eventId, guestId } },
      data,
    });
  }

  listByEvent(eventId: string) {
    return prisma.guestContribution.findMany({
      where: { eventId },
      include: {
        guest: {
          select: { id: true, fullName: true, phone: true, rsvpStatus: true, isCheckedIn: true },
        },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  getStats(eventId: string) {
    return prisma.guestContribution.groupBy({
      by: ['status'],
      where: { eventId },
      _count: { id: true },
      _sum: { requiredAmount: true, paidAmount: true, remainingAmount: true },
    });
  }

  countByStatus(eventId: string, status: ContributionStatus) {
    return prisma.guestContribution.count({ where: { eventId, status } });
  }
}
