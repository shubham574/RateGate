import { Worker, Job } from 'bullmq';
import { PrismaClient, NotificationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ResendProvider } from '../providers/resend.provider';
import { NotificationJobPayload } from '../types';
import dotenv from 'dotenv';
import Redis from 'ioredis';

// Load env since this runs as a separate process
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const resendProvider = new ResendProvider();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

/**
 * Email Worker
 * 
 * Runs as a SEPARATE process from the API server.
 * Processes EMAIL notifications from the BullMQ queue.
 */
const emailWorker = new Worker<NotificationJobPayload>(
  'notifications',
  async (job: Job<NotificationJobPayload>) => {
    const { notificationId, channel, recipient, renderedSubject, renderedBody } = job.data;

    // Only process EMAIL jobs
    if (channel !== 'EMAIL') {
      return; // Skip — this job is for another worker
    }

    console.log(`[EmailWorker] Processing job ${job.id} → ${recipient}`);

    const result = await resendProvider.send({
      to: recipient,
      subject: renderedSubject,
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
      console.log(`[EmailWorker] ✓ Sent to ${recipient} (msgId: ${result.providerMsgId})`);
    } else {
      console.error(`[EmailWorker] ✗ Failed for ${recipient}: ${result.error}`);
      throw new Error(result.error); // Throw to trigger BullMQ retry
    }
  },
  {
    connection: redis as any,
    concurrency: 5,
  }
);

// Handle final failure (after all retries exhausted)
emailWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    console.error(
      `[EmailWorker] Job ${job.id} permanently failed after ${job.attemptsMade} attempts: ${err.message}`
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
      await dlq.add('failed-email', {
        ...job.data,
        error: err.message,
        failedAt: new Date().toISOString(),
      });
      await dlq.close();
    } catch (updateErr) {
      console.error('[EmailWorker] Failed to update notification status:', updateErr);
    }
  }
});

emailWorker.on('completed', (job) => {
  console.log(`[EmailWorker] Job ${job.id} completed`);
});

console.log('[EmailWorker] Started — waiting for EMAIL jobs...');
