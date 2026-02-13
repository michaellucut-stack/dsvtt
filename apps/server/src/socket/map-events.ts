import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@dsvtt/shared';
import { GameEventType } from '@dsvtt/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import {
  mapLoadSchema,
  mapUpdateSchema,
  tokenMoveSchema,
  tokenAddSchema,
  tokenRemoveSchema,
  fogCreateSchema,
  fogUpdateSchema,
} from '@dsvtt/events';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import * as mapService from '../api/maps/map.service.js';
import { logEvent } from '../services/event-store.js';

/** Typed Socket.IO server instance. */
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Typed Socket.IO socket with auth data attached. */
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user?: JwtPayload };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the Socket.IO room ID from a map's session. The room used for
 * broadcasting is the Room (lobby) that owns the session.
 *
 * @param mapId - The game map ID.
 * @returns The room ID to broadcast to, or null if not found.
 */
async function getRoomIdForMap(mapId: string): Promise<string | null> {
  const map = await prisma.gameMap.findUnique({
    where: { id: mapId },
    include: { session: { select: { roomId: true } } },
  });
  return map?.session.roomId ?? null;
}

/**
 * Resolve the session ID for a given map.
 */
async function getSessionIdForMap(mapId: string): Promise<string | null> {
  const map = await prisma.gameMap.findUnique({
    where: { id: mapId },
    select: { sessionId: true },
  });
  return map?.sessionId ?? null;
}

/**
 * Check whether a socket is currently in a given Socket.IO room.
 */
function isInRoom(socket: TypedSocket, roomId: string): boolean {
  return socket.rooms.has(roomId);
}

/**
 * Check whether a user is the director of the room that owns a map's session.
 *
 * @param mapId - The game map ID.
 * @param userId - The user ID to check.
 * @returns True if the user is the room's director.
 */
async function isDirectorForMap(mapId: string, userId: string): Promise<boolean> {
  const map = await prisma.gameMap.findUnique({
    where: { id: mapId },
    include: { session: { include: { room: { select: { directorId: true } } } } },
  });
  return map?.session.room.directorId === userId;
}

/**
 * Look up the room membership role for a given user in the room that owns
 * a map's session.
 *
 * @param mapId - The game map ID.
 * @param userId - The user ID.
 * @returns The player role ('DIRECTOR' | 'PLAYER'), or null if not a member.
 */
async function getMembershipForMap(
  mapId: string,
  userId: string,
): Promise<'DIRECTOR' | 'PLAYER' | null> {
  const map = await prisma.gameMap.findUnique({
    where: { id: mapId },
    include: { session: { select: { roomId: true } } },
  });
  if (!map) return null;

  const membership = await prisma.roomPlayer.findUnique({
    where: {
      roomId_userId: { roomId: map.session.roomId, userId },
    },
  });
  return membership?.role ?? null;
}

// ---------------------------------------------------------------------------
// Event registration
// ---------------------------------------------------------------------------

/**
 * Register map-related Socket.IO event handlers on a connected socket.
 *
 * Handles:
 * - `MAP_LOAD` — client requests current map state; server responds with
 *   `MAP_LOADED` containing the full map, tokens, and fog regions.
 * - `MAP_UPDATE` — director updates map settings; broadcasts `MAP_UPDATED`.
 * - `TOKEN_MOVE` — client moves a token; validates ownership; broadcasts
 *   `TOKEN_MOVED`.
 * - `TOKEN_ADD` — director adds a token; broadcasts `TOKEN_ADDED`.
 * - `TOKEN_REMOVE` — director removes a token; broadcasts `TOKEN_REMOVED`.
 * - `FOG_UPDATE` — director updates fog region visibility; broadcasts
 *   `FOG_UPDATED`.
 *
 * @param io - The Socket.IO server instance.
 * @param socket - The authenticated client socket.
 */
