import { prisma } from '@/config/database';
import { Prisma } from '@prisma/client';

export class PaymentRepository {
  create(data: Prisma.PaymentCreateInput) {
    return prisma.payment.create({ data });
  }

  findById(id: string) {
    return prisma.payment.findUnique({ where: { id }, include: { guest: true, event: true } });
  }

  findByInternalReference(internalReference: string) {
    return prisma.payment.findUnique({ where: { internalReference }, include: { guest: true, event: true } });
  }

  findByProviderReference(providerReference: string) {
    return prisma.payment.findFirst({
      where: { providerReference },
      include: { guest: true, event: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  listByEvent(eventId: string) {
    return prisma.payment.findMany({
      where: { eventId },
      include: { guest: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: string, data: Prisma.PaymentUpdateInput) {
    return prisma.payment.update({ where: { id }, data });
  }

  aggregateForEvent(eventId: string) {
    return prisma.payment.aggregate({
      where: { eventId, status: 'PAID' },
      _sum: { amount: true },
      _count: { id: true },
    });
  }
}
