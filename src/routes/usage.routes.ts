import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';
import { PLAN_LIMITS } from '../config/planLimits';

const router = Router();

// ─── GET /v1/usage ───────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;

    // Fetch the tenant to determine plan
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });

    const planLimits = PLAN_LIMITS[tenant?.plan || 'FREE'];

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

    // Build byChannel with limits
    const channelMap: Record<string, number> = {};
    usage.forEach((u) => {
      channelMap[u.channel] = u._count.id;
    });

    const byChannel = [
      {
        channel: 'EMAIL',
        count: channelMap['EMAIL'] || 0,
        limit: planLimits.EMAIL,
      },
      {
        channel: 'SMS',
        count: channelMap['SMS'] || 0,
        limit: planLimits.SMS,
      },
    ];

    // Fetch last 6 periods of usage history from UsageRecord table
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const historyRecords = await prisma.usageRecord.findMany({
      where: {
        tenantId,
        periodStart: { gte: sixMonthsAgo },
      },
      orderBy: { periodStart: 'desc' },
      take: 12, // Up to 6 periods × 2 channels
    });

    const history = historyRecords.map((r) => ({
      periodStart: r.periodStart.toISOString(),
      periodEnd: r.periodEnd.toISOString(),
      channel: r.channel,
      count: r.count,
    }));

    res.json({
      currentPeriod: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      byChannel,
      history,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

export default router;
