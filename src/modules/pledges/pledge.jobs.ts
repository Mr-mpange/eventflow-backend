import { getAutomationQueue } from '@/queues/automation.queue';

export async function enqueuePledgeReminder(pledgeId: string, promisedDate: Date) {
  const delay = Math.max(promisedDate.getTime() - Date.now(), 1000);
  await getAutomationQueue().add('sendPledgeReminderJob', { pledgeId }, { delay, jobId: `pledge-reminder:${pledgeId}` });
}
