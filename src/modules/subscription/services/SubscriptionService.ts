import { SubscriptionRepository } from '../repositories/SubscriptionRepository';
import { InvoiceRepository } from '../repositories/InvoiceRepository';
import { OrganizationRepository } from '@modules/user/repositories/OrganizationRepository';
import { UserRepository } from '@modules/auth/repositories/UserRepository';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';
import { subscriptionPlans } from '@/config';
import { auditService } from '@/shared/services/AuditService';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import type { UpgradePlanDto } from '../validators/subscription.validator';

export class SubscriptionService {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly invoiceRepo: InvoiceRepository,
    private readonly orgRepo: OrganizationRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async getSubscription(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user?.organizationId) {
      return { plan: 'FREE', status: 'ACTIVE', limits: subscriptionPlans.FREE };
    }

    let subscription = await this.subscriptionRepo.findByOrganization(user.organizationId);
    if (!subscription) {
      subscription = await this.subscriptionRepo.create({
        organization: { connect: { id: user.organizationId } },
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
      });
    }

    const limits = subscriptionPlans[subscription.plan];
    return { ...subscription, limits };
  }

  async upgradePlan(userId: string, dto: UpgradePlanDto) {
    const user = await this.userRepo.findById(userId);
    if (!user?.organizationId) {
      throw new ValidationError('Create an organization before upgrading');
    }

    let subscription = await this.subscriptionRepo.findByOrganization(user.organizationId);
    if (!subscription) {
      subscription = await this.subscriptionRepo.create({
        organization: { connect: { id: user.organizationId } },
        plan: dto.plan as SubscriptionPlan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    } else {
      subscription = await this.subscriptionRepo.upgrade(subscription.id, dto.plan as SubscriptionPlan);
    }

    const planConfig = subscriptionPlans[dto.plan as keyof typeof subscriptionPlans];
    if (planConfig.price > 0) {
      await this.invoiceRepo.create({
        subscription: { connect: { id: subscription.id } },
        amount: planConfig.price,
        currency: 'USD',
        status: 'OPEN',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    await auditService.log('UPDATE', 'Subscription', subscription.id, { userId }, undefined, { plan: dto.plan });
    return subscription;
  }

  async getInvoices(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user?.organizationId) return [];

    const subscription = await this.subscriptionRepo.findByOrganization(user.organizationId);
    if (!subscription) return [];

    return this.invoiceRepo.findBySubscription(subscription.id);
  }

  async getPlans() {
    return Object.entries(subscriptionPlans).map(([key, plan]) => ({
      id: key,
      ...plan,
    }));
  }
}
