import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConstraintEngine,
  ConstraintRegistry,
  createMovementSpeedConstraint,
  createActionEconomyConstraint,
} from '../constraint-engine.js';
import type { Constraint, ProposedAction, ConstraintContext } from '../constraint-engine.js';
import { createInitialState } from '../../state/index.js';
import type { GameState } from '../../state/index.js';

describe('ConstraintEngine', () => {
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

  describe('evaluate', () => {
    it('returns valid when no constraints are registered', () => {
      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { distance: 5 },
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
      expect(result.constraintId).toBeNull();
      expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('blocks action when a constraint fails', () => {
      const blockingConstraint: Constraint = {
        id: 'test:always-block',
        name: 'Always Block',
        scope: 'movement',
        gameSystemId: 'draw-steel',
        enabled: true,
        priority: 10,
        evaluate: () => ({ valid: false, reason: 'Blocked for testing' }),
      };
      registry.register(blockingConstraint);

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: {},
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Blocked for testing');
      expect(result.constraintId).toBe('test:always-block');
    });

    it('allows action when all constraints pass', () => {
      const passingConstraint: Constraint = {
        id: 'test:always-pass',
        name: 'Always Pass',
        scope: 'movement',
        gameSystemId: 'draw-steel',
        enabled: true,
        priority: 10,
        evaluate: () => ({ valid: true, reason: null }),
      };
      registry.register(passingConstraint);

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: {},
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
    });

    it('skips disabled constraints', () => {
      const disabledConstraint: Constraint = {
        id: 'test:disabled',
        name: 'Disabled Constraint',
        scope: 'movement',
        gameSystemId: 'draw-steel',
        enabled: false,
        priority: 10,
        evaluate: () => ({ valid: false, reason: 'Should not be evaluated' }),
      };
      registry.register(disabledConstraint);

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: {},
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
      expect(result.evaluatedConstraints).not.toContain('test:disabled');
    });

    it('respects Director overrides', () => {
      const blockingConstraint: Constraint = {
        id: 'test:blocking',
        name: 'Blocking Constraint',
        scope: 'movement',
        gameSystemId: 'draw-steel',
        enabled: true,
        priority: 10,
        evaluate: () => ({ valid: false, reason: 'Blocked' }),
      };
      registry.register(blockingConstraint);

      // Add override for this constraint
      const overrideContext: ConstraintContext = {
        ...context,
        overriddenConstraints: new Set(['test:blocking']),
      };

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: {},
      };

      const result = engine.evaluate(state, action, overrideContext);
      expect(result.valid).toBe(true);
    });

    it('evaluates constraints in priority order', () => {
      const order: string[] = [];

      const lowPriority: Constraint = {
        id: 'test:low',
        name: 'Low Priority',
        scope: 'movement',
        gameSystemId: 'draw-steel',
        enabled: true,
        priority: 100,
        evaluate: () => {
          order.push('low');
          return { valid: true, reason: null };
        },
      };

      const highPriority: Constraint = {
        id: 'test:high',
        name: 'High Priority',
        scope: 'movement',
        gameSystemId: 'draw-steel',
        enabled: true,
        priority: 1,
        evaluate: () => {
          order.push('high');
          return { valid: true, reason: null };
        },
      };

      // Register in reverse order to test sorting
      registry.register(lowPriority);
      registry.register(highPriority);

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: {},
      };

      engine.evaluate(state, action, context);
      expect(order).toEqual(['high', 'low']);
    });

    it('tracks evaluation time under 50ms budget', () => {
      // Register multiple lightweight constraints
      for (let i = 0; i < 20; i++) {
        registry.register({
          id: `test:fast-${i}`,
          name: `Fast Constraint ${i}`,
          scope: 'movement',
          gameSystemId: 'draw-steel',
          enabled: true,
          priority: i,
          evaluate: () => ({ valid: true, reason: null }),
        });
      }

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: {},
      };

      const result = engine.evaluate(state, action, context);
      expect(result.valid).toBe(true);
      expect(result.evaluationTimeMs).toBeLessThan(50);
      expect(result.evaluatedConstraints).toHaveLength(20);
    });
  });
});

