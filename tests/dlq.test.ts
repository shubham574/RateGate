import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { NotificationStatus } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { NotificationJobPayload } from '../src/types';

let redis: Redis;
let notificationQueue: Queue;
let dlqQueue: Queue;
let worker: Worker;

beforeAll(() => {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  notificationQueue = new Queue('test-notifications', { connection: redis });
  dlqQueue = new Queue('test-notifications-dlq', { connection: redis });

  worker = new Worker<NotificationJobPayload>(
    'test-notifications',
    async (job: Job<NotificationJobPayload>) => {
      // Mock failure mechanism: Always throw error to simulate provider down
      throw new Error('Simulated Provider Failure');
    },
    { connection: redis, concurrency: 1 }
  );

  // Setup the DLQ event listener similar to what our actual worker does
  worker.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      try {
        await prisma.notification.update({
          where: { id: job.data.notificationId },
          data: {
            status: NotificationStatus.FAILED,
            errorMessage: err.message,
          },
        });

        await dlqQueue.add('failed-job', {
          ...job.data,
          error: err.message,
          failedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to update status', e);
      }
    }
  });
});

afterAll(async () => {
  await worker.close();
  await notificationQueue.close();
  await dlqQueue.close();
  await redis.quit();
});

describe('Worker DLQ (Dead Letter Queue)', () => {
  it('should route job to DLQ after 3 failures and update DB status', async () => {
    // 1. Create a dummy notification record in the database
    const tenant = await prisma.tenant.findFirst(); // grab any tenant
    const notification = await prisma.notification.create({
      data: {
        tenantId: tenant!.id,
        channel: 'EMAIL',
        recipient: 'fail@example.com',
        status: NotificationStatus.QUEUED,
      },
    });

    // 2. Add job with max 3 attempts and no backoff (for fast test)
    const payload: NotificationJobPayload = {
      notificationId: notification.id,
      tenantId: tenant!.id,
      channel: 'EMAIL',
      recipient: 'fail@example.com',
      renderedSubject: 'Failing Subject',
      renderedBody: 'Failing Body',
    };

    await notificationQueue.add('notify-email', payload, {
      jobId: notification.id,
      attempts: 3,
      backoff: { type: 'fixed', delay: 10 }, // 10ms for fast test retry
    });

    // 3. Wait for the job to fail 3 times and reach DLQ
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Should comfortably complete in 1s

    // 4. Verification: Check the database status
    const dbNotif = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    
    expect(dbNotif?.status).toBe(NotificationStatus.FAILED);
    expect(dbNotif?.errorMessage).toBe('Simulated Provider Failure');

    // 5. Verification: Check the DLQ in Redis
    const dlqJobs = await dlqQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
    const dlqEntry = dlqJobs.find((j) => j.data.notificationId === notification.id);

    expect(dlqEntry).toBeDefined();
    expect(dlqEntry?.data.error).toBe('Simulated Provider Failure');
  });
});
