import { describe, it, expect } from 'vitest';
import {
  generateDrawSteelTemplate,
  computeFieldValue,
} from '../parsers/character-template-parser.js';

describe('generateDrawSteelTemplate', () => {
  const template = generateDrawSteelTemplate('draw-steel-001');

  it('generates a template with correct metadata', () => {
    expect(template.gameSystemId).toBe('draw-steel-001');
    expect(template.gameSystemName).toBe('Draw Steel');
    expect(template.version).toBe('1.0');
  });

  it('has all required sections in correct order', () => {
    const sectionIds = template.sectionOrder.map((s) => s.id);
    expect(sectionIds).toEqual([
      'header',
      'characteristics',
      'combat',
      'heroic_resource',
      'skills',
      'features',
      'inventory',
      'notes',
    ]);
  });

  it('puts skills section after combat stats (last in stats block)', () => {
    const sectionIds = template.sectionOrder.map((s) => s.id);
    const combatIdx = sectionIds.indexOf('combat');
    const heroicIdx = sectionIds.indexOf('heroic_resource');
    const skillsIdx = sectionIds.indexOf('skills');

    expect(skillsIdx).toBeGreaterThan(combatIdx);
    expect(skillsIdx).toBeGreaterThan(heroicIdx);
  });

  it('includes all five characteristics', () => {
    const charFields = template.fields.filter((f) => f.section === 'characteristics');
    const labels = charFields.map((f) => f.label);
    expect(labels).toContain('Might');
    expect(labels).toContain('Agility');
    expect(labels).toContain('Reason');
    expect(labels).toContain('Intuition');
    expect(labels).toContain('Presence');
    expect(charFields).toHaveLength(5);
  });

  it('includes header fields for class, ancestry, level, etc.', () => {
    const headerFields = template.fields.filter((f) => f.section === 'header');
    const ids = headerFields.map((f) => f.id);
    expect(ids).toContain('name');
    expect(ids).toContain('class');
    expect(ids).toContain('ancestry');
    expect(ids).toContain('level');
    expect(ids).toContain('echelon');
    expect(ids).toContain('kit');
    expect(ids).toContain('culture');
    expect(ids).toContain('career');
  });

  it('includes all 9 Draw Steel classes as options', () => {
    const classField = template.fields.find((f) => f.id === 'class');
    expect(classField).toBeDefined();
    expect(classField!.options).toContain('Censor');
    expect(classField!.options).toContain('Conduit');
    expect(classField!.options).toContain('Elementalist');
    expect(classField!.options).toContain('Fury');
    expect(classField!.options).toContain('Null');
    expect(classField!.options).toContain('Shadow');
    expect(classField!.options).toContain('Tactician');
    expect(classField!.options).toContain('Talent');
    expect(classField!.options).toContain('Troubadour');
    expect(classField!.options).toHaveLength(9);
  });

  it('includes all 12 Draw Steel ancestries as options', () => {
    const ancestryField = template.fields.find((f) => f.id === 'ancestry');
    expect(ancestryField).toBeDefined();
    expect(ancestryField!.options).toHaveLength(12);
    expect(ancestryField!.options).toContain('Human');
    expect(ancestryField!.options).toContain('Dwarf');
    expect(ancestryField!.options).toContain('High Elf');
  });

  it('includes combat fields: stamina, recoveries, speed, stability', () => {
    const combatFields = template.fields.filter((f) => f.section === 'combat');
    const ids = combatFields.map((f) => f.id);
    expect(ids).toContain('maxStamina');
    expect(ids).toContain('currentStamina');
    expect(ids).toContain('temporaryStamina');
    expect(ids).toContain('recoveries');
    expect(ids).toContain('recoveryValue');
    expect(ids).toContain('speed');
    expect(ids).toContain('stability');
    expect(ids).toContain('size');
  });

  it('includes heroic resource fields', () => {
    const heroicFields = template.fields.filter((f) => f.section === 'heroic_resource');
    const ids = heroicFields.map((f) => f.id);
    expect(ids).toContain('heroicResourceName');
    expect(ids).toContain('heroicResourceCurrent');
    expect(ids).toContain('heroicResourceMax');
    expect(ids).toContain('victories');
    expect(ids).toContain('heroTokens');
  });

  it('includes all 5 skill categories', () => {
    const skillFields = template.fields.filter((f) => f.section === 'skills');
    expect(skillFields).toHaveLength(5);
    const labels = skillFields.map((f) => f.label);
    expect(labels).toContain('Crafting');
    expect(labels).toContain('Exploration');
    expect(labels).toContain('Interpersonal');
    expect(labels).toContain('Intrigue');
    expect(labels).toContain('Lore');
  });

  it('marks echelon as computed from level', () => {
    const echelon = template.fields.find((f) => f.id === 'echelon');
    expect(echelon).toBeDefined();
    expect(echelon!.type).toBe('computed');
    expect(echelon!.computedFrom).toContain('level');
    expect(echelon!.editable).toBe(false);
  });

  it('marks recoveryValue as computed from maxStamina', () => {
    const rv = template.fields.find((f) => f.id === 'recoveryValue');
    expect(rv).toBeDefined();
    expect(rv!.type).toBe('computed');
    expect(rv!.computedFrom).toContain('maxStamina');
    expect(rv!.editable).toBe(false);
  });
});

describe('computeFieldValue', () => {
  it('computes echelon from level', () => {
    expect(computeFieldValue('echelon', { level: 1 })).toBe(1);
    expect(computeFieldValue('echelon', { level: 4 })).toBe(1);
    expect(computeFieldValue('echelon', { level: 5 })).toBe(2);
    expect(computeFieldValue('echelon', { level: 7 })).toBe(2);
    expect(computeFieldValue('echelon', { level: 8 })).toBe(3);
    expect(computeFieldValue('echelon', { level: 10 })).toBe(3);
    expect(computeFieldValue('echelon', { level: 11 })).toBe(4);
  });

  it('computes recovery value as maxStamina / 3 (rounded down)', () => {
    expect(computeFieldValue('recoveryValue', { maxStamina: 21 })).toBe(7);
    expect(computeFieldValue('recoveryValue', { maxStamina: 30 })).toBe(10);
    expect(computeFieldValue('recoveryValue', { maxStamina: 10 })).toBe(3);
    expect(computeFieldValue('recoveryValue', { maxStamina: 0 })).toBe(0);
  });

  it('returns null for unknown field', () => {
    expect(computeFieldValue('unknown_field', {})).toBeNull();
  });

  it('handles missing data gracefully', () => {
    expect(computeFieldValue('echelon', {})).toBe(1); // defaults to level 1
    expect(computeFieldValue('recoveryValue', {})).toBe(0); // defaults to 0 stamina
  });
});
