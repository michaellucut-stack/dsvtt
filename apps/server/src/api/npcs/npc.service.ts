import type { Npc, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import type { CreateNpcBody, UpdateNpcBody } from './npc.schemas.js';

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

/** Serialised NPC item. */
export interface NpcItem {
  id: string;
  sessionId: string;
  name: string;
  stats: Record<string, unknown>;
  notes: string | null;
  tokenId: string | null;
}

function serializeNpc(npc: Npc): NpcItem {
  return {
    id: npc.id,
    sessionId: npc.sessionId,
    name: npc.name,
    stats: npc.stats as Record<string, unknown>,
    notes: npc.notes,
    tokenId: npc.tokenId,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify that a session exists and that the requesting user is the director
 * of the room owning the session.
 *
 * @returns The session with its room.
 * @throws {AppError} 404 if session not found, 403 if not director.
 */
export async function requireSessionDirector(
  sessionId: string,
  userId: string,
): Promise<{ id: string; roomId: string }> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { room: { select: { id: true, directorId: true } } },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  if (session.room.directorId !== userId) {
    throw new AppError(
      'Only the session director can perform this action',
      403,
      'NPC_NOT_DIRECTOR',
    );
  }

  return { id: session.id, roomId: session.roomId };
}

/**
 * Verify an NPC exists and that the requesting user is the director of the
 * session's room.
 *
 * @returns The NPC and associated roomId.
 * @throws {AppError} 404 if NPC not found, 403 if not director.
 */
async function requireNpcDirector(
  npcId: string,
  userId: string,
): Promise<{ npc: Npc; roomId: string }> {
  const npc = await prisma.npc.findUnique({
    where: { id: npcId },
    include: { session: { include: { room: { select: { id: true, directorId: true } } } } },
  });

  if (!npc) {
    throw new AppError('NPC not found', 404, 'NPC_NOT_FOUND');
  }

  if (npc.session.room.directorId !== userId) {
    throw new AppError(
      'Only the session director can perform this action',
      403,
      'NPC_NOT_DIRECTOR',
    );
  }

  return { npc, roomId: npc.session.room.id };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Create a new NPC within a game session.
 *
 * @param sessionId - The game session ID.
 * @param userId - The authenticated user ID (must be director).
 * @param data - NPC creation data.
 * @returns The created NPC.
 * @throws {AppError} 404 if session not found, 403 if not director.
 * @throws {AppError} 404 if tokenId is specified but the token doesn't exist.
 */
export async function createNpc(
  sessionId: string,
  userId: string,
  data: CreateNpcBody,
): Promise<NpcItem> {
  await requireSessionDirector(sessionId, userId);

  // Validate token exists if provided
  if (data.tokenId) {
    const token = await prisma.token.findUnique({ where: { id: data.tokenId } });
    if (!token) {
      throw new AppError('Token not found', 404, 'TOKEN_NOT_FOUND');
    }
  }

  const npc = await prisma.npc.create({
    data: {
      sessionId,
      name: data.name,
      stats: (data.stats ?? {}) as Prisma.InputJsonValue,
      notes: data.notes ?? null,
      tokenId: data.tokenId ?? null,
    },
  });

  return serializeNpc(npc);
}

/**
 * List all NPCs belonging to a game session.
 *
 * @param sessionId - The game session ID.
 * @returns Array of NPC items.
 */
export async function listNpcs(sessionId: string): Promise<NpcItem[]> {
  const npcs = await prisma.npc.findMany({
    where: { sessionId },
    orderBy: { name: 'asc' },
  });

  return npcs.map(serializeNpc);
}

/**
 * Get a single NPC by ID.
 *
 * @param npcId - The NPC ID.
 * @returns The NPC item.
 * @throws {AppError} 404 if not found.
 */
export async function getNpc(npcId: string): Promise<NpcItem> {
  const npc = await prisma.npc.findUnique({ where: { id: npcId } });

  if (!npc) {
    throw new AppError('NPC not found', 404, 'NPC_NOT_FOUND');
  }

  return serializeNpc(npc);
}

/**
 * Update an NPC's data.
 *
 * @param npcId - The NPC ID.
 * @param userId - The authenticated user ID (must be director).
 * @param data - Partial update data.
 * @returns The updated NPC.
 * @throws {AppError} 404 if not found, 403 if not director.
 * @throws {AppError} 404 if tokenId is specified but the token doesn't exist.
 */
export async function updateNpc(
  npcId: string,
  userId: string,
  data: UpdateNpcBody,
): Promise<NpcItem> {
  await requireNpcDirector(npcId, userId);

  // Validate token exists if being changed
  if (data.tokenId) {
    const token = await prisma.token.findUnique({ where: { id: data.tokenId } });
    if (!token) {
      throw new AppError('Token not found', 404, 'TOKEN_NOT_FOUND');
    }
  }

  const updateData: Prisma.NpcUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.stats !== undefined) updateData.stats = data.stats as Prisma.InputJsonValue;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.tokenId !== undefined) {
    updateData.token = data.tokenId
      ? { connect: { id: data.tokenId } }
      : { disconnect: true };
  }

  const npc = await prisma.npc.update({
    where: { id: npcId },
    data: updateData,
  });

  return serializeNpc(npc);
}

/**
 * Delete an NPC and unlink any associated token.
 *
 * @param npcId - The NPC ID.
 * @param userId - The authenticated user ID (must be director).
 * @throws {AppError} 404 if not found, 403 if not director.
 */
export async function deleteNpc(
  npcId: string,
  userId: string,
): Promise<void> {
  await requireNpcDirector(npcId, userId);
  await prisma.npc.delete({ where: { id: npcId } });
}

/**
 * Assign (or re-assign) a map token to an NPC.
 *
 * @param npcId - The NPC ID.
 * @param userId - The authenticated user ID (must be director).
 * @param tokenId - The token ID to link.
 * @returns The updated NPC.
 * @throws {AppError} 404 if NPC or token not found, 403 if not director.
 */
export async function assignToken(
  npcId: string,
  userId: string,
  tokenId: string,
): Promise<NpcItem> {
  await requireNpcDirector(npcId, userId);

  const token = await prisma.token.findUnique({ where: { id: tokenId } });
  if (!token) {
    throw new AppError('Token not found', 404, 'TOKEN_NOT_FOUND');
  }

  const npc = await prisma.npc.update({
    where: { id: npcId },
    data: { tokenId },
  });

  return serializeNpc(npc);
}

/**
 * Look up the roomId for a given session.
 *
 * @param sessionId - The game session ID.
 * @returns The room ID, or null if not found.
 */
export async function getRoomIdForSession(sessionId: string): Promise<string | null> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { roomId: true },
  });
  return session?.roomId ?? null;
}
