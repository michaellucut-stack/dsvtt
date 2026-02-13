import type { Prisma, ActorType as PrismaActorType } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { maybeCreateSnapshot } from './snapshot.service.js';

export interface LogEventParams {
  sessionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actorId: string;
  actorType: PrismaActorType;
  metadata?: Record<string, unknown>;
}

export interface LoggedEvent {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  eventType: string;
  payload: unknown;
  actorId: string;
  actorType: string;
  timestamp: Date;
  metadata: unknown;
}

/**
 * Append a game event to the event log atomically.
 * Uses an interactive transaction with a row-level lock (SELECT ... FOR UPDATE)
 * to prevent race conditions when concurrent events arrive for the same session.
 */
export async function logEvent(params: LogEventParams): Promise<LoggedEvent> {
  const { sessionId, eventType, payload, actorId, actorType, metadata = {} } = params;

  const eventLog = await prisma.$transaction(async (tx) => {
    // Lock the session row to serialize concurrent event writes
    const rows = await tx.$queryRaw<{ eventCount: number }[]>`
      SELECT "eventCount" FROM "game_sessions"
      WHERE "id" = ${sessionId}::uuid
      FOR UPDATE
    `;

    const row = rows[0];
    if (!row) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const nextSeq = row.eventCount + 1;

    const created = await tx.gameEventLog.create({
      data: {
        sessionId,
        sequenceNumber: nextSeq,
        eventType,
        payload: payload as unknown as Prisma.InputJsonValue,
        actorId,
        actorType,
        metadata: metadata as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.gameSession.update({
      where: { id: sessionId },
      data: { eventCount: nextSeq },
    });

    return created;
  });

  const nextSeq = eventLog.sequenceNumber;

  logger.debug('Game event logged', {
    context: 'event-store',
    sessionId,
    eventType,
    sequenceNumber: nextSeq,
    actorId,
    actorType,
  });

  // Fire-and-forget: create snapshot if we crossed an interval boundary
  maybeCreateSnapshot(sessionId, nextSeq).catch(() => {});

  return eventLog as LoggedEvent;
}

/**
 * Retrieve events for a session, ordered by sequence number.
 * Optionally start from a given sequence number (for replay after snapshot).
 */
export async function getSessionEvents(
  sessionId: string,
  fromSequence = 0,
  limit?: number,
): Promise<LoggedEvent[]> {
  return prisma.gameEventLog.findMany({
    where: {
      sessionId,
      sequenceNumber: { gt: fromSequence },
    },
    orderBy: { sequenceNumber: 'asc' },
    ...(limit ? { take: limit } : {}),
  }) as Promise<LoggedEvent[]>;
}

/**
 * Get the total event count for a session.
 */
export async function getEventCount(sessionId: string): Promise<number> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { eventCount: true },
  });
  return session?.eventCount ?? 0;
}
