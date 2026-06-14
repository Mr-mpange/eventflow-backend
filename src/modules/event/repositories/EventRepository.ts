import { prisma } from '@/config/database';
import { Event, Prisma, EventStatus } from '@prisma/client';
import { paginate } from '@/shared/utils/helpers';

export class EventRepository {
  async findById(id: string): Promise<Event | null> {
    return prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, organizer: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async findByOrganizer(organizerId: string, page = 1, limit = 20, status?: EventStatus) {
    const { skip, take } = paginate(page, limit);
    const where: Prisma.EventWhereInput = {
      organizerId,
      deletedAt: null,
      ...(status ? { status } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take,
        orderBy: { eventDate: 'asc' },
        include: { category: true },
      }),
      prisma.event.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async create(data: Prisma.EventCreateInput): Promise<Event> {
    return prisma.event.create({ data, include: { category: true } });
  }

  async update(id: string, data: Prisma.EventUpdateInput): Promise<Event> {
    return prisma.event.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  async softDelete(id: string): Promise<Event> {
    return prisma.event.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async countByOrganizer(organizerId: string): Promise<number> {
    return prisma.event.count({ where: { organizerId, deletedAt: null } });
  }

  async getStats(eventId: string) {
    const [guestCount, checkedIn, rsvpAccepted, rsvpDeclined, rsvpMaybe, rsvpPending] = await Promise.all([
      prisma.guest.count({ where: { eventId, deletedAt: null } }),
      prisma.guest.count({ where: { eventId, isCheckedIn: true, deletedAt: null } }),
      prisma.guest.count({ where: { eventId, rsvpStatus: 'ACCEPTED', deletedAt: null } }),
      prisma.guest.count({ where: { eventId, rsvpStatus: 'DECLINED', deletedAt: null } }),
      prisma.guest.count({ where: { eventId, rsvpStatus: 'MAYBE', deletedAt: null } }),
      prisma.guest.count({ where: { eventId, rsvpStatus: 'PENDING', deletedAt: null } }),
    ]);

    return { guestCount, checkedIn, rsvpAccepted, rsvpDeclined, rsvpMaybe, rsvpPending };
  }
}
