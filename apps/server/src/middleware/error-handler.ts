import type { Request, Response, NextFunction } from 'express';

/**
 * Structured application error with an HTTP status code and machine-readable
 * error code. Operational errors are expected failures (bad input, auth
 * failures, etc.) and are safe to expose to clients.
 */
export class AppError extends Error {
  /** HTTP status code to return. */
  readonly statusCode: number;
  /** Machine-readable error code (e.g. "AUTH_INVALID_TOKEN"). */
  readonly code: string;
  /** Whether this is an expected operational error (vs a programmer bug). */
  readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Express middleware that returns a 404 JSON response for unmatched routes.
 */
export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError('Resource not found', 404, 'NOT_FOUND'));
}

/**
 * Global Express error-handling middleware.
 *
 * Catches both {@link AppError} instances and unexpected errors, returning a
 * consistent JSON envelope. Non-operational errors are logged and masked to
 * avoid leaking internal details.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Unexpected / programmer error — log and return generic 500
  console.error('[UnhandledError]', err);
  res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
