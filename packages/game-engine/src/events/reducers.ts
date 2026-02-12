import type { GameMap, Token, FogRegion, GameSessionStatus } from '@dsvtt/shared';
import { GameEventType } from '@dsvtt/shared';

import type { GameState, GamePlayer } from '../state/index.js';
import type { StoredEvent, EventReducer } from './index.js';
import { eventReducers } from './index.js';

// ── Lifecycle Reducers ──────────────────────────────────────────────

function reduceGameStarted(state: GameState, event: StoredEvent): GameState {
  return { ...state, status: 'active', sequenceNumber: event.sequenceNumber, updatedAt: event.timestamp };
}

function reduceGamePaused(state: GameState, event: StoredEvent): GameState {
  return { ...state, status: 'paused', sequenceNumber: event.sequenceNumber, updatedAt: event.timestamp };
}

function reduceGameResumed(state: GameState, event: StoredEvent): GameState {
  return { ...state, status: 'active', sequenceNumber: event.sequenceNumber, updatedAt: event.timestamp };
}

function reduceGameEnded(state: GameState, event: StoredEvent): GameState {
  return { ...state, status: 'ended', sequenceNumber: event.sequenceNumber, updatedAt: event.timestamp };
}

// ── Token Reducers ──────────────────────────────────────────────────

function reduceTokenMoved(state: GameState, event: StoredEvent): GameState {
  const { tokenId, x, y } = event.payload as { tokenId: string; x: number; y: number };
  const token = state.tokens.get(tokenId);
  if (!token) return state;
  const tokens = new Map(state.tokens);
  tokens.set(tokenId, { ...token, x, y });
  return { ...state, tokens, sequenceNumber: event.sequenceNumber, updatedAt: event.timestamp };
}

function reduceTokenAdded(state: GameState, event: StoredEvent): GameState {
  const p = event.payload as Record<string, unknown>;
  const token: Token = {
    id: p['tokenId'] as string,
    mapId: p['mapId'] as string,
    ownerId: (p['ownerId'] as string) ?? '',
    name: (p['name'] as string) ?? '',
    imageUrl: (p['imageUrl'] as string | null) ?? null,
    x: (p['x'] as number) ?? 0,
    y: (p['y'] as number) ?? 0,
    width: (p['width'] as number) ?? 1,
    height: (p['height'] as number) ?? 1,
    layer: (p['layer'] as Token['layer']) ?? 'token',
    visible: (p['visible'] as boolean) ?? true,
  };
  const tokens = new Map(state.tokens);
  tokens.set(token.id, token);
  return { ...state, tokens, sequenceNumber: event.sequenceNumber, updatedAt: event.timestamp };
}

function reduceTokenRemoved(state: GameState, event: StoredEvent): GameState {
  const { tokenId } = event.payload as { tokenId: string };
  const tokens = new Map(state.tokens);
  tokens.delete(tokenId);
  return { ...state, tokens, sequenceNumber: event.sequenceNumber, updatedAt: event.timestamp };
}

// ── Fog Reducers ────────────────────────────────────────────────────

function reduceFogUpdated(state: GameState, event: StoredEvent): GameState {
  const { regionId, revealed } = event.payload as { regionId: string; revealed: boolean };
  const region = state.fogRegions.get(regionId);
  if (!region) return state;
  const fogRegions = new Map(state.fogRegions);
  fogRegions.set(regionId, { ...region, revealed });
  return { ...state, fogRegions, sequenceNumber: event.sequenceNumber, updatedAt: event.timestamp };
}

// ── Turn Reducers ───────────────────────────────────────────────────

function reduceTurnAdvanced(state: GameState, event: StoredEvent): GameState {
  const { currentPlayerId, roundNumber } = event.payload as {
    currentPlayerId: string;
    roundNumber: number;
  };
  return {
    ...state,
    turnState: { ...state.turnState, currentPlayerId, roundNumber },
    sequenceNumber: event.sequenceNumber,
    updatedAt: event.timestamp,
  };
}

function reduceTurnSkipped(state: GameState, event: StoredEvent): GameState {
  const { currentPlayerId, roundNumber } = event.payload as {
    currentPlayerId: string;
    roundNumber: number;
  };
  return {
    ...state,
    turnState: { ...state.turnState, currentPlayerId, roundNumber },
    sequenceNumber: event.sequenceNumber,
    updatedAt: event.timestamp,
  };
}

function reduceTurnOrderSet(state: GameState, event: StoredEvent): GameState {
  const { order, currentPlayerId, roundNumber } = event.payload as {
    order: string[];
    currentPlayerId: string | null;
    roundNumber: number;
  };
  return {
    ...state,
    turnState: { order, currentPlayerId, roundNumber },
    sequenceNumber: event.sequenceNumber,
    updatedAt: event.timestamp,
  };
}

// ── Player Reducers ─────────────────────────────────────────────────

function reducePlayerJoined(state: GameState, event: StoredEvent): GameState {
  const { userId, displayName } = event.payload as { userId: string; displayName: string };
  const players = new Map(state.players);
  players.set(userId, { userId, displayName, isConnected: true });
  return { ...state, players, sequenceNumber: event.sequenceNumber, updatedAt: event.timestamp };
}

function reducePlayerLeft(state: GameState, event: StoredEvent): GameState {
  const { userId } = event.payload as { userId: string };
  const player = state.players.get(userId);
  if (!player) return state;
  const players = new Map(state.players);
  players.set(userId, { ...player, isConnected: false });
  return { ...state, players, sequenceNumber: event.sequenceNumber, updatedAt: event.timestamp };
}

// ── Registration ────────────────────────────────────────────────────

/**
 * Register all event reducers in the global registry.
 * Call once at application startup.
 */
export function registerAllReducers(): void {
  const reducerMap: Record<string, EventReducer> = {
    [GameEventType.GAME_STARTED]: reduceGameStarted,
    [GameEventType.GAME_PAUSED]: reduceGamePaused,
    [GameEventType.GAME_RESUMED]: reduceGameResumed,
    [GameEventType.GAME_ENDED]: reduceGameEnded,
    [GameEventType.TOKEN_MOVED]: reduceTokenMoved,
    [GameEventType.TOKEN_ADDED]: reduceTokenAdded,
    [GameEventType.TOKEN_REMOVED]: reduceTokenRemoved,
    [GameEventType.FOG_UPDATED]: reduceFogUpdated,
    [GameEventType.TURN_ADVANCED]: reduceTurnAdvanced,
    [GameEventType.TURN_SKIPPED]: reduceTurnSkipped,
    [GameEventType.TURN_ORDER_SET]: reduceTurnOrderSet,
    [GameEventType.PLAYER_JOINED]: reducePlayerJoined,
    [GameEventType.PLAYER_LEFT]: reducePlayerLeft,
  };

  for (const [eventType, reducer] of Object.entries(reducerMap)) {
    eventReducers.set(eventType, reducer);
  }
}
