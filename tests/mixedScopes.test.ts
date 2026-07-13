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
  it('should enforce the tightest winning scope dynamically', async () => {
    // We will track requests to recipient A to see different scopes trigger
    const recipientA = 'recipient-a@example.com';
    const recipientB = 'recipient-b@example.com';

    // Helper to fire a request
    const send = async (to: string, template: string) => {
      return request(app)
        .post('/v1/notify')
        .set('Authorization', `Bearer ${apiKeyToken}`)
        .send({
          channel: 'EMAIL',
          recipient: to,
          templateName: template,
          idempotencyKey: uuidv4() // unique so they process
        });
    };

    // ----- STEP 1: Hit TEMPLATE limit (limit: 2) -----
    const res1 = await send(recipientA, 'promo1'); // API_KEY=1, RECIPIENT=1, TEMPLATE_1=1
    expect(res1.status).toBe(202);

    const res2 = await send(recipientA, 'promo1'); // API_KEY=2, RECIPIENT=2, TEMPLATE_1=2
    expect(res2.status).toBe(202);

    const res3 = await send(recipientA, 'promo1'); // API_KEY=3, RECIPIENT=3, TEMPLATE_1=Blocked!
    expect(res3.status).toBe(429);
    expect(res3.body.scope).toBe('TEMPLATE');

    // ----- STEP 2: Bypass TEMPLATE limit using a different template, hit RECIPIENT limit (limit: 4) -----
    const res4 = await send(recipientA, 'promo2'); // API_KEY=4, RECIPIENT=4, TEMPLATE_2=1
    expect(res4.status).toBe(202);

    const res5 = await send(recipientA, 'promo2'); // API_KEY=5, RECIPIENT=Blocked! (limit is 4)
    expect(res5.status).toBe(429);
    expect(res5.body.scope).toBe('RECIPIENT');

    // ----- STEP 3: Bypass RECIPIENT limit using different recipient, hit API_KEY limit (limit: 10) -----
    // Current API_KEY count is 5. We need to send 5 more successful requests to hit 10.
    
    const sendNoTemplate = async (to: string) => {
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

    let accepted = 0;
    while(accepted < 5) { // 5 more to reach 10 total
      const r = await sendNoTemplate(`recipient-c-${uuidv4()}@example.com`);
      if (r.status === 202) accepted++;
      else break;
    }
    
    expect(accepted).toBe(5); // Successfully hit limit

    // 11th request across ANY recipient should fail API_KEY scope
    const resFinal = await sendNoTemplate('anyone@example.com');
    expect(resFinal.status).toBe(429);
    expect(resFinal.body.scope).toBe('API_KEY');
  });
});
