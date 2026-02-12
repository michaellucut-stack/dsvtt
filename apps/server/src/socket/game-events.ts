import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@dsvtt/shared';
import { GameEventType } from '@dsvtt/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { gameStartSchema, gamePauseSchema, gameActionSchema } from '@dsvtt/events';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { logEvent } from '../services/event-store.js';

/** Typed Socket.IO server instance. */
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Typed Socket.IO socket with auth data attached. */
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user?: JwtPayload };
};

/**
 * Register game-lifecycle Socket.IO event handlers on a connected socket.
 *
 * Handles:
 * - `GAME_START`: Director starts a new session. Creates a GameSession in DB,
 *   updates room status to ACTIVE, and broadcasts GAME_STARTED to the room.
 * - `GAME_PAUSE`: Pauses the current session. Validates the sender is the
 *   director, updates the session status, and broadcasts GAME_PAUSED.
 * - `GAME_ACTION`: Accepts a generic game action. Validates the actor is a
 *   room member, logs the event, and broadcasts GAME_STATE_UPDATE.
 *
 * @param io - The Socket.IO server instance (for broadcasting).
 * @param socket - The authenticated client socket.
 */
export function registerGameEvents(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user!;

  // ── GAME_START ─────────────────────────────────────────────────────
  socket.on('GAME_START', async (payload, callback) => {
    try {
      const parsed = gameStartSchema.safeParse(payload);
      if (!parsed.success) {
        callback({ ok: false, error: 'Invalid payload' });
        return;
      }

      const { roomId } = parsed.data;

      // Verify the user is the director
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        callback({ ok: false, error: 'Room not found' });
        return;
      }

      if (room.directorId !== user.sub) {
        callback({ ok: false, error: 'Only the director can start a game' });
        return;
      }

      // Check for existing active session
      const existingSession = await prisma.gameSession.findFirst({
        where: {
          roomId,
          status: { in: ['ACTIVE', 'PAUSED', 'SETUP'] },
        },
      });

      if (existingSession) {
        callback({ ok: false, error: 'Room already has an active session' });
        return;
      }

      // Create session and update room in a transaction
      const [session] = await prisma.$transaction([
        prisma.gameSession.create({
          data: {
            roomId,
            status: 'ACTIVE',
          },
        }),
        prisma.room.update({
          where: { id: roomId },
          data: { status: 'ACTIVE' },
        }),
      ]);

      // Broadcast to all room members
      io.to(roomId).emit('GAME_STARTED', {
        sessionId: session.id,
        roomId,
        status: 'active',
      });

      // Log event
      logEvent({
        sessionId: session.id,
        eventType: GameEventType.GAME_STARTED,
        payload: { roomId },
        actorId: user.sub,
        actorType: 'DIRECTOR',
      }).catch((err) => logger.error('Event logging failed', { context: 'event-store', error: String(err) }));

      callback({ ok: true, sessionId: session.id });
    } catch (err) {
      logger.error('GAME_START handler error', { context: 'socket', error: String(err) });
      callback({ ok: false, error: 'Internal server error' });
    }
  });

  // ── GAME_PAUSE ─────────────────────────────────────────────────────
  socket.on('GAME_PAUSE', async (payload) => {
    try {
      const parsed = gamePauseSchema.safeParse(payload);
      if (!parsed.success) return;

      const { sessionId } = parsed.data;

      // Look up session and verify director
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true },
      });

      if (!session) return;
      if (session.room.directorId !== user.sub) return;
      if (session.status !== 'ACTIVE') return;

      // Update session and room status
      await prisma.$transaction([
        prisma.gameSession.update({
          where: { id: sessionId },
          data: { status: 'PAUSED' },
        }),
        prisma.room.update({
          where: { id: session.roomId },
          data: { status: 'PAUSED' },
        }),
      ]);

      // Broadcast to all room members
      io.to(session.roomId).emit('GAME_PAUSED', { sessionId });

      // Log event
      logEvent({
        sessionId,
        eventType: GameEventType.GAME_PAUSED,
        payload: {},
        actorId: user.sub,
        actorType: 'DIRECTOR',
      }).catch((err) => logger.error('Event logging failed', { context: 'event-store', error: String(err) }));
    } catch (err) {
      logger.error('GAME_PAUSE handler error', { context: 'socket', error: String(err) });
    }
  });

  // ── GAME_ACTION ────────────────────────────────────────────────────
  socket.on('GAME_ACTION', async (payload) => {
    try {
      const parsed = gameActionSchema.safeParse(payload);
      if (!parsed.success) return;

      const { sessionId, actionType, data } = parsed.data;

      // Verify the session exists and is active
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true },
      });

      if (!session || session.status !== 'ACTIVE') return;

      // Verify the actor is a member of the room
      const membership = await prisma.roomPlayer.findUnique({
        where: {
          roomId_userId: {
            roomId: session.roomId,
            userId: user.sub,
          },
        },
      });

      if (!membership) return;

      // Determine actor type based on room role
      const actorType = membership.role === 'DIRECTOR' ? 'DIRECTOR' : 'PLAYER';

      // Log the event via centralized event store
      const eventLog = await logEvent({
        sessionId,
        eventType: actionType,
        payload: data as Record<string, unknown>,
        actorId: user.sub,
        actorType,
      });

      // Broadcast state update to all room members
      io.to(session.roomId).emit('GAME_STATE_UPDATE', {
        sessionId,
        state: {
          eventType: actionType,
          data,
          actorId: user.sub,
          actorType: actorType.toLowerCase(),
        },
        sequenceNumber: eventLog.sequenceNumber,
      });
    } catch (err) {
      logger.error('GAME_ACTION handler error', { context: 'socket', error: String(err) });
    }
  });
}
