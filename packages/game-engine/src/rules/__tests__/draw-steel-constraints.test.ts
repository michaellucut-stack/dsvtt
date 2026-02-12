import { describe, it, expect, beforeEach } from 'vitest';
import { ConstraintEngine, ConstraintRegistry } from '../constraint-engine.js';
import type { ProposedAction, ConstraintContext } from '../constraint-engine.js';
import {
  createDrawSteelMovementConstraint,
  createDrawSteelActionEconomyConstraint,
  createDrawSteelStabilityConstraint,
  createDrawSteelRestrainedConstraint,
  createDrawSteelGrabbedConstraint,
  getAllDrawSteelConstraints,
} from '../draw-steel-constraints.js';
import { createInitialState } from '../../state/index.js';
import type { GameState } from '../../state/index.js';

describe('Draw Steel Constraints', () => {
  let engine: ConstraintEngine;
  let registry: ConstraintRegistry;
  let state: GameState;
  let context: ConstraintContext;

  beforeEach(() => {
    registry = new ConstraintRegistry();
    engine = new ConstraintEngine(registry);
    state = createInitialState('session-1', 'room-1');
    context = {
      gameSystemId: 'draw-steel',
      isDirector: false,
      overriddenConstraints: new Set(),
      systemData: {},
    };
  });

  describe('Movement Speed Constraint', () => {
    beforeEach(() => {
      registry.register(createDrawSteelMovementConstraint());
    });

    it('allows movement within speed limit', () => {
      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { distance: 5, creatureSpeed: 6 },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
    });

    it('allows exact speed movement', () => {
      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { distance: 5, creatureSpeed: 5 },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
    });

    it('blocks movement exceeding speed', () => {
      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { distance: 8, creatureSpeed: 5 },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds speed');
    });

    it('allows movement when no speed data is provided', () => {
      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: {},
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
    });
  });

  describe('Action Economy Constraint', () => {
    beforeEach(() => {
      registry.register(createDrawSteelActionEconomyConstraint());
    });

    it('allows first action of the turn', () => {
      const action: ProposedAction = {
        type: 'turn_action',
        actorId: 'player-1',
        payload: { actionType: 'action', actionsUsedThisTurn: 0 },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
    });

    it('blocks second action in same turn', () => {
      const action: ProposedAction = {
        type: 'turn_action',
        actorId: 'player-1',
        payload: { actionType: 'action', actionsUsedThisTurn: 1 },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('already used your action');
    });

    it('blocks second maneuver in same turn', () => {
      const action: ProposedAction = {
        type: 'turn_action',
        actorId: 'player-1',
        payload: { actionType: 'maneuver', maneuversUsedThisTurn: 1 },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('already used your maneuver');
    });

    it('enforces dazed condition - blocks action when maneuver used', () => {
      const action: ProposedAction = {
        type: 'turn_action',
        actorId: 'player-1',
        payload: { actionType: 'action', maneuversUsedThisTurn: 1, isDazed: true },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Dazed');
    });

    it('enforces dazed condition - blocks maneuver when action used', () => {
      const action: ProposedAction = {
        type: 'turn_action',
        actorId: 'player-1',
        payload: { actionType: 'maneuver', actionsUsedThisTurn: 1, isDazed: true },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Dazed');
    });

    it('allows triggered actions without limit', () => {
      const action: ProposedAction = {
        type: 'turn_action',
        actorId: 'player-1',
        payload: { actionType: 'triggered action' },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
    });
  });

  describe('Stability Constraint', () => {
    beforeEach(() => {
      registry.register(createDrawSteelStabilityConstraint());
    });

    it('ignores voluntary movement', () => {
      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { distance: 5, isForced: false },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
    });

    it('blocks forced movement when stability fully negates it', () => {
      const action: ProposedAction = {
        type: 'forced_move',
        actorId: 'target-1',
        payload: { distance: 3, isForced: true, creatureStability: 5 },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('completely negates');
    });

    it('allows reduced forced movement when stability partially negates', () => {
      const action: ProposedAction = {
        type: 'forced_move',
        actorId: 'target-1',
        payload: { distance: 5, isForced: true, creatureStability: 2 },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
      expect(action.payload['effectiveDistance']).toBe(3);
    });
  });

  describe('Restrained Condition', () => {
    beforeEach(() => {
      registry.register(createDrawSteelRestrainedConstraint());
    });

    it('blocks all movement when restrained', () => {
      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { isRestrained: true },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('speed 0');
    });

    it('allows non-movement actions when restrained', () => {
      const action: ProposedAction = {
        type: 'use_ability',
        actorId: 'player-1',
        payload: { isRestrained: true },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
    });
  });

  describe('Grabbed Condition', () => {
    beforeEach(() => {
      registry.register(createDrawSteelGrabbedConstraint());
    });

    it('blocks normal movement when grabbed', () => {
      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { isGrabbed: true },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('speed 0');
    });

    it('allows escape attempts when grabbed', () => {
      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { isGrabbed: true, isEscapeAttempt: true },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
    });
  });

  describe('getAllDrawSteelConstraints', () => {
    it('returns all 6 Draw Steel constraints', () => {
      const constraints = getAllDrawSteelConstraints();
      expect(constraints).toHaveLength(6);
    });

    it('all constraints have the draw-steel game system ID', () => {
      const constraints = getAllDrawSteelConstraints();
      expect(constraints.every((c) => c.gameSystemId === 'draw-steel')).toBe(true);
    });
  });

  describe('Director Override Integration', () => {
    it('Director can bypass movement speed constraint', () => {
      registry.register(createDrawSteelMovementConstraint());

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { distance: 100, creatureSpeed: 5 },
      };

      // Without override: blocked
      const blocked = engine.evaluate(state, action, context);
      expect(blocked.valid).toBe(false);

      // With override: allowed
      const overrideContext: ConstraintContext = {
        ...context,
        overriddenConstraints: new Set(['draw-steel:movement:speed_limit']),
      };
      const allowed = engine.evaluate(state, action, overrideContext);
      expect(allowed.valid).toBe(true);
    });
  });
});
