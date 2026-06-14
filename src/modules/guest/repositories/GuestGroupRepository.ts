import { prisma } from '@/config/database';
import { GuestGroup } from '@prisma/client';

export class GuestGroupRepository {
  async findByEvent(eventId: string): Promise<GuestGroup[]> {
    return prisma.guestGroup.findMany({
      where: { eventId, deletedAt: null },
      include: { _count: { select: { guests: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<GuestGroup | null> {
    return prisma.guestGroup.findFirst({ where: { id, deletedAt: null } });
  }

  async create(data: { eventId: string; name: string; color?: string }): Promise<GuestGroup> {
    return prisma.guestGroup.create({ data });
  }

  async update(id: string, data: { name?: string; color?: string }): Promise<GuestGroup> {
    return prisma.guestGroup.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<GuestGroup> {
    return prisma.guestGroup.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
