import { ForbiddenError, NotFoundError } from '@/shared/errors/AppError';
import { auditService } from '@/shared/services/AuditService';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { PledgeStatus } from '@prisma/client';
import { enqueuePledgeReminder } from './pledge.jobs';
import { PledgeRepository } from './pledge.repository';
import { CreatePledgeInput, mapPledge } from './pledge.types';

export class PledgeService {
  constructor(
    private readonly pledgeRepo: PledgeRepository,
    private readonly eventRepo: EventRepository,
    private readonly guestRepo: GuestRepository,
  ) {}

  private async assertEventAccess(eventId: string, userId: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event', eventId);
    if (event.organizerId !== userId) throw new ForbiddenError();
    return event;
  }

  async create(userId: string, input: CreatePledgeInput) {
    const [event, guest] = await Promise.all([
      this.assertEventAccess(input.eventId, userId),
      this.guestRepo.findById(input.guestId),
    ]);

    if (!guest || guest.eventId !== input.eventId) throw new NotFoundError('Guest', input.guestId);

    const pledge = await this.pledgeRepo.create({
      event: { connect: { id: input.eventId } },
      guest: { connect: { id: input.guestId } },
      amount: input.amount,
      promisedDate: new Date(input.promisedDate),
      notes: input.notes,
    });

    await enqueuePledgeReminder(pledge.id, new Date(input.promisedDate));
    await auditService.log('CREATE', 'Pledge', pledge.id, { userId }, undefined, {
      amount: input.amount,
      promisedDate: input.promisedDate,
    });

    return mapPledge(pledge);
  }

  async listByEvent(eventId: string, userId: string) {
    await this.assertEventAccess(eventId, userId);
    const pledges = await this.pledgeRepo.listByEvent(eventId);
    return pledges.map(mapPledge);
  }

  async updateStatus(id: string, userId: string, status: PledgeStatus) {
    const pledge = await this.pledgeRepo.findById(id);
    if (!pledge) throw new NotFoundError('Pledge', id);
    await this.assertEventAccess(pledge.eventId, userId);

    const updated = await this.pledgeRepo.update(id, { status, reminderSent: status !== PledgeStatus.ACTIVE });
    await auditService.log('UPDATE', 'Pledge', id, { userId }, { status: pledge.status }, { status });
    return mapPledge(updated);
  }

  async markCompletedForGuest(eventId: string, guestId: string) {
    const pledges = await this.pledgeRepo.listByEvent(eventId);
    const active = pledges.filter((pledge) => pledge.guestId === guestId && pledge.status === PledgeStatus.ACTIVE);
    await Promise.all(active.map((pledge) => this.pledgeRepo.update(pledge.id, { status: PledgeStatus.PAID, reminderSent: true })));
  }
}
