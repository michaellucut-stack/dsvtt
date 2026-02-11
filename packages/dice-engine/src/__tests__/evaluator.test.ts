import { describe, it, expect } from 'vitest';
import { evaluateDice } from '../evaluator.js';
import { createRng, rollDie } from '../roller.js';
import type { DiceResult, DiceGroupResult, SingleDieResult } from '../types.js';

// =============================================================================
// Dice Evaluator Unit Tests
// =============================================================================

/**
 * Helper: find a seed that produces a specific first roll for a given die size.
 * Used to construct deterministic test scenarios.
 */
function findSeedForResult(sides: number, targetResult: number, maxAttempts = 10000): number {
  for (let seed = 0; seed < maxAttempts; seed++) {
    const rng = createRng(seed);
    const result = rollDie(sides, rng);
    if (result === targetResult) {
      return seed;
    }
  }
  throw new Error(`Could not find seed producing ${targetResult} on d${sides}`);
}

/**
 * Helper: find a seed that triggers an explosion on d6 (first roll = 6).
 */
function findExplodingSeed(sides: number, maxAttempts = 10000): number {
  return findSeedForResult(sides, sides, maxAttempts);
}

describe('Dice Evaluator', () => {
  // ─── Basic deterministic evaluation ───────────────────────────────────────

  describe('evaluateDice with seeds', () => {
    it('should return a deterministic result for "1d6" with a seed', () => {
      const seed = 42;
      const result = evaluateDice('1d6', seed);

      expect(result.formula).toBe('1d6');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(6);
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]!.sides).toBe(6);
      expect(result.rolls[0]!.result).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]!.result).toBeLessThanOrEqual(6);
    });

    it('should produce the same result with the same seed', () => {
      const seed = 123;
      const result1 = evaluateDice('1d6', seed);
      const result2 = evaluateDice('1d6', seed);

      expect(result1.total).toBe(result2.total);
      expect(result1.rolls).toEqual(result2.rolls);
    });

    it('should produce different results with different seeds', () => {
      // Use enough seeds that at least one pair differs
      const results = new Set<number>();
      for (let seed = 0; seed < 20; seed++) {
        results.add(evaluateDice('1d20', seed).total);
      }
      expect(results.size).toBeGreaterThan(1);
    });

    it('should return results within valid range for "1d6"', () => {
      for (let seed = 0; seed < 100; seed++) {
        const result = evaluateDice('1d6', seed);
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(6);
      }
    });

    it('should return results within valid range for "1d20"', () => {
      for (let seed = 0; seed < 100; seed++) {
        const result = evaluateDice('1d20', seed);
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(20);
      }
    });
  });

  // ─── Sum and modifier arithmetic ──────────────────────────────────────────

  describe('sum and modifier computation', () => {
    it('should compute "2d6+3" as sum of 2 dice + 3', () => {
      const seed = 42;
      const result = evaluateDice('2d6+3', seed);

      // Should have 2 dice rolls
      const diceRolls = result.rolls.filter((r) => !r.dropped);
      expect(diceRolls).toHaveLength(2);

      // Total should be sum of dice + 3
      const diceSum = diceRolls.reduce((sum, r) => sum + r.result, 0);
      expect(result.total).toBe(diceSum + 3);
    });

    it('should compute "1d20-2" as die result minus 2', () => {
      const seed = 42;
      const result = evaluateDice('1d20-2', seed);

      const dieValue = result.rolls[0]!.result;
      expect(result.total).toBe(dieValue - 2);
    });

    it('should compute "1d6+2d8+5" correctly across multiple terms', () => {
      const seed = 42;
      const result = evaluateDice('1d6+2d8+5', seed);

      // Should have 3 total dice rolls (1d6 + 2d8)
      expect(result.rolls).toHaveLength(3);

      // Verify terms
      expect(result.terms).toHaveLength(3);
      expect(result.terms[0]!.result.type).toBe('dice');
      expect(result.terms[1]!.result.type).toBe('dice');
      expect(result.terms[2]!.result.type).toBe('constant');

      // Verify total matches manual sum
      const d6 = result.rolls[0]!.result;
      const d8a = result.rolls[1]!.result;
      const d8b = result.rolls[2]!.result;
      expect(result.total).toBe(d6 + d8a + d8b + 5);
    });

    it('should handle constant-only expression "7"', () => {
      const result = evaluateDice('7', 42);

      expect(result.total).toBe(7);
      expect(result.rolls).toHaveLength(0);
    });
  });

  // ─── Keep highest ─────────────────────────────────────────────────────────

  describe('keep highest (kh)', () => {
    it('should keep 3 highest and drop 1 for "4d6kh3"', () => {
      const seed = 42;
      const result = evaluateDice('4d6kh3', seed);

      // Should have 4 rolls total
      expect(result.rolls).toHaveLength(4);

      // Exactly 1 should be dropped
      const dropped = result.rolls.filter((r) => r.dropped);
      const kept = result.rolls.filter((r) => !r.dropped);
      expect(dropped).toHaveLength(1);
      expect(kept).toHaveLength(3);

      // The dropped die should be the lowest value
      const droppedValue = dropped[0]!.result;
      for (const die of kept) {
        expect(die.result).toBeGreaterThanOrEqual(droppedValue);
      }

      // Total should be sum of kept dice
      const expectedTotal = kept.reduce((sum, r) => sum + r.result, 0);
      expect(result.total).toBe(expectedTotal);
    });

    it('should keep 1 highest for "2d20kh1" (advantage)', () => {
      const seed = 42;
      const result = evaluateDice('2d20kh1', seed);

      expect(result.rolls).toHaveLength(2);

      const dropped = result.rolls.filter((r) => r.dropped);
      const kept = result.rolls.filter((r) => !r.dropped);
      expect(dropped).toHaveLength(1);
      expect(kept).toHaveLength(1);

      // The kept die should be >= the dropped die
      expect(kept[0]!.result).toBeGreaterThanOrEqual(dropped[0]!.result);
      expect(result.total).toBe(kept[0]!.result);
    });
  });

  // ─── Keep lowest ──────────────────────────────────────────────────────────

  describe('keep lowest (kl)', () => {
    it('should keep 1 lowest for "4d6kl1"', () => {
      const seed = 42;
      const result = evaluateDice('4d6kl1', seed);

      expect(result.rolls).toHaveLength(4);

      const dropped = result.rolls.filter((r) => r.dropped);
      const kept = result.rolls.filter((r) => !r.dropped);
      expect(dropped).toHaveLength(3);
      expect(kept).toHaveLength(1);

      // The kept die should be <= all dropped dice
      for (const die of dropped) {
        expect(kept[0]!.result).toBeLessThanOrEqual(die.result);
      }

      expect(result.total).toBe(kept[0]!.result);
    });

    it('should keep 1 lowest for "2d20kl1" (disadvantage)', () => {
      const seed = 42;
      const result = evaluateDice('2d20kl1', seed);

      const kept = result.rolls.filter((r) => !r.dropped);
      const dropped = result.rolls.filter((r) => r.dropped);
      expect(kept).toHaveLength(1);
      expect(dropped).toHaveLength(1);

      expect(kept[0]!.result).toBeLessThanOrEqual(dropped[0]!.result);
      expect(result.total).toBe(kept[0]!.result);
    });
  });

  // ─── Exploding dice ──────────────────────────────────────────────────────

  describe('exploding dice', () => {
    it('should trigger explosion when maximum is rolled', () => {
      // Find a seed where first roll on d6 is 6 (max)
      const seed = findExplodingSeed(6);
      const result = evaluateDice('1d6!', seed);

      // Should have more than 1 roll due to explosion
      expect(result.rolls.length).toBeGreaterThanOrEqual(2);

      // First roll should be 6
      expect(result.rolls[0]!.result).toBe(6);

      // The exploded die(s) should be marked
      const explodedDice = result.rolls.filter((r) => r.exploded);
      expect(explodedDice.length).toBeGreaterThanOrEqual(1);

      // Total should be sum of all rolls (none dropped)
      const expectedTotal = result.rolls.reduce((sum, r) => sum + r.result, 0);
      expect(result.total).toBe(expectedTotal);
    });

    it('should not explode when non-maximum is rolled', () => {
      // Find a seed where first roll on d6 is NOT 6
      const seed = findSeedForResult(6, 3);
      const result = evaluateDice('1d6!', seed);

      // Should have exactly 1 roll (no explosion)
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]!.result).toBe(3);
      expect(result.rolls[0]!.exploded).toBe(false);
    });

    it('should accumulate all explosion values in total', () => {
      const seed = findExplodingSeed(6);
      const result = evaluateDice('1d6!', seed);

      const manualTotal = result.rolls.reduce((sum, r) => sum + r.result, 0);
      expect(result.total).toBe(manualTotal);
    });
  });

  // ─── Result structure ─────────────────────────────────────────────────────

  describe('result structure', () => {
    it('should have correct formula in result', () => {
      const result = evaluateDice('2d6+3', 42);
      expect(result.formula).toBe('2d6+3');
    });

    it('should include parsed expression in result', () => {
      const result = evaluateDice('2d6+3', 42);
      expect(result.expression).toBeDefined();
      expect(result.expression.head.type).toBe('dice');
      expect(result.expression.rest).toHaveLength(1);
    });

    it('should include terms with operators in result', () => {
      const result = evaluateDice('1d6+2d8-3', 42);

      expect(result.terms).toHaveLength(3);
      // First term always has '+' operator
      expect(result.terms[0]!.operator).toBe('+');
      expect(result.terms[1]!.operator).toBe('+');
      expect(result.terms[2]!.operator).toBe('-');
    });

    it('should have correct individual die entries with dropped flag', () => {
      const result = evaluateDice('4d6kh3', 42);

      for (const roll of result.rolls) {
        expect(roll).toHaveProperty('sides', 6);
        expect(roll).toHaveProperty('result');
        expect(roll).toHaveProperty('dropped');
        expect(roll).toHaveProperty('exploded');
        expect(typeof roll.dropped).toBe('boolean');
        expect(typeof roll.exploded).toBe('boolean');
        expect(roll.result).toBeGreaterThanOrEqual(1);
        expect(roll.result).toBeLessThanOrEqual(6);
      }
    });

    it('should have correct individual die entries with exploded flag', () => {
      const seed = findExplodingSeed(6);
      const result = evaluateDice('1d6!', seed);

      // At least one die should have exploded = true
      const hasExploded = result.rolls.some((r) => r.exploded);
      expect(hasExploded).toBe(true);

      // The first roll should not be marked exploded (it's the original)
      expect(result.rolls[0]!.exploded).toBe(false);
    });

    it('should flatten all rolls across groups', () => {
      const result = evaluateDice('2d6+3d8', 42);

      // 2 from d6 group + 3 from d8 group = 5 total
      expect(result.rolls).toHaveLength(5);

      const d6Rolls = result.rolls.filter((r) => r.sides === 6);
      const d8Rolls = result.rolls.filter((r) => r.sides === 8);
      expect(d6Rolls).toHaveLength(2);
      expect(d8Rolls).toHaveLength(3);
    });

    it('should provide term-level subtotals', () => {
      const result = evaluateDice('2d6+3', 42);

      // First term: dice group
      const diceTerm = result.terms[0]!.result as DiceGroupResult;
      expect(diceTerm.type).toBe('dice');
      expect(diceTerm.subtotal).toBe(
        diceTerm.rolls.filter((r) => !r.dropped).reduce((s, r) => s + r.result, 0),
      );

      // Second term: constant
      expect(result.terms[1]!.result.type).toBe('constant');
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle "1d2" (coin flip)', () => {
      for (let seed = 0; seed < 50; seed++) {
        const result = evaluateDice('1d2', seed);
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(2);
      }
    });

    it('should throw for invalid formulas', () => {
      expect(() => evaluateDice('')).toThrow();
      expect(() => evaluateDice('abc')).toThrow();
    });

    it('should work without a seed (uses Math.random)', () => {
      const result = evaluateDice('1d6');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(6);
    });
  });
});
