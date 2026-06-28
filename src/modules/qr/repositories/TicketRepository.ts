import { prisma } from '@/config/database';
import { Prisma } from '@prisma/client';

export class TicketRepository {
  findByGuest(eventId: string, guestId: string) {
    return prisma.ticket.findUnique({
      where: { eventId_guestId: { eventId, guestId } },
    });
  }

  findByToken(ticketToken: string) {
    return prisma.ticket.findUnique({
      where: { ticketToken },
      include: {
        guest: true,
        event: true,
      },
    });
  }

  create(data: Prisma.TicketCreateInput) {
    return prisma.ticket.create({ data });
  }

  update(id: string, data: Prisma.TicketUpdateInput) {
    return prisma.ticket.update({ where: { id }, data });
  }
}
