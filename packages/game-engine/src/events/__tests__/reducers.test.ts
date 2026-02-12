import { describe, it, expect, beforeAll } from 'vitest';
import { createInitialState } from '../../state/index.js';
import { applyEvent, replayEvents, eventReducers } from '../index.js';
import { registerAllReducers } from '../reducers.js';
import type { StoredEvent } from '../index.js';

function makeEvent(
  overrides: Partial<StoredEvent> & Pick<StoredEvent, 'eventType' | 'payload' | 'sequenceNumber'>,
): StoredEvent {
  return {
    id: `evt-${overrides.sequenceNumber}`,
    sessionId: 'session-1',
    actorId: 'user-1',
    actorType: 'director',
    timestamp: new Date('2026-01-01T12:00:00Z'),
    metadata: {},
    ...overrides,
  };
}

beforeAll(() => {
  registerAllReducers();
});

describe('Event Reducers', () => {
  it('registers all expected reducers', () => {
    expect(eventReducers.size).toBeGreaterThanOrEqual(13);
    expect(eventReducers.has('GAME_STARTED')).toBe(true);
    expect(eventReducers.has('TOKEN_MOVED')).toBe(true);
    expect(eventReducers.has('TURN_ADVANCED')).toBe(true);
  });

  it('GAME_STARTED sets status to active', () => {
    const state = createInitialState('session-1', 'room-1');
    const event = makeEvent({
      eventType: 'GAME_STARTED',
      payload: { roomId: 'room-1' },
      sequenceNumber: 1,
    });
    const result = applyEvent(state, event);
    expect(result.status).toBe('active');
    expect(result.sequenceNumber).toBe(1);
  });

  it('GAME_PAUSED sets status to paused', () => {
    const state = { ...createInitialState('session-1', 'room-1'), status: 'active' as const };
    const event = makeEvent({
      eventType: 'GAME_PAUSED',
      payload: {},
      sequenceNumber: 2,
    });
    const result = applyEvent(state, event);
    expect(result.status).toBe('paused');
  });

  it('TOKEN_ADDED adds a token to state', () => {
    const state = createInitialState('session-1', 'room-1');
    const event = makeEvent({
      eventType: 'TOKEN_ADDED',
      payload: {
        tokenId: 'token-1',
        mapId: 'map-1',
        name: 'Goblin',
        x: 3,
        y: 5,
        width: 1,
        height: 1,
        layer: 'token',
        visible: true,
        ownerId: 'user-1',
      },
      sequenceNumber: 1,
    });
    const result = applyEvent(state, event);
    expect(result.tokens.size).toBe(1);
    expect(result.tokens.get('token-1')?.name).toBe('Goblin');
    expect(result.tokens.get('token-1')?.x).toBe(3);
    expect(result.tokens.get('token-1')?.y).toBe(5);
  });

  it('TOKEN_MOVED updates token position', () => {
    const state = createInitialState('session-1', 'room-1');
    state.tokens.set('token-1', {
      id: 'token-1',
      mapId: 'map-1',
      ownerId: 'user-1',
      name: 'Goblin',
      imageUrl: null,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: 'token',
      visible: true,
    });

    const event = makeEvent({
      eventType: 'TOKEN_MOVED',
      payload: { tokenId: 'token-1', x: 5, y: 10 },
      sequenceNumber: 1,
    });
    const result = applyEvent(state, event);
    expect(result.tokens.get('token-1')?.x).toBe(5);
    expect(result.tokens.get('token-1')?.y).toBe(10);
  });

  it('TOKEN_REMOVED deletes a token from state', () => {
    const state = createInitialState('session-1', 'room-1');
    state.tokens.set('token-1', {
      id: 'token-1',
      mapId: 'map-1',
      ownerId: 'user-1',
      name: 'Goblin',
      imageUrl: null,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: 'token',
      visible: true,
    });

    const event = makeEvent({
      eventType: 'TOKEN_REMOVED',
      payload: { tokenId: 'token-1' },
      sequenceNumber: 1,
    });
    const result = applyEvent(state, event);
    expect(result.tokens.size).toBe(0);
  });

  it('FOG_UPDATED toggles fog region revealed', () => {
    const state = createInitialState('session-1', 'room-1');
    state.fogRegions.set('fog-1', {
      id: 'fog-1',
      mapId: 'map-1',
      points: [{ x: 0, y: 0 }],
      revealed: false,
    });

    const event = makeEvent({
      eventType: 'FOG_UPDATED',
      payload: { regionId: 'fog-1', revealed: true },
      sequenceNumber: 1,
    });
    const result = applyEvent(state, event);
    expect(result.fogRegions.get('fog-1')?.revealed).toBe(true);
  });

  it('TURN_ADVANCED updates turn state', () => {
    const state = createInitialState('session-1', 'room-1');
    const event = makeEvent({
      eventType: 'TURN_ADVANCED',
      payload: { currentPlayerId: 'player-2', roundNumber: 3 },
      sequenceNumber: 1,
    });
    const result = applyEvent(state, event);
    expect(result.turnState.currentPlayerId).toBe('player-2');
    expect(result.turnState.roundNumber).toBe(3);
  });

  it('PLAYER_JOINED adds a player', () => {
    const state = createInitialState('session-1', 'room-1');
    const event = makeEvent({
      eventType: 'PLAYER_JOINED',
      payload: { userId: 'player-1', displayName: 'Aragorn' },
      sequenceNumber: 1,
    });
    const result = applyEvent(state, event);
    expect(result.players.size).toBe(1);
    expect(result.players.get('player-1')?.displayName).toBe('Aragorn');
    expect(result.players.get('player-1')?.isConnected).toBe(true);
  });

  it('PLAYER_LEFT marks player as disconnected', () => {
    const state = createInitialState('session-1', 'room-1');
    state.players.set('player-1', {
      userId: 'player-1',
      displayName: 'Aragorn',
      isConnected: true,
    });

    const event = makeEvent({
      eventType: 'PLAYER_LEFT',
      payload: { userId: 'player-1' },
      sequenceNumber: 1,
    });
    const result = applyEvent(state, event);
    expect(result.players.get('player-1')?.isConnected).toBe(false);
  });

  it('unknown event type is ignored', () => {
    const state = createInitialState('session-1', 'room-1');
    const event = makeEvent({
      eventType: 'UNKNOWN_EVENT',
      payload: { foo: 'bar' },
      sequenceNumber: 1,
    });
    const result = applyEvent(state, event);
    expect(result).toBe(state);
  });

  it('replayEvents replays a full sequence correctly', () => {
    const initial = createInitialState('session-1', 'room-1');

    const events: StoredEvent[] = [
      makeEvent({
        eventType: 'GAME_STARTED',
        payload: { roomId: 'room-1' },
        sequenceNumber: 1,
      }),
      makeEvent({
        eventType: 'PLAYER_JOINED',
        payload: { userId: 'player-1', displayName: 'Frodo' },
        sequenceNumber: 2,
      }),
      makeEvent({
        eventType: 'TOKEN_ADDED',
        payload: {
          tokenId: 'token-1',
          mapId: 'map-1',
          name: 'Frodo',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          layer: 'token',
          visible: true,
          ownerId: 'player-1',
        },
        sequenceNumber: 3,
      }),
      makeEvent({
        eventType: 'TOKEN_MOVED',
        payload: { tokenId: 'token-1', x: 5, y: 3 },
        sequenceNumber: 4,
      }),
      makeEvent({
        eventType: 'TURN_ADVANCED',
        payload: { currentPlayerId: 'player-1', roundNumber: 1 },
        sequenceNumber: 5,
      }),
      // Chat events don't change state — they should be ignored gracefully
      makeEvent({
        eventType: 'CHAT_MESSAGE',
        payload: { messageId: 'msg-1', channel: 'ooc', content: 'Hello!' },
        sequenceNumber: 6,
      }),
    ];

    const finalState = replayEvents(initial, events);

    expect(finalState.status).toBe('active');
    expect(finalState.sequenceNumber).toBe(5); // Last state-modifying event
    expect(finalState.players.size).toBe(1);
    expect(finalState.players.get('player-1')?.displayName).toBe('Frodo');
    expect(finalState.tokens.size).toBe(1);
    expect(finalState.tokens.get('token-1')?.x).toBe(5);
    expect(finalState.tokens.get('token-1')?.y).toBe(3);
    expect(finalState.turnState.currentPlayerId).toBe('player-1');
    expect(finalState.turnState.roundNumber).toBe(1);
  });
});
