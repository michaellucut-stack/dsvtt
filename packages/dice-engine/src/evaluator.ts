import type {
  ConstantResult,
  DiceExpression,
  DiceGroup,
  DiceGroupResult,
  DiceResult,
  Operator,
  SingleDieResult,
  TermResult,
  ExpressionTerm,
} from './types.js';
import { parse } from './parser.js';
import { createRng, rollDie } from './roller.js';
import type { RandomFn } from './roller.js';

/** Maximum number of explosion re-rolls to prevent infinite loops. */
const MAX_EXPLOSIONS = 100;

/**
 * Evaluates a dice group by rolling all dice, applying explosions and keep/drop modifiers.
 *
 * @param group - The dice group to evaluate
 * @param rng - Random number generator
 * @returns The evaluated dice group result
 */
function evaluateDiceGroup(group: DiceGroup, rng: RandomFn): DiceGroupResult {
  const rolls: SingleDieResult[] = [];

  // Roll all dice, handling explosions
  for (let i = 0; i < group.count; i++) {
    let value = rollDie(group.sides, rng);
    rolls.push({ sides: group.sides, result: value, dropped: false, exploded: false });

    if (group.exploding) {
      let explosionCount = 0;
      while (value === group.sides && explosionCount < MAX_EXPLOSIONS) {
        value = rollDie(group.sides, rng);
        rolls.push({ sides: group.sides, result: value, dropped: false, exploded: true });
        explosionCount++;
      }
    }
  }

  // Apply keep/drop modifiers
  if (group.modifier !== null) {
    // Sort indices by result for keep/drop selection
    const indexedRolls = rolls.map((roll, index) => ({ roll, index }));
    const sorted = [...indexedRolls].sort((a, b) => a.roll.result - b.roll.result);

    const { mode, count } = group.modifier;
    const toDrop = new Set<number>();

    switch (mode) {
      case 'kh': {
        // Keep highest N: drop everything except the top N
        const dropCount = sorted.length - count;
        for (let i = 0; i < dropCount; i++) {
          toDrop.add(sorted[i]!.index);
        }
        break;
      }
      case 'kl': {
        // Keep lowest N: drop everything except the bottom N
        for (let i = count; i < sorted.length; i++) {
          toDrop.add(sorted[i]!.index);
        }
        break;
      }
      case 'dh': {
        // Drop highest N
        for (let i = sorted.length - count; i < sorted.length; i++) {
          toDrop.add(sorted[i]!.index);
        }
        break;
      }
      case 'dl': {
        // Drop lowest N
        for (let i = 0; i < count; i++) {
          toDrop.add(sorted[i]!.index);
        }
        break;
      }
    }

    for (const dropIndex of toDrop) {
      rolls[dropIndex]!.dropped = true;
    }
  }

  const subtotal = rolls
    .filter((roll) => !roll.dropped)
    .reduce((sum, roll) => sum + roll.result, 0);

  return { type: 'dice', group, rolls, subtotal };
}

/**
 * Evaluates a single expression term (dice group or constant).
 *
 * @param term - The term to evaluate
 * @param rng - Random number generator
 * @returns The evaluated term result
 */
function evaluateTerm(term: ExpressionTerm, rng: RandomFn): TermResult {
  if (term.type === 'dice') {
    return evaluateDiceGroup(term, rng);
  }

  const result: ConstantResult = { type: 'constant', value: term.value };
  return result;
}

/**
 * Gets the numeric value of a term result.
 *
 * @param result - The evaluated term result
 * @returns The numeric value
 */
function termValue(result: TermResult): number {
  if (result.type === 'dice') {
    return result.subtotal;
  }
  return result.value;
}

/**
 * Evaluates a parsed DiceExpression and returns the complete result.
 *
 * @param expression - The parsed dice expression AST
 * @param formula - The original formula string (for result metadata)
 * @param rng - Random number generator
 * @returns The complete dice result
 */
function evaluateExpression(
  expression: DiceExpression,
  formula: string,
  rng: RandomFn,
): DiceResult {
  const headResult = evaluateTerm(expression.head, rng);
  let total = termValue(headResult);

  const terms: { operator: Operator; result: TermResult }[] = [
    { operator: '+', result: headResult },
  ];

  for (const node of expression.rest) {
    const result = evaluateTerm(node.term, rng);
    const value = termValue(result);

    if (node.operator === '+') {
      total += value;
    } else {
      total -= value;
    }

    terms.push({ operator: node.operator, result });
  }

  // Collect all individual die rolls
  const rolls: SingleDieResult[] = [];
  for (const term of terms) {
    if (term.result.type === 'dice') {
      rolls.push(...term.result.rolls);
    }
  }

  return { formula, expression, terms, rolls, total };
}

/**
 * Evaluates a dice formula and returns the result.
 *
 * @param formula - Dice notation string (e.g., "2d6+3", "4d8kh3")
 * @param seed - Optional RNG seed for deterministic testing
 * @returns Evaluated dice result with individual rolls
 * @throws {DiceParseError} If the formula syntax is invalid
 */
export function evaluateDice(formula: string, seed?: number): DiceResult {
  const expression = parse(formula);
  const rng = createRng(seed);
  return evaluateExpression(expression, formula, rng);
}
