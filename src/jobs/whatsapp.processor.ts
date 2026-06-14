import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/config/redis';
import { WHATSAPP_QUEUE_NAME } from '@/queues/whatsapp.queue';
import { ghalaRailsService } from '@/infrastructure/whatsapp/GhalaRailsService';
import { MessageStatus } from '@prisma/client';
import { prisma } from '@/config/database';

async function processSendMessage(messageId: string): Promise<void> {
  const message = await prisma.whatsAppMessage.findUnique({ where: { id: messageId } });
  if (!message || message.status !== MessageStatus.QUEUED) return;

  const result = await ghalaRailsService.sendMessage({
    to: message.phone,
    message: message.message,
  });

  if (result.status === 'failed') {
    await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data: {
        status: MessageStatus.FAILED,
        errorMessage: result.error,
        retryCount: { increment: 1 },
      },
    });
    throw new Error(result.error ?? 'Send failed');
  }

  await prisma.whatsAppMessage.update({
    where: { id: messageId },
    data: {
      status: MessageStatus.SENT,
      externalId: result.externalId,
      sentAt: new Date(),
    },
  });
}

async function processCampaign(campaignId: string, guestIds?: string[]): Promise<void> {
  const campaign = await prisma.whatsAppCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return;

  const guests = await prisma.guest.findMany({
    where: {
      eventId: campaign.eventId,
      deletedAt: null,
      phone: { not: null },
      ...(guestIds?.length ? { id: { in: guestIds } } : {}),
    },
  });

  for (const guest of guests) {
    const message = await prisma.whatsAppMessage.create({
      data: {
        campaignId,
        guestId: guest.id,
        phone: guest.phone!,
        message: campaign.message,
        status: MessageStatus.QUEUED,
      },
    });

    await processSendMessage(message.id);
  }

  await prisma.whatsAppCampaign.update({
    where: { id: campaignId },
    data: { status: 'sent', sentAt: new Date() },
  });
}

export function createWhatsAppWorker(): Worker {
  return new Worker(
    WHATSAPP_QUEUE_NAME,
    async (job: Job) => {
      switch (job.name) {
        case 'send-message':
          await processSendMessage(job.data.messageId);
          break;
        case 'process-campaign':
          await processCampaign(job.data.campaignId, job.data.guestIds);
          break;
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    { connection: redisConnection, concurrency: 5 },
  );
}
