import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { WebhookJobPayload } from '../types';
import { signPayload } from '../services/webhook.service';
import dotenv from 'dotenv';
import { redis } from '../config/redis';

// Load env since this runs as a separate process
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Webhook Worker
 *
 * Runs as a SEPARATE process from the API server.
 * Picks up jobs from the "webhooks" queue, signs and POSTs the payload
 * to the tenant's configured webhookUrl, then writes a WebhookDelivery
 * record regardless of outcome.
 *
 * IMPORTANT: Webhook delivery failure NEVER mutates the original
 * notification's status. These are independent concerns.
 */
const webhookWorker = new Worker<WebhookJobPayload>(
  'webhooks',
  async (job: Job<WebhookJobPayload>) => {
    const { tenantId, notificationId, event, webhookUrl, webhookSecret, payload } = job.data;
    const attempt = job.attemptsMade + 1;

    console.log(`[WebhookWorker] Attempt ${attempt} — event=${event} url=${webhookUrl}`);

    const rawBody = JSON.stringify(payload);
    const signature = signPayload(webhookSecret, rawBody);

    // 5-second timeout using AbortController (available natively in Node 22+)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let statusCode: number | null = null;
    let errorMessage: string | null = null;
    let success = false;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RateGate-Signature': signature,
          'X-RateGate-Event': event,
          // Delivery ID will be set below after the record is created; omit here
          // and let tenants correlate via notificationId in the payload instead
          'User-Agent': 'RateGate-Webhook/1.0',
        },
        body: rawBody,
        signal: controller.signal,
      });

      statusCode = response.status;
      success = response.ok; // 2xx

      if (!success) {
        const body = await response.text().catch(() => '');
        errorMessage = `HTTP ${statusCode}: ${body.substring(0, 200)}`;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        errorMessage = 'Request timed out after 5000ms';
      } else {
        errorMessage = err.message ?? 'Unknown fetch error';
      }
    } finally {
      clearTimeout(timeout);
    }

    // Write delivery record regardless of outcome — provides full audit trail
    await prisma.webhookDelivery.create({
      data: {
        tenantId,
        notificationId,
        event: event as any,
        url: webhookUrl,
        payload: payload as any,
        statusCode,
        success,
        attempt,
        errorMessage,
      },
    });

    if (!success) {
      // Throw to trigger BullMQ retry on non-final attempts
      throw new Error(errorMessage ?? 'Webhook delivery failed');
    }

    console.log(`[WebhookWorker] ✓ Delivered — event=${event} status=${statusCode}`);
  },
  {
    connection: {
      ...((redis as any).options ?? {}),
      // BullMQ requires maxRetriesPerRequest: null for workers
      maxRetriesPerRequest: null,
    },
    concurrency: 10,
  }
);

// Final failure: log only — DO NOT touch the notification status
webhookWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    console.error(
      `[WebhookWorker] Job ${job.id} permanently failed after ${job.attemptsMade} attempts: ${err.message}` +
        ` — event=${job.data.event} url=${job.data.webhookUrl} notificationId=${job.data.notificationId}`
    );
    // NOTE: We intentionally do NOT update the notification status here.
    // Webhook delivery failure is a separate concern from notification delivery.
  }
});

webhookWorker.on('completed', (job) => {
  console.log(`[WebhookWorker] Job ${job.id} completed`);
});

console.log('[WebhookWorker] Started — waiting for WEBHOOK jobs...');
