// Core API
export { evaluateDice } from './evaluator.js';
export { parse, DiceParseError } from './parser.js';
export { createRng, rollDie } from './roller.js';

// Types
export type {
  DiceExpression,
  DiceGroup,
  DiceModifier,
  ConstantTerm,
  ExpressionTerm,
  ExpressionNode,
  Operator,
  KeepDropMode,
  SingleDieResult,
  DiceGroupResult,
  ConstantResult,
  TermResult,
  DiceResult,
} from './types.js';
export type { RandomFn } from './roller.js';
