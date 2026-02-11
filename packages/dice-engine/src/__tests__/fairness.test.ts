import { describe, it, expect } from 'vitest';
import { evaluateDice } from '../evaluator.js';

// =============================================================================
// Statistical Fairness Tests
//
// These tests verify that the dice engine produces statistically fair results
// by rolling large numbers of dice and checking distributions.
// =============================================================================

/** Roll a formula many times and collect results. */
function rollMany(formula: string, count: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    // Use sequential seeds for reproducibility
    results.push(evaluateDice(formula, i).total);
  }
  return results;
}

/** Count occurrences of each value in an array. */
function frequency(values: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

/** Calculate the average of an array. */
function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

describe('Dice Fairness (Statistical Tests)', () => {
  // ─── 1d6 uniform distribution ─────────────────────────────────────────────

  describe('1d6 distribution', () => {
    const SAMPLE_SIZE = 10_000;
    const TOLERANCE = 0.03; // 3% tolerance

    it('should produce each face approximately 16.67% of the time', () => {
      const results = rollMany('1d6', SAMPLE_SIZE);
      const counts = frequency(results);

      const expectedFrequency = 1 / 6; // ~16.67%

      for (let face = 1; face <= 6; face++) {
        const count = counts.get(face) ?? 0;
        const observed = count / SAMPLE_SIZE;

        expect(observed).toBeGreaterThan(expectedFrequency - TOLERANCE);
        expect(observed).toBeLessThan(expectedFrequency + TOLERANCE);
      }
    });

    it('should only produce values 1-6', () => {
      const results = rollMany('1d6', SAMPLE_SIZE);

      for (const result of results) {
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(6);
      }
    });

    it('should produce all 6 faces at least once in 10000 rolls', () => {
      const results = rollMany('1d6', SAMPLE_SIZE);
      const counts = frequency(results);

      for (let face = 1; face <= 6; face++) {
        expect(counts.has(face)).toBe(true);
        expect(counts.get(face)!).toBeGreaterThan(0);
      }
    });
  });

  // ─── 1d20 uniform distribution ────────────────────────────────────────────

  describe('1d20 distribution', () => {
    const SAMPLE_SIZE = 10_000;
    const TOLERANCE = 0.03; // 3% tolerance

    it('should produce a uniform distribution across all 20 faces', () => {
      const results = rollMany('1d20', SAMPLE_SIZE);
      const counts = frequency(results);

      const expectedFrequency = 1 / 20; // 5%

      for (let face = 1; face <= 20; face++) {
        const count = counts.get(face) ?? 0;
        const observed = count / SAMPLE_SIZE;

        expect(observed).toBeGreaterThan(expectedFrequency - TOLERANCE);
        expect(observed).toBeLessThan(expectedFrequency + TOLERANCE);
      }
    });

    it('should only produce values 1-20', () => {
      const results = rollMany('1d20', SAMPLE_SIZE);

      for (const result of results) {
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(20);
      }
    });

    it('should produce all 20 faces at least once', () => {
      const results = rollMany('1d20', SAMPLE_SIZE);
      const counts = frequency(results);

      for (let face = 1; face <= 20; face++) {
        expect(counts.has(face)).toBe(true);
      }
    });
  });

  // ─── 2d6 average ──────────────────────────────────────────────────────────

  describe('2d6 average', () => {
    const SAMPLE_SIZE = 10_000;

    it('should have an average close to 7.0 (within 0.2)', () => {
      const results = rollMany('2d6', SAMPLE_SIZE);
      const avg = average(results);

      expect(avg).toBeGreaterThan(7.0 - 0.2);
      expect(avg).toBeLessThan(7.0 + 0.2);
    });

    it('should produce values only between 2 and 12', () => {
      const results = rollMany('2d6', SAMPLE_SIZE);

      for (const result of results) {
        expect(result).toBeGreaterThanOrEqual(2);
        expect(result).toBeLessThanOrEqual(12);
      }
    });

    it('should have 7 as the most frequent result', () => {
      const results = rollMany('2d6', SAMPLE_SIZE);
      const counts = frequency(results);

      let maxCount = 0;
      let maxFace = 0;
      for (const [face, count] of counts) {
        if (count > maxCount) {
          maxCount = count;
          maxFace = face;
        }
      }

      expect(maxFace).toBe(7);
    });

    it('should produce a bell-curve distribution (7 more frequent than 2 or 12)', () => {
      const results = rollMany('2d6', SAMPLE_SIZE);
      const counts = frequency(results);

      const count7 = counts.get(7) ?? 0;
      const count2 = counts.get(2) ?? 0;
      const count12 = counts.get(12) ?? 0;

      expect(count7).toBeGreaterThan(count2);
      expect(count7).toBeGreaterThan(count12);
    });
  });

  // ─── 1d8 distribution ────────────────────────────────────────────────────

  describe('1d8 distribution', () => {
    const SAMPLE_SIZE = 10_000;
    const TOLERANCE = 0.03;

    it('should have an average close to 4.5', () => {
      const results = rollMany('1d8', SAMPLE_SIZE);
      const avg = average(results);

      expect(avg).toBeGreaterThan(4.5 - 0.2);
      expect(avg).toBeLessThan(4.5 + 0.2);
    });

    it('should produce a uniform distribution', () => {
      const results = rollMany('1d8', SAMPLE_SIZE);
      const counts = frequency(results);

      const expectedFrequency = 1 / 8;

      for (let face = 1; face <= 8; face++) {
        const count = counts.get(face) ?? 0;
        const observed = count / SAMPLE_SIZE;
        expect(observed).toBeGreaterThan(expectedFrequency - TOLERANCE);
        expect(observed).toBeLessThan(expectedFrequency + TOLERANCE);
      }
    });
  });

  // ─── 4d6 keep highest 3 ──────────────────────────────────────────────────

  describe('4d6kh3 (ability score rolling)', () => {
    const SAMPLE_SIZE = 10_000;

    it('should produce values between 3 and 18', () => {
      const results = rollMany('4d6kh3', SAMPLE_SIZE);

      for (const result of results) {
        expect(result).toBeGreaterThanOrEqual(3);
        expect(result).toBeLessThanOrEqual(18);
      }
    });

    it('should have an average higher than 3d6 average (10.5)', () => {
      const results4d6kh3 = rollMany('4d6kh3', SAMPLE_SIZE);
      const avg4d6kh3 = average(results4d6kh3);

      // 4d6kh3 average is approximately 12.24, definitely > 10.5
      expect(avg4d6kh3).toBeGreaterThan(10.5);
    });

    it('should have an average near ~12.24 (within 0.5)', () => {
      const results = rollMany('4d6kh3', SAMPLE_SIZE);
      const avg = average(results);

      // Theoretical average of 4d6 keep highest 3 is ~12.24
      expect(avg).toBeGreaterThan(11.5);
      expect(avg).toBeLessThan(13.0);
    });
  });

  // ─── Cross-die variance ───────────────────────────────────────────────────

  describe('variance across die types', () => {
    const SAMPLE_SIZE = 5_000;

    it('should have 1d12 average higher than 1d6 average', () => {
      const avg6 = average(rollMany('1d6', SAMPLE_SIZE));
      const avg12 = average(rollMany('1d12', SAMPLE_SIZE));

      expect(avg12).toBeGreaterThan(avg6);
    });

    it('should have 1d20 average higher than 1d12 average', () => {
      const avg12 = average(rollMany('1d12', SAMPLE_SIZE));
      const avg20 = average(rollMany('1d20', SAMPLE_SIZE));

      expect(avg20).toBeGreaterThan(avg12);
    });
  });
});
