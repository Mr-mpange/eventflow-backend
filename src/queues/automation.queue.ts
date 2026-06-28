import { Queue } from 'bullmq';
import { redisConnection } from '@/config/redis';

export const AUTOMATION_QUEUE_NAME = 'eventflow-automation';

let queue: Queue | null = null;

export function getAutomationQueue(): Queue {
  if (!queue) {
    queue = new Queue(AUTOMATION_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }

  return queue;
}
