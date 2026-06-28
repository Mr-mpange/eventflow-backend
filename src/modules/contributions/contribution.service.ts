import { Prisma, ContributionStatus } from '@prisma/client';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { auditService } from '@/shared/services/AuditService';
import { ForbiddenError, NotFoundError } from '@/shared/errors/AppError';
import { ContributionRepository } from './contribution.repository';
import { mapContribution, UpdateContributionInput } from './contribution.types';

export interface ContributionTicketIssuer {
  issueTicket(eventId: string, guestId: string): Promise<unknown>;
}

export class ContributionService {
  constructor(
    private readonly contributionRepo: ContributionRepository,
    private readonly eventRepo: EventRepository,
    private readonly guestRepo: GuestRepository,
    private readonly ticketIssuer?: ContributionTicketIssuer,
  ) {}

  private async assertEventAccess(eventId: string, userId: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event', eventId);
    if (event.organizerId !== userId) throw new ForbiddenError();
    return event;
  }

  private extractContributionAmount(settings: Prisma.JsonValue | null | undefined): number {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return 0;
    const amount = (settings as Record<string, unknown>).contributionAmount;
    const numeric = Number(amount ?? 0);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  }

  private computeStatus(requiredAmount: number, paidAmount: number, explicitStatus?: ContributionStatus) {
    if (explicitStatus === ContributionStatus.WAIVED) {
      return {
        status: ContributionStatus.WAIVED,
        remainingAmount: 0,
        completedAt: new Date(),
      };
    }

    const remainingAmount = Math.max(requiredAmount - paidAmount, 0);
    if (remainingAmount <= 0 && requiredAmount > 0) {
      return {
        status: ContributionStatus.COMPLETED,
        remainingAmount: 0,
        completedAt: new Date(),
      };
    }
    if (paidAmount > 0) {
      return {
        status: ContributionStatus.PARTIAL,
        remainingAmount,
        completedAt: null,
      };
    }
    return {
      status: ContributionStatus.UNPAID,
      remainingAmount,
      completedAt: null,
    };
  }

  async ensureForGuest(eventId: string, guestId: string, requiredAmount?: number) {
    const [event, guest, existing] = await Promise.all([
      this.eventRepo.findById(eventId),
      this.guestRepo.findById(guestId),
      this.contributionRepo.findByGuest(eventId, guestId),
    ]);

    if (!event) throw new NotFoundError('Event', eventId);
    if (!guest) throw new NotFoundError('Guest', guestId);

    const targetAmount = requiredAmount ?? this.extractContributionAmount(event.settings as Prisma.JsonValue);
    if (existing) {
      if (requiredAmount === undefined || Number(existing.requiredAmount) === targetAmount) return existing;
      const computed = this.computeStatus(targetAmount, Number(existing.paidAmount), existing.status);
      return this.contributionRepo.update(eventId, guestId, {
        requiredAmount: targetAmount,
        remainingAmount: computed.remainingAmount,
        status: computed.status,
        completedAt: computed.completedAt,
      });
    }

    return this.contributionRepo.create({
      event: { connect: { id: eventId } },
      guest: { connect: { id: guestId } },
      requiredAmount: targetAmount,
      paidAmount: 0,
      remainingAmount: targetAmount,
      status: targetAmount > 0 ? ContributionStatus.UNPAID : ContributionStatus.COMPLETED,
      ...(targetAmount > 0 ? {} : { completedAt: new Date() }),
    });
  }

  async getBalance(eventId: string, guestId: string) {
    const balance = await this.ensureForGuest(eventId, guestId);
    return mapContribution(balance);
  }

  async listByEvent(eventId: string, userId: string) {
    await this.assertEventAccess(eventId, userId);
    return this.contributionRepo.listByEvent(eventId);
  }

  async applyPayment(eventId: string, guestId: string, amount: number, context?: { userId?: string }) {
    const balance = await this.ensureForGuest(eventId, guestId);
    const requiredAmount = Number(balance.requiredAmount);
    const paidAmount = Number(balance.paidAmount) + amount;
    const computed = this.computeStatus(requiredAmount, paidAmount);

    const updated = await this.contributionRepo.update(eventId, guestId, {
      paidAmount,
      remainingAmount: computed.remainingAmount,
      status: computed.status,
      completedAt: computed.completedAt,
    });

    await auditService.log(
      'UPDATE',
      'GuestContribution',
      updated.id,
      { userId: context?.userId },
      { paidAmount: Number(balance.paidAmount), status: balance.status },
      { paidAmount, status: computed.status, remainingAmount: computed.remainingAmount },
    );

    if (computed.status === ContributionStatus.COMPLETED && this.ticketIssuer) {
      await this.ticketIssuer.issueTicket(eventId, guestId);
    }

    return mapContribution(updated);
  }

  async updateContribution(eventId: string, guestId: string, userId: string, payload: UpdateContributionInput) {
    const current = await this.ensureForGuest(eventId, guestId);
    await this.assertEventAccess(eventId, userId);

    const requiredAmount = payload.requiredAmount ?? Number(current.requiredAmount);
    const paidAmount = payload.paidAmount ?? Number(current.paidAmount);
    const computed = this.computeStatus(requiredAmount, paidAmount, payload.status);

    const updated = await this.contributionRepo.update(eventId, guestId, {
      requiredAmount,
      paidAmount,
      remainingAmount: computed.remainingAmount,
      status: computed.status,
      completedAt: computed.completedAt,
    });

    await auditService.log(
      'UPDATE',
      'GuestContribution',
      updated.id,
      { userId },
      { requiredAmount: Number(current.requiredAmount), paidAmount: Number(current.paidAmount), status: current.status },
      { requiredAmount, paidAmount, status: computed.status, remainingAmount: computed.remainingAmount },
    );

    if ((computed.status === ContributionStatus.COMPLETED || computed.status === ContributionStatus.WAIVED) && this.ticketIssuer) {
      await this.ticketIssuer.issueTicket(eventId, guestId);
    }

    return mapContribution(updated);
  }
}