describe('ConstraintRegistry', () => {
  let registry: ConstraintRegistry;

  beforeEach(() => {
    registry = new ConstraintRegistry();
  });

  it('registers and retrieves constraints by game system', () => {
    const constraint: Constraint = {
      id: 'test:c1',
      name: 'Test',
      scope: 'movement',
      gameSystemId: 'draw-steel',
      enabled: true,
      priority: 10,
      evaluate: () => ({ valid: true, reason: null }),
    };

    registry.register(constraint);
    expect(registry.getConstraints('draw-steel')).toHaveLength(1);
    expect(registry.getConstraints('other-system')).toHaveLength(0);
  });

  it('filters constraints by scope', () => {
    registry.register({
      id: 'test:movement',
      name: 'Movement',
      scope: 'movement',
      gameSystemId: 'draw-steel',
      enabled: true,
      priority: 10,
      evaluate: () => ({ valid: true, reason: null }),
    });

    registry.register({
      id: 'test:combat',
      name: 'Combat',
      scope: 'combat',
      gameSystemId: 'draw-steel',
      enabled: true,
      priority: 10,
      evaluate: () => ({ valid: true, reason: null }),
    });

    expect(registry.getConstraints('draw-steel', 'movement')).toHaveLength(1);
    expect(registry.getConstraints('draw-steel', 'combat')).toHaveLength(1);
    expect(registry.getConstraints('draw-steel', 'ability_use')).toHaveLength(0);
  });

  it('unregisters all constraints for a game system', () => {
    registry.register({
      id: 'test:c1',
      name: 'Test',
      scope: 'movement',
      gameSystemId: 'draw-steel',
      enabled: true,
      priority: 10,
      evaluate: () => ({ valid: true, reason: null }),
    });

    registry.unregister('draw-steel');
    expect(registry.getConstraints('draw-steel')).toHaveLength(0);
  });
});

describe('createMovementSpeedConstraint', () => {
  it('allows movement within speed limit', () => {
    const constraint = createMovementSpeedConstraint('draw-steel', () => 6);
    const state = createInitialState('s1', 'r1');
    const action: ProposedAction = {
      type: 'token_move',
      actorId: 'p1',
      payload: { distance: 5 },
    };

    const result = constraint.evaluate(state, action, {} as ConstraintContext);
    expect(result.valid).toBe(true);
  });

  it('blocks movement exceeding speed limit', () => {
    const constraint = createMovementSpeedConstraint('draw-steel', () => 5);
    const state = createInitialState('s1', 'r1');
    const action: ProposedAction = {
      type: 'token_move',
      actorId: 'p1',
      payload: { distance: 8 },
    };

    const result = constraint.evaluate(state, action, {} as ConstraintContext);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('exceeds speed');
  });

  it('allows movement when speed data is not available', () => {
    const constraint = createMovementSpeedConstraint('draw-steel', () => null);
    const state = createInitialState('s1', 'r1');
    const action: ProposedAction = {
      type: 'token_move',
      actorId: 'p1',
      payload: { distance: 100 },
    };

    const result = constraint.evaluate(state, action, {} as ConstraintContext);
    expect(result.valid).toBe(true);
  });
});

describe('createActionEconomyConstraint', () => {
  it('creates a valid constraint with correct properties', () => {
    const constraint = createActionEconomyConstraint('draw-steel', {
      maxActions: 1,
      maxManeuvers: 1,
      maxTriggeredActions: 1,
    });

    expect(constraint.id).toBe('draw-steel:action_economy:per_turn');
    expect(constraint.scope).toBe('action_economy');
    expect(constraint.enabled).toBe(true);
  });

  it('allows actions when no turn tracking is present', () => {
    const constraint = createActionEconomyConstraint('draw-steel', {
      maxActions: 1,
      maxManeuvers: 1,
      maxTriggeredActions: 1,
    });
    const state = createInitialState('s1', 'r1');
    const action: ProposedAction = {
      type: 'use_action',
      actorId: 'p1',
      payload: { actionType: 'action' },
    };

    const result = constraint.evaluate(state, action, {} as ConstraintContext);
    expect(result.valid).toBe(true);
  });
});
