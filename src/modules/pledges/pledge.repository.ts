import { prisma } from '@/config/database';
import { Prisma, PledgeStatus } from '@prisma/client';

export class PledgeRepository {
  create(data: Prisma.PledgeCreateInput) {
    return prisma.pledge.create({ data });
  }

  listByEvent(eventId: string) {
    return prisma.pledge.findMany({
      where: { eventId },
      include: { guest: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { promisedDate: 'asc' },
    });
  }

  findById(id: string) {
    return prisma.pledge.findUnique({ where: { id }, include: { guest: true, event: true } });
  }

  update(id: string, data: Prisma.PledgeUpdateInput) {
    return prisma.pledge.update({ where: { id }, data });
  }

  findReminderCandidates(before: Date) {
    return prisma.pledge.findMany({
      where: {
        status: PledgeStatus.ACTIVE,
        promisedDate: { lte: before },
        reminderSent: false,
      },
      include: { guest: true, event: true },
    });
  }

  aggregateForEvent(eventId: string) {
    return prisma.pledge.groupBy({
      by: ['status'],
      where: { eventId },
      _count: { id: true },
      _sum: { amount: true },
    });
  }
}
