import type { Prisma, Room, RoomPlayer, RoomStatus } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import type { CreateRoomBody, JoinRoomBody, ListRoomsQuery } from './room.schemas.js';

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

/** Serialised room with player count. */
export interface RoomListItem {
  id: string;
  name: string;
  status: string;
  directorId: string;
  maxPlayers: number;
  playerCount: number;
  gameSystemId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Serialised room detail including full player list. */
export interface RoomDetail extends RoomListItem {
  players: {
    id: string;
    userId: string;
    displayName: string;
    role: string;
    joinedAt: string;
  }[];
}

function serializeRoom(
  room: Room & {
    _count?: { players: number };
    players?: (RoomPlayer & { user: { displayName: string } })[];
  },
): RoomListItem {
  return {
    id: room.id,
    name: room.name,
    status: room.status,
    directorId: room.directorId,
    maxPlayers: room.maxPlayers,
    playerCount: room._count?.players ?? room.players?.length ?? 0,
    gameSystemId: room.gameSystemId,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

function serializeRoomDetail(
  room: Room & { players: (RoomPlayer & { user: { displayName: string } })[] },
): RoomDetail {
  return {
    ...serializeRoom(room),
    playerCount: room.players.length,
    players: room.players.map((p) => ({
      id: p.id,
      userId: p.userId,
      displayName: p.user.displayName,
      role: p.role,
      joinedAt: p.joinedAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Create a new room. The creator is automatically added as the Director.
 *
 * @param input - Validated creation payload (name, maxPlayers).
 * @param userId - The authenticated user's ID.
 * @returns The newly created room with player list.
 */
export async function createRoom(input: CreateRoomBody, userId: string): Promise<RoomDetail> {
  const room = await prisma.room.create({
    data: {
      name: input.name,
      maxPlayers: input.maxPlayers,
      directorId: userId,
      players: {
        create: {
          userId,
          role: 'DIRECTOR',
        },
      },
    },
    include: {
      players: {
        include: { user: { select: { displayName: true } } },
      },
    },
  });

  return serializeRoomDetail(room);
}

/**
 * List rooms with optional status filter and pagination.
 *
 * @param query - Validated query parameters.
 * @returns Paginated room list with player counts.
 */
export async function listRooms(
  query: ListRoomsQuery,
): Promise<{ rooms: RoomListItem[]; total: number; page: number; limit: number }> {
  const where: Prisma.RoomWhereInput = {};
  if (query.status) {
    where.status = query.status as RoomStatus;
  }

  const [rooms, total] = await Promise.all([
    prisma.room.findMany({
      where,
      include: { _count: { select: { players: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.room.count({ where }),
  ]);

  return {
    rooms: rooms.map(serializeRoom),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/**
 * Get detailed information about a single room including its players.
 *
 * @param roomId - The room's unique ID.
 * @returns Room detail with full player list.
 * @throws {AppError} 404 if the room does not exist.
 */
export async function getRoomDetail(roomId: string): Promise<RoomDetail> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      players: {
        include: { user: { select: { displayName: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  return serializeRoomDetail(room);
}

/**
 * Join a room as a player (or director if allowed).
 *
 * @param roomId - The room to join.
 * @param userId - The authenticated user's ID.
 * @param input - Validated join payload with role.
 * @returns The updated room detail.
 * @throws {AppError} 404 if the room does not exist.
 * @throws {AppError} 409 if the user is already in the room.
 * @throws {AppError} 400 if the room is full or not in WAITING/ACTIVE status.
 */
export async function joinRoom(
  roomId: string,
  userId: string,
  input: JoinRoomBody,
): Promise<RoomDetail> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      players: {
        include: { user: { select: { displayName: true } } },
      },
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  if (room.status !== 'WAITING' && room.status !== 'ACTIVE') {
    throw new AppError(
      'Cannot join a room that is not waiting or active',
      400,
      'ROOM_NOT_JOINABLE',
    );
  }

  const existingPlayer = room.players.find((p) => p.userId === userId);
  if (existingPlayer) {
    throw new AppError('Already a member of this room', 409, 'ROOM_ALREADY_JOINED');
  }

  if (room.players.length >= room.maxPlayers) {
    throw new AppError('Room is full', 400, 'ROOM_FULL');
  }

  // Only the original director can have the DIRECTOR role; joiners default to PLAYER
  const role = input.role === 'director' && room.directorId === userId ? 'DIRECTOR' : 'PLAYER';

  await prisma.roomPlayer.create({
    data: {
      roomId,
      userId,
      role,
    },
  });

  // Refetch for full detail
  return getRoomDetail(roomId);
}

/**
 * Leave a room. If the leaving user is the director, the room status is set
 * to ENDED.
 *
 * @param roomId - The room to leave.
 * @param userId - The authenticated user's ID.
 * @returns An object indicating whether the room was ended.
 * @throws {AppError} 404 if the room or membership is not found.
 */
export async function leaveRoom(roomId: string, userId: string): Promise<{ roomEnded: boolean }> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  const membership = await prisma.roomPlayer.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!membership) {
    throw new AppError('Not a member of this room', 404, 'ROOM_NOT_MEMBER');
  }

  await prisma.roomPlayer.delete({
    where: { id: membership.id },
  });

  // If the director leaves, end the room
  if (room.directorId === userId) {
    await prisma.room.update({
      where: { id: roomId },
      data: { status: 'ENDED' },
    });
    return { roomEnded: true };
  }

  return { roomEnded: false };
}

/**
 * Delete a room. Only the room's director may perform this action.
 *
 * @param roomId - The room to delete.
 * @param userId - The authenticated user's ID.
 * @throws {AppError} 404 if the room does not exist.
 * @throws {AppError} 403 if the user is not the room's director.
 */
export async function deleteRoom(roomId: string, userId: string): Promise<void> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  if (room.directorId !== userId) {
    throw new AppError('Only the room director can delete the room', 403, 'ROOM_NOT_DIRECTOR');
  }

  await prisma.room.delete({
    where: { id: roomId },
  });
}

/**
 * Verify that a user is the director of a given room.
 *
 * @param roomId - The room ID to check.
 * @param userId - The user ID to verify.
 * @returns The room record.
 * @throws {AppError} 404 if the room does not exist.
 * @throws {AppError} 403 if the user is not the director.
 */
export async function requireDirector(roomId: string, userId: string): Promise<Room> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  if (room.directorId !== userId) {
    throw new AppError('Only the room director can perform this action', 403, 'ROOM_NOT_DIRECTOR');
  }

  return room;
}