export function registerMapEvents(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user!;

  // ── MAP_LOAD ─────────────────────────────────────────────────────────
  socket.on('MAP_LOAD', async (payload) => {
    try {
      const parsed = mapLoadSchema.safeParse(payload);
      if (!parsed.success) return;

      const { mapId } = parsed.data;

      // Resolve room and verify socket is in the room
      const roomId = await getRoomIdForMap(mapId);
      if (!roomId || !isInRoom(socket, roomId)) return;

      const state = await mapService.getMapState(mapId);

      socket.emit('MAP_LOADED', {
        mapId: state.id,
        sessionId: state.sessionId,
        name: state.name,
        backgroundUrl: state.backgroundUrl,
        gridWidth: state.gridWidth,
        gridHeight: state.gridHeight,
        gridSize: state.gridSize,
      });
    } catch (err) {
      logger.error('MAP_LOAD handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });

  // ── MAP_UPDATE ───────────────────────────────────────────────────────
  socket.on('MAP_UPDATE', async (payload) => {
    try {
      const parsed = mapUpdateSchema.safeParse(payload);
      if (!parsed.success) return;

      const { mapId, ...changes } = parsed.data;

      // Verify director status
      const isDir = await isDirectorForMap(mapId, user.sub);
      if (!isDir) return;

      // Resolve room and verify socket is in the room
      const roomId = await getRoomIdForMap(mapId);
      if (!roomId || !isInRoom(socket, roomId)) return;

      // Apply changes via service
      await mapService.updateMap(mapId, changes);

      // Broadcast update to all room members
      io.to(roomId).emit('MAP_UPDATED', {
        mapId,
        changes: changes as Record<string, unknown>,
        updatedBy: user.sub,
      });

      // Log event
      const sessionId = await getSessionIdForMap(mapId);
      if (sessionId) {
        logEvent({
          sessionId,
          eventType: GameEventType.MAP_UPDATED,
          payload: { mapId, changes: changes as Record<string, unknown> },
          actorId: user.sub,
          actorType: 'DIRECTOR',
        }).catch((err) =>
          logger.error('Event logging failed', { context: 'event-store', error: String(err) }),
        );
      }
    } catch (err) {
      logger.error('MAP_UPDATE handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });

  // ── TOKEN_MOVE ───────────────────────────────────────────────────────
  socket.on('TOKEN_MOVE', async (payload) => {
    try {
      const parsed = tokenMoveSchema.safeParse(payload);
      if (!parsed.success) return;

      const { tokenId, mapId, x, y } = parsed.data;

      // Resolve room and verify socket is in the room
      const roomId = await getRoomIdForMap(mapId);
      if (!roomId || !isInRoom(socket, roomId)) return;

      // Validate ownership: players can only move their own tokens,
      // directors can move any token.
      const role = await getMembershipForMap(mapId, user.sub);
      if (!role) return;

      if (role === 'PLAYER') {
        const token = await prisma.token.findUnique({ where: { id: tokenId } });
        if (!token || token.ownerId !== user.sub) return;
      }

      // Apply move
      await mapService.moveToken(tokenId, x, y);

      // Broadcast to room
      io.to(roomId).emit('TOKEN_MOVED', {
        tokenId,
        mapId,
        x,
        y,
        movedBy: user.sub,
      });

      // Log event
      const sessionId = await getSessionIdForMap(mapId);
      if (sessionId) {
        logEvent({
          sessionId,
          eventType: GameEventType.TOKEN_MOVED,
          payload: { tokenId, mapId, x, y },
          actorId: user.sub,
          actorType: role as 'DIRECTOR' | 'PLAYER',
        }).catch((err) =>
          logger.error('Event logging failed', { context: 'event-store', error: String(err) }),
        );
      }
    } catch (err) {
      logger.error('TOKEN_MOVE handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });

  // ── TOKEN_ADD ────────────────────────────────────────────────────────
  socket.on('TOKEN_ADD', async (payload, callback) => {
    try {
      const parsed = tokenAddSchema.safeParse(payload);
      if (!parsed.success) {
        callback({ ok: false, error: 'Invalid payload' });
        return;
      }

      const { mapId, name, imageUrl, x, y, width, height, layer, visible } = parsed.data;

      // Resolve room and verify socket is in the room
      const roomId = await getRoomIdForMap(mapId);
      if (!roomId || !isInRoom(socket, roomId)) {
        callback({ ok: false, error: 'Not in room' });
        return;
      }

      // Players can add tokens on the 'token' layer (e.g. placing their
      // character after creation). Other layers are director-only.
      const role = await getMembershipForMap(mapId, user.sub);
      if (!role) {
        callback({ ok: false, error: 'Not a room member' });
        return;
      }

      if (role !== 'DIRECTOR' && layer !== 'token') {
        callback({ ok: false, error: 'Only the director can add tokens to this layer' });
        return;
      }

      // Map lowercase layer values from event schema to Prisma enum values
      const layerMap: Record<string, 'BACKGROUND' | 'TOKEN' | 'EFFECT' | 'GM'> = {
        background: 'BACKGROUND',
        token: 'TOKEN',
        effect: 'EFFECT',
        gm: 'GM',
      };

      const token = await mapService.addToken(mapId, {
        name,
        imageUrl: imageUrl ?? null,
        x,
        y,
        width,
        height,
        layer: layerMap[layer] ?? 'TOKEN',
        ownerId: user.sub,
        visible,
      });

      // Broadcast to room
      io.to(roomId).emit('TOKEN_ADDED', {
        tokenId: token.id,
        mapId,
        name: token.name,
        imageUrl: token.imageUrl,
        x: token.x,
        y: token.y,
        width: token.width,
        height: token.height,
        layer: layer as 'background' | 'token' | 'effect' | 'gm',
        visible: token.visible,
        ownerId: token.ownerId,
      });

      // Log event
      const sessionId = await getSessionIdForMap(mapId);
      if (sessionId) {
        logEvent({
          sessionId,
          eventType: GameEventType.TOKEN_ADDED,
          payload: {
            tokenId: token.id,
            mapId,
            name,
            x,
            y,
            width,
            height,
            layer,
            visible,
            ownerId: user.sub,
          },
          actorId: user.sub,
          actorType: role,
        }).catch((err) =>
          logger.error('Event logging failed', { context: 'event-store', error: String(err) }),
        );
      }

      callback({ ok: true, tokenId: token.id });
    } catch (err) {
      logger.error('TOKEN_ADD handler error', {
        context: 'socket',
        error: String(err),
      });
      callback({ ok: false, error: 'Internal server error' });
    }
  });

  // ── TOKEN_REMOVE ─────────────────────────────────────────────────────
  socket.on('TOKEN_REMOVE', async (payload) => {
    try {
      const parsed = tokenRemoveSchema.safeParse(payload);
      if (!parsed.success) return;

      const { tokenId, mapId } = parsed.data;

      // Verify director status
      const isDir = await isDirectorForMap(mapId, user.sub);
      if (!isDir) return;

      // Resolve room and verify socket is in the room
      const roomId = await getRoomIdForMap(mapId);
      if (!roomId || !isInRoom(socket, roomId)) return;

      await mapService.removeToken(tokenId);

      // Broadcast to room
      io.to(roomId).emit('TOKEN_REMOVED', {
        tokenId,
        mapId,
        removedBy: user.sub,
      });

      // Log event
      const sessionId = await getSessionIdForMap(mapId);
      if (sessionId) {
        logEvent({
          sessionId,
          eventType: GameEventType.TOKEN_REMOVED,
          payload: { tokenId, mapId },
          actorId: user.sub,
          actorType: 'DIRECTOR',
        }).catch((err) =>
          logger.error('Event logging failed', { context: 'event-store', error: String(err) }),
        );
      }
    } catch (err) {
      logger.error('TOKEN_REMOVE handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });

  // ── FOG_CREATE ───────────────────────────────────────────────────────
  socket.on('FOG_CREATE', async (payload, callback) => {
    try {
      const parsed = fogCreateSchema.safeParse(payload);
      if (!parsed.success) {
        callback({ ok: false, error: 'Invalid payload' });
        return;
      }

      const { mapId, name, points, revealed } = parsed.data;

      // Verify director status
      const isDir = await isDirectorForMap(mapId, user.sub);
      if (!isDir) {
        callback({ ok: false, error: 'Only the director can create fog regions' });
        return;
      }

      // Resolve room and verify socket is in the room
      const roomId = await getRoomIdForMap(mapId);
      if (!roomId || !isInRoom(socket, roomId)) {
        callback({ ok: false, error: 'Not in room' });
        return;
      }

      const region = await mapService.createFogRegion(mapId, { points, revealed, name });

      // Broadcast to room
      io.to(roomId).emit('FOG_CREATED', {
        mapId,
        region: {
          id: region.id,
          mapId: region.mapId,
          name: region.name,
          points: region.points,
          revealed: region.revealed,
        },
        createdBy: user.sub,
      });

      // Log event
      const sessionId = await getSessionIdForMap(mapId);
      if (sessionId) {
        logEvent({
          sessionId,
          eventType: GameEventType.FOG_CREATED,
          payload: { mapId, regionId: region.id, name, points, revealed },
          actorId: user.sub,
          actorType: 'DIRECTOR',
        }).catch((err) =>
          logger.error('Event logging failed', { context: 'event-store', error: String(err) }),
        );
      }

      callback({ ok: true, regionId: region.id });
    } catch (err) {
      logger.error('FOG_CREATE handler error', {
        context: 'socket',
        error: String(err),
      });
      callback({ ok: false, error: 'Internal server error' });
    }
  });

  // ── FOG_UPDATE ───────────────────────────────────────────────────────
  socket.on('FOG_UPDATE', async (payload) => {
    try {
      const parsed = fogUpdateSchema.safeParse(payload);
      if (!parsed.success) return;

      const { mapId, regionId, revealed } = parsed.data;

      // Verify director status
      const isDir = await isDirectorForMap(mapId, user.sub);
      if (!isDir) return;

      // Resolve room and verify socket is in the room
      const roomId = await getRoomIdForMap(mapId);
      if (!roomId || !isInRoom(socket, roomId)) return;

      await mapService.updateFogRegion(mapId, regionId, revealed);

      // Broadcast to room (players see revealed regions only — the client
      // decides what to render based on the revealed flag)
      io.to(roomId).emit('FOG_UPDATED', {
        mapId,
        regionId,
        revealed,
        updatedBy: user.sub,
      });

      // Log event
      const sessionId = await getSessionIdForMap(mapId);
      if (sessionId) {
        logEvent({
          sessionId,
          eventType: GameEventType.FOG_UPDATED,
          payload: { mapId, regionId, revealed },
          actorId: user.sub,
          actorType: 'DIRECTOR',
        }).catch((err) =>
          logger.error('Event logging failed', { context: 'event-store', error: String(err) }),
        );
      }
    } catch (err) {
      logger.error('FOG_UPDATE handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });
}
