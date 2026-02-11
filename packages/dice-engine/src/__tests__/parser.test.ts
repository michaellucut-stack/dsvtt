import { describe, it, expect } from 'vitest';
import { parse, DiceParseError } from '../parser.js';
import type { DiceExpression, DiceGroup, ConstantTerm } from '../types.js';

// =============================================================================
// Dice Parser Unit Tests
// =============================================================================

describe('Dice Parser', () => {
  // ─── Basic expressions ────────────────────────────────────────────────────

  describe('basic dice expressions', () => {
    it('should parse "2d6" into a correct DiceExpression', () => {
      const result = parse('2d6');

      expect(result.head).toEqual({
        type: 'dice',
        count: 2,
        sides: 6,
        modifier: null,
        exploding: false,
      });
      expect(result.rest).toEqual([]);
    });

    it('should parse "1d20" as a single die group', () => {
      const result = parse('1d20');

      expect(result.head.type).toBe('dice');
      const group = result.head as DiceGroup;
      expect(group.count).toBe(1);
      expect(group.sides).toBe(20);
      expect(group.modifier).toBeNull();
      expect(group.exploding).toBe(false);
    });

    it('should parse "3d8" correctly', () => {
      const result = parse('3d8');
      const group = result.head as DiceGroup;

      expect(group.count).toBe(3);
      expect(group.sides).toBe(8);
    });

    it('should parse "1d100" (percentile)', () => {
      const result = parse('1d100');
      const group = result.head as DiceGroup;

      expect(group.count).toBe(1);
      expect(group.sides).toBe(100);
    });
  });

  // ─── Dice + modifier ─────────────────────────────────────────────────────

  describe('dice with arithmetic modifiers', () => {
    it('should parse "4d8+3" as dice group + constant modifier', () => {
      const result = parse('4d8+3');

      // Head: dice group
      expect(result.head.type).toBe('dice');
      const group = result.head as DiceGroup;
      expect(group.count).toBe(4);
      expect(group.sides).toBe(8);

      // Rest: one constant term
      expect(result.rest).toHaveLength(1);
      expect(result.rest[0]!.operator).toBe('+');
      expect(result.rest[0]!.term.type).toBe('constant');
      expect((result.rest[0]!.term as ConstantTerm).value).toBe(3);
    });

    it('should parse "1d20-1" as dice group minus constant', () => {
      const result = parse('1d20-1');

      expect(result.head.type).toBe('dice');
      expect(result.rest).toHaveLength(1);
      expect(result.rest[0]!.operator).toBe('-');
      expect((result.rest[0]!.term as ConstantTerm).value).toBe(1);
    });

    it('should parse "2d6+5" correctly', () => {
      const result = parse('2d6+5');

      const group = result.head as DiceGroup;
      expect(group.count).toBe(2);
      expect(group.sides).toBe(6);
      expect(result.rest).toHaveLength(1);
      expect((result.rest[0]!.term as ConstantTerm).value).toBe(5);
    });
  });

  // ─── Keep highest ─────────────────────────────────────────────────────────

  describe('keep highest (kh)', () => {
    it('should parse "1d20kh1" with keep highest 1', () => {
      const result = parse('1d20kh1');

      expect(result.head.type).toBe('dice');
      const group = result.head as DiceGroup;
      expect(group.count).toBe(1);
      expect(group.sides).toBe(20);
      expect(group.modifier).toEqual({ mode: 'kh', count: 1 });
      expect(group.exploding).toBe(false);
    });

    it('should parse "4d6kh3" (classic ability score roll)', () => {
      const result = parse('4d6kh3');

      const group = result.head as DiceGroup;
      expect(group.count).toBe(4);
      expect(group.sides).toBe(6);
      expect(group.modifier).toEqual({ mode: 'kh', count: 3 });
    });

    it('should parse "2d20kh1" (advantage)', () => {
      const result = parse('2d20kh1');

      const group = result.head as DiceGroup;
      expect(group.count).toBe(2);
      expect(group.sides).toBe(20);
      expect(group.modifier).toEqual({ mode: 'kh', count: 1 });
    });
  });

  // ─── Keep lowest ──────────────────────────────────────────────────────────

  describe('keep lowest (kl)', () => {
    it('should parse "2d6kl1" with keep lowest 1', () => {
      const result = parse('2d6kl1');

      expect(result.head.type).toBe('dice');
      const group = result.head as DiceGroup;
      expect(group.count).toBe(2);
      expect(group.sides).toBe(6);
      expect(group.modifier).toEqual({ mode: 'kl', count: 1 });
    });

    it('should parse "2d20kl1" (disadvantage)', () => {
      const result = parse('2d20kl1');

      const group = result.head as DiceGroup;
      expect(group.count).toBe(2);
      expect(group.sides).toBe(20);
      expect(group.modifier).toEqual({ mode: 'kl', count: 1 });
    });
  });

  // ─── Drop modifiers ──────────────────────────────────────────────────────

  describe('drop highest / drop lowest (dh/dl)', () => {
    it('should parse "4d6dl1" with drop lowest 1', () => {
      const result = parse('4d6dl1');

      const group = result.head as DiceGroup;
      expect(group.modifier).toEqual({ mode: 'dl', count: 1 });
    });

    it('should parse "3d8dh1" with drop highest 1', () => {
      const result = parse('3d8dh1');

      const group = result.head as DiceGroup;
      expect(group.modifier).toEqual({ mode: 'dh', count: 1 });
    });
  });

  // ─── Exploding dice ──────────────────────────────────────────────────────

  describe('exploding dice (!)', () => {
    it('should parse "8d6!" with exploding flag', () => {
      const result = parse('8d6!');

      expect(result.head.type).toBe('dice');
      const group = result.head as DiceGroup;
      expect(group.count).toBe(8);
      expect(group.sides).toBe(6);
      expect(group.exploding).toBe(true);
      expect(group.modifier).toBeNull();
    });

    it('should parse "1d6!" as a single exploding die', () => {
      const result = parse('1d6!');

      const group = result.head as DiceGroup;
      expect(group.count).toBe(1);
      expect(group.sides).toBe(6);
      expect(group.exploding).toBe(true);
    });

    it('should parse "3d6!kh2" with both exploding and keep highest', () => {
      const result = parse('3d6!kh2');

      const group = result.head as DiceGroup;
      expect(group.count).toBe(3);
      expect(group.sides).toBe(6);
      expect(group.exploding).toBe(true);
      expect(group.modifier).toEqual({ mode: 'kh', count: 2 });
    });
  });

  // ─── Complex multi-term expressions ───────────────────────────────────────

  describe('multiple groups + constants', () => {
    it('should parse "1d6+2d8+5" as three terms', () => {
      const result = parse('1d6+2d8+5');

      // Head: 1d6
      expect(result.head.type).toBe('dice');
      const head = result.head as DiceGroup;
      expect(head.count).toBe(1);
      expect(head.sides).toBe(6);

      // Rest[0]: +2d8
      expect(result.rest).toHaveLength(2);
      expect(result.rest[0]!.operator).toBe('+');
      expect(result.rest[0]!.term.type).toBe('dice');
      const second = result.rest[0]!.term as DiceGroup;
      expect(second.count).toBe(2);
      expect(second.sides).toBe(8);

      // Rest[1]: +5
      expect(result.rest[1]!.operator).toBe('+');
      expect(result.rest[1]!.term.type).toBe('constant');
      expect((result.rest[1]!.term as ConstantTerm).value).toBe(5);
    });

    it('should parse "2d6+1d4-2" correctly', () => {
      const result = parse('2d6+1d4-2');

      expect(result.rest).toHaveLength(2);
      expect(result.rest[0]!.operator).toBe('+');
      expect(result.rest[0]!.term.type).toBe('dice');
      expect(result.rest[1]!.operator).toBe('-');
      expect(result.rest[1]!.term.type).toBe('constant');
      expect((result.rest[1]!.term as ConstantTerm).value).toBe(2);
    });

    it('should parse "1d20+4d6kh3+5" with mixed modifiers', () => {
      const result = parse('1d20+4d6kh3+5');

      expect(result.rest).toHaveLength(2);

      // Second term is 4d6kh3
      const diceGroup = result.rest[0]!.term as DiceGroup;
      expect(diceGroup.count).toBe(4);
      expect(diceGroup.sides).toBe(6);
      expect(diceGroup.modifier).toEqual({ mode: 'kh', count: 3 });

      // Third term is constant 5
      expect((result.rest[1]!.term as ConstantTerm).value).toBe(5);
    });
  });

  // ─── Whitespace handling ──────────────────────────────────────────────────

  describe('whitespace handling', () => {
    it('should ignore spaces in formula', () => {
      const result = parse('2d6 + 3');

      expect(result.head.type).toBe('dice');
      expect(result.rest).toHaveLength(1);
      expect((result.rest[0]!.term as ConstantTerm).value).toBe(3);
    });

    it('should handle leading/trailing spaces', () => {
      const result = parse('  1d20  ');

      expect(result.head.type).toBe('dice');
      const group = result.head as DiceGroup;
      expect(group.count).toBe(1);
      expect(group.sides).toBe(20);
    });
  });

  // ─── Constants as head ────────────────────────────────────────────────────

  describe('constant-only expressions', () => {
    it('should parse a plain number as a constant', () => {
      const result = parse('5');

      expect(result.head.type).toBe('constant');
      expect((result.head as ConstantTerm).value).toBe(5);
      expect(result.rest).toEqual([]);
    });

    it('should parse "10+5" as two constants', () => {
      const result = parse('10+5');

      expect(result.head.type).toBe('constant');
      expect((result.head as ConstantTerm).value).toBe(10);
      expect(result.rest).toHaveLength(1);
      expect((result.rest[0]!.term as ConstantTerm).value).toBe(5);
    });
  });

  // ─── Invalid inputs ──────────────────────────────────────────────────────

  describe('invalid inputs', () => {
    it('should throw DiceParseError for empty string', () => {
      expect(() => parse('')).toThrow(DiceParseError);
    });

    it('should throw DiceParseError for "abc"', () => {
      expect(() => parse('abc')).toThrow(DiceParseError);
    });

    it('should throw DiceParseError for "d" alone', () => {
      expect(() => parse('d')).toThrow(DiceParseError);
    });

    it('should throw DiceParseError for "0d6" (zero dice)', () => {
      expect(() => parse('0d6')).toThrow(DiceParseError);
    });

    it('should throw DiceParseError for "2d0" (zero sides)', () => {
      expect(() => parse('2d0')).toThrow(DiceParseError);
    });

    it('should throw DiceParseError for "2d1" (one-sided die)', () => {
      expect(() => parse('2d1')).toThrow(DiceParseError);
    });

    it('should throw DiceParseError for whitespace-only string', () => {
      expect(() => parse('   ')).toThrow(DiceParseError);
    });

    it('should throw DiceParseError for "d6" (missing count)', () => {
      expect(() => parse('d6')).toThrow(DiceParseError);
    });

    it('should throw DiceParseError for "2d" (missing sides)', () => {
      expect(() => parse('2d')).toThrow(DiceParseError);
    });

    it('should throw DiceParseError for "2d6+" (trailing operator)', () => {
      expect(() => parse('2d6+')).toThrow(DiceParseError);
    });

    it('should throw DiceParseError with correct formula property', () => {
      try {
        parse('abc');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(DiceParseError);
        expect((e as DiceParseError).formula).toBe('abc');
      }
    });

    it('should throw DiceParseError for keep count exceeding dice count', () => {
      expect(() => parse('2d6kh5')).toThrow(DiceParseError);
    });

    it('should throw DiceParseError for dice count exceeding maximum', () => {
      expect(() => parse('101d6')).toThrow(DiceParseError);
    });

    it('should throw DiceParseError for sides exceeding maximum', () => {
      expect(() => parse('1d1001')).toThrow(DiceParseError);
    });
  });
});
