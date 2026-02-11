import type { Prisma } from '@prisma/client';
import { evaluateDice, DiceParseError } from '@dsvtt/dice-engine';
import type { DiceResult, SingleDieResult } from '@dsvtt/dice-engine';
import { DICE_FORMULA_MAX_LENGTH } from '@dsvtt/shared';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

/** Serialised dice roll result. */
export interface DiceRollItem {
  id: string;
  sessionId: string;
  playerId: string;
  formula: string;
  results: SingleDieResult[];
  total: number;
  isPrivate: boolean;
  timestamp: string;
}

function serializeDiceRoll(roll: {
  id: string;
  sessionId: string;
  playerId: string;
  formula: string;
  results: Prisma.JsonValue;
  total: number;
  isPrivate: boolean;
  timestamp: Date;
}): DiceRollItem {
  return {
    id: roll.id,
    sessionId: roll.sessionId,
    playerId: roll.playerId,
    formula: roll.formula,
    results: roll.results as unknown as SingleDieResult[],
    total: roll.total,
    isPrivate: roll.isPrivate,
    timestamp: roll.timestamp.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Validate a dice formula string and evaluate it using @dsvtt/dice-engine.
 *
 * @param formula - The dice notation string (e.g. "2d6+3").
 * @returns The evaluated DiceResult.
 * @throws {AppError} 400 if the formula is too long or syntactically invalid.
 */
export function rollFormula(formula: string): DiceResult {
  if (formula.length > DICE_FORMULA_MAX_LENGTH) {
    throw new AppError(
      `Formula must be at most ${DICE_FORMULA_MAX_LENGTH} characters`,
      400,
      'DICE_FORMULA_TOO_LONG',
    );
  }

  try {
    return evaluateDice(formula);
  } catch (err) {
    if (err instanceof DiceParseError) {
      throw new AppError(
        `Invalid dice formula: ${err.message}`,
        400,
        'DICE_INVALID_FORMULA',
      );
    }
    throw err;
  }
}

/**
 * Evaluate a dice formula, persist the result to the database, and return it.
 *
 * @param sessionId - The game session ID.
 * @param playerId - The player who rolled.
 * @param formula - The dice notation string.
 * @param isPrivate - Whether the roll is private (director-only visibility).
 * @returns The persisted dice roll item.
 * @throws {AppError} 404 if the session does not exist.
 * @throws {AppError} 400 if the formula is invalid.
 */
export async function rollAndPersist(
  sessionId: string,
  playerId: string,
  formula: string,
  isPrivate: boolean,
): Promise<{ roll: DiceRollItem; diceResult: DiceResult }> {
  // Verify session exists
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  // Evaluate the dice formula
  const diceResult = rollFormula(formula);

  // Persist to database
  const record = await prisma.diceRollLog.create({
    data: {
      sessionId,
      playerId,
      formula,
      results: diceResult.rolls as unknown as Prisma.InputJsonValue,
      total: diceResult.total,
      isPrivate,
    },
  });

  return {
    roll: serializeDiceRoll(record),
    diceResult,
  };
}

/**
 * Retrieve paginated dice roll history for a session.
 *
 * @param sessionId - The game session ID.
 * @param userId - The requesting user's ID (used to filter private rolls).
 * @param isDirector - Whether the user is the room's director.
 * @param page - Page number (1-based).
 * @param limit - Items per page.
 * @returns Paginated dice roll history.
 */
export async function getDiceHistory(
  sessionId: string,
  userId: string,
  isDirector: boolean,
  page: number,
  limit: number,
): Promise<{ rolls: DiceRollItem[]; total: number; page: number; limit: number }> {
  // Build where clause: directors see all rolls, players only see
  // public rolls + their own private rolls.
  const where: Prisma.DiceRollLogWhereInput = {
    sessionId,
    ...(isDirector
      ? {}
      : {
          OR: [
            { isPrivate: false },
            { isPrivate: true, playerId: userId },
          ],
        }),
  };

  const [rolls, total] = await Promise.all([
    prisma.diceRollLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.diceRollLog.count({ where }),
  ]);

  return {
    rolls: rolls.map(serializeDiceRoll),
    total,
    page,
    limit,
  };
}
