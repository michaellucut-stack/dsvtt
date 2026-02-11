import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@dsvtt/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { npcActionSchema } from '@dsvtt/events';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import type { NpcItem } from '../api/npcs/npc.service.js';

/** Typed Socket.IO server instance. */
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Typed Socket.IO socket with auth data attached. */
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user?: JwtPayload };
};

// ---------------------------------------------------------------------------
// Broadcast helpers (called from REST routes via the exported `io` instance)
// ---------------------------------------------------------------------------

/**
 * Broadcast NPC_CREATED to all members of a room.
 */
export function broadcastNpcCreated(
  io: TypedServer,
  roomId: string,
  sessionId: string,
  npc: NpcItem,
): void {
  io.to(roomId).emit('NPC_CREATED', {
    sessionId,
    npc: {
      id: npc.id,
      name: npc.name,
      stats: npc.stats,
      notes: npc.notes,
      tokenId: npc.tokenId,
    },
  });
}

/**
 * Broadcast NPC_UPDATED to all members of a room.
 */
export function broadcastNpcUpdated(
  io: TypedServer,
  roomId: string,
  sessionId: string,
  npc: NpcItem,
): void {
  io.to(roomId).emit('NPC_UPDATED', {
    sessionId,
    npc: {
      id: npc.id,
      name: npc.name,
      stats: npc.stats,
      notes: npc.notes,
      tokenId: npc.tokenId,
    },
  });
}

/**
 * Broadcast NPC_DELETED to all members of a room.
 */
export function broadcastNpcDeleted(
  io: TypedServer,
  roomId: string,
  sessionId: string,
  npcId: string,
): void {
  io.to(roomId).emit('NPC_DELETED', { sessionId, npcId });
}

// ---------------------------------------------------------------------------
// Socket event handler registration
// ---------------------------------------------------------------------------

/**
 * Register NPC-related Socket.IO event handlers on a connected socket.
 *
 * Handles:
 * - `NPC_ACTION` — Director triggers an NPC action; server broadcasts
 *   `NPC_ACTION_BROADCAST` to the room.
 *
 * NPC CRUD broadcasts (NPC_CREATED, NPC_UPDATED, NPC_DELETED) are triggered
 * from REST routes via the broadcast helper functions above.
 */
export function registerNpcEvents(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user!;

  socket.on('NPC_ACTION', async (payload) => {
    try {
      const parsed = npcActionSchema.safeParse(payload);
      if (!parsed.success) return;

      const { sessionId, npcId, actionType, data } = parsed.data;

      // Verify session and director status
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: { select: { id: true, directorId: true } } },
      });
      if (!session) return;

      const roomId = session.room.id;
      if (!socket.rooms.has(roomId)) return;

      // Only directors can trigger NPC actions
      if (session.room.directorId !== user.sub) return;

      // Look up NPC name
      const npc = await prisma.npc.findUnique({
        where: { id: npcId },
        select: { name: true },
      });
      if (!npc) return;

      // Broadcast to room
      io.to(roomId).emit('NPC_ACTION_BROADCAST', {
        sessionId,
        npcId,
        npcName: npc.name,
        actionType,
        data,
      });
    } catch (err) {
      logger.error('NPC_ACTION handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });
}
