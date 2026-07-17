import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate, validateQuery } from '../middleware/validate';
import { rateLimiterMiddleware } from '../middleware/rateLimiter';
import { NotificationService } from '../services/notification.service';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────

const notifySchema = z.object({
  channel: z.enum(['EMAIL', 'SMS']),
  recipient: z.string().min(1, 'Recipient is required'),
  templateName: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
  idempotencyKey: z.string().optional(),
}).refine(
  (data) => data.templateName || data.body,
  { message: 'Either templateName or body must be provided' }
);

const notificationsQuerySchema = z.object({
  status: z.enum(['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RATE_LIMITED']).optional(),
  channel: z.enum(['EMAIL', 'SMS']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.string().optional().transform((val) => {
    if (!val) return 25;
    const num = parseInt(val, 10);
    return isNaN(num) ? 25 : Math.min(Math.max(num, 1), 100);
  }),
});

// ─── POST /v1/notify ─────────────────────────────────────────

router.post(
  '/',
  validate(notifySchema),
  rateLimiterMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
      const { channel, recipient, templateName, subject, body, variables, idempotencyKey } = req.body;

      // Idempotency check
      if (idempotencyKey) {
        const existing = await NotificationService.findByIdempotencyKey(
          tenantId,
          idempotencyKey
        );
        if (existing) {
          res.status(200).json({
            id: existing.id,
            status: existing.status.toLowerCase(),
            message: 'Duplicate request — returning existing notification',
          });
          return;
        }
      }

      // Create notification and enqueue
      const notification = await NotificationService.createAndEnqueue({
        tenantId,
        channel,
        recipient,
        templateName,
        subject,
        body,
        variables,
        idempotencyKey,
      });

      res.status(202).json({
        id: notification.id,
        status: 'queued',
      });
    } catch (error: any) {
      if (error.code === 'P2002' && req.body.idempotencyKey) {
        // Race condition: another request just created this notification
        const tenantId = (req as Request & { auth: AuthenticatedRequest }).auth.tenantId;
        const existing = await NotificationService.findByIdempotencyKey(
          tenantId,
          req.body.idempotencyKey
        );
        if (existing) {
          res.status(200).json({
            id: existing.id,
            status: existing.status.toLowerCase(),
            message: 'Duplicate request — returning existing notification',
          });
          return;
        }
      }

      if (error.statusCode) {
        res.status(error.statusCode).json({
          error: error.message,
        });
        return;
      }
      throw error;
    }
  }
);

// ─── GET /v1/notifications ───────────────────────────────────

router.get(
  '/',
  validateQuery(notificationsQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
      const query = req.query as any;
      const status = query.status as string | undefined;
      const channel = query.channel as string | undefined;
      const startDate = query.startDate as string | undefined;
      const endDate = query.endDate as string | undefined;
      const cursor = query.cursor as string | undefined;
      const rawLimit = query.limit;
      let limit = 25;
      if (rawLimit) {
        const parsed = parseInt(rawLimit as string, 10);
        if (!isNaN(parsed)) {
          limit = Math.min(Math.max(parsed, 1), 100);
        }
      }

      const where: any = { tenantId };
      if (status) where.status = status;
      if (channel) where.channel = channel;

      // Date range filtering
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const notifications = await prisma.notification.findMany({
        where,
        take: limit + 1,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        orderBy: { createdAt: 'desc' },
        include: { template: { select: { name: true } } },
      });

      let nextCursor: string | null = null;
      if (notifications.length > limit) {
        const nextItem = notifications.pop();
        nextCursor = nextItem!.id;
      }

      res.json({
        data: notifications.map((n) => ({
          id: n.id,
          channel: n.channel,
          recipient: n.recipient,
          status: n.status,
          templateId: n.templateId,
          templateName: n.template?.name || null,
          providerMsgId: n.providerMsgId,
          errorMessage: n.errorMessage,
          createdAt: n.createdAt,
          deliveredAt: n.status === 'DELIVERED' ? n.updatedAt : null,
        })),
        nextCursor,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }
);

// ─── GET /v1/notify/:id ──────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
    const id = req.params.id as string;

    const notification = await NotificationService.getById(tenantId, id);

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    // Build base response
    const response: any = {
      id: notification.id,
      channel: notification.channel,
      recipient: notification.recipient,
      status: notification.status,
      rateLimited: notification.rateLimited,
      templateId: notification.templateId,
      providerMsgId: notification.providerMsgId,
      errorMessage: notification.errorMessage,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      deliveredAt: notification.status === 'DELIVERED' ? notification.updatedAt : null,
    };

    // If rate limited, include which scope/rule caused the rejection
    if (notification.status === 'RATE_LIMITED') {
      let matchedScope: string | null = null;
      if (notification.errorMessage && notification.errorMessage.startsWith('Rate limited: ')) {
        const parts = notification.errorMessage.split(' ');
        if (parts.length >= 4 && parts[3] === 'scope') {
          matchedScope = parts[2];
        }
      }

      const rules = await prisma.rateLimitRule.findMany({
        where: {
          tenantId,
          OR: [
            { channel: notification.channel },
            { channel: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      const applicableRules = matchedScope 
        ? rules.filter(r => r.scope === matchedScope)
        : rules;

      if (applicableRules.length > 0) {
        response.rateLimitInfo = applicableRules.map((rule) => ({
          ruleId: rule.id,
          scope: rule.scope,
          channel: rule.channel,
          windowSecs: rule.windowSecs,
          maxRequests: rule.maxRequests,
          strategy: rule.strategy,
        }));
      }
    }

    res.json(response);
  } catch (error) {
    throw error;
  }
});

export default router;
