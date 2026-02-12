import type { GameState } from '../state/index.js';

/**
 * Result of validating a game action against the rule set.
 */
export interface ValidationResult {
  /** Whether the action is allowed. */
  valid: boolean;
  /** Human-readable reason if the action is rejected. */
  reason: string | null;
}

/**
 * Validates a game action against the current state and rules.
 * Placeholder implementation — delegates to ConstraintEngine when a game system is loaded.
 *
 * @param _state - The current game state
 * @param _actionType - The type of action being attempted
 * @param _payload - The action payload data
 * @returns Validation result indicating whether the action is allowed
 */
export function validateAction(
  _state: GameState,
  _actionType: string,
  _payload: Record<string, unknown>,
): ValidationResult {
  // Default: allow all actions when no game system is loaded.
  // When a game system is loaded, use ConstraintEngine.evaluate() instead.
  return { valid: true, reason: null };
}

// Re-export constraint engine
export type {
  Constraint,
  ConstraintScope,
  ConstraintEvaluator,
  ProposedAction,
  ConstraintContext,
  ConstraintValidationResult,
} from './constraint-engine.js';

export {
  ConstraintRegistry,
  ConstraintEngine,
  createMovementSpeedConstraint,
  createActionEconomyConstraint,
} from './constraint-engine.js';
