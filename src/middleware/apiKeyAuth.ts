import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../types';

/**
 * API Key Authentication Middleware
 * 
 * Extracts Bearer token from Authorization header, hashes with SHA-256,
 * looks up the hash in the database, validates the key is not revoked,
 * and attaches tenantId + apiKeyId to the request object.
 */
export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'Missing or invalid Authorization header. Use: Bearer <api-key>',
      });
      return;
    }

    const rawKey = authHeader.slice(7).trim();

    if (!rawKey) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'API key is empty',
      });
      return;
    }

    // Hash the key with SHA-256 — we never store or compare raw keys
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { tenant: true },
    });

    if (!apiKey) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid API key',
      });
      return;
    }

    if (apiKey.revoked) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'API key has been revoked',
      });
      return;
    }

    // Update lastUsedAt (fire and forget — don't block the request)
    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    // Attach auth info to the request
    (req as Request & { auth: AuthenticatedRequest }).auth = {
      tenantId: apiKey.tenantId,
      apiKeyId: apiKey.id,
    };

    next();
  } catch (error) {
    next(error);
  }
}
