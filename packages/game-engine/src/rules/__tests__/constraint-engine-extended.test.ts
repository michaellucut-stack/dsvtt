import { describe, it, expect, beforeEach } from 'vitest';
import { ConstraintEngine, ConstraintRegistry } from '../constraint-engine.js';
import type { Constraint, ProposedAction, ConstraintContext } from '../constraint-engine.js';
import {
  getAllDrawSteelConstraints,
  createDrawSteelFreeStrikeConstraint,
} from '../draw-steel-constraints.js';
import { ActionPipeline } from '../action-pipeline.js';
import { createInitialState } from '../../state/index.js';
import type { GameState } from '../../state/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConstraint(overrides: Partial<Constraint> = {}): Constraint {
  return {
    id: 'test:default',
    name: 'Default Test Constraint',
    scope: 'movement',
    gameSystemId: 'draw-steel',
    enabled: true,
    priority: 10,
    evaluate: () => ({ valid: true, reason: null }),
    ...overrides,
  };
}

function makeContext(overrides: Partial<ConstraintContext> = {}): ConstraintContext {
  return {
    gameSystemId: 'draw-steel',
    isDirector: false,
    overriddenConstraints: new Set(),
    systemData: {},
    ...overrides,
  };
}

function makeAction(overrides: Partial<ProposedAction> = {}): ProposedAction {
  return {
    type: 'token_move',
    actorId: 'player-1',
    payload: {},
    ...overrides,
  };
}

// ── ConstraintRegistry Edge Cases ────────────────────────────────────────────

describe('ConstraintRegistry edge cases', () => {
  let registry: ConstraintRegistry;

  beforeEach(() => {
    registry = new ConstraintRegistry();
  });

  it('clear() removes all constraints across all game systems', () => {
    registry.register(makeConstraint({ id: 'a:1', gameSystemId: 'system-a' }));
    registry.register(makeConstraint({ id: 'b:1', gameSystemId: 'system-b' }));

    expect(registry.getConstraints('system-a')).toHaveLength(1);
    expect(registry.getConstraints('system-b')).toHaveLength(1);

    registry.clear();

    expect(registry.getConstraints('system-a')).toHaveLength(0);
    expect(registry.getConstraints('system-b')).toHaveLength(0);
  });

  it('clear() also clears scoped index', () => {
    registry.register(makeConstraint({ id: 'a:move', gameSystemId: 'sys', scope: 'movement' }));
    registry.register(makeConstraint({ id: 'a:combat', gameSystemId: 'sys', scope: 'combat' }));

    registry.clear();

    expect(registry.getConstraints('sys', 'movement')).toHaveLength(0);
    expect(registry.getConstraints('sys', 'combat')).toHaveLength(0);
  });

  it('duplicate constraint registration (same id) results in both being evaluated', () => {
    const evaluations: string[] = [];

    registry.register(
      makeConstraint({
        id: 'dup:1',
        evaluate: () => {
          evaluations.push('first');
          return { valid: true, reason: null };
        },
      }),
    );

    registry.register(
      makeConstraint({
        id: 'dup:1',
        evaluate: () => {
          evaluations.push('second');
          return { valid: true, reason: null };
        },
      }),
    );

    // Both are stored
    expect(registry.getConstraints('draw-steel')).toHaveLength(2);

    // Both are evaluated by the engine
    const engine = new ConstraintEngine(registry);
    const state = createInitialState('s1', 'r1');
    engine.evaluate(state, makeAction(), makeContext());

    expect(evaluations).toEqual(['first', 'second']);
  });

  it('unregister() removes all constraints for a game system including scoped', () => {
    registry.register(
      makeConstraint({ id: 'ds:1', gameSystemId: 'draw-steel', scope: 'movement' }),
    );
    registry.register(makeConstraint({ id: 'ds:2', gameSystemId: 'draw-steel', scope: 'combat' }));
    registry.register(
      makeConstraint({ id: 'other:1', gameSystemId: 'other-system', scope: 'movement' }),
    );

    registry.unregister('draw-steel');

    expect(registry.getConstraints('draw-steel')).toHaveLength(0);
    expect(registry.getConstraints('draw-steel', 'movement')).toHaveLength(0);
    expect(registry.getConstraints('draw-steel', 'combat')).toHaveLength(0);
    // Other system is untouched
    expect(registry.getConstraints('other-system')).toHaveLength(1);
  });

  it('getConstraints() returns empty array for unknown game system', () => {
    expect(registry.getConstraints('nonexistent-system')).toEqual([]);
  });

  it('getConstraints() returns empty array for unknown scope of known system', () => {
    registry.register(makeConstraint({ scope: 'movement' }));
    expect(registry.getConstraints('draw-steel', 'combat')).toEqual([]);
  });
});

