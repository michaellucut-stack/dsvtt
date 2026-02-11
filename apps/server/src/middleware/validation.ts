import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';

/**
 * Middleware factory that validates `req.body` against a Zod schema.
 *
 * On success the parsed (and potentially transformed) body replaces `req.body`.
 * On failure a 400 response is returned with structured Zod error details.
 *
 * @param schema - The Zod schema to validate the request body against.
 * @returns Express middleware.
 *
 * @example
 * ```ts
 * router.post('/register', validate(registerSchema), handler);
 * ```
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const zodError = result.error as ZodError;
      res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body validation failed',
          details: zodError.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      });
      return;
    }

    // Replace body with the parsed (cleaned) value
    req.body = result.data;
    next();
  };
}
