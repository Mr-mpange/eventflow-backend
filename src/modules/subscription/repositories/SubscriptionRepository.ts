import { prisma } from '@/config/database';
import { Subscription, SubscriptionPlan, SubscriptionStatus, Prisma } from '@prisma/client';

export class SubscriptionRepository {
  async findByOrganization(organizationId: string): Promise<Subscription | null> {
    return prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { invoices: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
  }

  async findById(id: string): Promise<Subscription | null> {
    return prisma.subscription.findUnique({
      where: { id },
      include: { invoices: true },
    });
  }

  async create(data: Prisma.SubscriptionCreateInput): Promise<Subscription> {
    return prisma.subscription.create({ data });
  }

  async update(id: string, data: Prisma.SubscriptionUpdateInput): Promise<Subscription> {
    return prisma.subscription.update({ where: { id }, data });
  }

  async upgrade(id: string, plan: SubscriptionPlan): Promise<Subscription> {
    return prisma.subscription.update({
      where: { id },
      data: {
        plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }
}
