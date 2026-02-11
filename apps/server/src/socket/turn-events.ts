import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@dsvtt/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { turnEndSchema, turnSkipSchema } from '@dsvtt/events';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import * as turnService from '../api/turns/turn.service.js';

/** Typed Socket.IO server instance. */
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Typed Socket.IO socket with auth data attached. */
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user?: JwtPayload };
};

/**
 * Register turn-management Socket.IO event handlers on a connected socket.
 *
 * Handles:
 * - `TURN_END`: Director advances to the next turn. Broadcasts
 *   TURN_CHANGED to the room.
 * - `TURN_SKIP`: Director skips a player's turn. Broadcasts
 *   TURN_CHANGED to the room.
 *
 * Note: TURN_SET_ORDER is handled via the REST API (POST /turns/set-order)
 * since it requires a structured body. The REST handler should trigger
 * the TURN_ORDER_UPDATED broadcast via the io instance exported from
 * index.ts.
 *
 * @param io - The Socket.IO server instance.
 * @param socket - The authenticated client socket.
 */
export function registerTurnEvents(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user!;

  // ── TURN_END (advance to next turn) ─────────────────────────────────
  socket.on('TURN_END', async (payload) => {
    try {
      const parsed = turnEndSchema.safeParse(payload);
      if (!parsed.success) return;

      const { sessionId } = parsed.data;

      // Look up session to get room ID and verify director
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: { select: { id: true, directorId: true } } },
      });
      if (!session) return;

      const roomId = session.room.id;

      // Only director can advance turns
      if (session.room.directorId !== user.sub) return;
      if (!socket.rooms.has(roomId)) return;

      // Advance turn via service
      let state;
      try {
        state = await turnService.nextTurn(sessionId, user.sub);
      } catch {
        // Turn order not set or other validation error — silently ignore
        return;
      }

      const currentPlayerId = state.entries[state.currentIndex]?.userId;
      if (!currentPlayerId) return;

      // Broadcast to room
      io.to(roomId).emit('TURN_CHANGED', {
        sessionId,
        currentPlayerId,
        roundNumber: state.roundNumber,
      });
    } catch (err) {
      logger.error('TURN_END handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });

  // ── TURN_SKIP ──────────────────────────────────────────────────────
  socket.on('TURN_SKIP', async (payload) => {
    try {
      const parsed = turnSkipSchema.safeParse(payload);
      if (!parsed.success) return;

      const { sessionId } = parsed.data;

      // Look up session to get room ID and verify director
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: { select: { id: true, directorId: true } } },
      });
      if (!session) return;

      const roomId = session.room.id;

      // Only director can skip turns
      if (session.room.directorId !== user.sub) return;
      if (!socket.rooms.has(roomId)) return;

      // Skip turn via service
      let state;
      try {
        state = await turnService.skipTurn(sessionId, user.sub);
      } catch {
        return;
      }

      const currentPlayerId = state.entries[state.currentIndex]?.userId;
      if (!currentPlayerId) return;

      // Broadcast to room
      io.to(roomId).emit('TURN_CHANGED', {
        sessionId,
        currentPlayerId,
        roundNumber: state.roundNumber,
      });
    } catch (err) {
      logger.error('TURN_SKIP handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });
}
