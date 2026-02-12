import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@dsvtt/shared';
import { GameEventType, DICE_FORMULA_MAX_LENGTH } from '@dsvtt/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { diceRollSchema } from '@dsvtt/events';
import { evaluateDice, DiceParseError } from '@dsvtt/dice-engine';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { logEvent } from '../services/event-store.js';

/** Typed Socket.IO server instance. */
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Typed Socket.IO socket with auth data attached. */
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user?: JwtPayload };
};

/**
 * Register dice-related Socket.IO event handlers on a connected socket.
 *
 * Handles:
 * - `DICE_ROLL`: Client rolls dice publicly. Server evaluates using
 *   @dsvtt/dice-engine, persists to DiceRollLog, broadcasts DICE_RESULT
 *   to the room.
 * - `DICE_ROLL_PRIVATE`: Client rolls dice privately. Server evaluates,
 *   persists, and sends DICE_RESULT_PRIVATE only to the roller and the
 *   room's director.
 *
 * @param io - The Socket.IO server instance.
 * @param socket - The authenticated client socket.
 */
export function registerDiceEvents(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user!;

  // ── DICE_ROLL (public) ─────────────────────────────────────────────
  socket.on('DICE_ROLL', async (payload) => {
    try {
      const parsed = diceRollSchema.safeParse(payload);
      if (!parsed.success) return;

      const { sessionId, formula } = parsed.data;

      // Validate formula length
      if (formula.length > DICE_FORMULA_MAX_LENGTH) return;

      // Look up session and verify room membership
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: { select: { id: true } } },
      });
      if (!session) return;

      const roomId = session.room.id;
      if (!socket.rooms.has(roomId)) return;

      // Look up display name
      const dbUser = await prisma.user.findUnique({
        where: { id: user.sub },
        select: { displayName: true },
      });
      if (!dbUser) return;

      // Evaluate the dice formula
      let diceResult;
      try {
        diceResult = evaluateDice(formula);
      } catch (err) {
        if (err instanceof DiceParseError) {
          logger.warn('Invalid dice formula from socket', {
            context: 'socket',
            userId: user.sub,
            formula,
            error: err.message,
          });
          return;
        }
        throw err;
      }

      // Persist to database
      const record = await prisma.diceRollLog.create({
        data: {
          sessionId,
          playerId: user.sub,
          formula,
          results: diceResult.rolls as unknown as Prisma.InputJsonValue,
          total: diceResult.total,
          isPrivate: false,
        },
      });

      // Broadcast to all room members
      io.to(roomId).emit('DICE_RESULT', {
        rollId: record.id,
        sessionId,
        playerId: user.sub,
        playerName: dbUser.displayName,
        formula,
        results: diceResult.rolls.map((r) => ({
          sides: r.sides,
          result: r.result,
          dropped: r.dropped,
          exploded: r.exploded,
        })),
        total: diceResult.total,
      });

      // Log event
      logEvent({
        sessionId,
        eventType: GameEventType.DICE_ROLL,
        payload: { rollId: record.id, formula, total: diceResult.total, playerName: dbUser.displayName },
        actorId: user.sub,
        actorType: 'PLAYER',
      }).catch((err) => logger.error('Event logging failed', { context: 'event-store', error: String(err) }));
    } catch (err) {
      logger.error('DICE_ROLL handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });

  // ── DICE_ROLL_PRIVATE ──────────────────────────────────────────────
  socket.on('DICE_ROLL_PRIVATE', async (payload) => {
    try {
      const parsed = diceRollSchema.safeParse(payload);
      if (!parsed.success) return;

      const { sessionId, formula } = parsed.data;

      if (formula.length > DICE_FORMULA_MAX_LENGTH) return;

      // Look up session and room
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: { select: { id: true, directorId: true } } },
      });
      if (!session) return;

      const roomId = session.room.id;
      if (!socket.rooms.has(roomId)) return;

      // Look up display name
      const dbUser = await prisma.user.findUnique({
        where: { id: user.sub },
        select: { displayName: true },
      });
      if (!dbUser) return;

      // Evaluate the dice formula
      let diceResult;
      try {
        diceResult = evaluateDice(formula);
      } catch (err) {
        if (err instanceof DiceParseError) {
          logger.warn('Invalid dice formula from socket (private)', {
            context: 'socket',
            userId: user.sub,
            formula,
            error: err.message,
          });
          return;
        }
        throw err;
      }

      // Persist to database
      const record = await prisma.diceRollLog.create({
        data: {
          sessionId,
          playerId: user.sub,
          formula,
          results: diceResult.rolls as unknown as Prisma.InputJsonValue,
          total: diceResult.total,
          isPrivate: true,
        },
      });

      const resultPayload = {
        rollId: record.id,
        sessionId,
        playerId: user.sub,
        playerName: dbUser.displayName,
        formula,
        results: diceResult.rolls.map((r) => ({
          sides: r.sides,
          result: r.result,
          dropped: r.dropped,
          exploded: r.exploded,
        })),
        total: diceResult.total,
      };

      // Send only to the roller
      socket.emit('DICE_RESULT_PRIVATE', resultPayload);

      // Also send to the director (if different from roller)
      if (session.room.directorId !== user.sub) {
        const directorSockets = await io.in(roomId).fetchSockets();
        for (const dirSocket of directorSockets) {
          if (dirSocket.data.user?.sub === session.room.directorId) {
            dirSocket.emit('DICE_RESULT_PRIVATE', resultPayload);
          }
        }
      }

      // Log event
      logEvent({
        sessionId,
        eventType: GameEventType.DICE_ROLL_PRIVATE,
        payload: { rollId: record.id, formula, total: diceResult.total, playerName: dbUser.displayName },
        actorId: user.sub,
        actorType: 'PLAYER',
      }).catch((err) => logger.error('Event logging failed', { context: 'event-store', error: String(err) }));
    } catch (err) {
      logger.error('DICE_ROLL_PRIVATE handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });
}
