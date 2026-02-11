/** Lifecycle status of a game session. */
export type GameSessionStatus = 'setup' | 'active' | 'paused' | 'ended';

/** The type of actor that triggered a game event. */
export type ActorType = 'director' | 'player' | 'ai' | 'system';

/**
 * An immutable event in the event-sourced game log.
 * Game state is reconstructed by replaying events in sequence order.
 */
export interface GameEvent {
  id: string;
  sessionId: string;
  /** Monotonically increasing per session. */
  sequenceNumber: number;
  /** Discriminated union key identifying the event type. */
  eventType: string;
  /** Event-specific data. */
  payload: Record<string, unknown>;
  /** User or AI that triggered the event. */
  actorId: string;
  actorType: ActorType;
  timestamp: Date;
  /** Additional context (IP, client version, etc.). */
  metadata: Record<string, unknown>;
}

/** A game session tied to a room, tracking event count and lifecycle. */
export interface GameSession {
  id: string;
  roomId: string;
  status: GameSessionStatus;
  startedAt: Date;
  endedAt: Date | null;
  eventCount: number;
}
