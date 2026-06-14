import { prisma } from '@/config/database';
import { WhatsAppMessage, MessageStatus, Prisma } from '@prisma/client';

export class WhatsAppMessageRepository {
  async findById(id: string): Promise<WhatsAppMessage | null> {
    return prisma.whatsAppMessage.findUnique({ where: { id }, include: { guest: true } });
  }

  async create(data: Prisma.WhatsAppMessageCreateInput): Promise<WhatsAppMessage> {
    return prisma.whatsAppMessage.create({ data });
  }

  async update(id: string, data: Prisma.WhatsAppMessageUpdateInput): Promise<WhatsAppMessage> {
    return prisma.whatsAppMessage.update({ where: { id }, data });
  }

  async findQueued(limit = 100): Promise<WhatsAppMessage[]> {
    return prisma.whatsAppMessage.findMany({
      where: { status: MessageStatus.QUEUED },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getDeliveryStats(eventId: string) {
    const messages = await prisma.whatsAppMessage.groupBy({
      by: ['status'],
      where: { guest: { eventId } },
      _count: { id: true },
    });
    return messages.map((m) => ({ status: m.status, count: m._count.id }));
  }

  async findByCampaign(campaignId: string): Promise<WhatsAppMessage[]> {
    return prisma.whatsAppMessage.findMany({
      where: { campaignId },
      include: { guest: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
