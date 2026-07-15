import { clerkMiddleware, getAuth } from '@clerk/express';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

// 1. Clerk validates the JWT and adds `req.auth`
// 2. We look up the Tenant by `clerkUserId`
export const clerkAuth = [
  clerkMiddleware(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId: clerkUserId } = getAuth(req);
      
      if (!clerkUserId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const tenant = await prisma.tenant.findUnique({
        where: { clerkUserId },
      });

      if (!tenant) {
        res.status(403).json({ error: 'Tenant not found. Please sync your account first.' });
        return;
      }

      // Re-assign req.auth to our internal AuthenticatedRequest format
      // so downstream handlers can just use req.auth.tenantId safely.
      // @ts-ignore
      req.auth = {
        tenantId: tenant.id,
        clerkUserId,
      };

      next();
    } catch (error) {
      next(error);
    }
  }
];
