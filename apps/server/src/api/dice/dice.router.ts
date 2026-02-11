import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { validate } from '../../middleware/validation.js';
import { rollDiceSchema, diceHistoryQuerySchema } from './dice.schemas.js';
import * as diceService from './dice.service.js';
import { prisma } from '../../config/prisma.js';

/** Dice router — mounted at `/api/sessions/:sessionId/dice`. */
export const diceRouter = Router({ mergeParams: true });

// All dice routes require authentication
diceRouter.use(authenticateToken);

/**
 * POST /api/sessions/:sessionId/dice/roll
 *
 * Roll dice using the specified formula. The result is evaluated by the
 * dice engine, persisted to DiceRollLog, and returned to the client.
 */
diceRouter.post(
  '/roll',
  validate(rollDiceSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const { formula, isPrivate } = req.body;

      const { roll } = await diceService.rollAndPersist(
        sessionId,
        req.user!.sub,
        formula,
        isPrivate,
      );

      res.status(200).json({ ok: true, data: roll });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/sessions/:sessionId/dice/history
 *
 * Get paginated dice roll history for the session. Private rolls are only
 * visible to the roller and the room's director.
 */
diceRouter.get(
  '/history',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const userId = req.user!.sub;

      const queryResult = diceHistoryQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: queryResult.error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
        });
        return;
      }

      // Determine if user is the director
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: { select: { directorId: true } } },
      });

      if (!session) {
        res.status(404).json({
          ok: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
        });
        return;
      }

      const isDirector = session.room.directorId === userId;

      const result = await diceService.getDiceHistory(
        sessionId,
        userId,
        isDirector,
        queryResult.data.page,
        queryResult.data.limit,
      );

      res.status(200).json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);
