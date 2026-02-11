import type { ActorType } from '@dsvtt/shared';

import type { GameState } from '../state/index.js';

/**
 * A stored event in the event-sourcing log.
 * Events are immutable and ordered by sequence number within a session.
 */
export interface StoredEvent {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  eventType: string;
  payload: Record<string, unknown>;
  actorId: string;
  actorType: ActorType;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

/**
 * A periodic snapshot of the game state for fast reconstruction.
 * Instead of replaying all events from the beginning, replay from the last snapshot.
 */
export interface StateSnapshot {
  sessionId: string;
  /** The sequence number at which this snapshot was taken. */
  sequenceNumber: number;
  /** Serialized game state. */
  state: Record<string, unknown>;
  createdAt: Date;
}

/**
 * An event reducer applies a single event to produce a new game state.
 * Reducers must be pure functions with no side effects.
 */
export type EventReducer = (state: GameState, event: StoredEvent) => GameState;

/**
 * Registry of event reducers keyed by event type.
 * Placeholder — will be populated as game actions are implemented.
 */
export const eventReducers: Map<string, EventReducer> = new Map();

/**
 * Applies a single event to the game state using the registered reducer.
 * If no reducer is registered for the event type, returns the state unchanged.
 *
 * @param state - The current game state
 * @param event - The event to apply
 * @returns The new game state after applying the event
 */
export function applyEvent(state: GameState, event: StoredEvent): GameState {
  const reducer = eventReducers.get(event.eventType);
  if (reducer === undefined) {
    return state;
  }
  return reducer(state, event);
}

/**
 * Reconstructs game state by replaying a sequence of events from an initial state.
 *
 * @param initialState - The starting state (either fresh or from a snapshot)
 * @param events - Ordered events to replay
 * @returns The reconstructed game state
 */
export function replayEvents(initialState: GameState, events: StoredEvent[]): GameState {
  return events.reduce<GameState>((state, event) => applyEvent(state, event), initialState);
}
