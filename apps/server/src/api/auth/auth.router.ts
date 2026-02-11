import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validation.js';
import { authenticateToken } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

/** Auth router — mounted at `/api/auth`. */
export const authRouter = Router();

// Apply a stricter rate limit to auth endpoints to mitigate brute-force attacks
const authLimiter = rateLimit({ windowMs: 60_000, maxRequests: 20 });
authRouter.use(authLimiter);

/**
 * POST /api/auth/register
 *
 * Creates a new user account and returns the user profile with access and
 * refresh tokens.
 */
authRouter.post(
  '/register',
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email and password, returning the user profile
 * with access and refresh tokens.
 */
authRouter.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/auth/refresh
 *
 * Accepts a valid refresh token and issues a new access + refresh token pair.
 */
authRouter.post(
  '/refresh',
  validate(refreshSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokens = await authService.refreshTokens(req.body.refreshToken);
      res.status(200).json({ ok: true, data: { tokens } });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/auth/me
 *
 * Protected route — returns the authenticated user's profile.
 */
authRouter.get(
  '/me',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await authService.getProfile(req.user!.sub);
      res.status(200).json({ ok: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },
);
