import { describe, it, expect, beforeEach } from 'vitest';

import { ConstraintEngine, ConstraintRegistry } from '../constraint-engine.js';
import type { ProposedAction, ConstraintContext } from '../constraint-engine.js';
import {
  getAllDrawSteelConstraints,
  createDrawSteelMovementConstraint,
  createDrawSteelActionEconomyConstraint,
  createDrawSteelRestrainedConstraint,
  createDrawSteelGrabbedConstraint,
  createDrawSteelStabilityConstraint,
  createDrawSteelFreeStrikeConstraint,
} from '../draw-steel-constraints.js';
import { ActionPipeline } from '../action-pipeline.js';
import type { GameState } from '../../state/index.js';
import { createInitialState } from '../../state/index.js';

// ── Performance Tests ───────────────────────────────────────────────────────
//
// Sprint 12 requirement: Constraint evaluation must stay under 50ms budget.
// These tests validate performance under various conditions.

const PERFORMANCE_BUDGET_MS = 50;
const DRAW_STEEL_SYSTEM_ID = 'draw-steel';

function createTestState(): GameState {
  return createInitialState('perf-session-1', 'perf-room-1');
}

function createDefaultContext(overrides?: Partial<ConstraintContext>): ConstraintContext {
  return {
    gameSystemId: DRAW_STEEL_SYSTEM_ID,
    isDirector: false,
    overriddenConstraints: new Set(),
    systemData: {},
    ...overrides,
  };
}

