import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@dsvtt/shared';
import { GameEventType } from '@dsvtt/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { characterUpdateSchema } from '@dsvtt/events';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import * as characterService from '../api/characters/character.service.js';
import { logEvent } from '../services/event-store.js';

/** Typed Socket.IO server instance. */
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Typed Socket.IO socket with auth data attached. */
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user?: JwtPayload };
};

// ---------------------------------------------------------------------------
// Broadcast helper (called from REST routes)
// ---------------------------------------------------------------------------

/**
 * Broadcast CHARACTER_UPDATED to all members of a room when a character is
 * edited via the REST API.
 */
export function broadcastCharacterUpdated(
  io: TypedServer,
  roomId: string,
  sessionId: string,
  characterId: string,
  changes: Record<string, unknown>,
  updatedBy: string,
): void {
  io.to(roomId).emit('CHARACTER_UPDATED', {
    sessionId,
    characterId,
    changes,
    updatedBy,
  });
}

// ---------------------------------------------------------------------------
// Socket event handler registration
// ---------------------------------------------------------------------------

/**
 * Register character-related Socket.IO event handlers on a connected socket.
 *
 * Handles:
 * - `CHARACTER_UPDATE` — Client pushes character changes via WebSocket;
 *   server validates ownership, persists, and broadcasts CHARACTER_UPDATED.
 */
export function registerCharacterEvents(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user!;

  socket.on('CHARACTER_UPDATE', async (payload) => {
    try {
      const parsed = characterUpdateSchema.safeParse(payload);
      if (!parsed.success) return;

      const { sessionId, characterId, changes } = parsed.data;

      // Verify session exists and get room
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: { select: { id: true, directorId: true } } },
      });
      if (!session) return;

      const roomId = session.room.id;
      if (!socket.rooms.has(roomId)) return;

      // Verify ownership: player owns the character, or user is director
      const character = await prisma.character.findUnique({
        where: { id: characterId },
      });
      if (!character) return;

      const isDirector = session.room.directorId === user.sub;
      if (!isDirector && character.userId !== user.sub) return;

      // Apply the changes via service
      await characterService.updateCharacter(characterId, user.sub, {
        ...(changes['name'] !== undefined && typeof changes['name'] === 'string'
          ? { name: changes['name'] }
          : {}),
        ...(changes['stats'] !== undefined &&
        typeof changes['stats'] === 'object' &&
        changes['stats'] !== null
          ? { stats: changes['stats'] as Record<string, unknown> }
          : {}),
        ...(changes['notes'] !== undefined
          ? { notes: changes['notes'] as string | null }
          : {}),
        ...(changes['inventory'] !== undefined && Array.isArray(changes['inventory'])
          ? { inventory: changes['inventory'] as unknown[] }
          : {}),
      });

      // Broadcast to room
      io.to(roomId).emit('CHARACTER_UPDATED', {
        sessionId,
        characterId,
        changes,
        updatedBy: user.sub,
      });

      // Log event
      const actorType = isDirector ? 'DIRECTOR' : 'PLAYER';
      logEvent({
        sessionId,
        eventType: GameEventType.CHARACTER_UPDATED,
        payload: { characterId, changes },
        actorId: user.sub,
        actorType,
      }).catch((err) => logger.error('Event logging failed', { context: 'event-store', error: String(err) }));
    } catch (err) {
      logger.error('CHARACTER_UPDATE handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });
}
