import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────

const rateLimitRuleSchema = z.object({
  scope: z.enum(['API_KEY', 'RECIPIENT', 'TEMPLATE']),
  channel: z.enum(['EMAIL', 'SMS']).optional().nullable(),
  windowSecs: z.number().int().positive(),
  maxRequests: z.number().int().positive(),
  strategy: z.enum(['FIXED_WINDOW', 'SLIDING_WINDOW', 'TOKEN_BUCKET']).default('SLIDING_WINDOW'),
});

const updateRateLimitRuleSchema = z.object({
  windowSecs: z.number().int().positive().optional(),
  maxRequests: z.number().int().positive().optional(),
  strategy: z.enum(['FIXED_WINDOW', 'SLIDING_WINDOW', 'TOKEN_BUCKET']).optional(),
  channel: z.enum(['EMAIL', 'SMS']).optional().nullable(),
});

// ─── Helpers ─────────────────────────────────────────────────

function formatWindowDisplay(secs: number): string {
  if (secs < 60) return `${secs} second${secs !== 1 ? 's' : ''}`;
  if (secs < 3600) {
    const mins = Math.floor(secs / 60);
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  }
  if (secs < 86400) {
    const hours = Math.floor(secs / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  const days = Math.floor(secs / 86400);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

function formatRule(rule: any) {
  return {
    id: rule.id,
    scope: rule.scope,
    channel: rule.channel,
    windowSecs: rule.windowSecs,
    windowDisplay: formatWindowDisplay(rule.windowSecs),
    maxRequests: rule.maxRequests,
    strategy: rule.strategy,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

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
        ...formatRule(rule),
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

  res.json({ rules: rules.map(formatRule) });
});

// ─── PATCH /v1/rate-limit-rules/:id ──────────────────────────

router.patch(
  '/:id',
  validate(updateRateLimitRuleSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
      const id = req.params.id as string;

      // Verify the rule belongs to this tenant — 404 to avoid leaking existence
      const existing = await prisma.rateLimitRule.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        res.status(404).json({ error: 'Rate limit rule not found' });
        return;
      }

      const { windowSecs, maxRequests, strategy, channel } = req.body;

      const updated = await prisma.rateLimitRule.update({
        where: { id },
        data: {
          ...(windowSecs !== undefined && { windowSecs }),
          ...(maxRequests !== undefined && { maxRequests }),
          ...(strategy !== undefined && { strategy }),
          ...(channel !== undefined && { channel }),
        },
      });

      res.json(formatRule(updated));
    } catch (error) {
      throw error;
    }
  }
);

// ─── DELETE /v1/rate-limit-rules/:id ─────────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
    const id = req.params.id as string;

    // Check ownership first — return 404 to avoid leaking existence via 403
    const existing = await prisma.rateLimitRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Rate limit rule not found' });
      return;
    }

    await prisma.rateLimitRule.delete({
      where: { id },
    });

    res.json({ message: 'Rule deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

export default router;
