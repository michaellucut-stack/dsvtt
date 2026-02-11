import { TurnManager } from '@dsvtt/game-engine';
import type { TurnOrder, TurnOrderEntry } from '@dsvtt/game-engine';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// In-memory turn state management
// ---------------------------------------------------------------------------

/** Map of sessionId → TurnManager instance. */
const turnManagers = new Map<string, TurnManager>();

/**
 * Get or create a TurnManager for a session.
 *
 * @param sessionId - The game session ID.
 * @returns The TurnManager for the session.
 */
function getManager(sessionId: string): TurnManager {
  let manager = turnManagers.get(sessionId);
  if (!manager) {
    manager = new TurnManager();
    turnManagers.set(sessionId, manager);
  }
  return manager;
}

/**
 * Clean up a session's turn manager when no longer needed.
 *
 * @param sessionId - The game session ID to clean up.
 */
export function cleanupSession(sessionId: string): void {
  turnManagers.delete(sessionId);
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/**
 * Persist the current turn state to GameEventLog for durability.
 *
 * @param sessionId - The game session ID.
 * @param eventType - The turn event type.
 * @param state - The turn order state snapshot.
 * @param actorId - The user who triggered the change.
 */
async function persistTurnEvent(
  sessionId: string,
  eventType: string,
  state: TurnOrder,
  actorId: string,
): Promise<void> {
  try {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return;

    await prisma.$transaction([
      prisma.gameEventLog.create({
        data: {
          sessionId,
          sequenceNumber: session.eventCount + 1,
          eventType,
          payload: state as unknown as Prisma.InputJsonValue,
          actorId,
          actorType: 'DIRECTOR',
        },
      }),
      prisma.gameSession.update({
        where: { id: sessionId },
        data: { eventCount: { increment: 1 } },
      }),
    ]);
  } catch (err) {
    logger.error('Failed to persist turn event', {
      context: 'turns',
      sessionId,
      eventType,
      error: String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Verify a session exists and return its room ID.
 *
 * @param sessionId - The game session ID.
 * @returns The session's room ID.
 * @throws {AppError} 404 if session not found.
 */
async function requireSession(sessionId: string): Promise<string> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { roomId: true },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  return session.roomId;
}

/**
 * Verify the user is the director of the room that owns the session.
 *
 * @param sessionId - The game session ID.
 * @param userId - The user ID to check.
 * @returns The room ID.
 * @throws {AppError} 404 if session not found.
 * @throws {AppError} 403 if user is not the director.
 */
export async function requireSessionDirector(
  sessionId: string,
  userId: string,
): Promise<string> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { room: { select: { id: true, directorId: true } } },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  if (session.room.directorId !== userId) {
    throw new AppError(
      'Only the director can manage turns',
      403,
      'TURN_NOT_DIRECTOR',
    );
  }

  return session.room.id;
}

/**
 * Get the current turn order for a session.
 *
 * @param sessionId - The game session ID.
 * @returns The current turn order state.
 * @throws {AppError} 404 if session not found.
 */
export async function getTurnOrder(sessionId: string): Promise<TurnOrder> {
  await requireSession(sessionId);
  const manager = getManager(sessionId);
  return manager.getState();
}

/**
 * Set the initiative order for a session. Director only.
 *
 * @param sessionId - The game session ID.
 * @param userId - The director's user ID.
 * @param entries - Array of userId + initiative values.
 * @returns The new turn order state.
 * @throws {AppError} 404 if session not found, 403 if not director.
 */
export async function setTurnOrder(
  sessionId: string,
  userId: string,
  entries: TurnOrderEntry[],
): Promise<TurnOrder> {
  const roomId = await requireSessionDirector(sessionId, userId);
  void roomId; // Used for authorization only

  const manager = getManager(sessionId);
  manager.setOrder(entries);

  const state = manager.getState();

  // Persist asynchronously — don't block the response
  void persistTurnEvent(sessionId, 'TURN_SET_ORDER', state, userId);

  return state;
}

/**
 * Advance to the next turn. Director only.
 *
 * @param sessionId - The game session ID.
 * @param userId - The director's user ID.
 * @returns The updated turn order state.
 * @throws {AppError} 404 if session not found, 403 if not director.
 * @throws {AppError} 400 if no turn order is set.
 */
export async function nextTurn(
  sessionId: string,
  userId: string,
): Promise<TurnOrder> {
  await requireSessionDirector(sessionId, userId);

  const manager = getManager(sessionId);
  const state = manager.getState();

  if (state.entries.length === 0) {
    throw new AppError(
      'No turn order has been set',
      400,
      'TURN_NO_ORDER',
    );
  }

  manager.nextTurn();
  const newState = manager.getState();

  // Persist asynchronously
  void persistTurnEvent(sessionId, 'TURN_NEXT', newState, userId);

  return newState;
}

/**
 * Skip the current turn. Director only.
 *
 * @param sessionId - The game session ID.
 * @param userId - The director's user ID.
 * @returns The updated turn order state.
 * @throws {AppError} 404 if session not found, 403 if not director.
 * @throws {AppError} 400 if no turn order is set.
 */
export async function skipTurn(
  sessionId: string,
  userId: string,
): Promise<TurnOrder> {
  await requireSessionDirector(sessionId, userId);

  const manager = getManager(sessionId);
  const state = manager.getState();

  if (state.entries.length === 0) {
    throw new AppError(
      'No turn order has been set',
      400,
      'TURN_NO_ORDER',
    );
  }

  const currentPlayerId = manager.getCurrentPlayerId();
  if (currentPlayerId) {
    manager.skipPlayer(currentPlayerId);
  }
  const newState = manager.getState();

  // Persist asynchronously
  void persistTurnEvent(sessionId, 'TURN_SKIP', newState, userId);

  return newState;
}
