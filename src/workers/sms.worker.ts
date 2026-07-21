import { Worker, Job } from 'bullmq';
import { PrismaClient, NotificationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { TwilioProvider } from '../providers/twilio.provider';
import { NotificationJobPayload } from '../types';
import dotenv from 'dotenv';
import { redis } from '../config/redis';
import { notificationDLQ } from '../queues/notification.queue';
import { webhookQueue } from '../queues/webhook.queue';
import { buildPayload } from '../services/webhook.service';
import { WebhookEvent } from '@prisma/client';

// Load env since this runs as a separate process
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const twilioProvider = new TwilioProvider();
// Use centralized redis instance

/**
 * SMS Worker
 * 
 * Runs as a SEPARATE process from the API server.
 * Processes SMS notifications from the BullMQ queue.
 */
const smsWorker = new Worker<NotificationJobPayload>(
  'sms-notifications',
  async (job: Job<NotificationJobPayload>) => {
    const { notificationId, channel, recipient, renderedBody } = job.data;

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

      // Enqueue webhook job for NOTIFICATION_SENT (if tenant has webhookUrl)
      // TODO: Add NOTIFICATION_DELIVERED here when Twilio status callbacks are wired in
      const tenant = await prisma.tenant.findUnique({
        where: { id: job.data.tenantId },
        select: { webhookUrl: true, webhookSecret: true },
      });
      if (tenant?.webhookUrl && tenant.webhookSecret) {
        const notification = await prisma.notification.findUnique({
          where: { id: notificationId },
          select: { id: true, channel: true, recipient: true, status: true, providerMsgId: true, errorMessage: true },
        });
        if (notification) {
          const payload = buildPayload(WebhookEvent.NOTIFICATION_SENT, {
            notificationId: notification.id,
            channel: notification.channel,
            recipient: notification.recipient,
            status: notification.status,
            providerMsgId: notification.providerMsgId,
            errorMessage: notification.errorMessage,
          });
          await webhookQueue.add('notification.sent', {
            tenantId: job.data.tenantId,
            notificationId,
            event: WebhookEvent.NOTIFICATION_SENT,
            webhookUrl: tenant.webhookUrl,
            webhookSecret: tenant.webhookSecret,
            payload: payload as any,
          });
        }
      }
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

      // Enqueue webhook job for NOTIFICATION_FAILED (if tenant has webhookUrl)
      const tenant = await prisma.tenant.findUnique({
        where: { id: job.data.tenantId },
        select: { webhookUrl: true, webhookSecret: true },
      });
      if (tenant?.webhookUrl && tenant.webhookSecret) {
        const payload = buildPayload(WebhookEvent.NOTIFICATION_FAILED, {
          notificationId: job.data.notificationId,
          channel: job.data.channel,
          recipient: job.data.recipient,
          status: NotificationStatus.FAILED,
          errorMessage: err.message,
        });
        await webhookQueue.add('notification.failed', {
          tenantId: job.data.tenantId,
          notificationId: job.data.notificationId,
          event: WebhookEvent.NOTIFICATION_FAILED,
          webhookUrl: tenant.webhookUrl,
          webhookSecret: tenant.webhookSecret,
          payload: payload as any,
        });
      }

      // Route to DLQ
      await notificationDLQ.add('failed-sms', {
        ...job.data,
        error: err.message,
        failedAt: new Date().toISOString(),
      });
    } catch (updateErr) {
      console.error('[SMSWorker] Failed to update notification status:', updateErr);
    }
  }
});

smsWorker.on('completed', (job) => {
  console.log(`[SMSWorker] Job ${job.id} completed`);
});

console.log('[SMSWorker] Started — waiting for SMS jobs...');
