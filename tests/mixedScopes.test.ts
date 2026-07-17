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
  
  const rawKey = `rg_mixed_${randomBytes(16).toString('hex')}`;
  apiKeyToken = rawKey;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 8);

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Mixed Scopes Test Tenant',
      email: `mixed-test-${uuidv4()}@rategate.dev`,
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

  // Create tiered rules
  // 1. TEMPLATE scope is the tightest (limit: 2)
  await prisma.rateLimitRule.create({
    data: {
      tenantId: testTenantId,
      scope: RateLimitScope.TEMPLATE,
      windowSecs: 60,
      maxRequests: 2,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
    }
  });

  // 2. RECIPIENT scope is medium (limit: 4)
  await prisma.rateLimitRule.create({
    data: {
      tenantId: testTenantId,
      scope: RateLimitScope.RECIPIENT,
      windowSecs: 60,
      maxRequests: 4,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
    }
  });

  // 3. API_KEY scope is the loosest (limit: 10)
  await prisma.rateLimitRule.create({
    data: {
      tenantId: testTenantId,
      scope: RateLimitScope.API_KEY,
      windowSecs: 60,
      maxRequests: 10,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
    }
  });

  // Create two templates for testing
  await prisma.template.createMany({
    data: [
      { tenantId: testTenantId, name: 'promo1', channel: Channel.EMAIL, body: 'Promo 1' },
      { tenantId: testTenantId, name: 'promo2', channel: Channel.EMAIL, body: 'Promo 2' }
    ]
  });
});

afterAll(async () => {
  await prisma.tenant.delete({ where: { id: testTenantId } });
  await prisma.$disconnect();
  await redis.quit();
});

describe('Mixed Scopes Rate Limiter', () => {
  it('should enforce the tightest winning scope dynamically and not consume quota on rejection', async () => {
    const recipientA = 'recipient-a@example.com';

    const send = async (to: string, template: string) => {
      return request(app)
        .post('/v1/notify')
        .set('Authorization', `Bearer ${apiKeyToken}`)
        .send({
          channel: 'EMAIL',
          recipient: to,
          templateName: template,
          idempotencyKey: uuidv4()
        });
    };

    const sendRaw = async (to: string) => {
      return request(app)
        .post('/v1/notify')
        .set('Authorization', `Bearer ${apiKeyToken}`)
        .send({
          channel: 'EMAIL',
          recipient: to,
          body: 'Raw body to bypass template limits',
          idempotencyKey: uuidv4()
        });
    };

    // ----- STEP 1: Hit TEMPLATE limit (limit: 2) -----
    const res1 = await send(recipientA, 'promo1'); // API_KEY=1, RECIPIENT=1, TEMPLATE_1=1
    expect(res1.status).toBe(202);

    const res2 = await send(recipientA, 'promo1'); // API_KEY=2, RECIPIENT=2, TEMPLATE_1=2
    expect(res2.status).toBe(202);

    const res3 = await send(recipientA, 'promo1'); // API_KEY=2, RECIPIENT=2, TEMPLATE_1=Blocked!
    expect(res3.status).toBe(429);
    expect(res3.body.scope).toBe('TEMPLATE');

    // ----- STEP 2: Bypass TEMPLATE limit using raw body, hit RECIPIENT limit (limit: 4) -----
    // Because res3 failed, it did NOT consume API_KEY or RECIPIENT. 
    // We only have 2 RECIPIENT consumptions. We need 2 more to hit 4.
    const res4 = await sendRaw(recipientA); // API_KEY=3, RECIPIENT=3
    expect(res4.status).toBe(202);

    const res5 = await sendRaw(recipientA); // API_KEY=4, RECIPIENT=4
    expect(res5.status).toBe(202);

    const res6 = await sendRaw(recipientA); // API_KEY=4, RECIPIENT=Blocked!
    expect(res6.status).toBe(429);
    expect(res6.body.scope).toBe('RECIPIENT');

    // ----- STEP 3: Bypass RECIPIENT limit using different recipients, hit API_KEY limit (limit: 10) -----
    // Current API_KEY count is 4. We need to send 6 more successful requests to hit 10.
    let accepted = 0;
    while(accepted < 6) { 
      const r = await sendRaw(`recipient-c-${uuidv4()}@example.com`);
      if (r.status === 202) accepted++;
      else break;
    }
    
    expect(accepted).toBe(6); // Successfully hit limit

    // 11th request across ANY recipient should fail API_KEY scope
    const resFinal = await sendRaw('anyone@example.com');
    expect(resFinal.status).toBe(429);
    expect(resFinal.body.scope).toBe('API_KEY');
  });

  it('should not burn shared quota when bombarded with rejected requests', async () => {
    // We will bombard promo2 which has a limit of 2, then check that API_KEY still has quota.
    const recipientX = 'recipient-x@example.com';

    const send = async (to: string, template: string) => {
      return request(app)
        .post('/v1/notify')
        .set('Authorization', `Bearer ${apiKeyToken}`)
        .send({
          channel: 'EMAIL',
          recipient: to,
          templateName: template,
          idempotencyKey: uuidv4()
        });
    };

    // 2 successful requests
    await send(recipientX, 'promo2');
    await send(recipientX, 'promo2');

    // Fire a burst of 10 rejected requests
    for (let i = 0; i < 10; i++) {
      const res = await send(recipientX, 'promo2');
      expect(res.status).toBe(429);
      expect(res.body.scope).toBe('TEMPLATE');
    }

    // API_KEY quota is 10. We used 2 above. We should have 8 left.
    // Let's send 8 successful requests to different recipients.
    const sendRaw = async (to: string) => {
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

    let accepted = 0;
    for (let i = 0; i < 8; i++) {
      const res = await sendRaw(`recipient-y-${i}@example.com`);
      if (res.status === 202) accepted++;
    }
    expect(accepted).toBe(8);

    // The next one should fail API_KEY
    const resFinal = await sendRaw('recipient-z@example.com');
    expect(resFinal.status).toBe(429);
    expect(resFinal.body.scope).toBe('API_KEY');
  });
});
