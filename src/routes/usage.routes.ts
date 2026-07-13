import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── GET /v1/usage ───────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;

  // Get current billing period (first day of current month to last day)
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Count notifications grouped by channel for the current period
  const usage = await prisma.notification.groupBy({
    by: ['channel'],
    where: {
      tenantId,
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
      status: {
        not: 'RATE_LIMITED',
      },
    },
    _count: {
      id: true,
    },
  });

  const result = {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    channels: usage.map((u) => ({
      channel: u.channel,
      count: u._count.id,
    })),
    total: usage.reduce((sum, u) => sum + u._count.id, 0),
  };

  res.json(result);
});

export default router;
