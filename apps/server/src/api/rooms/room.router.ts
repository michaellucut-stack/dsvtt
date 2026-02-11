import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { validate } from '../../middleware/validation.js';
import {
  createRoomSchema,
  joinRoomSchema,
  listRoomsQuerySchema,
} from './room.schemas.js';
import * as roomService from './room.service.js';

/** Room router — mounted at `/api/rooms`. */
export const roomRouter = Router();

// All room routes require authentication
roomRouter.use(authenticateToken);

/**
 * POST /api/rooms
 *
 * Create a new room. The authenticated user becomes the Director and is
 * automatically added as a player with the DIRECTOR role.
 */
roomRouter.post(
  '/',
  validate(createRoomSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const room = await roomService.createRoom(req.body, req.user!.sub);
      res.status(201).json({ ok: true, data: room });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/rooms
 *
 * List rooms with optional status filter and pagination.
 * Query params: status (WAITING|ACTIVE|PAUSED|ENDED), page, limit.
 */
roomRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const queryResult = listRoomsQuerySchema.safeParse(req.query);
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

      const result = await roomService.listRooms(queryResult.data);
      res.status(200).json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/rooms/:id
 *
 * Get detailed information about a specific room including its players list.
 */
roomRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const room = await roomService.getRoomDetail(req.params['id'] as string);
      res.status(200).json({ ok: true, data: room });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/rooms/:id/join
 *
 * Join a room. Validates max players and prevents duplicate joins.
 * Body: { role?: 'player' | 'director' } (defaults to 'player').
 */
roomRouter.post(
  '/:id/join',
  validate(joinRoomSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const room = await roomService.joinRoom(
        req.params['id'] as string,
        req.user!.sub,
        req.body,
      );
      res.status(200).json({ ok: true, data: room });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/rooms/:id/leave
 *
 * Leave a room. If the director leaves, the room status is set to ENDED.
 */
roomRouter.post(
  '/:id/leave',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await roomService.leaveRoom(req.params['id'] as string, req.user!.sub);
      res.status(200).json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/rooms/:id
 *
 * Delete a room. Only the room's director may perform this action.
 */
roomRouter.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await roomService.deleteRoom(req.params['id'] as string, req.user!.sub);
      res.status(200).json({ ok: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);
