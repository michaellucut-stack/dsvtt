import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { createInitialState, replayEvents } from '@dsvtt/game-engine';
import type { GameState, StoredEvent } from '@dsvtt/game-engine';
import { logger } from '../utils/logger.js';

/** Number of events between automatic snapshots. */
const SNAPSHOT_INTERVAL = 100;

// ── State Serialization ─────────────────────────────────────────────

function serializeState(state: GameState): Record<string, unknown> {
  return {
    ...state,
    players: Object.fromEntries(state.players),
    maps: Object.fromEntries(state.maps),
    tokens: Object.fromEntries(state.tokens),
    fogRegions: Object.fromEntries(state.fogRegions),
    createdAt: state.createdAt.toISOString(),
    updatedAt: state.updatedAt.toISOString(),
  };
}

function deserializeState(raw: Record<string, unknown>): GameState {
  return {
    sessionId: raw['sessionId'] as string,
    roomId: raw['roomId'] as string,
    status: raw['status'] as GameState['status'],
    players: new Map(Object.entries((raw['players'] as Record<string, unknown>) ?? {})) as GameState['players'],
    activeMapId: (raw['activeMapId'] as string | null) ?? null,
    maps: new Map(Object.entries((raw['maps'] as Record<string, unknown>) ?? {})) as GameState['maps'],
    tokens: new Map(Object.entries((raw['tokens'] as Record<string, unknown>) ?? {})) as GameState['tokens'],
    fogRegions: new Map(Object.entries((raw['fogRegions'] as Record<string, unknown>) ?? {})) as GameState['fogRegions'],
    turnState: (raw['turnState'] as GameState['turnState']) ?? {
      currentPlayerId: null,
      roundNumber: 0,
      order: [],
    },
    sequenceNumber: (raw['sequenceNumber'] as number) ?? 0,
    createdAt: new Date(raw['createdAt'] as string),
    updatedAt: new Date(raw['updatedAt'] as string),
  };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Get the latest snapshot for a session.
 */
export async function getLatestSnapshot(sessionId: string) {
  return prisma.stateSnapshot.findFirst({
    where: { sessionId },
    orderBy: { sequenceNumber: 'desc' },
  });
}

/**
 * List all snapshots for a session.
 */
export async function listSnapshots(sessionId: string) {
  return prisma.stateSnapshot.findMany({
    where: { sessionId },
    orderBy: { sequenceNumber: 'asc' },
    select: { id: true, sessionId: true, sequenceNumber: true, createdAt: true },
  });
}

/**
 * Create a snapshot of the current game state at the latest event.
 */
export async function createSnapshot(sessionId: string) {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { roomId: true, eventCount: true },
  });
  if (!session) throw new Error('Session not found');

  const lastSnapshot = await getLatestSnapshot(sessionId);
  const fromSeq = lastSnapshot?.sequenceNumber ?? 0;

  const events = await prisma.gameEventLog.findMany({
    where: { sessionId, sequenceNumber: { gt: fromSeq } },
    orderBy: { sequenceNumber: 'asc' },
  });

  let baseState: GameState;
  if (lastSnapshot) {
    baseState = deserializeState(lastSnapshot.state as Record<string, unknown>);
  } else {
    baseState = createInitialState(sessionId, session.roomId);
  }

  const state = replayEvents(baseState, events as unknown as StoredEvent[]);

  const snapshot = await prisma.stateSnapshot.create({
    data: {
      sessionId,
      sequenceNumber: state.sequenceNumber,
      state: serializeState(state) as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    id: snapshot.id,
    sessionId: snapshot.sessionId,
    sequenceNumber: snapshot.sequenceNumber,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

/**
 * Check if a snapshot should be created after an event is logged.
 * Called as fire-and-forget from the event store.
 */
export async function maybeCreateSnapshot(sessionId: string, eventCount: number): Promise<void> {
  if (eventCount > 0 && eventCount % SNAPSHOT_INTERVAL === 0) {
    try {
      await createSnapshot(sessionId);
      logger.info(`Snapshot created at event ${eventCount}`, { context: 'snapshot', sessionId });
    } catch (err) {
      logger.error('Snapshot creation failed', { context: 'snapshot', sessionId, error: String(err) });
    }
  }
}

/**
 * Reconstruct game state at a specific sequence number.
 */
export async function reconstructStateAt(
  sessionId: string,
  targetSequence: number,
): Promise<Record<string, unknown>> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { roomId: true },
  });
  if (!session) throw new Error('Session not found');

  // Find the latest snapshot at or before targetSequence
  const snapshot = await prisma.stateSnapshot.findFirst({
    where: { sessionId, sequenceNumber: { lte: targetSequence } },
    orderBy: { sequenceNumber: 'desc' },
  });

  const fromSeq = snapshot?.sequenceNumber ?? 0;

  const events = await prisma.gameEventLog.findMany({
    where: {
      sessionId,
      sequenceNumber: { gt: fromSeq, lte: targetSequence },
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  let baseState: GameState;
  if (snapshot) {
    baseState = deserializeState(snapshot.state as Record<string, unknown>);
  } else {
    baseState = createInitialState(sessionId, session.roomId);
  }

  const state = replayEvents(baseState, events as unknown as StoredEvent[]);
  return serializeState(state);
}
