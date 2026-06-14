import { Queue } from 'bullmq';
import { redisConnection } from '@/config/redis';

export const WHATSAPP_QUEUE_NAME = 'whatsapp-messages';

let _queue: Queue | null = null;

export function getWhatsAppQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(WHATSAPP_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return _queue;
}

/** @deprecated Use getWhatsAppQueue() */
export const whatsappQueue = {
  add: (...args: Parameters<Queue['add']>) => getWhatsAppQueue().add(...args),
};
