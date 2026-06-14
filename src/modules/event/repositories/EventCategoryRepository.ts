import { prisma } from '@/config/database';
import { EventCategory } from '@prisma/client';

export class EventCategoryRepository {
  async findAll(): Promise<EventCategory[]> {
    return prisma.eventCategory.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<EventCategory | null> {
    return prisma.eventCategory.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async create(data: { name: string; description?: string; icon?: string }): Promise<EventCategory> {
    const slug = data.name.toLowerCase().replace(/\s+/g, '-');
    return prisma.eventCategory.create({
      data: { ...data, slug },
    });
  }
}
