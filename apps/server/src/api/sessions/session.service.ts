import type { SessionStatus } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { requireDirector } from '../rooms/room.service.js';

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

/** Serialised game session. */
export interface SessionItem {
  id: string;
  roomId: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  eventCount: number;
}

/** Serialised session detail with event count from logs. */
export interface SessionDetail extends SessionItem {
  loggedEventCount: number;
}

function serializeSession(session: {
  id: string;
  roomId: string;
  status: SessionStatus;
  startedAt: Date;
  endedAt: Date | null;
  eventCount: number;
}): SessionItem {
  return {
    id: session.id,
    roomId: session.roomId,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    eventCount: session.eventCount,
  };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Start a new game session for a room. Only the room's director may start a
 * session. The room status is updated to ACTIVE.
 *
 * @param roomId - The room to start a session in.
 * @param userId - The authenticated user's ID (must be the director).
 * @returns The newly created session.
 * @throws {AppError} 404 if room not found, 403 if not director.
 * @throws {AppError} 400 if there is already an active/paused session.
 */
export async function startSession(roomId: string, userId: string): Promise<SessionItem> {
  await requireDirector(roomId, userId);

  // Check for existing active or paused session
  const existing = await prisma.gameSession.findFirst({
    where: {
      roomId,
      status: { in: ['ACTIVE', 'PAUSED', 'SETUP'] },
    },
  });

  if (existing && existing.status !== 'SETUP') {
    throw new AppError(
      'Room already has an active or pending session',
      400,
      'SESSION_ALREADY_ACTIVE',
    );
  }

  // If a stale SETUP session exists, transition it to ACTIVE instead of
  // creating a duplicate.
  if (existing && existing.status === 'SETUP') {
    const [session] = await prisma.$transaction([
      prisma.gameSession.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', startedAt: new Date() },
      }),
      prisma.room.update({
        where: { id: roomId },
        data: { status: 'ACTIVE' },
      }),
    ]);
    return serializeSession(session);
  }

  const [session] = await prisma.$transaction([
    prisma.gameSession.create({
      data: {
        roomId,
        status: 'ACTIVE',
      },
    }),
    prisma.room.update({
      where: { id: roomId },
      data: { status: 'ACTIVE' },
    }),
  ]);

  return serializeSession(session);
}

/**
 * List all sessions for a given room, ordered by start time descending.
 *
 * @param roomId - The room whose sessions to list.
 * @returns Array of session items.
 * @throws {AppError} 404 if the room does not exist.
 */
export async function listSessions(roomId: string): Promise<SessionItem[]> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  const sessions = await prisma.gameSession.findMany({
    where: { roomId },
    orderBy: { startedAt: 'desc' },
  });

  return sessions.map(serializeSession);
}

/**
 * Get detailed information about a single session, including the count of
 * logged events from the GameEventLog table.
 *
 * @param sessionId - The session's unique ID.
 * @returns Session detail with event counts.
 * @throws {AppError} 404 if the session does not exist.
 */
export async function getSessionDetail(sessionId: string): Promise<SessionDetail> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      _count: { select: { eventLogs: true } },
    },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  return {
    ...serializeSession(session),
    loggedEventCount: session._count.eventLogs,
  };
}

/**
 * Update the status of a game session. Only the room's director may change
 * session status. Transitions are validated:
 * - SETUP → ACTIVE
 * - ACTIVE → PAUSED | ENDED
 * - PAUSED → ACTIVE | ENDED
 *
 * When a session is ended, the room status is also set to PAUSED (allowing
 * the director to start a new session).
 *
 * @param sessionId - The session to update.
 * @param userId - The authenticated user's ID (must be the room's director).
 * @param newStatus - The desired session status.
 * @returns The updated session.
 * @throws {AppError} 404 if session not found.
 * @throws {AppError} 403 if not the director.
 * @throws {AppError} 400 if the status transition is invalid.
 */
export async function updateSessionStatus(
  sessionId: string,
  userId: string,
  newStatus: string,
): Promise<SessionItem> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  await requireDirector(session.roomId, userId);

  // Validate status transitions
  const validTransitions: Record<string, string[]> = {
    SETUP: ['ACTIVE'],
    ACTIVE: ['PAUSED', 'ENDED'],
    PAUSED: ['ACTIVE', 'ENDED'],
    ENDED: [],
  };

  const allowed = validTransitions[session.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot transition session from ${session.status} to ${newStatus}`,
      400,
      'SESSION_INVALID_TRANSITION',
    );
  }

  const updateData: { status: SessionStatus; endedAt?: Date } = {
    status: newStatus as SessionStatus,
  };

  if (newStatus === 'ENDED') {
    updateData.endedAt = new Date();
  }

  const [updated] = await prisma.$transaction([
    prisma.gameSession.update({
      where: { id: sessionId },
      data: updateData,
    }),
    // Update room status to match session lifecycle
    ...(newStatus === 'ACTIVE'
      ? [prisma.room.update({ where: { id: session.roomId }, data: { status: 'ACTIVE' as const } })]
      : newStatus === 'PAUSED'
        ? [
            prisma.room.update({
              where: { id: session.roomId },
              data: { status: 'PAUSED' as const },
            }),
          ]
        : newStatus === 'ENDED'
          ? [
              prisma.room.update({
                where: { id: session.roomId },
                data: { status: 'WAITING' as const },
              }),
            ]
          : []),
  ]);

  return serializeSession(updated);
}
