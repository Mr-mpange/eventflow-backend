import { prisma } from '@/config/database';
import { WhatsAppTemplate, Prisma } from '@prisma/client';

export class WhatsAppTemplateRepository {
  async findAll(): Promise<WhatsAppTemplate[]> {
    return prisma.whatsAppTemplate.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<WhatsAppTemplate | null> {
    return prisma.whatsAppTemplate.findFirst({ where: { id, deletedAt: null } });
  }

  async create(data: { name: string; language?: string; category?: string; content: Record<string, unknown> }): Promise<WhatsAppTemplate> {
    return prisma.whatsAppTemplate.create({ data: { ...data, content: data.content as Prisma.InputJsonValue } });
  }
}