// ── inferScope Explicit Mapping Tests ────────────────────────────────────────

describe('ConstraintEngine inferScope mapping', () => {
  let engine: ConstraintEngine;
  let registry: ConstraintRegistry;
  let state: GameState;

  beforeEach(() => {
    registry = new ConstraintRegistry();
    engine = new ConstraintEngine(registry);
    state = createInitialState('s1', 'r1');

    // Register one constraint per scope so we can detect which scope was selected
    const scopes = [
      'movement',
      'action_economy',
      'ability_use',
      'combat',
      'condition',
      'resource',
      'general',
    ] as const;

    for (const scope of scopes) {
      registry.register(
        makeConstraint({
          id: `marker:${scope}`,
          scope,
          evaluate: () => ({ valid: true, reason: null }),
        }),
      );
    }
  });

  function evaluatedScopes(actionType: string): string[] {
    const result = engine.evaluate(state, makeAction({ type: actionType }), makeContext());
    return result.evaluatedConstraints;
  }

  it('token_move maps to movement scope', () => {
    const evaluated = evaluatedScopes('token_move');
    expect(evaluated).toContain('marker:movement');
    expect(evaluated).not.toContain('marker:combat');
    expect(evaluated).not.toContain('marker:action_economy');
  });

  it('turn_action maps to action_economy scope', () => {
    const evaluated = evaluatedScopes('turn_action');
    expect(evaluated).toContain('marker:action_economy');
    expect(evaluated).not.toContain('marker:movement');
  });

  it('use_ability maps to ability_use scope', () => {
    const evaluated = evaluatedScopes('use_ability');
    expect(evaluated).toContain('marker:ability_use');
    expect(evaluated).not.toContain('marker:movement');
  });

  it('combat_attack maps to combat scope', () => {
    const evaluated = evaluatedScopes('combat_attack');
    expect(evaluated).toContain('marker:combat');
    expect(evaluated).not.toContain('marker:movement');
  });

  it('unknown action type evaluates ALL constraints (null scope)', () => {
    const evaluated = evaluatedScopes('unknown_garbage_type');
    // When scope is null, all constraints for the system are returned
    expect(evaluated).toContain('marker:movement');
    expect(evaluated).toContain('marker:action_economy');
    expect(evaluated).toContain('marker:ability_use');
    expect(evaluated).toContain('marker:combat');
    expect(evaluated).toContain('marker:condition');
    expect(evaluated).toContain('marker:resource');
    expect(evaluated).toContain('marker:general');
  });

  it('scope inference is case-insensitive', () => {
    const evaluated = evaluatedScopes('TOKEN_MOVE');
    expect(evaluated).toContain('marker:movement');
    expect(evaluated).not.toContain('marker:combat');
  });

  it('mixed case action types resolve correctly', () => {
    const evaluated = evaluatedScopes('Turn_Action');
    expect(evaluated).toContain('marker:action_economy');
    expect(evaluated).not.toContain('marker:movement');
  });
});

// ── ActionPipeline Edge Cases ────────────────────────────────────────────────

describe('ActionPipeline edge cases', () => {
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

  it('updateConfig() toggles constraintsEnabled off so actions pass without validation', () => {
    // Register a blocking constraint
    registry.register(
      makeConstraint({
        id: 'test:blocker',
        evaluate: () => ({ valid: false, reason: 'Blocked!' }),
      }),
    );

    const action = makeAction();

    // Initially, the constraint blocks
    const blocked = pipeline.processAction(state, action, 'draw-steel', false);
    expect(blocked.success).toBe(false);

    // Disable constraints via updateConfig
    pipeline.updateConfig({ constraintsEnabled: false });

    const passed = pipeline.processAction(state, action, 'draw-steel', false);
    expect(passed.success).toBe(true);
    expect(passed.validation.evaluatedConstraints).toHaveLength(0);
    expect(passed.validation.evaluationTimeMs).toBe(0);
  });

  it('removeOverride() on non-existent session does not throw', () => {
    expect(() => {
      pipeline.removeOverride('no-such-session', 'some-constraint');
    }).not.toThrow();
  });

  it('getOverrides() on non-existent session returns empty array', () => {
    const overrides = pipeline.getOverrides('no-such-session');
    expect(overrides).toEqual([]);
  });

  it('clearOverrides() clears all overrides for a session', () => {
    pipeline.addOverride('session-1', 'c1');
    pipeline.addOverride('session-1', 'c2');
    pipeline.addOverride('session-1', 'c3');

    expect(pipeline.getOverrides('session-1')).toHaveLength(3);

    pipeline.clearOverrides('session-1');

    expect(pipeline.getOverrides('session-1')).toEqual([]);
  });

  it('clearOverrides() does not affect other sessions', () => {
    pipeline.addOverride('session-1', 'c1');
    pipeline.addOverride('session-2', 'c2');

    pipeline.clearOverrides('session-1');

    expect(pipeline.getOverrides('session-1')).toEqual([]);
    expect(pipeline.getOverrides('session-2')).toEqual(['c2']);
  });

  it('processing action when constraintsEnabled is false skips all validation', () => {
    const disabledPipeline = new ActionPipeline(engine, {
      constraintsEnabled: false,
    });

    // Register multiple blocking constraints
    registry.register(
      makeConstraint({
        id: 'block:1',
        scope: 'movement',
        evaluate: () => ({ valid: false, reason: 'Nope 1' }),
      }),
    );
    registry.register(
      makeConstraint({
        id: 'block:2',
        scope: 'combat',
        evaluate: () => ({ valid: false, reason: 'Nope 2' }),
      }),
    );

    const action = makeAction();
    const result = disabledPipeline.processAction(state, action, 'draw-steel', false);

    expect(result.success).toBe(true);
    expect(result.validation.valid).toBe(true);
    expect(result.validation.evaluatedConstraints).toHaveLength(0);
    expect(result.event).not.toBeNull();
  });
});

