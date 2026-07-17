import { Request, Response, NextFunction } from 'express';
import { RateLimitScope, Channel } from '@prisma/client';
import { rateLimiterService } from '../services/rateLimiter.service';
import { AuthenticatedRequest, RateLimitResult } from '../types';
import { prisma } from '../config/prisma';

export function normalizeRecipient(recipient: string, channel: Channel): string {
  if (channel === Channel.EMAIL) {
    return recipient.toLowerCase().trim();
  } else if (channel === Channel.SMS) {
    const isPlus = recipient.startsWith('+');
    const digits = recipient.replace(/\D/g, '');
    return isPlus ? '+' + digits : digits;
  }
  return recipient;
}

/**
 * Rate limiter middleware.
 * Checks rate limits in order: API_KEY → RECIPIENT → TEMPLATE.
 * Uses PEEK mode first. If all pass, runs COMMIT mode.
 * First failure returns 429 immediately and saves a RATE_LIMITED notification.
 */
export async function rateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { tenantId, apiKeyId } = (req as Request & { auth: AuthenticatedRequest }).auth;
    const { channel, recipient, templateName } = req.body;
    const channelEnum = channel as Channel;

    const handleRejection = async (scope: string, result: RateLimitResult) => {
      let templateId = null;
      if (templateName) {
        const template = await prisma.template.findUnique({
          where: { tenantId_name: { tenantId, name: templateName } },
          select: { id: true }
        });
        if (template) templateId = template.id;
      }

      const errorMessage = `Rate limited: ${scope} scope (${result.limit} limit / ${result.windowSecs}s)`;
      
      const notification = await prisma.notification.create({
        data: {
          tenantId,
          channel: channelEnum,
          recipient, // Use original unnormalized recipient for delivery consistency
          templateId,
          status: 'RATE_LIMITED',
          rateLimited: true,
          errorMessage,
          idempotencyKey: req.body.idempotencyKey || null,
        }
      });
      
      res.status(429).json({
        error: 'rate_limit_exceeded',
        notificationId: notification.id,
        scope,
        limit: result.limit,
        windowSecs: result.windowSecs,
        retryAfterSecs: result.retryAfterSecs,
      });
    };

    const scopesToCheck = [];
    
    // Check 1: API_KEY scope
    scopesToCheck.push({ scope: RateLimitScope.API_KEY, identifier: apiKeyId ?? 'unknown' });
    
    // Check 2: RECIPIENT scope
    const normalizedRecipient = normalizeRecipient(recipient, channelEnum);
    scopesToCheck.push({ scope: RateLimitScope.RECIPIENT, identifier: normalizedRecipient });
    
    // Check 3: TEMPLATE scope
    if (templateName) {
      scopesToCheck.push({ scope: RateLimitScope.TEMPLATE, identifier: templateName });
    }

    // Phase 1: PEEK
    const passedScopes = [];
    for (const check of scopesToCheck) {
      const result = await rateLimiterService.check({
        tenantId,
        scope: check.scope,
        identifier: check.identifier,
        channel: channelEnum,
        mode: 'PEEK',
      });
      
      if (!result.allowed) {
        await handleRejection(check.scope, result);
        return;
      }
      passedScopes.push(check);
    }
    
    // Phase 2: COMMIT
    await Promise.all(passedScopes.map(check => 
      rateLimiterService.check({
        tenantId,
        scope: check.scope,
        identifier: check.identifier,
        channel: channelEnum,
        mode: 'COMMIT',
      })
    ));

    next();
  } catch (error) {
    next(error);
  }
}
