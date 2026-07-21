import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Zod validation middleware factory.
 * Validates request body against the provided schema.
 * Returns 400 with detailed errors on validation failure.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error: any) {
      if (error.name === 'ZodError' && Array.isArray(error.issues)) {
        res.status(400).json({
          error: 'validation_error',
          details: error.issues.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Zod validation middleware for query parameters.
 * Validates req.query against the provided schema and stores parsed/transformed
 * result on res.locals.parsedQuery (since req.query is a read-only getter in Express).
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query);
      // Store parsed/transformed result for route handlers to consume.
      // We cannot overwrite req.query (read-only getter in Express 5).
      res.locals.parsedQuery = parsed;
      next();
    } catch (error: any) {
      if (error.name === 'ZodError' && Array.isArray(error.issues)) {
        res.status(400).json({
          error: 'validation_error',
          details: error.issues.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}
