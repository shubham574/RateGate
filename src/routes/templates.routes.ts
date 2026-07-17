import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { TemplateService } from '../services/template.service';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').regex(
    /^[a-z0-9-_]+$/,
    'Template name must be lowercase letters, numbers, hyphens or underscores only'
  ),
  channel: z.enum(['EMAIL', 'SMS']),
  subject: z.string().optional(),
  body: z.string().min(1, 'Template body is required'),
});

const updateTemplateSchema = z.object({
  channel: z.enum(['EMAIL', 'SMS']).optional(),
  subject: z.string().optional(),
  body: z.string().min(1).optional(),
});

// ─── POST /v1/templates — Create or update a template ────────

router.post(
  '/',
  validate(createTemplateSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
      const { name, channel, subject, body } = req.body;

      const template = await TemplateService.upsert(tenantId, {
        name,
        channel,
        subject,
        body,
      });

      res.status(201).json({
        id: template.id,
        name: template.name,
        channel: template.channel,
        subject: template.subject,
        body: template.body,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      });
    } catch (error) {
      throw error;
    }
  }
);

// ─── GET /v1/templates — List all templates ──────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;

    const templates = await prisma.template.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      data: templates.map((t) => ({
        id: t.id,
        name: t.name,
        channel: t.channel,
        subject: t.subject,
        body: t.body,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error) {
    throw error;
  }
});

// ─── GET /v1/templates/:name — Get template by name ──────────

router.get('/:name', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
    const { name } = req.params;

    const template = await TemplateService.findByName(tenantId, name);

    if (!template) {
      res.status(404).json({ error: `Template '${name}' not found` });
      return;
    }

    res.json({
      id: template.id,
      name: template.name,
      channel: template.channel,
      subject: template.subject,
      body: template.body,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
  } catch (error) {
    throw error;
  }
});

// ─── PATCH /v1/templates/:name — Update a template ───────────

router.patch(
  '/:name',
  validate(updateTemplateSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
      const { name } = req.params;

      const existing = await TemplateService.findByName(tenantId, name);
      if (!existing) {
        res.status(404).json({ error: `Template '${name}' not found` });
        return;
      }

      const updated = await prisma.template.update({
        where: { tenantId_name: { tenantId, name } },
        data: req.body,
      });

      res.json({
        id: updated.id,
        name: updated.name,
        channel: updated.channel,
        subject: updated.subject,
        body: updated.body,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      throw error;
    }
  }
);

// ─── DELETE /v1/templates/:name — Delete a template ──────────

router.delete('/:name', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = (req as Request & { auth: AuthenticatedRequest }).auth;
    const { name } = req.params;

    const existing = await TemplateService.findByName(tenantId, name);
    if (!existing) {
      res.status(404).json({ error: `Template '${name}' not found` });
      return;
    }

    await prisma.template.delete({
      where: { tenantId_name: { tenantId, name } },
    });

    res.status(200).json({ message: `Template '${name}' deleted successfully` });
  } catch (error) {
    throw error;
  }
});

export default router;
