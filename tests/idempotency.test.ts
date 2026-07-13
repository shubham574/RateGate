import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { createHash, randomBytes } from 'crypto';
import { Plan, Channel } from '@prisma/client';

let testTenantId: string;
let apiKeyToken: string;

beforeAll(async () => {
  // Setup a test tenant & API key for the integration test
  const rawKey = `rg_test_${randomBytes(16).toString('hex')}`;
  apiKeyToken = rawKey;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 8);

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Idempotency Test Tenant',
      email: `idempotency-test-${uuidv4()}@rategate.dev`,
      plan: Plan.STARTER,
      apiKeys: {
        create: {
          keyHash,
          keyPrefix,
          label: 'Test Key',
        },
      },
    },
  });

  testTenantId = tenant.id;
});

afterAll(async () => {
  // Cleanup test tenant
  await prisma.tenant.delete({ where: { id: testTenantId } });
  await prisma.$disconnect();
});

describe('Idempotency Under Concurrent Load', () => {
  it('should successfully handle concurrent requests with the same idempotencyKey without failing', async () => {
    const idempotencyKey = `idem-race-${uuidv4()}`;

    const requestBody = {
      channel: 'EMAIL',
      recipient: 'race-test@example.com',
      body: 'Testing idempotency race',
      idempotencyKey,
    };

    // Fire 5 identical requests completely concurrently
    const promises = Array.from({ length: 5 }, () =>
      request(app)
        .post('/v1/notify')
        .set('Authorization', `Bearer ${apiKeyToken}`)
        .send(requestBody)
    );

    const responses = await Promise.all(promises);

    // All should return either 202 (first to create) or 200 (duplicate returning existing)
    // None should return 409 (conflict) or 500 error.
    let createdCount = 0;
    let returningExistingCount = 0;
    let notificationIds = new Set<string>();

    for (const res of responses) {
      if (res.status === 202) {
        createdCount++;
        notificationIds.add(res.body.id);
      } else if (res.status === 200) {
        returningExistingCount++;
        notificationIds.add(res.body.id);
        expect(res.body.message).toBe('Duplicate request — returning existing notification');
      } else {
        // Log to help with debugging if it fails
        console.error('Unexpected response:', res.status, res.body);
      }
    }

    expect(createdCount).toBe(1);
    expect(returningExistingCount).toBe(4);
    expect(notificationIds.size).toBe(1); // Should all return the same notification ID
  });
});
