import { Queue, QueueOptions } from 'bullmq';
import { redis } from '../config/redis';

const webhookQueueOptions: QueueOptions = {
  connection: redis as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s → 5s → 25s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
};

/**
 * BullMQ Webhook delivery queue.
 * Each job represents a signed HTTP POST to a tenant's configured webhookUrl.
 */
export const webhookQueue = new Queue('webhooks', webhookQueueOptions);

console.log('[Queue] Webhook queue initialized');
