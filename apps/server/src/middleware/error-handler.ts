import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

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
 * consistent JSON envelope. In production, stack traces and internal details
 * are never leaked to the client. All errors are logged via the structured
 * winston logger with request-id correlation.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? 'unknown';

  if (err instanceof AppError) {
    // Log operational errors at appropriate levels based on status code
    const logLevel = err.statusCode >= 500 ? 'error' : 'warn';
    logger[logLevel](err.message, {
      context: 'error-handler',
      requestId,
      code: err.code,
      statusCode: err.statusCode,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      ...(NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
    });

    res.status(err.statusCode).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Unexpected / programmer error — always log full details server-side
  logger.error('Unhandled error', {
    context: 'error-handler',
    requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  });

  // In production, never expose stack traces or internal error details
  const isProduction = NODE_ENV === 'production';

  res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      ...(isProduction ? {} : { detail: err.message, stack: err.stack }),
    },
  });
}
