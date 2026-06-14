import { prisma } from '@/config/database';
import { InvitationTemplate } from '@prisma/client';

export class InvitationTemplateRepository {
  async findAll(publicOnly = true): Promise<InvitationTemplate[]> {
    return prisma.invitationTemplate.findMany({
      where: { deletedAt: null, ...(publicOnly ? { isPublic: true } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<InvitationTemplate | null> {
    return prisma.invitationTemplate.findFirst({
      where: { id, deletedAt: null },
    });
  }
}
