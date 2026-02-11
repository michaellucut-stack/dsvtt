import type { Character, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import type { CreateCharacterBody, UpdateCharacterBody } from './character.schemas.js';

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

/** Serialised character item. */
export interface CharacterItem {
  id: string;
  sessionId: string;
  userId: string;
  name: string;
  stats: Record<string, unknown>;
  notes: string | null;
  inventory: unknown[];
}

function serializeCharacter(char: Character): CharacterItem {
  return {
    id: char.id,
    sessionId: char.sessionId,
    userId: char.userId,
    name: char.name,
    stats: char.stats as Record<string, unknown>,
    notes: char.notes,
    inventory: char.inventory as unknown[],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the director ID for a session's room.
 *
 * @returns The director's user ID, or null if session not found.
 */
async function getSessionDirectorId(sessionId: string): Promise<string | null> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { room: { select: { directorId: true } } },
  });
  return session?.room.directorId ?? null;
}

/**
 * Determine whether the user is the director of the session's room.
 */
async function isSessionDirector(sessionId: string, userId: string): Promise<boolean> {
  const directorId = await getSessionDirectorId(sessionId);
  return directorId === userId;
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Create a character owned by a player within a game session.
 *
 * @param sessionId - The game session ID.
 * @param userId - The owner's user ID.
 * @param data - Character creation data.
 * @returns The created character.
 * @throws {AppError} 404 if session not found.
 */
export async function createCharacter(
  sessionId: string,
  userId: string,
  data: CreateCharacterBody,
): Promise<CharacterItem> {
  // Verify session exists
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const character = await prisma.character.create({
    data: {
      sessionId,
      userId,
      name: data.name,
      stats: (data.stats ?? {}) as Prisma.InputJsonValue,
      notes: data.notes ?? null,
      inventory: (data.inventory ?? []) as Prisma.InputJsonValue,
    },
  });

  return serializeCharacter(character);
}

/**
 * List characters in a session. Directors see all characters; players see
 * only their own.
 *
 * @param sessionId - The game session ID.
 * @param userId - The requesting user's ID.
 * @returns Array of character items.
 */
export async function listCharacters(
  sessionId: string,
  userId: string,
): Promise<CharacterItem[]> {
  const isDirector = await isSessionDirector(sessionId, userId);

  const characters = await prisma.character.findMany({
    where: {
      sessionId,
      ...(!isDirector ? { userId } : {}),
    },
    orderBy: { name: 'asc' },
  });

  return characters.map(serializeCharacter);
}

/**
 * Get a character by ID with ownership verification.
 *
 * Directors can view any character in their session. Players can only view
 * their own characters.
 *
 * @param characterId - The character ID.
 * @param userId - The requesting user's ID.
 * @returns The character item.
 * @throws {AppError} 404 if not found, 403 if not owner and not director.
 */
export async function getCharacter(
  characterId: string,
  userId: string,
): Promise<CharacterItem> {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { session: { include: { room: { select: { directorId: true } } } } },
  });

  if (!character) {
    throw new AppError('Character not found', 404, 'CHARACTER_NOT_FOUND');
  }

  const isDirector = character.session.room.directorId === userId;
  if (!isDirector && character.userId !== userId) {
    throw new AppError(
      'You do not have permission to view this character',
      403,
      'CHARACTER_FORBIDDEN',
    );
  }

  return serializeCharacter(character);
}

/**
 * Update a character. Players can update only their own characters; directors
 * can update any character in the session.
 *
 * @param characterId - The character ID.
 * @param userId - The authenticated user's ID.
 * @param data - Partial update data.
 * @returns The updated character.
 * @throws {AppError} 404 if not found, 403 if not owner and not director.
 */
export async function updateCharacter(
  characterId: string,
  userId: string,
  data: UpdateCharacterBody,
): Promise<CharacterItem> {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { session: { include: { room: { select: { directorId: true } } } } },
  });

  if (!character) {
    throw new AppError('Character not found', 404, 'CHARACTER_NOT_FOUND');
  }

  const isDirector = character.session.room.directorId === userId;
  if (!isDirector && character.userId !== userId) {
    throw new AppError(
      'You do not have permission to update this character',
      403,
      'CHARACTER_FORBIDDEN',
    );
  }

  const updateData: Prisma.CharacterUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.stats !== undefined) updateData.stats = data.stats as Prisma.InputJsonValue;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.inventory !== undefined) updateData.inventory = data.inventory as Prisma.InputJsonValue;

  const updated = await prisma.character.update({
    where: { id: characterId },
    data: updateData,
  });

  return serializeCharacter(updated);
}

/**
 * Delete a character. Players can delete only their own; directors can delete
 * any character in the session.
 *
 * @param characterId - The character ID.
 * @param userId - The authenticated user's ID.
 * @throws {AppError} 404 if not found, 403 if not owner and not director.
 */
export async function deleteCharacter(
  characterId: string,
  userId: string,
): Promise<void> {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { session: { include: { room: { select: { directorId: true } } } } },
  });

  if (!character) {
    throw new AppError('Character not found', 404, 'CHARACTER_NOT_FOUND');
  }

  const isDirector = character.session.room.directorId === userId;
  if (!isDirector && character.userId !== userId) {
    throw new AppError(
      'You do not have permission to delete this character',
      403,
      'CHARACTER_FORBIDDEN',
    );
  }

  await prisma.character.delete({ where: { id: characterId } });
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