// ── Constraint Evaluator Exception Handling ──────────────────────────────────

describe('Constraint evaluator exception handling', () => {
  it('propagates errors thrown by constraint evaluate function', () => {
    const registry = new ConstraintRegistry();
    const engine = new ConstraintEngine(registry);
    const state = createInitialState('s1', 'r1');

    registry.register(
      makeConstraint({
        id: 'test:throws',
        evaluate: () => {
          throw new Error('Evaluator exploded');
        },
      }),
    );

    expect(() => {
      engine.evaluate(state, makeAction(), makeContext());
    }).toThrow('Evaluator exploded');
  });

  it('does not catch TypeError from constraint evaluators', () => {
    const registry = new ConstraintRegistry();
    const engine = new ConstraintEngine(registry);
    const state = createInitialState('s1', 'r1');

    registry.register(
      makeConstraint({
        id: 'test:type-error',
        evaluate: (() => {
          const obj: Record<string, unknown> = {};
          // Force a TypeError by calling a non-function
          (obj as unknown as { call: () => void }).call();
          // Unreachable, but satisfies return type
          return { valid: true, reason: null };
        }) as Constraint['evaluate'],
      }),
    );

    expect(() => {
      engine.evaluate(state, makeAction(), makeContext());
    }).toThrow();
  });
});

// ── Free Strike Constraint ───────────────────────────────────────────────────

describe('Draw Steel free strike constraint', () => {
  it('always returns valid (advisory only)', () => {
    const constraint = createDrawSteelFreeStrikeConstraint();
    const state = createInitialState('s1', 'r1');
    const context = makeContext();

    // Test with various action types and payloads
    const scenarios = [
      makeAction({ type: 'token_move', payload: { distance: 100, creatureSpeed: 5 } }),
      makeAction({ type: 'move', payload: {} }),
      makeAction({ type: 'forced_move', payload: { isForced: true } }),
      makeAction({ type: 'combat_attack', payload: {} }),
    ];

    for (const action of scenarios) {
      const result = constraint.evaluate(state, action, context);
      expect(result.valid).toBe(true);
    }
  });

  it('is registered with the correct scope and priority', () => {
    const constraint = createDrawSteelFreeStrikeConstraint();

    expect(constraint.scope).toBe('movement');
    expect(constraint.priority).toBe(100); // Low priority - advisory
    expect(constraint.gameSystemId).toBe('draw-steel');
    expect(constraint.id).toBe('draw-steel:combat:free_strike_opportunity');
    expect(constraint.enabled).toBe(true);
  });
});

// ── Integrated Draw Steel Pipeline Test ──────────────────────────────────────

