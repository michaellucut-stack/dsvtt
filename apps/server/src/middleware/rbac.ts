import type { Request, Response, NextFunction } from 'express';
import type { PlayerRole } from '@dsvtt/shared';
import { AppError } from './error-handler.js';

/**
 * Middleware factory that restricts access to users whose `role` claim is
 * included in the supplied allow-list.
 *
 * Must be mounted **after** {@link authenticateToken} so that `req.user` is
 * populated.
 *
 * @param roles - One or more {@link PlayerRole} values that are permitted.
 * @returns Express middleware that returns 403 if the user's role is not allowed.
 *
 * @example
 * ```ts
 * router.delete('/rooms/:id', authenticateToken, requireRole('director'), handler);
 * ```
 */
export function requireRole(...roles: PlayerRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      return;
    }

    if (!roles.includes(user.role)) {
      next(
        new AppError(
          `Insufficient permissions. Required role(s): ${roles.join(', ')}`,
          403,
          'FORBIDDEN',
        ),
      );
      return;
    }

    next();
  };
}
