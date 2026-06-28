import { Pledge, PledgeStatus } from '@prisma/client';

export interface CreatePledgeInput {
  eventId: string;
  guestId: string;
  amount: number;
  promisedDate: string;
  notes?: string;
}

export interface UpdatePledgeStatusInput {
  status: PledgeStatus;
}

export function mapPledge(record: Pledge) {
  return {
    ...record,
    amount: Number(record.amount),
  };
}
