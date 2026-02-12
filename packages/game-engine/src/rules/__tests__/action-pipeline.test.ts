import { describe, it, expect, beforeEach } from 'vitest';
import { ActionPipeline } from '../action-pipeline.js';
import { ConstraintEngine, ConstraintRegistry } from '../constraint-engine.js';
import type { Constraint, ProposedAction } from '../constraint-engine.js';
import { createInitialState } from '../../state/index.js';
import type { GameState } from '../../state/index.js';

describe('ActionPipeline', () => {
  let pipeline: ActionPipeline;
  let engine: ConstraintEngine;
  let registry: ConstraintRegistry;
  let state: GameState;

  beforeEach(() => {
    registry = new ConstraintRegistry();
    engine = new ConstraintEngine(registry);
    pipeline = new ActionPipeline(engine);
    state = createInitialState('session-1', 'room-1');
  });

  describe('processAction', () => {
    it('processes valid action successfully', () => {
      const action: ProposedAction = {
        type: 'TOKEN_MOVED',
        actorId: 'player-1',
        payload: { tokenId: 'token-1', x: 5, y: 3 },
      };

      const result = pipeline.processAction(state, action, 'draw-steel', false);
      expect(result.success).toBe(true);
      expect(result.validation.valid).toBe(true);
      expect(result.event).not.toBeNull();
      expect(result.event!.eventType).toBe('TOKEN_MOVED');
    });

    it('blocks action when constraint fails', () => {
      const blockingConstraint: Constraint = {
        id: 'test:blocker',
        name: 'Test Blocker',
        scope: 'movement',
        gameSystemId: 'draw-steel',
        enabled: true,
        priority: 10,
        evaluate: () => ({ valid: false, reason: 'Test block' }),
      };
      registry.register(blockingConstraint);

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: {},
      };

      const result = pipeline.processAction(state, action, 'draw-steel', false);
      expect(result.success).toBe(false);
      expect(result.validation.valid).toBe(false);
      expect(result.newState).toBeNull();
      expect(result.event).toBeNull();
    });

    it('skips constraints when no game system is set', () => {
      const blockingConstraint: Constraint = {
        id: 'test:blocker',
        name: 'Test Blocker',
        scope: 'general',
        gameSystemId: 'draw-steel',
        enabled: true,
        priority: 10,
        evaluate: () => ({ valid: false, reason: 'Should not block' }),
      };
      registry.register(blockingConstraint);

      const action: ProposedAction = {
        type: 'TOKEN_MOVED',
        actorId: 'player-1',
        payload: { tokenId: 'token-1', x: 5, y: 3 },
      };

      const result = pipeline.processAction(state, action, '', false);
      expect(result.success).toBe(true);
    });

    it('skips constraints when disabled in config', () => {
      const pipelineDisabled = new ActionPipeline(engine, { constraintsEnabled: false });
      const blockingConstraint: Constraint = {
        id: 'test:blocker',
        name: 'Test Blocker',
        scope: 'movement',
        gameSystemId: 'draw-steel',
        enabled: true,
        priority: 10,
        evaluate: () => ({ valid: false, reason: 'Should not block' }),
      };
      registry.register(blockingConstraint);

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: {},
      };

      const result = pipelineDisabled.processAction(state, action, 'draw-steel', false);
      expect(result.success).toBe(true);
    });

    it('assigns correct sequence number to events', () => {
      const action: ProposedAction = {
        type: 'TOKEN_MOVED',
        actorId: 'player-1',
        payload: { tokenId: 'token-1', x: 1, y: 1 },
      };

      const result = pipeline.processAction(state, action, 'draw-steel', false);
      expect(result.event!.sequenceNumber).toBe(1);
    });

    it('sets correct actor type for Director', () => {
      const action: ProposedAction = {
        type: 'TOKEN_MOVED',
        actorId: 'director-1',
        payload: { tokenId: 'token-1', x: 1, y: 1 },
      };

      const result = pipeline.processAction(state, action, 'draw-steel', true);
      expect(result.event!.actorType).toBe('director');
    });

    it('sets correct actor type for Player', () => {
      const action: ProposedAction = {
        type: 'TOKEN_MOVED',
        actorId: 'player-1',
        payload: { tokenId: 'token-1', x: 1, y: 1 },
      };

      const result = pipeline.processAction(state, action, 'draw-steel', false);
      expect(result.event!.actorType).toBe('player');
    });
  });

  describe('Director overrides', () => {
    it('adds and retrieves overrides', () => {
      pipeline.addOverride('session-1', 'constraint-1');
      pipeline.addOverride('session-1', 'constraint-2');

      const overrides = pipeline.getOverrides('session-1');
      expect(overrides).toContain('constraint-1');
      expect(overrides).toContain('constraint-2');
    });

    it('removes a specific override', () => {
      pipeline.addOverride('session-1', 'constraint-1');
      pipeline.addOverride('session-1', 'constraint-2');
      pipeline.removeOverride('session-1', 'constraint-1');

      const overrides = pipeline.getOverrides('session-1');
      expect(overrides).not.toContain('constraint-1');
      expect(overrides).toContain('constraint-2');
    });

    it('clears all overrides for a session', () => {
      pipeline.addOverride('session-1', 'constraint-1');
      pipeline.addOverride('session-1', 'constraint-2');
      pipeline.clearOverrides('session-1');

      const overrides = pipeline.getOverrides('session-1');
      expect(overrides).toHaveLength(0);
    });

    it('overrides apply to action processing', () => {
      const blockingConstraint: Constraint = {
        id: 'test:blocker',
        name: 'Test Blocker',
        scope: 'movement',
        gameSystemId: 'draw-steel',
        enabled: true,
        priority: 10,
        evaluate: () => ({ valid: false, reason: 'Blocked' }),
      };
      registry.register(blockingConstraint);

      // Add override
      pipeline.addOverride('session-1', 'test:blocker');

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: {},
      };

      const result = pipeline.processAction(state, action, 'draw-steel', false);
      expect(result.success).toBe(true);
    });
  });
});
