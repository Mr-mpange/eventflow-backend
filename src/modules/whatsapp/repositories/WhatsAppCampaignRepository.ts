import { prisma } from '@/config/database';
import { WhatsAppCampaign, Prisma } from '@prisma/client';

export class WhatsAppCampaignRepository {
  async findById(id: string): Promise<WhatsAppCampaign | null> {
    return prisma.whatsAppCampaign.findFirst({
      where: { id, deletedAt: null },
      include: { messages: true, template: true },
    });
  }

  async findByEvent(eventId: string): Promise<WhatsAppCampaign[]> {
    return prisma.whatsAppCampaign.findMany({
      where: { eventId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.WhatsAppCampaignCreateInput): Promise<WhatsAppCampaign> {
    return prisma.whatsAppCampaign.create({ data });
  }

  async update(id: string, data: Prisma.WhatsAppCampaignUpdateInput): Promise<WhatsAppCampaign> {
    return prisma.whatsAppCampaign.update({ where: { id }, data });
  }

  async findScheduled(): Promise<WhatsAppCampaign[]> {
    return prisma.whatsAppCampaign.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: new Date() },
        deletedAt: null,
      },
    });
  }
}
