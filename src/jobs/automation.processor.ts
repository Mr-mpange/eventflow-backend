import { Job, Worker } from 'bullmq';
import { redisConnection } from '@/config/redis';
import { AUTOMATION_QUEUE_NAME } from '@/queues/automation.queue';
import { analyticsService, cardService, paymentService, pledgeRepository, ticketService } from '@/shared/container';
import { briqSmsService } from '@/infrastructure/sms/BriqSmsService';
import { ghalaRailsService } from '@/infrastructure/whatsapp/GhalaRailsService';
import { prisma } from '@/config/database';
import { PledgeStatus } from '@prisma/client';

async function processJob(job: Job) {
  switch (job.name) {
    case 'sendBulkInvitationsJob':
      for (const guestId of job.data.guestIds as string[]) {
        await cardService.sendInvitationCard(job.data.eventId, guestId, job.data.contributionAmount);
      }
      return;
    case 'sendInvitationCardJob':
      await cardService.sendInvitationCard(job.data.eventId, job.data.guestId, job.data.contributionAmount);
      return;
    case 'sendPaymentReminderJob':
    case 'sendUnpaidGuestFollowupJob': {
      const balance = await prisma.guestContribution.findUnique({
        where: { eventId_guestId: { eventId: job.data.eventId, guestId: job.data.guestId } },
        include: { guest: true, event: true },
      });
      if (!balance?.guest.phone) return;
      await ghalaRailsService.sendMessage({
        to: balance.guest.phone,
        message: `Reminder: your remaining balance for ${balance.event.title} is TZS ${Number(balance.remainingAmount).toLocaleString()}.`,
      });
      return;
    }
    case 'sendPledgeReminderJob': {
      const pledge = await pledgeRepository.findById(job.data.pledgeId);
      if (!pledge || !pledge.guest.phone) return;
      if (pledge.status !== PledgeStatus.ACTIVE) return;
      const message = `Reminder: you promised to pay TZS ${Number(pledge.amount).toLocaleString()} for ${pledge.event.title}.`;
      const wa = await ghalaRailsService.sendMessage({ to: pledge.guest.phone, message });
      if (wa.status === 'failed') {
        await briqSmsService.sendMessage({ to: pledge.guest.phone, message });
      }
      await pledgeRepository.update(pledge.id, {
        reminderSent: true,
        status: pledge.promisedDate < new Date() ? PledgeStatus.MISSED : pledge.status,
      });
      return;
    }
    case 'sendTicketAfterPaymentJob':
      await ticketService.issueTicket(job.data.eventId, job.data.guestId);
      return;
    case 'syncPaymentStatusJob':
      await paymentService.getStatus(job.data.paymentId);
      return;
    case 'generateEventAnalyticsJob':
      await analyticsService.getEventAnalytics(job.data.eventId, job.data.userId);
      return;
    default:
      throw new Error(`Unknown automation job: ${job.name}`);
  }
}

export function createAutomationWorker(): Worker {
  return new Worker(AUTOMATION_QUEUE_NAME, processJob, {
    connection: redisConnection,
    concurrency: 5,
  });
}
