import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { createHash, randomBytes } from 'crypto';
import { Plan, Channel, RateLimitScope, RateLimitStrategy } from '@prisma/client';
import Redis from 'ioredis';

let testTenantId: string;
let apiKeyToken: string;
let redis: Redis;

beforeAll(async () => {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  const rawKey = `rg_norm_${randomBytes(16).toString('hex')}`;
  apiKeyToken = rawKey;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 8);

  let tenant;
  try {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Norm Test Tenant',
        email: `norm-test-${uuidv4()}@rategate.dev`,
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
  } catch (e: any) {
    console.error('Prisma Error:', e.code, e.meta, e.message);
    throw e;
  }

  testTenantId = tenant.id;

  await prisma.rateLimitRule.create({
    data: {
      tenantId: testTenantId,
      scope: RateLimitScope.RECIPIENT,
      windowSecs: 60,
      maxRequests: 4,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
    }
  });
});

afterAll(async () => {
  if (testTenantId) {
    await prisma.tenant.delete({ where: { id: testTenantId } });
  }
  await prisma.$disconnect();
  await redis.quit();
});

describe('Recipient Normalization', () => {
  it('should treat email variations as the same recipient', async () => {
    const send = async (to: string) => {
      return request(app)
        .post('/v1/notify')
        .set('Authorization', `Bearer ${apiKeyToken}`)
        .send({
          channel: 'EMAIL',
          recipient: to,
          body: 'Raw body',
          idempotencyKey: uuidv4()
        });
    };

    // Limit is 4. Send 4 variations.
    const res1 = await send('foo@x.com');
    const res2 = await send('Foo@X.com');
    const res3 = await send(' foo@x.com ');
    const res4 = await send('FOO@X.COM');

    expect(res1.status).toBe(202);
    expect(res2.status).toBe(202);
    expect(res3.status).toBe(202);
    expect(res4.status).toBe(202);

    // 5th should fail
    const res5 = await send('foo@x.com');
    expect(res5.status).toBe(429);
    expect(res5.body.scope).toBe('RECIPIENT');
  });
});
