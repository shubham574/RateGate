import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── Zod Schema ──────────────────────────────────────────────

const rateLimitRuleSchema = z.object({
  scope: z.enum(['API_KEY', 'RECIPIENT', 'TEMPLATE']),
  channel: z.enum(['EMAIL', 'SMS']).optional().nullable(),
  windowSecs: z.number().int().positive(),
  maxRequests: z.number().int().positive(),
  strategy: z.enum(['FIXED_WINDOW', 'SLIDING_WINDOW', 'TOKEN_BUCKET']).default('SLIDING_WINDOW'),
});

// ─── POST /v1/rate-limit-rules ───────────────────────────────

router.post(
  '/',
  validate(rateLimitRuleSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
      const { scope, channel, windowSecs, maxRequests, strategy } = req.body;

      // Upsert: find existing rule by tenant + scope + channel, or create new
      const existing = await prisma.rateLimitRule.findFirst({
        where: {
          tenantId,
          scope,
          channel: channel || null,
        },
      });

      let rule;
      if (existing) {
        rule = await prisma.rateLimitRule.update({
          where: { id: existing.id },
          data: { windowSecs, maxRequests, strategy },
        });
      } else {
        rule = await prisma.rateLimitRule.create({
          data: {
            tenantId,
            scope,
            channel: channel || null,
            windowSecs,
            maxRequests,
            strategy,
          },
        });
      }

      res.status(existing ? 200 : 201).json({
        id: rule.id,
        scope: rule.scope,
        channel: rule.channel,
        windowSecs: rule.windowSecs,
        maxRequests: rule.maxRequests,
        strategy: rule.strategy,
        message: existing ? 'Rule updated' : 'Rule created',
      });
    } catch (error) {
      throw error;
    }
  }
);

// ─── GET /v1/rate-limit-rules ────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;

  const rules = await prisma.rateLimitRule.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ rules });
});

export default router;
