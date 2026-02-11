import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@dsvtt/shared';
import { config } from '../config/index.js';
import { AppError } from './error-handler.js';

// ---------------------------------------------------------------------------
// Extend Express Request to carry authenticated user data
// ---------------------------------------------------------------------------

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user claims, set by {@link authenticateToken}. */
      user?: JwtPayload;
    }
  }
}

/**
 * Express middleware that extracts and verifies a JWT Bearer token from the
 * `Authorization` header. On success the decoded {@link JwtPayload} is
 * attached to `req.user`. On failure a 401 {@link AppError} is raised.
 */
export function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new AppError('Missing or malformed Authorization header', 401, 'AUTH_NO_TOKEN'));
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new AppError('Token has expired', 401, 'AUTH_TOKEN_EXPIRED'));
      return;
    }
    next(new AppError('Invalid token', 401, 'AUTH_INVALID_TOKEN'));
  }
}
