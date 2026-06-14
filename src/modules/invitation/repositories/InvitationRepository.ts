import { prisma } from '@/config/database';
import { Invitation, Prisma, InvitationStatus } from '@prisma/client';

export class InvitationRepository {
  async findById(id: string): Promise<Invitation | null> {
    return prisma.invitation.findFirst({
      where: { id, deletedAt: null },
      include: { template: true, event: true },
    });
  }

  async findByEvent(eventId: string): Promise<Invitation[]> {
    return prisma.invitation.findMany({
      where: { eventId, deletedAt: null },
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.InvitationCreateInput): Promise<Invitation> {
    return prisma.invitation.create({ data, include: { template: true } });
  }

  async update(id: string, data: Prisma.InvitationUpdateInput): Promise<Invitation> {
    return prisma.invitation.update({
      where: { id },
      data,
      include: { template: true },
    });
  }

  async softDelete(id: string): Promise<Invitation> {
    return prisma.invitation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async publish(id: string): Promise<Invitation> {
    return prisma.invitation.update({
      where: { id },
      data: { status: InvitationStatus.PUBLISHED, publishedAt: new Date() },
      include: { template: true },
    });
  }
}
