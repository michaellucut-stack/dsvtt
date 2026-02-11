import type {
  ConstantTerm,
  DiceExpression,
  DiceGroup,
  DiceModifier,
  ExpressionNode,
  ExpressionTerm,
  KeepDropMode,
  Operator,
} from './types.js';

/** Error thrown when a dice formula cannot be parsed. */
export class DiceParseError extends Error {
  constructor(
    message: string,
    public readonly formula: string,
    public readonly position: number,
  ) {
    super(`${message} at position ${position} in "${formula}"`);
    this.name = 'DiceParseError';
  }
}

/**
 * Regex for a dice group: NdS with optional exploding (!) and keep/drop modifier.
 * Examples: "2d6", "4d8kh3", "1d20!", "3d6!kh2"
 */
const DICE_GROUP_REGEX = /^(\d+)d(\d+)(!)?(?:(kh|kl|dh|dl)(\d+))?/;

/** Regex for a plain integer constant. */
const CONSTANT_REGEX = /^(\d+)/;

/** Maximum number of dice allowed in a single group (safety limit). */
const MAX_DICE_COUNT = 100;

/** Maximum number of sides allowed on a die (safety limit). */
const MAX_DICE_SIDES = 1000;

/**
 * Parses a dice notation string into a DiceExpression AST.
 *
 * Supports:
 * - Basic rolls: "2d6", "1d20", "3d8"
 * - Modifiers: "2d6+3", "1d20-1", "2d6+1d4+2"
 * - Keep/drop: "4d6kh3" (keep highest 3), "2d20kl1" (keep lowest 1)
 * - Exploding dice: "2d6!" (re-roll on max)
 *
 * @param formula - The dice notation string to parse
 * @returns The parsed dice expression AST
 * @throws {DiceParseError} If the formula syntax is invalid
 */
export function parse(formula: string): DiceExpression {
  const input = formula.replace(/\s/g, '');

  if (input.length === 0) {
    throw new DiceParseError('Empty formula', formula, 0);
  }

  let pos = 0;

  function parseTerm(): ExpressionTerm {
    const remaining = input.slice(pos);

    // Try dice group first
    const diceMatch = DICE_GROUP_REGEX.exec(remaining);
    if (diceMatch !== null) {
      const count = parseInt(diceMatch[1]!, 10);
      const sides = parseInt(diceMatch[2]!, 10);
      const exploding = diceMatch[3] === '!';
      const modMode = diceMatch[4] as KeepDropMode | undefined;
      const modCount = diceMatch[5] !== undefined ? parseInt(diceMatch[5], 10) : undefined;

      if (count < 1 || count > MAX_DICE_COUNT) {
        throw new DiceParseError(
          `Dice count must be between 1 and ${MAX_DICE_COUNT}, got ${count}`,
          formula,
          pos,
        );
      }

      if (sides < 2 || sides > MAX_DICE_SIDES) {
        throw new DiceParseError(
          `Dice sides must be between 2 and ${MAX_DICE_SIDES}, got ${sides}`,
          formula,
          pos,
        );
      }

      let modifier: DiceModifier | null = null;
      if (modMode !== undefined && modCount !== undefined) {
        if (modCount < 1 || modCount > count) {
          throw new DiceParseError(
            `Keep/drop count must be between 1 and ${count}, got ${modCount}`,
            formula,
            pos,
          );
        }
        modifier = { mode: modMode, count: modCount };
      }

      pos += diceMatch[0]!.length;

      const group: DiceGroup = {
        type: 'dice',
        count,
        sides,
        modifier,
        exploding,
      };
      return group;
    }

    // Try constant
    const constMatch = CONSTANT_REGEX.exec(remaining);
    if (constMatch !== null) {
      const value = parseInt(constMatch[1]!, 10);
      pos += constMatch[0]!.length;

      const constant: ConstantTerm = {
        type: 'constant',
        value,
      };
      return constant;
    }

    throw new DiceParseError('Expected a dice group (e.g., "2d6") or a number', formula, pos);
  }

  function parseOperator(): Operator | null {
    if (pos >= input.length) {
      return null;
    }
    const char = input[pos];
    if (char === '+' || char === '-') {
      pos++;
      return char;
    }
    return null;
  }

  const head = parseTerm();
  const rest: ExpressionNode[] = [];

  while (pos < input.length) {
    const operator = parseOperator();
    if (operator === null) {
      throw new DiceParseError(
        `Expected operator (+/-) or end of formula, got "${input[pos]}"`,
        formula,
        pos,
      );
    }
    const term = parseTerm();
    rest.push({ term, operator });
  }

  return { head, rest };
}
