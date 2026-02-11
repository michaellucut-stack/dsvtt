import type { GameState } from '../state/index.js';

/**
 * Result of validating a game action against the rule set.
 * Will be expanded in Phase 2 with the constraint engine.
 */
export interface ValidationResult {
  /** Whether the action is allowed. */
  valid: boolean;
  /** Human-readable reason if the action is rejected. */
  reason: string | null;
}

/**
 * Validates a game action against the current state and rules.
 * Placeholder implementation — always permits actions.
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
  // TODO(game-engine): Implement rule validation in Phase 2
  return { valid: true, reason: null };
}
