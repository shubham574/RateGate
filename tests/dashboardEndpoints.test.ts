import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../src/config/prisma';
import app from '../src/app';
import { Plan, Channel, NotificationStatus, RateLimitScope, RateLimitStrategy } from '@prisma/client';

/**
 * Dashboard Endpoints Integration Tests
 * 
 * Tests all new dashboard-facing endpoints for:
 * - Correct response shapes
 * - Tenant isolation (Tenant A cannot access Tenant B's data)
 * - Pagination and filtering
 * - Idempotent operations
 */

// ─── Test Data ───────────────────────────────────────────────

let tenantA: any;
let tenantB: any;
let apiKeyA: string;  // raw key
let apiKeyB: string;  // raw key
let tenantAKeyId: string;
let tenantBKeyId: string;
let notificationA1Id: string;
let notificationA2Id: string;
let notificationB1Id: string;
let ruleAId: string;
let ruleBId: string;
let createdApiKeyId: string;

function authHeader(rawKey: string) {
  return { Authorization: `Bearer ${rawKey}` };
}

beforeAll(async () => {
  // Create Tenant A
  tenantA = await prisma.tenant.create({
    data: {
      name: 'Test Tenant A',
      email: `test-a-${Date.now()}@rategate.dev`,
      plan: Plan.STARTER,
    },
  });

  // Create Tenant B
  tenantB = await prisma.tenant.create({
    data: {
      name: 'Test Tenant B',
      email: `test-b-${Date.now()}@rategate.dev`,
      plan: Plan.FREE,
    },
  });

  // Create API keys
  apiKeyA = `nk_live_testkey_a_${randomBytes(12).toString('hex')}`;
  const hashA = createHash('sha256').update(apiKeyA).digest('hex');
  const keyRecordA = await prisma.apiKey.create({
    data: {
      tenantId: tenantA.id,
      keyHash: hashA,
      keyPrefix: apiKeyA.substring(0, 12),
      label: 'Test Key A',
    },
  });
  tenantAKeyId = keyRecordA.id;

  apiKeyB = `nk_live_testkey_b_${randomBytes(12).toString('hex')}`;
  const hashB = createHash('sha256').update(apiKeyB).digest('hex');
  const keyRecordB = await prisma.apiKey.create({
    data: {
      tenantId: tenantB.id,
      keyHash: hashB,
      keyPrefix: apiKeyB.substring(0, 12),
      label: 'Test Key B',
    },
  });
  tenantBKeyId = keyRecordB.id;

  // Create notifications for Tenant A
  const ntfnA1 = await prisma.notification.create({
    data: {
      tenantId: tenantA.id,
      channel: Channel.EMAIL,
      recipient: 'user@example.com',
      status: NotificationStatus.DELIVERED,
    },
  });
  notificationA1Id = ntfnA1.id;

  const ntfnA2 = await prisma.notification.create({
    data: {
      tenantId: tenantA.id,
      channel: Channel.SMS,
      recipient: '+1234567890',
      status: NotificationStatus.RATE_LIMITED,
      rateLimited: true,
    },
  });
  notificationA2Id = ntfnA2.id;

  // Create notifications for Tenant B
  const ntfnB1 = await prisma.notification.create({
    data: {
      tenantId: tenantB.id,
      channel: Channel.EMAIL,
      recipient: 'other@example.com',
      status: NotificationStatus.QUEUED,
    },
  });
  notificationB1Id = ntfnB1.id;

  // Create rate limit rules
  const ruleA = await prisma.rateLimitRule.create({
    data: {
      tenantId: tenantA.id,
      scope: RateLimitScope.API_KEY,
      windowSecs: 60,
      maxRequests: 100,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
    },
  });
  ruleAId = ruleA.id;

  const ruleB = await prisma.rateLimitRule.create({
    data: {
      tenantId: tenantB.id,
      scope: RateLimitScope.RECIPIENT,
      channel: Channel.EMAIL,
      windowSecs: 3600,
      maxRequests: 5,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
    },
  });
  ruleBId = ruleB.id;
});

afterAll(async () => {
  // Clean up test data
  await prisma.notification.deleteMany({
    where: { tenantId: { in: [tenantA.id, tenantB.id] } },
  });
  await prisma.rateLimitRule.deleteMany({
    where: { tenantId: { in: [tenantA.id, tenantB.id] } },
  });
  await prisma.apiKey.deleteMany({
    where: { tenantId: { in: [tenantA.id, tenantB.id] } },
  });
  await prisma.tenant.deleteMany({
    where: { id: { in: [tenantA.id, tenantB.id] } },
  });
  await prisma.$disconnect();
});

// ═══════════════════════════════════════════════════════════════
// GET /v1/notifications — List & Filters
// ═══════════════════════════════════════════════════════════════

