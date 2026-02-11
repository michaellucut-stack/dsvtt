import type { GameSessionStatus, GameMap, Token, FogRegion } from '@dsvtt/shared';

/** A player's representation within the active game state. */
export interface GamePlayer {
  userId: string;
  displayName: string;
  isConnected: boolean;
}

/**
 * The complete authoritative game state, reconstructed from event sourcing.
 * This is the server-side truth that gets projected to clients.
 */
export interface GameState {
  sessionId: string;
  roomId: string;
  status: GameSessionStatus;
  /** All players currently in the session. */
  players: Map<string, GamePlayer>;
  /** The currently active map, if any. */
  activeMapId: string | null;
  /** All maps in the session, keyed by map ID. */
  maps: Map<string, GameMap>;
  /** All tokens across all maps, keyed by token ID. */
  tokens: Map<string, Token>;
  /** All fog regions across all maps, keyed by region ID. */
  fogRegions: Map<string, FogRegion>;
  /** The current turn order state. */
  turnState: {
    currentPlayerId: string | null;
    roundNumber: number;
    order: string[];
  };
  /** Last applied event sequence number. */
  sequenceNumber: number;
  /** Timestamp of state creation. */
  createdAt: Date;
  /** Timestamp of last state update. */
  updatedAt: Date;
}

/**
 * Creates a fresh initial game state for a new session.
 *
 * @param sessionId - The unique session identifier
 * @param roomId - The room this session belongs to
 * @returns A new GameState with default values
 */
export function createInitialState(sessionId: string, roomId: string): GameState {
  const now = new Date();
  return {
    sessionId,
    roomId,
    status: 'setup',
    players: new Map(),
    activeMapId: null,
    maps: new Map(),
    tokens: new Map(),
    fogRegions: new Map(),
    turnState: {
      currentPlayerId: null,
      roundNumber: 0,
      order: [],
    },
    sequenceNumber: 0,
    createdAt: now,
    updatedAt: now,
  };
}
