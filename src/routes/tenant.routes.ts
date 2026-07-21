import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { validate } from '../middleware/validate';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────

function generateWebhookSecret(): string {
  // Format: whsec_ + 48 hex chars (24 random bytes)
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

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

      // Determine if we need to generate a webhook secret
      let webhookSecretUpdate: { webhookSecret?: string } = {};
      if (webhookUrl !== undefined && webhookUrl !== null) {
        // Only generate a new secret if this is the first time webhookUrl is being set
        const current = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { webhookUrl: true, webhookSecret: true },
        });
        if (!current?.webhookSecret) {
          // First time setting a URL — generate secret
          webhookSecretUpdate = { webhookSecret: generateWebhookSecret() };
        }
        // If secret already exists and URL is just being changed, keep existing secret
      }

      const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ...(name !== undefined && { name }),
          ...(webhookUrl !== undefined && { webhookUrl }),
          ...webhookSecretUpdate,
        },
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          webhookUrl: true,
          webhookSecret: true,
          createdAt: true,
        },
      });

      res.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        plan: updated.plan,
        webhookUrl: updated.webhookUrl,
        hasWebhookSecret: !!updated.webhookSecret,
        createdAt: updated.createdAt,
      });
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
        webhookSecret: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.json({
      id: tenant.id,
      name: tenant.name,
      email: tenant.email,
      plan: tenant.plan,
      webhookUrl: tenant.webhookUrl,
      // Never expose the raw secret — consumers only need to know if one is configured
      hasWebhookSecret: !!tenant.webhookSecret,
      createdAt: tenant.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

// ─── POST /v1/tenant/webhook-secret/regenerate ───────────────

router.post(
  '/webhook-secret/regenerate',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;

      const newSecret = generateWebhookSecret();

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { webhookSecret: newSecret },
      });

      // Return the secret ONCE — it is never retrievable after this response.
      // If lost, the tenant must regenerate again.
      res.json({
        webhookSecret: newSecret,
        message:
          'Secret rotated successfully. This value is shown only once — copy it now. ' +
          'Update your webhook verification code before closing this dialog, or all ' +
          'incoming webhooks will fail signature verification.',
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to regenerate webhook secret' });
    }
  }
);

export default router;
