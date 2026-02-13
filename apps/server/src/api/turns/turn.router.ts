import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../../middleware/auth.js';
import { validate } from '../../middleware/validation.js';
import { getIO } from '../../config/socket-io.js';
import * as turnService from './turn.service.js';

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

/** Zod schema for setting initiative order. */
const setOrderSchema = z.object({
  entries: z
    .array(
      z.object({
        userId: z.string().min(1, 'userId is required'),
        name: z.string().min(1, 'name is required').max(100),
        initiative: z.number().finite('Initiative must be a finite number'),
        isNpc: z.boolean().default(false),
      }),
    )
    .min(1, 'At least one entry is required'),
});

/** Turn router — mounted at `/api/sessions/:sessionId/turns`. */
export const turnRouter = Router({ mergeParams: true });

// All turn routes require authentication
turnRouter.use(authenticateToken);

/**
 * GET /api/sessions/:sessionId/turns
 *
 * Get the current turn order for the session.
 */
turnRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params['sessionId'] as string;
    const state = await turnService.getTurnOrder(sessionId);
    res.status(200).json({ ok: true, data: state });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sessions/:sessionId/turns/set-order
 *
 * Set the initiative order for the session. Director only.
 * Body: { entries: [{ userId: string, initiative: number }] }
 */
turnRouter.post(
  '/set-order',
  validate(setOrderSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const userId = req.user!.sub;
      const entries = req.body.entries as {
        userId: string;
        name: string;
        initiative: number;
        isNpc: boolean;
      }[];

      const state = await turnService.setTurnOrder(sessionId, userId, entries);

      // Broadcast TURN_ORDER_UPDATED so all clients see the initiative order
      const io = getIO();
      io.emit('TURN_ORDER_UPDATED', {
        sessionId,
        order: entries
          .sort((a, b) => b.initiative - a.initiative)
          .map((e) => ({
            userId: e.userId,
            name: e.name,
            initiative: e.initiative,
            isNpc: e.isNpc,
          })),
        roundNumber: state.roundNumber,
      });

      res.status(200).json({ ok: true, data: state });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/sessions/:sessionId/turns/clear
 *
 * End combat by clearing the turn order. Director only.
 */
turnRouter.post(
  '/clear',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const userId = req.user!.sub;

      await turnService.clearTurnOrder(sessionId, userId);

      // Broadcast empty turn order so all clients exit combat mode
      const io = getIO();
      io.emit('TURN_ORDER_UPDATED', {
        sessionId,
        order: [],
        roundNumber: 1,
      });

      res.status(200).json({ ok: true, data: { entries: [], currentIndex: 0, roundNumber: 1 } });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/sessions/:sessionId/turns/next
 *
 * Advance to the next turn. Director only.
 */
turnRouter.post('/next', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params['sessionId'] as string;
    const userId = req.user!.sub;
    const state = await turnService.nextTurn(sessionId, userId);
    res.status(200).json({ ok: true, data: state });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sessions/:sessionId/turns/skip
 *
 * Skip the current turn. Director only.
 */
turnRouter.post('/skip', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params['sessionId'] as string;
    const userId = req.user!.sub;
    const state = await turnService.skipTurn(sessionId, userId);
    res.status(200).json({ ok: true, data: state });
  } catch (err) {
    next(err);
  }
});
