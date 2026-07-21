import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/validate';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';
import { signPayload } from '../services/webhook.service';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────

const deliveriesQuerySchema = z.object({
  event: z
    .enum([
      'NOTIFICATION_SENT',
      'NOTIFICATION_DELIVERED',
      'NOTIFICATION_FAILED',
      'NOTIFICATION_RATE_LIMITED',
    ])
    .optional(),
  success: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 25;
      const num = parseInt(val, 10);
      return isNaN(num) ? 25 : Math.min(Math.max(num, 1), 100);
    }),
});

// ─── POST /v1/webhooks/test ──────────────────────────────────
// NOTE: This endpoint is intentionally Clerk-only — it is a tenant-configuration
// action triggered from the dashboard UI. Registering it on the API-key path
// would allow anyone with an nk_live_ key to probe/spam the tenant's webhook
// endpoint, which adds attack surface for no legitimate use case.

router.post('/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { webhookUrl: true, webhookSecret: true },
    });

    if (!tenant?.webhookUrl) {
      res.status(400).json({
        error: 'No webhook URL configured. Set a webhookUrl in Settings first.',
      });
      return;
    }

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test delivery from RateGate. Your endpoint is correctly configured.',
        tenantId,
      },
    };

    const rawBody = JSON.stringify(testPayload);
    const signature = tenant.webhookSecret ? signPayload(tenant.webhookSecret, rawBody) : 'unsigned';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const startMs = Date.now();
    let statusCode: number | undefined;
    let success = false;
    let error: string | undefined;

    try {
      const response = await fetch(tenant.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RateGate-Signature': signature,
          'X-RateGate-Event': 'webhook.test',
          'User-Agent': 'RateGate-Webhook/1.0',
        },
        body: rawBody,
        signal: controller.signal,
      });

      statusCode = response.status;
      success = response.ok;

      if (!success) {
        const body = await response.text().catch(() => '');
        error = `HTTP ${statusCode}: ${body.substring(0, 200)}`;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        error = 'Request timed out after 5000ms';
      } else {
        error = err.message ?? 'Unknown error';
      }
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - startMs;

    res.json({ success, statusCode, error, latencyMs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send test webhook' });
  }
});

// ─── GET /v1/webhooks/deliveries ─────────────────────────────

router.get(
  '/deliveries',
  validateQuery(deliveriesQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
      // Use the Zod-transformed parsed query (stored by validateQuery middleware)
      const query = res.locals.parsedQuery ?? req.query;

      const event = query.event as string | undefined;
      const successFilter = query.success as boolean | undefined;
      const cursor = query.cursor as string | undefined;
      // limit is already a number after Zod transform
      const limit = (query.limit as number) ?? 25;

      const where: any = { tenantId };
      if (event) where.event = event;
      if (successFilter !== undefined) where.success = successFilter;

      const deliveries = await prisma.webhookDelivery.findMany({
        where,
        take: limit + 1,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | null = null;
      if (deliveries.length > limit) {
        const nextItem = deliveries.pop();
        nextCursor = nextItem!.id;
      }

      res.json({
        data: deliveries.map((d) => ({
          id: d.id,
          notificationId: d.notificationId,
          event: d.event,
          url: d.url,
          payload: d.payload,
          statusCode: d.statusCode,
          success: d.success,
          attempt: d.attempt,
          errorMessage: d.errorMessage,
          createdAt: d.createdAt,
        })),
        nextCursor,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch webhook deliveries' });
    }
  }
);

export default router;
