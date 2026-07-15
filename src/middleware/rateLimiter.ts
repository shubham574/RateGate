import { Request, Response, NextFunction } from 'express';
import { RateLimitScope, Channel } from '@prisma/client';
import { rateLimiterService } from '../services/rateLimiter.service';
import { AuthenticatedRequest } from '../types';

/**
 * Rate limiter middleware.
 * Checks rate limits in order: API_KEY → RECIPIENT → TEMPLATE.
 * First failure returns 429 immediately.
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

    // Check 1: API_KEY scope
    const apiKeyResult = await rateLimiterService.check({
      tenantId,
      scope: RateLimitScope.API_KEY,
      identifier: apiKeyId ?? 'unknown',
      channel: channelEnum,
    });

    if (!apiKeyResult.allowed) {
      res.status(429).json({
        error: 'rate_limit_exceeded',
        scope: 'API_KEY',
        limit: apiKeyResult.limit,
        windowSecs: apiKeyResult.windowSecs,
        retryAfterSecs: apiKeyResult.retryAfterSecs,
      });
      return;
    }

    // Check 2: RECIPIENT scope
    const recipientResult = await rateLimiterService.check({
      tenantId,
      scope: RateLimitScope.RECIPIENT,
      identifier: recipient,
      channel: channelEnum,
    });

    if (!recipientResult.allowed) {
      res.status(429).json({
        error: 'rate_limit_exceeded',
        scope: 'RECIPIENT',
        limit: recipientResult.limit,
        windowSecs: recipientResult.windowSecs,
        retryAfterSecs: recipientResult.retryAfterSecs,
      });
      return;
    }

    // Check 3: TEMPLATE scope (only if template is specified)
    if (templateName) {
      const templateResult = await rateLimiterService.check({
        tenantId,
        scope: RateLimitScope.TEMPLATE,
        identifier: templateName,
        channel: channelEnum,
      });

      if (!templateResult.allowed) {
        res.status(429).json({
          error: 'rate_limit_exceeded',
          scope: 'TEMPLATE',
          limit: templateResult.limit,
          windowSecs: templateResult.windowSecs,
          retryAfterSecs: templateResult.retryAfterSecs,
        });
        return;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}
