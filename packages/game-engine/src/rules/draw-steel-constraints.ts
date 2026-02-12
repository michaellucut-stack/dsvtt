import type { GameState } from '../state/index.js';
import type { Constraint, ProposedAction, ConstraintContext } from './constraint-engine.js';

/**
 * Draw Steel-specific constraint definitions.
 * These are compiled from the parsed rules and registered at game system load time.
 */

const DRAW_STEEL_SYSTEM_ID = 'draw-steel';

/**
 * Draw Steel movement constraint.
 * In Draw Steel, a creature can move up to their speed in squares per turn.
 * Different movement types (walk, fly, teleport) all count against the speed budget.
 */
export function createDrawSteelMovementConstraint(): Constraint {
  return {
    id: `${DRAW_STEEL_SYSTEM_ID}:movement:speed_limit`,
    name: 'Draw Steel: Movement Speed Limit',
    scope: 'movement',
    gameSystemId: DRAW_STEEL_SYSTEM_ID,
    enabled: true,
    priority: 10,
    evaluate: (state: GameState, action: ProposedAction, _context: ConstraintContext) => {
      const distance = action.payload['distance'] as number | undefined;
      const creatureSpeed = action.payload['creatureSpeed'] as number | undefined;

      if (distance === undefined || creatureSpeed === undefined) {
        return { valid: true, reason: null };
      }

      if (distance > creatureSpeed) {
        return {
          valid: false,
          reason: `Movement (${distance} squares) exceeds speed (${creatureSpeed} squares). Creatures can only move up to their speed per turn.`,
        };
      }

      return { valid: true, reason: null };
    },
  };
}

/**
 * Draw Steel action economy constraint.
 * Per turn, a creature gets: 1 Action + 1 Maneuver + unlimited Free Triggered Actions.
 * Dazed condition: can use EITHER an action OR a maneuver (not both).
 */
export function createDrawSteelActionEconomyConstraint(): Constraint {
  return {
    id: `${DRAW_STEEL_SYSTEM_ID}:action_economy:turn_actions`,
    name: 'Draw Steel: Action Economy',
    scope: 'action_economy',
    gameSystemId: DRAW_STEEL_SYSTEM_ID,
    enabled: true,
    priority: 5,
    evaluate: (state: GameState, action: ProposedAction, _context: ConstraintContext) => {
      const abilityActionType = (action.payload['actionType'] as string)?.toLowerCase();
      const actionsUsed = (action.payload['actionsUsedThisTurn'] as number) ?? 0;
      const maneuversUsed = (action.payload['maneuversUsedThisTurn'] as number) ?? 0;
      const isDazed = (action.payload['isDazed'] as boolean) ?? false;

      if (!abilityActionType) {
        return { valid: true, reason: null };
      }

      // Dazed: can use action OR maneuver, not both
      if (isDazed) {
        if (abilityActionType === 'action' && maneuversUsed > 0) {
          return {
            valid: false,
            reason: 'Dazed: you already used a maneuver this turn, so you cannot use an action.',
          };
        }
        if (abilityActionType === 'maneuver' && actionsUsed > 0) {
          return {
            valid: false,
            reason: 'Dazed: you already used an action this turn, so you cannot use a maneuver.',
          };
        }
      }

      // Normal action economy
      if (abilityActionType === 'action' && actionsUsed >= 1) {
        return {
          valid: false,
          reason: 'You have already used your action this turn.',
        };
      }

      if (abilityActionType === 'maneuver' && maneuversUsed >= 1) {
        return {
          valid: false,
          reason: 'You have already used your maneuver this turn.',
        };
      }

      // Triggered actions are unlimited (but still count against conditions)
      return { valid: true, reason: null };
    },
  };
}

/**
 * Draw Steel free strike opportunity constraint.
 * When a creature moves away from an adjacent enemy, the enemy gets a free strike.
 * This constraint doesn't block movement, but flags the opportunity for the system.
 */
