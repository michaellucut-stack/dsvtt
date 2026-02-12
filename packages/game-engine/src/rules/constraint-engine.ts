import type { GameState } from '../state/index.js';
import type { ValidationResult } from './index.js';

// ── Constraint Types ────────────────────────────────────────────────────────

/** The scope of a constraint - what kind of action it applies to. */
export type ConstraintScope =
  | 'movement'
  | 'action_economy'
  | 'ability_use'
  | 'combat'
  | 'condition'
  | 'resource'
  | 'general';

/**
 * A single game constraint that can be evaluated against a proposed action.
 * Constraints are compiled from parsed rules at game system load time.
 */
export interface Constraint {
  /** Unique identifier for this constraint. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** What kind of action this constraint applies to. */
  scope: ConstraintScope;
  /** The game system this constraint belongs to. */
  gameSystemId: string;
  /** Whether this constraint is currently enabled. */
  enabled: boolean;
  /** Priority for evaluation ordering (lower = higher priority). */
  priority: number;
  /**
   * Evaluates the constraint against the current game state and proposed action.
   * Returns a validation result indicating whether the action is allowed.
   */
  evaluate: ConstraintEvaluator;
}

/**
 * A function that evaluates a constraint against a proposed action.
 *
 * @param state - Current game state
 * @param action - The proposed action
 * @param context - Additional context (game system data, character data, etc.)
 * @returns Validation result
 */
export type ConstraintEvaluator = (
  state: GameState,
  action: ProposedAction,
  context: ConstraintContext,
) => ValidationResult;

/** A proposed game action to be validated. */
export interface ProposedAction {
  type: string;
  actorId: string;
  payload: Record<string, unknown>;
}

/** Context provided to constraint evaluators. */
export interface ConstraintContext {
  /** The active game system ID. */
  gameSystemId: string;
  /** Whether the actor is the Director (Directors can override). */
  isDirector: boolean;
  /** Set of constraint IDs that are currently overridden by the Director. */
  overriddenConstraints: Set<string>;
  /** Additional game system-specific data. */
  systemData: Record<string, unknown>;
}

// ── Constraint Registry ─────────────────────────────────────────────────────

/**
 * Registry of compiled constraints, organized by game system and scope.
 * Constraints are loaded once when a game system is registered.
 */
export class ConstraintRegistry {
  private constraints: Map<string, Constraint[]> = new Map();
  private byScope: Map<string, Map<ConstraintScope, Constraint[]>> = new Map();

  /**
   * Registers a constraint for a game system.
   */
  register(constraint: Constraint): void {
    const systemId = constraint.gameSystemId;

    // Add to flat list
    const systemConstraints = this.constraints.get(systemId) ?? [];
    systemConstraints.push(constraint);
    this.constraints.set(systemId, systemConstraints);

    // Add to scope index
    let scopeMap = this.byScope.get(systemId);
    if (!scopeMap) {
      scopeMap = new Map();
      this.byScope.set(systemId, scopeMap);
    }
    const scopeConstraints = scopeMap.get(constraint.scope) ?? [];
    scopeConstraints.push(constraint);
    scopeMap.set(constraint.scope, scopeConstraints);
  }

  /**
   * Gets all constraints for a game system, optionally filtered by scope.
   */
  getConstraints(gameSystemId: string, scope?: ConstraintScope): Constraint[] {
    if (scope) {
      const scopeMap = this.byScope.get(gameSystemId);
      return scopeMap?.get(scope) ?? [];
    }
    return this.constraints.get(gameSystemId) ?? [];
  }

  /**
   * Removes all constraints for a game system.
   */
  unregister(gameSystemId: string): void {
    this.constraints.delete(gameSystemId);
    this.byScope.delete(gameSystemId);
  }

  /**
   * Clears all registered constraints.
   */
  clear(): void {
    this.constraints.clear();
    this.byScope.clear();
  }
}

// ── Constraint Engine ───────────────────────────────────────────────────────

/** Extended validation result with constraint information. */
export interface ConstraintValidationResult extends ValidationResult {
  /** The ID of the constraint that blocked the action (if invalid). */
  constraintId: string | null;
  /** All constraints that were evaluated. */
  evaluatedConstraints: string[];
  /** Time taken to evaluate all constraints (ms). */
  evaluationTimeMs: number;
}

/**
 * The constraint engine evaluates proposed game actions against all applicable
 * constraints for the active game system.
 *
 * It supports:
 * - Scope-based filtering (only evaluate relevant constraints)
 * - Director overrides (bypass specific constraints)
 * - Performance tracking (latency budget monitoring)
 */
export class ConstraintEngine {
  private registry: ConstraintRegistry;

  constructor(registry?: ConstraintRegistry) {
    this.registry = registry ?? new ConstraintRegistry();
  }

  /**
   * Gets the underlying constraint registry.
   */
  getRegistry(): ConstraintRegistry {
    return this.registry;
  }

