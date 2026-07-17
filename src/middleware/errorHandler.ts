import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler middleware.
 * Catches unhandled errors and returns a consistent JSON response.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message);

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Prisma known errors
  if ((err as any).code === 'P2002') {
    res.status(409).json({
      error: 'conflict',
      message: 'A record with that unique constraint already exists',
    });
    return;
  }

  res.status(500).json({
    error: 'internal_server_error',
    // TODO: revert to non-verbose after debugging
    message: err.message || 'An unexpected error occurred',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
}
