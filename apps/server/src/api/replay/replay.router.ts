import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { getEventsQuerySchema, getStateAtQuerySchema } from './replay.schemas.js';
import * as eventStore from '../../services/event-store.js';
import * as snapshotService from '../../services/snapshot.service.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/error-handler.js';

export const replayRouter = Router({ mergeParams: true });
replayRouter.use(authenticateToken);

/**
 * GET /api/sessions/:sessionId/replay/events?fromSequence=0&limit=500
 * Retrieve events for session replay, paginated by sequence number.
 */
replayRouter.get('/events', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params['sessionId'] as string;

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { eventCount: true },
    });
    if (!session) throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');

    const parsed = getEventsQuerySchema.parse(req.query);
    const events = await eventStore.getSessionEvents(sessionId, parsed.fromSequence, parsed.limit);

    res.json({
      ok: true,
      data: {
        events,
        totalEvents: session.eventCount,
        hasMore: events.length === parsed.limit,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sessions/:sessionId/replay/state?sequenceNumber=42
 * Reconstruct game state at a specific point in time.
 */
replayRouter.get('/state', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params['sessionId'] as string;

    const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');

    const parsed = getStateAtQuerySchema.parse(req.query);
    const state = await snapshotService.reconstructStateAt(sessionId, parsed.sequenceNumber);

    res.json({ ok: true, data: { state, sequenceNumber: parsed.sequenceNumber } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sessions/:sessionId/replay/snapshots
 * List all snapshots for a session.
 */
replayRouter.get('/snapshots', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params['sessionId'] as string;

    const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');

    const snapshots = await snapshotService.listSnapshots(sessionId);

    res.json({ ok: true, data: { snapshots } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sessions/:sessionId/replay/snapshots
 * Manually trigger snapshot creation.
 */
replayRouter.post('/snapshots', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params['sessionId'] as string;

    // Verify session exists and user is the director
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { room: { select: { directorId: true } } },
    });
    if (!session) throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');

    const userId = (req as Request & { user?: { sub: string } }).user?.sub;
    if (session.room.directorId !== userId) {
      throw new AppError('Only the director can create snapshots', 403, 'FORBIDDEN');
    }

    const snapshot = await snapshotService.createSnapshot(sessionId);

    res.status(201).json({ ok: true, data: snapshot });
  } catch (err) {
    next(err);
  }
});