describe('Performance: Constraint evaluation budget', () => {
  let registry: ConstraintRegistry;
  let engine: ConstraintEngine;
  let state: GameState;

  beforeEach(() => {
    registry = new ConstraintRegistry();
    engine = new ConstraintEngine(registry);
    state = createTestState();

    // Register all Draw Steel constraints
    for (const constraint of getAllDrawSteelConstraints()) {
      registry.register(constraint);
    }
  });

  // ── Single Evaluation Performance ──────────────────────────────────────

  describe('single evaluation', () => {
    it('evaluates movement constraint under budget', () => {
      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { distance: 5, creatureSpeed: 6 },
      };

      const result = engine.evaluate(state, action, createDefaultContext());

      expect(result.valid).toBe(true);
      expect(result.evaluationTimeMs).toBeLessThan(PERFORMANCE_BUDGET_MS);
    });

    it('evaluates action economy constraint under budget', () => {
      const action: ProposedAction = {
        type: 'turn_action',
        actorId: 'player-1',
        payload: { actionType: 'action', actionsUsedThisTurn: 0, maneuversUsedThisTurn: 0 },
      };

      const result = engine.evaluate(state, action, createDefaultContext());

      expect(result.valid).toBe(true);
      expect(result.evaluationTimeMs).toBeLessThan(PERFORMANCE_BUDGET_MS);
    });

    it('evaluates invalid action under budget', () => {
      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { distance: 10, creatureSpeed: 5, isRestrained: true },
      };

      const result = engine.evaluate(state, action, createDefaultContext());

      expect(result.valid).toBe(false);
      expect(result.evaluationTimeMs).toBeLessThan(PERFORMANCE_BUDGET_MS);
    });
  });

  // ── Batch Evaluation Performance ───────────────────────────────────────

  describe('batch evaluation (simulating rapid actions)', () => {
    it('evaluates 100 movement actions under 50ms each', () => {
      const timings: number[] = [];

      for (let i = 0; i < 100; i++) {
        const action: ProposedAction = {
          type: 'token_move',
          actorId: `player-${i % 10}`,
          payload: { distance: (i % 6) + 1, creatureSpeed: 6 },
        };

        const result = engine.evaluate(state, action, createDefaultContext());
        timings.push(result.evaluationTimeMs);
      }

      // Every single evaluation should be under budget
      const maxTime = Math.max(...timings);
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;

      expect(maxTime).toBeLessThan(PERFORMANCE_BUDGET_MS);
      // Average should be well under budget
      expect(avgTime).toBeLessThan(PERFORMANCE_BUDGET_MS / 2);
    });

    it('evaluates 100 action economy checks under 50ms each', () => {
      const timings: number[] = [];

      for (let i = 0; i < 100; i++) {
        const action: ProposedAction = {
          type: 'turn_action',
          actorId: `player-${i % 10}`,
          payload: {
            actionType: i % 2 === 0 ? 'action' : 'maneuver',
            actionsUsedThisTurn: 0,
            maneuversUsedThisTurn: 0,
          },
        };

        const result = engine.evaluate(state, action, createDefaultContext());
        timings.push(result.evaluationTimeMs);
      }

      const maxTime = Math.max(...timings);
      expect(maxTime).toBeLessThan(PERFORMANCE_BUDGET_MS);
    });

    it('evaluates mixed action types under budget', () => {
      const actionTypes = ['token_move', 'turn_action', 'use_ability', 'combat_attack'];
      const timings: number[] = [];

      for (let i = 0; i < 200; i++) {
        const actionType = actionTypes[i % actionTypes.length]!;
        const action: ProposedAction = {
          type: actionType,
          actorId: `player-${i % 10}`,
          payload: {
            distance: 3,
            creatureSpeed: 6,
            actionType: 'action',
            actionsUsedThisTurn: 0,
            maneuversUsedThisTurn: 0,
          },
        };

        const result = engine.evaluate(state, action, createDefaultContext());
        timings.push(result.evaluationTimeMs);
      }

      const maxTime = Math.max(...timings);
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;

      expect(maxTime).toBeLessThan(PERFORMANCE_BUDGET_MS);
      expect(avgTime).toBeLessThan(10); // Average should be very fast
    });
  });

  // ── Pipeline Performance ───────────────────────────────────────────────

  describe('action pipeline performance', () => {
    it('processes action through full pipeline under budget', () => {
      const pipeline = new ActionPipeline(engine, {
        constraintsEnabled: true,
        performanceBudgetMs: PERFORMANCE_BUDGET_MS,
        logPerformanceWarnings: false,
      });

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { distance: 3, creatureSpeed: 6 },
      };

      const start = performance.now();
      const result = pipeline.processAction(state, action, DRAW_STEEL_SYSTEM_ID, false);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(PERFORMANCE_BUDGET_MS);
      expect(result.validation.evaluationTimeMs).toBeLessThan(PERFORMANCE_BUDGET_MS);
    });

    it('processes 100 pipeline actions under budget', () => {
      const pipeline = new ActionPipeline(engine, {
        constraintsEnabled: true,
        performanceBudgetMs: PERFORMANCE_BUDGET_MS,
        logPerformanceWarnings: false,
      });

      const timings: number[] = [];

      for (let i = 0; i < 100; i++) {
        const action: ProposedAction = {
          type: 'token_move',
          actorId: `player-${i % 5}`,
          payload: { distance: 4, creatureSpeed: 6 },
        };

        const start = performance.now();
        pipeline.processAction(state, action, DRAW_STEEL_SYSTEM_ID, false);
        timings.push(performance.now() - start);
      }

      const maxTime = Math.max(...timings);
      expect(maxTime).toBeLessThan(PERFORMANCE_BUDGET_MS);
    });
  });

  // ── Constraint Scaling ─────────────────────────────────────────────────

  describe('constraint scaling', () => {
    it('stays under budget with many registered constraints', () => {
      // Add 50 additional dummy constraints to test scaling
      for (let i = 0; i < 50; i++) {
        registry.register({
          id: `${DRAW_STEEL_SYSTEM_ID}:test:constraint_${i}`,
          name: `Test Constraint ${i}`,
          scope: 'movement',
          gameSystemId: DRAW_STEEL_SYSTEM_ID,
          enabled: true,
          priority: 50 + i,
          evaluate: () => ({ valid: true, reason: null }),
        });
      }

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { distance: 3, creatureSpeed: 6 },
      };

      const result = engine.evaluate(state, action, createDefaultContext());

      expect(result.valid).toBe(true);
      // Even with 56 constraints (6 Draw Steel + 50 dummy), should be under budget
      expect(result.evaluationTimeMs).toBeLessThan(PERFORMANCE_BUDGET_MS);
      expect(result.evaluatedConstraints.length).toBeGreaterThan(50);
    });

    it('stays under budget with Director overrides active', () => {
      const overrides = new Set([
        `${DRAW_STEEL_SYSTEM_ID}:movement:speed_limit`,
        `${DRAW_STEEL_SYSTEM_ID}:movement:stability`,
      ]);

      const action: ProposedAction = {
        type: 'token_move',
        actorId: 'player-1',
        payload: { distance: 100, creatureSpeed: 5 },
      };

      const result = engine.evaluate(
        state,
        action,
        createDefaultContext({ overriddenConstraints: overrides }),
      );

      // Should pass because speed constraint is overridden
      expect(result.valid).toBe(true);
      expect(result.evaluationTimeMs).toBeLessThan(PERFORMANCE_BUDGET_MS);
    });
  });

  // ── Concurrent Simulation ──────────────────────────────────────────────

  describe('concurrent load simulation', () => {
    it('evaluates 500 rapid-fire actions with consistent performance', () => {
      const timings: number[] = [];

      for (let i = 0; i < 500; i++) {
        const action: ProposedAction = {
          type: i % 3 === 0 ? 'token_move' : i % 3 === 1 ? 'turn_action' : 'use_ability',
          actorId: `player-${i % 20}`,
          payload: {
            distance: (i % 6) + 1,
            creatureSpeed: 6,
            actionType: i % 2 === 0 ? 'action' : 'maneuver',
            actionsUsedThisTurn: 0,
            maneuversUsedThisTurn: 0,
          },
        };

        const result = engine.evaluate(state, action, createDefaultContext());
        timings.push(result.evaluationTimeMs);
      }

      const maxTime = Math.max(...timings);
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const p95Index = Math.floor(timings.length * 0.95);
      const sortedTimings = [...timings].sort((a, b) => a - b);
      const p95 = sortedTimings[p95Index]!;

      // All under budget
      expect(maxTime).toBeLessThan(PERFORMANCE_BUDGET_MS);
      // p95 should be very fast
      expect(p95).toBeLessThan(PERFORMANCE_BUDGET_MS / 5);
      // Average should be sub-millisecond
      expect(avgTime).toBeLessThan(5);
    });
  });
});
