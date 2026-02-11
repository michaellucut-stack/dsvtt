import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { ChatChannel } from '@prisma/client';
import { authenticateToken } from '../../middleware/auth.js';
import { validate } from '../../middleware/validation.js';
import { sendMessageSchema, chatHistoryQuerySchema } from './chat.schemas.js';
import * as chatService from './chat.service.js';
import { prisma } from '../../config/prisma.js';

/** Chat router — mounted at `/api/sessions/:sessionId/chat`. */
export const chatRouter = Router({ mergeParams: true });

// All chat routes require authentication
chatRouter.use(authenticateToken);

/**
 * GET /api/sessions/:sessionId/chat
 *
 * Get paginated chat history for the session. Whispers are only visible to
 * the sender, recipient, and the room's director.
 */
chatRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const userId = req.user!.sub;

      const queryResult = chatHistoryQuerySchema.safeParse(req.query);
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

      const result = await chatService.getChatHistory(
        sessionId,
        userId,
        isDirector,
        queryResult.data.page,
        queryResult.data.limit,
        queryResult.data.channel as ChatChannel | undefined,
      );

      res.status(200).json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/sessions/:sessionId/chat
 *
 * Send a chat message. For whisper messages, recipientId is required and
 * the recipient must be a member of the room.
 */
chatRouter.post(
  '/',
  validate(sendMessageSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const userId = req.user!.sub;
      const { content, channel, recipientId } = req.body;

      // Look up sender's display name
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      });

      if (!user) {
        res.status(401).json({
          ok: false,
          error: { code: 'AUTH_USER_NOT_FOUND', message: 'User not found' },
        });
        return;
      }

      const message = await chatService.sendMessage(
        sessionId,
        userId,
        user.displayName,
        channel as ChatChannel,
        content,
        recipientId,
      );

      res.status(201).json({ ok: true, data: message });
    } catch (err) {
      next(err);
    }
  },
);
