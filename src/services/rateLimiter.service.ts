import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../config/redis';
import { prisma } from '../config/prisma';
import { RateLimitCheckParams, RateLimitResult } from '../types';
import { RateLimitStrategy } from '@prisma/client';

/**
 * Rate Limiter Service
 * 
 * Loads Lua scripts once via SCRIPT LOAD and caches the SHA for EVALSHA.
 * All rate limit checks are atomic — no JS-level GET-then-SET.
 */
class RateLimiterService {
  private slidingWindowSHA: string | null = null;
  private tokenBucketSHA: string | null = null;
  private initialized = false;

  /**
   * Load and cache Lua scripts with SCRIPT LOAD.
   * Called lazily on first check.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const slidingWindowScript = fs.readFileSync(
      path.join(__dirname, '../lua/slidingWindow.lua'),
      'utf-8'
    );
    const tokenBucketScript = fs.readFileSync(
      path.join(__dirname, '../lua/tokenBucket.lua'),
      'utf-8'
    );

    this.slidingWindowSHA = await redis.script('LOAD', slidingWindowScript) as string;
    this.tokenBucketSHA = await redis.script('LOAD', tokenBucketScript) as string;
    this.initialized = true;

    console.log('[RateLimiter] Lua scripts loaded and cached');
  }

  /**
   * Check rate limit for a given scope.
   * Looks up the tenant's RateLimitRule, then executes the appropriate Lua script.
   */
  async check(params: RateLimitCheckParams): Promise<RateLimitResult> {
    await this.initialize();

    const { tenantId, scope, identifier, channel } = params;

    // Find the matching rule for this tenant, scope, and channel
    const rule = await prisma.rateLimitRule.findFirst({
      where: {
        tenantId,
        scope,
        OR: [{ channel }, { channel: null }], // null channel means "all channels"
      },
      orderBy: { channel: 'asc' }, // Prefer channel-specific rules (non-null first)
    });

    // No rule configured → allow by default
    if (!rule) {
      return { allowed: true };
    }

    const key = `rl:${tenantId}:${scope}:${identifier}:${channel}`;
    const now = Date.now();

    let result: [number, number, number];

    if (rule.strategy === RateLimitStrategy.TOKEN_BUCKET) {
      const refillRate = rule.maxRequests / rule.windowSecs; // tokens per second
      const ttlSecs = rule.windowSecs * 2; // Key expires after 2x window

      result = (await redis.evalsha(
        this.tokenBucketSHA!,
        1,
        key,
        now.toString(),
        rule.maxRequests.toString(),
        refillRate.toString(),
        ttlSecs.toString()
      )) as [number, number, number];
    } else {
      // Default: SLIDING_WINDOW (also handles FIXED_WINDOW for simplicity)
      const windowMs = rule.windowSecs * 1000;
      const requestId = uuidv4();
      const ttlSecs = rule.windowSecs + 10; // Key expires shortly after window

      result = (await redis.evalsha(
        this.slidingWindowSHA!,
        1,
        key,
        now.toString(),
        windowMs.toString(),
        rule.maxRequests.toString(),
        requestId,
        ttlSecs.toString()
      )) as [number, number, number];
    }

    const [allowed, count, retryAfterMs] = result;

    return {
      allowed: allowed === 1,
      limit: rule.maxRequests,
      remaining: Math.max(0, rule.maxRequests - count),
      windowSecs: rule.windowSecs,
      retryAfterSecs: Math.ceil(retryAfterMs / 1000),
    };
  }
}

// Singleton export
export const rateLimiterService = new RateLimiterService();