describe('GET /v1/notify (notifications list)', () => {
  it('should return only the authenticated tenant\'s notifications', async () => {
    const res = await request(app)
      .get('/v1/notify')
      .set(authHeader(apiKeyA));

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);

    // All returned notifications belong to Tenant A
    for (const n of res.body.data) {
      expect(n.id).toBeDefined();
      expect(n.channel).toBeDefined();
    }

    // Tenant B's notification should NOT be in the response
    const ids = res.body.data.map((n: any) => n.id);
    expect(ids).not.toContain(notificationB1Id);
  });

  it('should filter by status', async () => {
    const res = await request(app)
      .get('/v1/notify?status=DELIVERED')
      .set(authHeader(apiKeyA));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    for (const n of res.body.data) {
      expect(n.status).toBe('DELIVERED');
    }
  });

  it('should filter by channel', async () => {
    const res = await request(app)
      .get('/v1/notify?channel=SMS')
      .set(authHeader(apiKeyA));

    expect(res.status).toBe(200);
    for (const n of res.body.data) {
      expect(n.channel).toBe('SMS');
    }
  });

  it('should support cursor-based pagination', async () => {
    const res1 = await request(app)
      .get('/v1/notify?limit=1')
      .set(authHeader(apiKeyA));

    expect(res1.status).toBe(200);
    expect(res1.body.data.length).toBe(1);

    if (res1.body.nextCursor) {
      const res2 = await request(app)
        .get(`/v1/notify?limit=1&cursor=${res1.body.nextCursor}`)
        .set(authHeader(apiKeyA));

      expect(res2.status).toBe(200);
      // Cursor page should return different records
      expect(res2.body.data[0]?.id).not.toBe(res1.body.data[0]?.id);
    }
  });

  it('should have correct response shape with providerMsgId and errorMessage', async () => {
    const res = await request(app)
      .get('/v1/notify')
      .set(authHeader(apiKeyA));

    expect(res.status).toBe(200);
    const first = res.body.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('channel');
    expect(first).toHaveProperty('recipient');
    expect(first).toHaveProperty('status');
    expect(first).toHaveProperty('templateId');
    expect(first).toHaveProperty('providerMsgId');
    expect(first).toHaveProperty('errorMessage');
    expect(first).toHaveProperty('createdAt');
    expect(first).toHaveProperty('deliveredAt');
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /v1/notify/:id — Detail with rate limit info
// ═══════════════════════════════════════════════════════════════

describe('GET /v1/notify/:id (notification detail)', () => {
  it('should return full notification detail', async () => {
    const res = await request(app)
      .get(`/v1/notify/${notificationA1Id}`)
      .set(authHeader(apiKeyA));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(notificationA1Id);
    expect(res.body.channel).toBe('EMAIL');
    expect(res.body.status).toBe('DELIVERED');
    expect(res.body.deliveredAt).toBeDefined();
  });

  it('should include rateLimitInfo when status is RATE_LIMITED', async () => {
    const res = await request(app)
      .get(`/v1/notify/${notificationA2Id}`)
      .set(authHeader(apiKeyA));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RATE_LIMITED');
    expect(res.body.rateLimitInfo).toBeDefined();
    expect(Array.isArray(res.body.rateLimitInfo)).toBe(true);
  });

  it('should return 404 for another tenant\'s notification (tenant isolation)', async () => {
    const res = await request(app)
      .get(`/v1/notify/${notificationB1Id}`)
      .set(authHeader(apiKeyA));

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════
// API Key CRUD
// ═══════════════════════════════════════════════════════════════

describe('API Key CRUD (/v1/api-keys)', () => {
  it('GET should list only the authenticated tenant\'s keys', async () => {
    const res = await request(app)
      .get('/v1/api-keys')
      .set(authHeader(apiKeyA));

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);

    // Should NOT contain raw key hash or raw key material
    for (const key of res.body.data) {
      expect(key).not.toHaveProperty('keyHash');
      expect(key).not.toHaveProperty('key');
      expect(key).not.toHaveProperty('rawKey');
      expect(key).toHaveProperty('id');
      expect(key).toHaveProperty('label');
      expect(key).toHaveProperty('keyPrefix');
      expect(key).toHaveProperty('revoked');
    }
  });

  it('POST should create a key and return the raw key ONLY on creation', async () => {
    const res = await request(app)
      .post('/v1/api-keys')
      .set(authHeader(apiKeyA))
      .send({ label: 'Test Created Key' });

    expect(res.status).toBe(201);
    expect(res.body.key).toBeDefined();
    expect(res.body.key).toMatch(/^nk_live_/);
    expect(res.body.keyPrefix).toBe(res.body.key.substring(0, 12));
    expect(res.body.label).toBe('Test Created Key');
    expect(res.body.id).toBeDefined();

    createdApiKeyId = res.body.id;

    // Now GET should NOT contain the raw key
    const listRes = await request(app)
      .get('/v1/api-keys')
      .set(authHeader(apiKeyA));

    const found = listRes.body.data.find((k: any) => k.id === createdApiKeyId);
    expect(found).toBeDefined();
    expect(found).not.toHaveProperty('key');
    expect(found).not.toHaveProperty('rawKey');
  });

  it('PATCH /revoke should revoke a key (idempotent)', async () => {
    // First revoke
    const res1 = await request(app)
      .patch(`/v1/api-keys/${createdApiKeyId}/revoke`)
      .set(authHeader(apiKeyA));

    expect(res1.status).toBe(200);
    expect(res1.body.revoked).toBe(true);

    // Second revoke (idempotent — still 200)
    const res2 = await request(app)
      .patch(`/v1/api-keys/${createdApiKeyId}/revoke`)
      .set(authHeader(apiKeyA));

    expect(res2.status).toBe(200);
    expect(res2.body.revoked).toBe(true);
  });

  it('PATCH /revoke should return 404 for another tenant\'s key (tenant isolation)', async () => {
    const res = await request(app)
      .patch(`/v1/api-keys/${tenantBKeyId}/revoke`)
      .set(authHeader(apiKeyA));

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════
// Rate Limit Rules PATCH & DELETE
// ═══════════════════════════════════════════════════════════════

describe('Rate Limit Rules (/v1/rate-limit-rules)', () => {
  it('GET should include windowSecs as number and windowDisplay', async () => {
    const res = await request(app)
      .get('/v1/rate-limit-rules')
      .set(authHeader(apiKeyA));

    expect(res.status).toBe(200);
    expect(res.body.rules).toBeDefined();
    for (const rule of res.body.rules) {
      expect(typeof rule.windowSecs).toBe('number');
      expect(typeof rule.windowDisplay).toBe('string');
    }
  });

  it('PATCH should update a rule partially', async () => {
    const res = await request(app)
      .patch(`/v1/rate-limit-rules/${ruleAId}`)
      .set(authHeader(apiKeyA))
      .send({ maxRequests: 200 });

    expect(res.status).toBe(200);
    expect(res.body.maxRequests).toBe(200);
    expect(res.body.windowSecs).toBe(60); // unchanged
    expect(res.body.windowDisplay).toBeDefined();
  });

  it('PATCH should return 404 for another tenant\'s rule (tenant isolation)', async () => {
    const res = await request(app)
      .patch(`/v1/rate-limit-rules/${ruleBId}`)
      .set(authHeader(apiKeyA))
      .send({ maxRequests: 999 });

    expect(res.status).toBe(404);
  });

  it('DELETE should return 404 for another tenant\'s rule (tenant isolation)', async () => {
    const res = await request(app)
      .delete(`/v1/rate-limit-rules/${ruleBId}`)
      .set(authHeader(apiKeyA));

    expect(res.status).toBe(404);
  });

  it('DELETE should succeed for own rule', async () => {
    // Create a temporary rule to delete
    const createRes = await request(app)
      .post('/v1/rate-limit-rules')
      .set(authHeader(apiKeyA))
      .send({
        scope: 'TEMPLATE',
        windowSecs: 120,
        maxRequests: 10,
        strategy: 'FIXED_WINDOW',
      });

    expect(createRes.status).toBe(201);
    const tempRuleId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/v1/rate-limit-rules/${tempRuleId}`)
      .set(authHeader(apiKeyA));

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('Rule deleted');
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /v1/usage
// ═══════════════════════════════════════════════════════════════

describe('GET /v1/usage', () => {
  it('should return usage with correct shape', async () => {
    const res = await request(app)
      .get('/v1/usage')
      .set(authHeader(apiKeyA));

    expect(res.status).toBe(200);
    expect(res.body.currentPeriod).toBeDefined();
    expect(res.body.currentPeriod.start).toBeDefined();
    expect(res.body.currentPeriod.end).toBeDefined();
    expect(res.body.byChannel).toBeDefined();
    expect(Array.isArray(res.body.byChannel)).toBe(true);
    expect(res.body.history).toBeDefined();
    expect(Array.isArray(res.body.history)).toBe(true);

    // byChannel should include limits from plan
    for (const ch of res.body.byChannel) {
      expect(ch).toHaveProperty('channel');
      expect(ch).toHaveProperty('count');
      expect(ch).toHaveProperty('limit');
      expect(typeof ch.limit).toBe('number');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// PATCH /v1/tenant
// ═══════════════════════════════════════════════════════════════

describe('PATCH /v1/tenant', () => {
  it('should update tenant name', async () => {
    const res = await request(app)
      .patch('/v1/tenant')
      .set(authHeader(apiKeyA))
      .send({ name: 'Updated Tenant A' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Tenant A');
    expect(res.body.email).toBeDefined();
    expect(res.body.plan).toBeDefined();
  });

  it('should update webhookUrl', async () => {
    const res = await request(app)
      .patch('/v1/tenant')
      .set(authHeader(apiKeyA))
      .send({ webhookUrl: 'https://hooks.example.com/rategate' });

    expect(res.status).toBe(200);
    expect(res.body.webhookUrl).toBe('https://hooks.example.com/rategate');
  });

  it('should allow setting webhookUrl to null', async () => {
    const res = await request(app)
      .patch('/v1/tenant')
      .set(authHeader(apiKeyA))
      .send({ webhookUrl: null });

    expect(res.status).toBe(200);
    expect(res.body.webhookUrl).toBeNull();
  });

  it('should reject invalid webhookUrl', async () => {
    const res = await request(app)
      .patch('/v1/tenant')
      .set(authHeader(apiKeyA))
      .send({ webhookUrl: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});
