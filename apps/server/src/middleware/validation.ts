import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';

/**
 * Formats Zod validation errors into a consistent array of
 * `{ path, message }` objects for the API error envelope.
 *
 * @param zodError - The Zod error to format.
 * @returns Formatted error details.
 */
function formatZodErrors(zodError: ZodError): Array<{ path: string; message: string }> {
  return zodError.errors.map((e) => ({
    path: e.path.join('.'),
    message: e.message,
  }));
}

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
          details: formatZodErrors(zodError),
        },
      });
      return;
    }

    // Replace body with the parsed (cleaned) value
    req.body = result.data;
    next();
  };
}

/**
 * Middleware factory that validates `req.params` against a Zod schema.
 *
 * On success the parsed parameters replace `req.params`. On failure a 400
 * response is returned with structured Zod error details. Use this to enforce
 * type-safe URL parameter constraints (e.g. UUID format, numeric IDs).
 *
 * @param schema - The Zod schema to validate route parameters against.
 * @returns Express middleware.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 *
 * const paramsSchema = z.object({
 *   sessionId: z.string().uuid(),
 *   mapId: z.string().uuid(),
 * });
 *
 * router.get('/sessions/:sessionId/maps/:mapId', validateParams(paramsSchema), handler);
 * ```
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const zodError = result.error as ZodError;
      res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'URL parameter validation failed',
          details: formatZodErrors(zodError),
        },
      });
      return;
    }

    // Replace params with the parsed (cleaned) value
    req.params = result.data as Record<string, string>;
    next();
  };
}

/**
 * Middleware factory that validates `req.query` against a Zod schema.
 *
 * On success the parsed query replaces `req.query`. On failure a 400 response
 * is returned with structured Zod error details. Use this to enforce type-safe
 * query string constraints (e.g. pagination limits, sort directions).
 *
 * @param schema - The Zod schema to validate query parameters against.
 * @returns Express middleware.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 *
 * const querySchema = z.object({
 *   page: z.coerce.number().int().positive().default(1),
 *   limit: z.coerce.number().int().min(1).max(100).default(20),
 *   sort: z.enum(['name', 'created']).default('created'),
 * });
 *
 * router.get('/items', validateQuery(querySchema), handler);
 * ```
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const zodError = result.error as ZodError;
      res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          details: formatZodErrors(zodError),
        },
      });
      return;
    }

    // Replace query with the parsed (cleaned) value
    // Cast needed because Express types req.query as ParsedQs
    req.query = result.data as Record<string, string>;
    next();
  };
}
