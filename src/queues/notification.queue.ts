import { Queue, QueueOptions } from 'bullmq';
import { redis } from '../config/redis';

const defaultOptions: QueueOptions = {
  connection: redis as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
};

/**
 * BullMQ SMS notification queue producer.
 */
export const smsQueue = new Queue('sms-notifications', defaultOptions);

/**
 * BullMQ Email notification queue producer.
 */
export const emailQueue = new Queue('email-notifications', defaultOptions);

/**
 * Dead Letter Queue for notifications that fail after all retries.
 */
export const notificationDLQ = new Queue('notifications-dlq', {
  connection: redis as any,
});

console.log('[Queue] Notification queues initialized');
