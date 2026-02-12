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
 * Uses a transaction to increment the session's eventCount and assign
 * the next sequence number.
 */
export async function logEvent(params: LogEventParams): Promise<LoggedEvent> {
  const { sessionId, eventType, payload, actorId, actorType, metadata = {} } = params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { eventCount: true },
  });

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const nextSeq = session.eventCount + 1;

  const [eventLog] = await prisma.$transaction([
    prisma.gameEventLog.create({
      data: {
        sessionId,
        sequenceNumber: nextSeq,
        eventType,
        payload: payload as unknown as Prisma.InputJsonValue,
        actorId,
        actorType,
        metadata: metadata as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.gameSession.update({
      where: { id: sessionId },
      data: { eventCount: { increment: 1 } },
    }),
  ]);

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
