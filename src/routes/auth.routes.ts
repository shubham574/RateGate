import { Router, Request, Response } from 'express';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { prisma } from '../config/prisma';
import { createHash, randomBytes } from 'crypto';
import { Plan, RateLimitScope, RateLimitStrategy, Channel } from '@prisma/client';

const router = Router();

// /v1/auth/sync
// Used by the dashboard to provision a Tenant for a new Clerk user
router.post(
  '/sync',
  clerkMiddleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId: clerkUserId } = getAuth(req);
      if (!clerkUserId) {
        console.error('[DashboardAuthSync Error] Unauthorized: No clerkUserId.', {
          auth: getAuth(req),
          headers: req.headers.authorization ? 'Bearer provided' : 'None',
        });
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { email, firstName, lastName } = req.body;

      let tenant = await prisma.tenant.findUnique({
        where: { clerkUserId },
      });

      if (tenant) {
        res.status(200).json({ message: 'Tenant already sunk', tenantId: tenant.id });
        return;
      }

      // 1. Create Tenant
      const tenantName = firstName ? `${firstName}'s Org` : 'My Organization';
      tenant = await prisma.tenant.create({
        data: {
          name: tenantName,
          email: email || `${clerkUserId}@placeholder.rategate.dev`,
          clerkUserId,
          plan: Plan.FREE,
        },
      });

      // 2. Create Default API Key
      const rawKey = `rg_${randomBytes(32).toString('hex')}`;
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = rawKey.substring(0, 8);

      await prisma.apiKey.create({
        data: {
          tenantId: tenant.id,
          keyHash,
          keyPrefix,
          label: 'Default Key',
        },
      });

      // 3. Create Default Rate Limit Rules (Sandbox limits)
      await prisma.rateLimitRule.createMany({
        data: [
          {
            tenantId: tenant.id,
            scope: RateLimitScope.API_KEY,
            windowSecs: 60,
            maxRequests: 50,
            strategy: RateLimitStrategy.SLIDING_WINDOW,
          },
          {
            tenantId: tenant.id,
            scope: RateLimitScope.RECIPIENT,
            channel: Channel.EMAIL,
            windowSecs: 3600,
            maxRequests: 5,
            strategy: RateLimitStrategy.SLIDING_WINDOW,
          },
        ],
      });

      res.status(201).json({
        message: 'Tenant provisioned',
        tenantId: tenant.id,
        // We return the raw key ONLY ONCE here.
        initialApiKey: rawKey,
      });
    } catch (error) {
      // If P2002 on unique constraint, another request just created it
      if ((error as any).code === 'P2002') {
        const existing = await prisma.tenant.findUnique({ where: { clerkUserId: (req as any).auth.userId } });
        if (existing) {
          res.status(200).json({ message: 'Tenant already sunk (race condition)', tenantId: existing.id });
          return;
        }
      }
      console.error('[DashboardAuthSync Error]', error);
      res.status(500).json({ error: 'Failed to provision tenant' });
    }
  }
);

export default router;
