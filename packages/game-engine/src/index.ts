// State management
export type { GameState, GamePlayer } from './state/index.js';
export { createInitialState } from './state/index.js';

// Rule validation
export type { ValidationResult } from './rules/index.js';
export { validateAction } from './rules/index.js';

// Constraint engine (Phase 2)
export type {
  Constraint,
  ConstraintScope,
  ConstraintEvaluator,
  ProposedAction,
  ConstraintContext,
  ConstraintValidationResult,
} from './rules/index.js';
export {
  ConstraintRegistry,
  ConstraintEngine,
  createMovementSpeedConstraint,
  createActionEconomyConstraint,
} from './rules/index.js';

// Action pipeline (Sprint 11)
export type { ActionPipelineResult, ActionPipelineConfig } from './rules/action-pipeline.js';
export { ActionPipeline } from './rules/action-pipeline.js';

// Draw Steel constraints (Sprint 11)
export {
  createDrawSteelMovementConstraint,
  createDrawSteelActionEconomyConstraint,
  createDrawSteelFreeStrikeConstraint,
  createDrawSteelStabilityConstraint,
  createDrawSteelRestrainedConstraint,
  createDrawSteelGrabbedConstraint,
  getAllDrawSteelConstraints,
} from './rules/draw-steel-constraints.js';

// Turn management
export type { TurnOrder, TurnOrderEntry } from './turns/index.js';
export { TurnManager } from './turns/index.js';

// Event sourcing
export type { StoredEvent, StateSnapshot, EventReducer } from './events/index.js';
export { applyEvent, replayEvents, eventReducers } from './events/index.js';
export { registerAllReducers } from './events/reducers.js';
