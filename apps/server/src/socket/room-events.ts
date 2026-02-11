import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@dsvtt/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { roomJoinSchema, roomLeaveSchema } from '@dsvtt/events';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

/** Typed Socket.IO server instance. */
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Typed Socket.IO socket with auth data attached. */
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user?: JwtPayload };
};

/**
 * In-memory presence tracker. Maps roomId → Set of userId strings currently
 * connected to the room's Socket.IO room.
 */
const roomPresence = new Map<string, Set<string>>();

/**
 * Get the set of online user IDs in a room.
 *
 * @param roomId - The room to query.
 * @returns A read-only set of user IDs, or an empty set if no one is online.
 */
export function getOnlineUsers(roomId: string): ReadonlySet<string> {
  return roomPresence.get(roomId) ?? new Set();
}

/**
 * Track a user joining a room's presence set.
 */
function trackJoin(roomId: string, userId: string): void {
  let members = roomPresence.get(roomId);
  if (!members) {
    members = new Set();
    roomPresence.set(roomId, members);
  }
  members.add(userId);
}

/**
 * Track a user leaving a room's presence set. Cleans up empty sets.
 */
function trackLeave(roomId: string, userId: string): void {
  const members = roomPresence.get(roomId);
  if (members) {
    members.delete(userId);
    if (members.size === 0) {
      roomPresence.delete(roomId);
    }
  }
}

/**
 * Register room-related Socket.IO event handlers on a connected socket.
 *
 * Handles:
 * - `ROOM_JOIN`: Client joins a Socket.IO room, presence tracked, ROOM_JOINED
 *   broadcast to room members.
 * - `ROOM_LEAVE`: Client leaves a Socket.IO room, presence removed,
 *   ROOM_LEFT broadcast to room members.
 *
 * On disconnect, the user is automatically removed from all tracked rooms.
 *
 * @param io - The Socket.IO server instance (for broadcasting).
 * @param socket - The authenticated client socket.
 */
export function registerRoomEvents(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user!;

  // ── ROOM_JOIN ──────────────────────────────────────────────────────
  socket.on('ROOM_JOIN', async (payload, callback) => {
    try {
      const parsed = roomJoinSchema.safeParse(payload);
      if (!parsed.success) {
        callback({ ok: false, error: 'Invalid payload' });
        return;
      }

      const { roomId } = parsed.data;

      // Verify the user is actually a member of this room in the DB
      const membership = await prisma.roomPlayer.findUnique({
        where: { roomId_userId: { roomId, userId: user.sub } },
        include: { user: { select: { displayName: true } } },
      });

      if (!membership) {
        callback({ ok: false, error: 'Not a member of this room' });
        return;
      }

      // Join the Socket.IO room
      await socket.join(roomId);
      trackJoin(roomId, user.sub);

      // Broadcast to all room members (including sender)
      io.to(roomId).emit('ROOM_JOINED', {
        roomId,
        userId: user.sub,
        displayName: membership.user.displayName,
        role: membership.role.toLowerCase() as 'director' | 'player',
      });

      callback({ ok: true });
    } catch (err) {
      logger.error('ROOM_JOIN handler error', { context: 'socket', error: String(err) });
      callback({ ok: false, error: 'Internal server error' });
    }
  });

  // ── ROOM_LEAVE ─────────────────────────────────────────────────────
  socket.on('ROOM_LEAVE', (payload) => {
    try {
      const parsed = roomLeaveSchema.safeParse(payload);
      if (!parsed.success) return;

      const { roomId } = parsed.data;

      socket.leave(roomId);
      trackLeave(roomId, user.sub);

      // Broadcast to remaining room members
      io.to(roomId).emit('ROOM_LEFT', {
        roomId,
        userId: user.sub,
      });
    } catch (err) {
      logger.error('ROOM_LEAVE handler error', { context: 'socket', error: String(err) });
    }
  });

  // ── Cleanup on disconnect ──────────────────────────────────────────
  socket.on('disconnect', () => {
    // Remove user from all presence sets
    for (const [roomId, members] of roomPresence.entries()) {
      if (members.has(user.sub)) {
        members.delete(user.sub);

        // Notify room members the user went offline
        io.to(roomId).emit('ROOM_LEFT', {
          roomId,
          userId: user.sub,
        });

        if (members.size === 0) {
          roomPresence.delete(roomId);
        }
      }
    }
  });
}

/**
 * Broadcast a ROOM_CREATED event to all connected sockets (lobby broadcast).
 * Called from the HTTP route after a room is created.
 *
 * @param io - The Socket.IO server instance.
 * @param payload - The room creation payload to broadcast.
 */
export function broadcastRoomCreated(
  io: TypedServer,
  payload: {
    roomId: string;
    name: string;
    directorId: string;
    maxPlayers: number;
  },
): void {
  io.emit('ROOM_CREATED', payload);
}
