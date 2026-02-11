import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../../middleware/auth.js';
import { validate } from '../../middleware/validation.js';
import * as sessionService from './session.service.js';

/** Schema for the PATCH session status body. */
const updateSessionStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'ENDED']),
});

/** Session router — mounted at `/api`. Session routes span two URL patterns. */
export const sessionRouter = Router();

// All session routes require authentication
sessionRouter.use(authenticateToken);

/**
 * POST /api/rooms/:roomId/sessions
 *
 * Start a new game session for the given room. Only the room's director may
 * perform this action.
 */
sessionRouter.post(
  '/rooms/:roomId/sessions',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await sessionService.startSession(
        req.params['roomId'] as string,
        req.user!.sub,
      );
      res.status(201).json({ ok: true, data: session });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/rooms/:roomId/sessions
 *
 * List all sessions for the given room, ordered by start time descending.
 */
sessionRouter.get(
  '/rooms/:roomId/sessions',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessions = await sessionService.listSessions(req.params['roomId'] as string);
      res.status(200).json({ ok: true, data: sessions });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/sessions/:id
 *
 * Get detailed information about a single session including its event count.
 */
sessionRouter.get(
  '/sessions/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await sessionService.getSessionDetail(req.params['id'] as string);
      res.status(200).json({ ok: true, data: session });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/sessions/:id/status
 *
 * Update the status of a game session. Only the room's director may change
 * session status. Valid transitions: SETUP→ACTIVE, ACTIVE→PAUSED|ENDED,
 * PAUSED→ACTIVE|ENDED.
 */
sessionRouter.patch(
  '/sessions/:id/status',
  validate(updateSessionStatusSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await sessionService.updateSessionStatus(
        req.params['id'] as string,
        req.user!.sub,
        req.body.status,
      );
      res.status(200).json({ ok: true, data: session });
    } catch (err) {
      next(err);
    }
  },
);
