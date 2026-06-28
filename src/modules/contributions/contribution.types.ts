import { ContributionStatus, GuestContribution } from '@prisma/client';

export interface ContributionBalance {
  guestId: string;
  eventId: string;
  requiredAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: ContributionStatus;
  completedAt: Date | null;
}

export interface UpdateContributionInput {
  requiredAmount?: number;
  paidAmount?: number;
  status?: ContributionStatus;
}

export function mapContribution(record: GuestContribution): ContributionBalance {
  return {
    guestId: record.guestId,
    eventId: record.eventId,
    requiredAmount: Number(record.requiredAmount),
    paidAmount: Number(record.paidAmount),
    remainingAmount: Number(record.remainingAmount),
    status: record.status,
    completedAt: record.completedAt,
  };
}