  /**
   * Evaluates a proposed action against all applicable constraints.
   *
   * @param state - Current game state
   * @param action - The proposed action
   * @param context - Evaluation context (game system, Director status, overrides)
   * @returns Validation result with constraint details
   */
  evaluate(
    state: GameState,
    action: ProposedAction,
    context: ConstraintContext,
  ): ConstraintValidationResult {
    const startTime = performance.now();
    const evaluatedConstraints: string[] = [];

    // Get the action scope from the action type
    const scope = this.inferScope(action.type);

    // Get applicable constraints
    const constraints = scope
      ? this.registry.getConstraints(context.gameSystemId, scope)
      : this.registry.getConstraints(context.gameSystemId);

    // Sort by priority
    const sorted = [...constraints].sort((a, b) => a.priority - b.priority);

    for (const constraint of sorted) {
      // Skip disabled constraints
      if (!constraint.enabled) continue;

      // Skip Director-overridden constraints
      if (context.overriddenConstraints.has(constraint.id)) continue;

      evaluatedConstraints.push(constraint.id);

      const result = constraint.evaluate(state, action, context);
      if (!result.valid) {
        const evaluationTimeMs = performance.now() - startTime;
        return {
          valid: false,
          reason: result.reason ?? `Blocked by constraint: ${constraint.name}`,
          constraintId: constraint.id,
          evaluatedConstraints,
          evaluationTimeMs,
        };
      }
    }

    const evaluationTimeMs = performance.now() - startTime;
    return {
      valid: true,
      reason: null,
      constraintId: null,
      evaluatedConstraints,
      evaluationTimeMs,
    };
  }

  /**
   * Infers the constraint scope from an action type.
   * Uses an explicit lookup table to avoid ambiguous substring matches.
   */
  private inferScope(actionType: string): ConstraintScope | null {
    const lower = actionType.toLowerCase();

    // Exact match lookup (highest priority)
    const exactMatch = SCOPE_EXACT_MAP.get(lower);
    if (exactMatch) return exactMatch;

    // Prefix-based matching (ordered by specificity, most specific first)
    for (const [prefix, scope] of SCOPE_PREFIX_MAP) {
      if (lower.startsWith(prefix)) return scope;
    }

    return null; // Evaluate all constraints
  }
}

/**
 * Explicit action type -> scope mapping for unambiguous resolution.
 */
const SCOPE_EXACT_MAP = new Map<string, ConstraintScope>([
  ['token_move', 'movement'],
  ['move', 'movement'],
  ['forced_move', 'movement'],
  ['turn_action', 'action_economy'],
  ['end_turn', 'action_economy'],
  ['start_turn', 'action_economy'],
  ['use_ability', 'ability_use'],
  ['cast_ability', 'ability_use'],
  ['combat_attack', 'combat'],
  ['attack', 'combat'],
  ['damage', 'combat'],
  ['apply_condition', 'condition'],
  ['remove_condition', 'condition'],
  ['spend_resource', 'resource'],
  ['gain_resource', 'resource'],
]);

/**
 * Prefix-based fallback for action types not in the exact map.
 */
const SCOPE_PREFIX_MAP: Array<[string, ConstraintScope]> = [
  ['move', 'movement'],
  ['turn', 'action_economy'],
  ['combat', 'combat'],
  ['attack', 'combat'],
  ['ability', 'ability_use'],
  ['condition', 'condition'],
  ['resource', 'resource'],
];

// ── Built-in Constraint Factories ───────────────────────────────────────────

/**
 * Creates a movement speed constraint.
 * Validates that a token movement does not exceed the creature's speed.
 */
export function createMovementSpeedConstraint(
  gameSystemId: string,
  getCreatureSpeed: (state: GameState, actorId: string) => number | null,
): Constraint {
  return {
    id: `${gameSystemId}:movement:speed`,
    name: 'Movement Speed Limit',
    scope: 'movement',
    gameSystemId,
    enabled: true,
    priority: 10,
    evaluate: (state, action, _context) => {
      const speed = getCreatureSpeed(state, action.actorId);
      if (speed === null) {
        // No speed data available, allow the action
        return { valid: true, reason: null };
      }

      const distance = action.payload['distance'] as number | undefined;
      if (distance !== undefined && distance > speed) {
        return {
          valid: false,
          reason: `Movement distance (${distance}) exceeds speed (${speed})`,
        };
      }

      return { valid: true, reason: null };
    },
  };
}

/**
 * Creates an action economy constraint.
 * Validates that a creature has not exceeded their allowed actions per turn.
 */
export function createActionEconomyConstraint(
  gameSystemId: string,
  options: {
    maxActions: number;
    maxManeuvers: number;
    maxTriggeredActions: number;
  },
): Constraint {
  return {
    id: `${gameSystemId}:action_economy:per_turn`,
    name: 'Action Economy',
    scope: 'action_economy',
    gameSystemId,
    enabled: true,
    priority: 5,
    evaluate: (state, action, _context) => {
      // Count actions taken this turn by this actor
      const actorId = action.actorId;
      const actionType = (action.payload['actionType'] as string) ?? 'action';

      // This is a simplified placeholder - full implementation will track
      // actions per turn in the game state
      const turnActions = (state as unknown as Record<string, unknown>)['turnActions'] as
        | Map<string, { actions: number; maneuvers: number; triggered: number }>
        | undefined;

      if (!turnActions) {
        return { valid: true, reason: null };
      }

      const actorTurnActions = turnActions.get(actorId);
      if (!actorTurnActions) {
        return { valid: true, reason: null };
      }

      if (actionType === 'action' && actorTurnActions.actions >= options.maxActions) {
        return {
          valid: false,
          reason: `Already used ${actorTurnActions.actions}/${options.maxActions} actions this turn`,
        };
      }

      if (actionType === 'maneuver' && actorTurnActions.maneuvers >= options.maxManeuvers) {
        return {
          valid: false,
          reason: `Already used ${actorTurnActions.maneuvers}/${options.maxManeuvers} maneuvers this turn`,
        };
      }

      return { valid: true, reason: null };
    },
  };
}
