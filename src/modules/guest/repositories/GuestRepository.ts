import { prisma } from '@/config/database';
import { Guest, Prisma, RsvpStatus } from '@prisma/client';
import { paginate } from '@/shared/utils/helpers';

export class GuestRepository {
  async findById(id: string): Promise<Guest | null> {
    return prisma.guest.findFirst({
      where: { id, deletedAt: null },
      include: { group: true },
    });
  }

  async findByQrCode(qrCode: string): Promise<Guest | null> {
    return prisma.guest.findFirst({
      where: { qrCode, deletedAt: null },
      include: { event: true, group: true },
    });
  }

  async findByEvent(eventId: string, page = 1, limit = 50, search?: string, groupId?: string, rsvpStatus?: RsvpStatus) {
    const { skip, take } = paginate(page, limit);
    const where: Prisma.GuestWhereInput = {
      eventId,
      deletedAt: null,
      ...(groupId ? { groupId } : {}),
      ...(rsvpStatus ? { rsvpStatus } : {}),
      ...(search ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.guest.findMany({ where, skip, take, orderBy: { fullName: 'asc' }, include: { group: true } }),
      prisma.guest.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async create(data: Prisma.GuestCreateInput): Promise<Guest> {
    return prisma.guest.create({ data, include: { group: true } });
  }

  async createMany(data: Prisma.GuestCreateManyInput[]): Promise<number> {
    const result = await prisma.guest.createMany({ data, skipDuplicates: true });
    return result.count;
  }

  async update(id: string, data: Prisma.GuestUpdateInput): Promise<Guest> {
    return prisma.guest.update({ where: { id }, data, include: { group: true } });
  }

  async softDelete(id: string): Promise<Guest> {
    return prisma.guest.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findAllForExport(eventId: string): Promise<Guest[]> {
    return prisma.guest.findMany({
      where: { eventId, deletedAt: null },
      include: { group: true },
      orderBy: { fullName: 'asc' },
    });
  }
}
