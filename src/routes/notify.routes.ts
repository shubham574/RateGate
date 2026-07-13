import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { rateLimiterMiddleware } from '../middleware/rateLimiter';
import { NotificationService } from '../services/notification.service';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────

const notifySchema = z.object({
  channel: z.enum(['EMAIL', 'SMS']),
  recipient: z.string().min(1, 'Recipient is required'),
  templateName: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  variables: z.record(z.string()).optional(),
  idempotencyKey: z.string().optional(),
}).refine(
  (data) => data.templateName || data.body,
  { message: 'Either templateName or body must be provided' }
);

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

// ─── GET /v1/notify/:id ──────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
    const { id } = req.params;

    const notification = await NotificationService.getById(tenantId, id);

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({
      id: notification.id,
      channel: notification.channel,
      recipient: notification.recipient,
      status: notification.status.toLowerCase(),
      rateLimited: notification.rateLimited,
      providerMsgId: notification.providerMsgId,
      errorMessage: notification.errorMessage,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    });
  } catch (error) {
    throw error;
  }
});

export default router;
