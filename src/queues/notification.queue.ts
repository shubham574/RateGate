import { Queue } from 'bullmq';
import { redis } from '../config/redis';

/**
 * BullMQ notification queue producer.
 * Workers consume from this queue in separate processes.
 */
export const notificationQueue = new Queue('notifications', {
  connection: redis as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { count: 1000 },  // Keep last 1000 completed
    removeOnFail: { count: 5000 },       // Keep last 5000 failed
  },
});

/**
 * Dead Letter Queue for notifications that fail after all retries.
 */
export const notificationDLQ = new Queue('notifications-dlq', {
  connection: redis as any,
});

console.log('[Queue] Notification queue initialized');