describe('Integrated Draw Steel pipeline', () => {
  let registry: ConstraintRegistry;
  let engine: ConstraintEngine;
  let pipeline: ActionPipeline;
  let state: GameState;

  beforeEach(() => {
    registry = new ConstraintRegistry();
    engine = new ConstraintEngine(registry);
    pipeline = new ActionPipeline(engine, { logPerformanceWarnings: false });
    state = createInitialState('session-ds', 'room-ds');

    // Register all 6 Draw Steel constraints
    const constraints = getAllDrawSteelConstraints();
    expect(constraints).toHaveLength(6);
    for (const c of constraints) {
      registry.register(c);
    }
  });

  it('registers all 6 Draw Steel constraints', () => {
    const all = registry.getConstraints('draw-steel');
    expect(all).toHaveLength(6);

    const ids = all.map((c) => c.id);
    expect(ids).toContain('draw-steel:movement:speed_limit');
    expect(ids).toContain('draw-steel:action_economy:turn_actions');
    expect(ids).toContain('draw-steel:combat:free_strike_opportunity');
    expect(ids).toContain('draw-steel:movement:stability');
    expect(ids).toContain('draw-steel:condition:restrained');
    expect(ids).toContain('draw-steel:condition:grabbed');
  });

  it('valid movement within speed passes', () => {
    const action = makeAction({
      type: 'token_move',
      actorId: 'creature-1',
      payload: { distance: 5, creatureSpeed: 6 },
    });

    const result = pipeline.processAction(state, action, 'draw-steel', false);
    expect(result.success).toBe(true);
    expect(result.validation.valid).toBe(true);
    expect(result.event).not.toBeNull();
  });

  it('movement over speed is blocked', () => {
    const action = makeAction({
      type: 'token_move',
      actorId: 'creature-1',
      payload: { distance: 10, creatureSpeed: 6 },
    });

    const result = pipeline.processAction(state, action, 'draw-steel', false);
    expect(result.success).toBe(false);
    expect(result.validation.valid).toBe(false);
    expect(result.validation.reason).toContain('exceeds speed');
    expect(result.validation.constraintId).toBe('draw-steel:movement:speed_limit');
  });

  it('Director override bypasses speed constraint, removal re-blocks', () => {
    const speedConstraintId = 'draw-steel:movement:speed_limit';

    const action = makeAction({
      type: 'token_move',
      actorId: 'creature-1',
      payload: { distance: 10, creatureSpeed: 6 },
    });

    // Step 1: Blocked without override
    const blocked = pipeline.processAction(state, action, 'draw-steel', false);
    expect(blocked.success).toBe(false);
    expect(blocked.validation.constraintId).toBe(speedConstraintId);

    // Step 2: Add Director override for speed constraint
    pipeline.addOverride('session-ds', speedConstraintId);
    expect(pipeline.getOverrides('session-ds')).toContain(speedConstraintId);

    // Step 3: Now the same action passes
    const overridden = pipeline.processAction(state, action, 'draw-steel', false);
    expect(overridden.success).toBe(true);
    expect(overridden.validation.valid).toBe(true);
    expect(overridden.validation.evaluatedConstraints).not.toContain(speedConstraintId);

    // Step 4: Remove the override
    pipeline.removeOverride('session-ds', speedConstraintId);
    expect(pipeline.getOverrides('session-ds')).not.toContain(speedConstraintId);

    // Step 5: Blocked again
    const blockedAgain = pipeline.processAction(state, action, 'draw-steel', false);
    expect(blockedAgain.success).toBe(false);
    expect(blockedAgain.validation.constraintId).toBe(speedConstraintId);
  });

  it('restrained creature cannot move even within speed', () => {
    const action = makeAction({
      type: 'token_move',
      actorId: 'creature-1',
      payload: { distance: 1, creatureSpeed: 6, isRestrained: true },
    });

    const result = pipeline.processAction(state, action, 'draw-steel', false);
    expect(result.success).toBe(false);
    expect(result.validation.reason).toContain('Restrained');
    // Restrained has priority 1 so it should be the blocking constraint
    expect(result.validation.constraintId).toBe('draw-steel:condition:restrained');
  });

  it('grabbed creature cannot move unless escape attempt', () => {
    const moveAction = makeAction({
      type: 'token_move',
      actorId: 'creature-1',
      payload: { distance: 1, creatureSpeed: 6, isGrabbed: true },
    });

    const blocked = pipeline.processAction(state, moveAction, 'draw-steel', false);
    expect(blocked.success).toBe(false);
    expect(blocked.validation.reason).toContain('Grabbed');

    // Escape attempt is allowed
    const escapeAction = makeAction({
      type: 'token_move',
      actorId: 'creature-1',
      payload: { distance: 1, creatureSpeed: 6, isGrabbed: true, isEscapeAttempt: true },
    });

    const passed = pipeline.processAction(state, escapeAction, 'draw-steel', false);
    expect(passed.success).toBe(true);
  });

  it('forced movement reduced to zero by stability is blocked', () => {
    const action = makeAction({
      type: 'forced_move',
      actorId: 'creature-1',
      payload: { distance: 3, isForced: true, creatureStability: 5 },
    });

    const result = pipeline.processAction(state, action, 'draw-steel', false);
    expect(result.success).toBe(false);
    expect(result.validation.reason).toContain('stability');
  });

  it('action economy blocks second action in a turn', () => {
    const action = makeAction({
      type: 'turn_action',
      actorId: 'creature-1',
      payload: { actionType: 'action', actionsUsedThisTurn: 1 },
    });

    const result = pipeline.processAction(state, action, 'draw-steel', false);
    expect(result.success).toBe(false);
    expect(result.validation.reason).toContain('already used your action');
  });
});
