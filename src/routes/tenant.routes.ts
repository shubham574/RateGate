import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── Zod Schema ──────────────────────────────────────────────

const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  webhookUrl: z.string().url().nullable().optional(),
});

// ─── PATCH /v1/tenant ────────────────────────────────────────

router.patch(
  '/',
  validate(updateTenantSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
      const { name, webhookUrl } = req.body;

      const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ...(name !== undefined && { name }),
          ...(webhookUrl !== undefined && { webhookUrl }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          webhookUrl: true,
          createdAt: true,
        },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update tenant' });
    }
  }
);

// ─── GET /v1/tenant ──────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        webhookUrl: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

export default router;
