import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';
import { createHash, randomBytes } from 'crypto';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────

const createApiKeySchema = z.object({
  label: z.string().min(1, 'Label is required').max(100).default('New API Key'),
});

// ─── GET /v1/api-keys ─────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;

    const keys = await prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
        revoked: true,
        // NEVER include keyHash or raw key material
      },
    });

    res.json({ data: keys });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// ─── POST /v1/api-keys ────────────────────────────────────────

router.post(
  '/',
  validate(createApiKeySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
      const { label } = req.body;

      // Generate raw key: nk_live_ + 32 random alphanumeric chars
      const randomPart = randomBytes(24).toString('base64url').slice(0, 32);
      const rawKey = `nk_live_${randomPart}`;
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = rawKey.substring(0, 12);

      const apiKey = await prisma.apiKey.create({
        data: {
          tenantId,
          keyHash,
          keyPrefix,
          label,
        },
      });

      // The RAW key is returned ONLY in this creation response, never again
      res.status(201).json({
        id: apiKey.id,
        key: rawKey,
        keyPrefix: apiKey.keyPrefix,
        label: apiKey.label,
        createdAt: apiKey.createdAt,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }
);

// ─── PATCH /v1/api-keys/:id/revoke ────────────────────────────

router.patch('/:id/revoke', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
    const id = req.params.id as string;

    // Verify the key belongs to this tenant
    const existing = await prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }

    // Idempotent: revoking an already-revoked key returns 200, not an error
    const updated = await prisma.apiKey.update({
      where: { id },
      data: { revoked: true },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        revoked: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// ─── DELETE /v1/api-keys/:id ──────────────────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
    const id = req.params.id as string;

    await prisma.apiKey.delete({
      where: {
        id,
        tenantId, // Ensure it belongs to the tenant
      }
    });

    res.json({ message: 'API key revoked and deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;
