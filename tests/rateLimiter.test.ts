import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Rate Limiter Correctness Test
 * 
 * CRITICAL: This test verifies that the sliding window rate limiter
 * correctly handles concurrent requests. Under a limit of 5, exactly
 * 5 of 20 concurrent requests should succeed — no more, no less.
 * 
 * This proves the Lua script is truly atomic (no race conditions).
 */

let redis: Redis;
let slidingWindowSHA: string;

beforeAll(async () => {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  // Load the sliding window Lua script
  const scriptPath = path.join(__dirname, '../src/lua/slidingWindow.lua');
  const script = fs.readFileSync(scriptPath, 'utf-8');
  slidingWindowSHA = await redis.script('LOAD', script) as string;
});

afterAll(async () => {
  await redis.quit();
});

describe('Sliding Window Rate Limiter', () => {
  it('should allow exactly 5 of 20 concurrent requests (limit=5)', async () => {
    const testKey = `rl:test:${uuidv4()}`;
    const windowMs = 60000; // 60 second window
    const maxRequests = 5;
    const ttlSecs = 70;
    const now = Date.now();

    // Fire 20 concurrent requests simultaneously
    const promises = Array.from({ length: 20 }, (_, i) => {
      const requestId = uuidv4();
      return redis.evalsha(
        slidingWindowSHA,
        1,
        testKey,
        now.toString(),
        windowMs.toString(),
        maxRequests.toString(),
        requestId,
        ttlSecs.toString()
      ) as Promise<[number, number, number]>;
    });

    const results = await Promise.all(promises);

    const allowed = results.filter((r) => r[0] === 1).length;
    const rejected = results.filter((r) => r[0] === 0).length;

    console.log(`  Allowed: ${allowed}, Rejected: ${rejected}`);

    expect(allowed).toBe(5);
    expect(rejected).toBe(15);

    // Cleanup
    await redis.del(testKey);
  });

  it('should allow new requests after window expires', async () => {
    const testKey = `rl:test:expire:${uuidv4()}`;
    const windowMs = 1000; // 1 second window for fast test
    const maxRequests = 3;
    const ttlSecs = 5;
    const now = Date.now();

    // Fill up the window
    for (let i = 0; i < 3; i++) {
      await redis.evalsha(
        slidingWindowSHA,
        1,
        testKey,
        now.toString(),
        windowMs.toString(),
        maxRequests.toString(),
        uuidv4(),
        ttlSecs.toString()
      );
    }

    // This should be rejected
    const rejectedResult = await redis.evalsha(
      slidingWindowSHA,
      1,
      testKey,
      now.toString(),
      windowMs.toString(),
      maxRequests.toString(),
      uuidv4(),
      ttlSecs.toString()
    ) as [number, number, number];

    expect(rejectedResult[0]).toBe(0);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Now this should be allowed
    const afterExpiry = Date.now();
    const allowedResult = await redis.evalsha(
      slidingWindowSHA,
      1,
      testKey,
      afterExpiry.toString(),
      windowMs.toString(),
      maxRequests.toString(),
      uuidv4(),
      ttlSecs.toString()
    ) as [number, number, number];

    expect(allowedResult[0]).toBe(1);

    // Cleanup
    await redis.del(testKey);
  });

  it('should return correct retryAfterMs when rate limited', async () => {
    const testKey = `rl:test:retry:${uuidv4()}`;
    const windowMs = 10000; // 10 second window
    const maxRequests = 2;
    const ttlSecs = 15;
    const now = Date.now();

    // Fill up
    for (let i = 0; i < 2; i++) {
      await redis.evalsha(
        slidingWindowSHA,
        1,
        testKey,
        now.toString(),
        windowMs.toString(),
        maxRequests.toString(),
        uuidv4(),
        ttlSecs.toString()
      );
    }

    // This should be rejected with retryAfterMs > 0
    const result = await redis.evalsha(
      slidingWindowSHA,
      1,
      testKey,
      now.toString(),
      windowMs.toString(),
      maxRequests.toString(),
      uuidv4(),
      ttlSecs.toString()
    ) as [number, number, number];

    expect(result[0]).toBe(0);
    expect(result[2]).toBeGreaterThan(0); // retryAfterMs should be positive

    // Cleanup
    await redis.del(testKey);
  });
});

describe('Token Bucket Rate Limiter', () => {
  let tokenBucketSHA: string;

  beforeAll(async () => {
    const scriptPath = path.join(__dirname, '../src/lua/tokenBucket.lua');
    const script = fs.readFileSync(scriptPath, 'utf-8');
    tokenBucketSHA = await redis.script('LOAD', script) as string;
  });

  it('should allow exactly 5 of 20 concurrent requests (bucket=5)', async () => {
    const testKey = `rl:test:bucket:${uuidv4()}`;
    const maxTokens = 5;
    const refillRate = 1; // 1 token per second
    const ttlSecs = 60;
    const now = Date.now();

    // Fire 20 concurrent requests
    const promises = Array.from({ length: 20 }, () =>
      redis.evalsha(
        tokenBucketSHA,
        1,
        testKey,
        now.toString(),
        maxTokens.toString(),
        refillRate.toString(),
        ttlSecs.toString()
      ) as Promise<[number, number, number]>
    );

    const results = await Promise.all(promises);

    const allowed = results.filter((r) => r[0] === 1).length;
    const rejected = results.filter((r) => r[0] === 0).length;

    console.log(`  Token Bucket — Allowed: ${allowed}, Rejected: ${rejected}`);

    expect(allowed).toBe(5);
    expect(rejected).toBe(15);

    // Cleanup
    await redis.del(testKey);
  });
});