export function createDrawSteelFreeStrikeConstraint(): Constraint {
  return {
    id: `${DRAW_STEEL_SYSTEM_ID}:combat:free_strike_opportunity`,
    name: 'Draw Steel: Free Strike Opportunity',
    scope: 'movement',
    gameSystemId: DRAW_STEEL_SYSTEM_ID,
    enabled: true,
    priority: 100, // Low priority - informational, not blocking
    evaluate: (_state: GameState, _action: ProposedAction, _context: ConstraintContext) => {
      // This constraint is advisory - it always passes but the system should
      // check for adjacent enemies and trigger free strike opportunities
      // The actual blocking/resolution happens in the combat flow
      return { valid: true, reason: null };
    },
  };
}

/**
 * Draw Steel stability constraint.
 * Forced movement is reduced by the creature's stability score.
 */
export function createDrawSteelStabilityConstraint(): Constraint {
  return {
    id: `${DRAW_STEEL_SYSTEM_ID}:movement:stability`,
    name: 'Draw Steel: Stability vs Forced Movement',
    scope: 'movement',
    gameSystemId: DRAW_STEEL_SYSTEM_ID,
    enabled: true,
    priority: 20,
    evaluate: (_state: GameState, action: ProposedAction, _context: ConstraintContext) => {
      const isForcedMovement = (action.payload['isForced'] as boolean) ?? false;
      if (!isForcedMovement) {
        return { valid: true, reason: null };
      }

      const forcedDistance = (action.payload['distance'] as number) ?? 0;
      const stability = (action.payload['creatureStability'] as number) ?? 0;

      const effectiveDistance = Math.max(0, forcedDistance - stability);

      if (effectiveDistance <= 0) {
        return {
          valid: false,
          reason: `Creature's stability (${stability}) completely negates forced movement of ${forcedDistance} squares.`,
        };
      }

      // Movement is valid but reduced. The effective distance is communicated
      // via the validation result reason, not by mutating the action payload.
      return {
        valid: true,
        reason: `Forced movement reduced from ${forcedDistance} to ${effectiveDistance} by stability (${stability}).`,
      };
    },
  };
}

/**
 * Draw Steel condition enforcement - restrained.
 * A restrained creature has speed 0 and can't be force moved.
 */
export function createDrawSteelRestrainedConstraint(): Constraint {
  return {
    id: `${DRAW_STEEL_SYSTEM_ID}:condition:restrained`,
    name: 'Draw Steel: Restrained Condition',
    scope: 'movement',
    gameSystemId: DRAW_STEEL_SYSTEM_ID,
    enabled: true,
    priority: 1, // Highest priority - overrides other movement
    evaluate: (_state: GameState, action: ProposedAction, _context: ConstraintContext) => {
      const isRestrained = (action.payload['isRestrained'] as boolean) ?? false;

      if (isRestrained && action.type.includes('move')) {
        return {
          valid: false,
          reason: 'Restrained creatures have speed 0 and cannot move.',
        };
      }

      return { valid: true, reason: null };
    },
  };
}

/**
 * Draw Steel condition enforcement - grabbed.
 * A grabbed creature has speed 0 but can use forced movement on the grabber to escape.
 */
export function createDrawSteelGrabbedConstraint(): Constraint {
  return {
    id: `${DRAW_STEEL_SYSTEM_ID}:condition:grabbed`,
    name: 'Draw Steel: Grabbed Condition',
    scope: 'movement',
    gameSystemId: DRAW_STEEL_SYSTEM_ID,
    enabled: true,
    priority: 2,
    evaluate: (_state: GameState, action: ProposedAction, _context: ConstraintContext) => {
      const isGrabbed = (action.payload['isGrabbed'] as boolean) ?? false;

      if (isGrabbed && action.type.includes('move')) {
        const isEscapeAttempt = (action.payload['isEscapeAttempt'] as boolean) ?? false;
        if (!isEscapeAttempt) {
          return {
            valid: false,
            reason: 'Grabbed creatures have speed 0. Use an escape action to break free.',
          };
        }
      }

      return { valid: true, reason: null };
    },
  };
}

/**
 * Returns all Draw Steel constraints.
 */
export function getAllDrawSteelConstraints(): Constraint[] {
  return [
    createDrawSteelMovementConstraint(),
    createDrawSteelActionEconomyConstraint(),
    createDrawSteelFreeStrikeConstraint(),
    createDrawSteelStabilityConstraint(),
    createDrawSteelRestrainedConstraint(),
    createDrawSteelGrabbedConstraint(),
  ];
}
