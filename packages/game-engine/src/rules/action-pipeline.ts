import type { GameState } from '../state/index.js';
import type { StoredEvent } from '../events/index.js';
import { applyEvent } from '../events/index.js';
import type {
  ConstraintEngine,
  ProposedAction,
  ConstraintContext,
  ConstraintValidationResult,
} from './constraint-engine.js';

// ── Action Pipeline Types ───────────────────────────────────────────────────

/** Result of processing an action through the pipeline. */
export interface ActionPipelineResult {
  /** Whether the action was successfully applied. */
  success: boolean;
  /** The validation result from the constraint engine. */
  validation: ConstraintValidationResult;
  /** The new game state (if action was applied). */
  newState: GameState | null;
  /** The stored event (if action was applied). */
  event: StoredEvent | null;
}

/** Configuration for the action pipeline. */
export interface ActionPipelineConfig {
  /** Whether constraint validation is enabled. */
  constraintsEnabled: boolean;
  /** Performance budget in milliseconds. */
  performanceBudgetMs: number;
  /** Whether to log performance warnings. */
  logPerformanceWarnings: boolean;
}

const DEFAULT_CONFIG: ActionPipelineConfig = {
  constraintsEnabled: true,
  performanceBudgetMs: 50,
  logPerformanceWarnings: true,
};

// ── Action Pipeline ─────────────────────────────────────────────────────────

/**
 * The action pipeline validates and applies game actions.
 *
 * Flow:
 * 1. Validate action against constraint engine
 * 2. If valid, create a StoredEvent
 * 3. Apply the event to produce new game state
 * 4. Return the result
 */
export class ActionPipeline {
  private constraintEngine: ConstraintEngine;
  private config: ActionPipelineConfig;
  private directorOverrides: Map<string, Set<string>> = new Map();

  constructor(constraintEngine: ConstraintEngine, config?: Partial<ActionPipelineConfig>) {
    this.constraintEngine = constraintEngine;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Processes a proposed action through the pipeline.
   *
   * @param state - Current game state
   * @param action - The proposed action
   * @param gameSystemId - Active game system ID
   * @param isDirector - Whether the actor is the Director
   * @returns Pipeline result with validation and new state
   */
  processAction(
    state: GameState,
    action: ProposedAction,
    gameSystemId: string,
    isDirector: boolean,
  ): ActionPipelineResult {
    // Step 1: Build constraint context
    const sessionOverrides = this.directorOverrides.get(state.sessionId) ?? new Set();
    const context: ConstraintContext = {
      gameSystemId,
      isDirector,
      overriddenConstraints: sessionOverrides,
      systemData: {},
    };

    // Step 2: Validate against constraints
    let validation: ConstraintValidationResult;
    if (this.config.constraintsEnabled && gameSystemId) {
      validation = this.constraintEngine.evaluate(state, action, context);

      // Check performance budget
      if (
        this.config.logPerformanceWarnings &&
        validation.evaluationTimeMs > this.config.performanceBudgetMs
      ) {
        console.warn(
          `[ActionPipeline] Constraint evaluation exceeded budget: ${validation.evaluationTimeMs.toFixed(1)}ms > ${this.config.performanceBudgetMs}ms for action ${action.type}`,
        );
      }
    } else {
      // No constraints - always valid
      validation = {
        valid: true,
        reason: null,
        constraintId: null,
        evaluatedConstraints: [],
        evaluationTimeMs: 0,
      };
    }

    // Step 3: If invalid, return without applying
    if (!validation.valid) {
      return {
        success: false,
        validation,
        newState: null,
        event: null,
      };
    }

    // Step 4: Create and apply the event
    const event: StoredEvent = {
      id: crypto.randomUUID(),
      sessionId: state.sessionId,
      sequenceNumber: state.sequenceNumber + 1,
      eventType: action.type,
      payload: action.payload,
      actorId: action.actorId,
      actorType: isDirector ? 'director' : 'player',
      timestamp: new Date(),
      metadata: {},
    };

    const newState = applyEvent(state, event);

    return {
      success: true,
      validation,
      newState,
      event,
    };
  }

  /**
   * Adds a Director override for a specific constraint in a session.
   */
  addOverride(sessionId: string, constraintId: string): void {
    const overrides = this.directorOverrides.get(sessionId) ?? new Set();
    overrides.add(constraintId);
    this.directorOverrides.set(sessionId, overrides);
  }

  /**
   * Removes a Director override for a specific constraint.
   */
  removeOverride(sessionId: string, constraintId: string): void {
    const overrides = this.directorOverrides.get(sessionId);
    if (overrides) {
      overrides.delete(constraintId);
    }
  }

  /**
   * Gets all active overrides for a session.
   */
  getOverrides(sessionId: string): string[] {
    const overrides = this.directorOverrides.get(sessionId);
    return overrides ? [...overrides] : [];
  }

  /**
   * Clears all overrides for a session.
   */
  clearOverrides(sessionId: string): void {
    this.directorOverrides.delete(sessionId);
  }

  /**
   * Updates the pipeline configuration.
   */
  updateConfig(config: Partial<ActionPipelineConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
