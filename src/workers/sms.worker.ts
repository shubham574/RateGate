import { Worker, Job } from 'bullmq';
import { PrismaClient, NotificationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { TwilioProvider } from '../providers/twilio.provider';
import { NotificationJobPayload } from '../types';
import dotenv from 'dotenv';
import Redis from 'ioredis';

// Load env since this runs as a separate process
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const twilioProvider = new TwilioProvider();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

/**
 * SMS Worker
 * 
 * Runs as a SEPARATE process from the API server.
 * Processes SMS notifications from the BullMQ queue.
 */
const smsWorker = new Worker<NotificationJobPayload>(
  'notifications',
  async (job: Job<NotificationJobPayload>) => {
    const { notificationId, channel, recipient, renderedBody } = job.data;

    // Only process SMS jobs
    if (channel !== 'SMS') {
      return; // Skip — this job is for another worker
    }

    console.log(`[SMSWorker] Processing job ${job.id} → ${recipient}`);

    const result = await twilioProvider.send({
      to: recipient,
      body: renderedBody,
    });

    if (result.success) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          providerMsgId: result.providerMsgId,
        },
      });
      console.log(`[SMSWorker] ✓ Sent to ${recipient} (msgId: ${result.providerMsgId})`);
    } else {
      console.error(`[SMSWorker] ✗ Failed for ${recipient}: ${result.error}`);
      throw new Error(result.error); // Throw to trigger BullMQ retry
    }
  },
  {
    connection: redis as any,
    concurrency: 5,
  }
);

// Handle final failure (after all retries exhausted)
smsWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    console.error(
      `[SMSWorker] Job ${job.id} permanently failed after ${job.attemptsMade} attempts: ${err.message}`
    );

    try {
      await prisma.notification.update({
        where: { id: job.data.notificationId },
        data: {
          status: NotificationStatus.FAILED,
          errorMessage: err.message,
        },
      });

      // Route to DLQ
      const { Queue } = await import('bullmq');
      const dlq = new Queue('notifications-dlq', { connection: redis as any });
      await dlq.add('failed-sms', {
        ...job.data,
        error: err.message,
        failedAt: new Date().toISOString(),
      });
      await dlq.close();
    } catch (updateErr) {
      console.error('[SMSWorker] Failed to update notification status:', updateErr);
    }
  }
});

smsWorker.on('completed', (job) => {
  console.log(`[SMSWorker] Job ${job.id} completed`);
});

console.log('[SMSWorker] Started — waiting for SMS jobs...');
