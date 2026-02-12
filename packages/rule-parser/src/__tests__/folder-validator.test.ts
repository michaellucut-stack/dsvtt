import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { validateGameRulesFolder } from '../parsers/folder-validator.js';

let tempRoot: string;

beforeAll(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'folder-validator-test-'));
});

afterAll(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

/** Creates a directory path recursively and returns it. */
function mkdirs(...segments: string[]): string {
  const dirPath = path.join(tempRoot, ...segments);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

/** Creates a file with content. */
function createFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('validateGameRulesFolder', () => {
  it('returns valid for a minimal valid folder structure', () => {
    const root = mkdirs('valid-minimal');
    const chaptersDir = mkdirs('valid-minimal', 'Rules', 'Chapters');
    createFile(path.join(chaptersDir, 'combat.md'), '# Combat\n\nSome rules.');

    const result = validateGameRulesFolder(root);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.structure).not.toBeNull();
    expect(result.structure!.hasRulesDir).toBe(true);
    expect(result.structure!.rulesChapters).toContain('combat');
  });

  it('returns error for missing root directory', () => {
    const nonExistent = path.join(tempRoot, 'does-not-exist');

    const result = validateGameRulesFolder(nonExistent);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.code).toBe('MISSING_REQUIRED_DIR');
    expect(result.structure).toBeNull();
  });

  it('returns error when root path is a file, not a directory', () => {
    const filePath = path.join(tempRoot, 'a-file.txt');
    fs.writeFileSync(filePath, 'not a directory', 'utf-8');

    const result = validateGameRulesFolder(filePath);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.code).toBe('MISSING_REQUIRED_DIR');
  });

  it('returns error for missing Rules/ directory', () => {
    const root = mkdirs('no-rules');
    // Create only the root, no Rules/ directory

    const result = validateGameRulesFolder(root);

    expect(result.valid).toBe(false);
    const rulesDirError = result.errors.find((e) => e.message.includes('Rules/'));
    expect(rulesDirError).toBeDefined();
    expect(rulesDirError!.code).toBe('MISSING_REQUIRED_DIR');
  });

  it('returns error for missing Chapters/ directory under Rules/', () => {
    const root = mkdirs('no-chapters');
    mkdirs('no-chapters', 'Rules');
    // Rules/ exists but no Chapters/ inside

    const result = validateGameRulesFolder(root);

    expect(result.valid).toBe(false);
    const chaptersError = result.errors.find((e) => e.message.includes('Chapters'));
    expect(chaptersError).toBeDefined();
    expect(chaptersError!.code).toBe('MISSING_REQUIRED_DIR');
  });

  it('detects monster families in Bestiary/Monsters/Monsters/', () => {
    const root = mkdirs('with-bestiary');
    mkdirs('with-bestiary', 'Rules', 'Chapters');
    createFile(path.join(root, 'Rules', 'Chapters', 'basics.md'), '# Basics');
    mkdirs('with-bestiary', 'Bestiary', 'Monsters', 'Monsters', 'War Dogs');
    mkdirs('with-bestiary', 'Bestiary', 'Monsters', 'Monsters', 'Undead');

    const result = validateGameRulesFolder(root);

    expect(result.valid).toBe(true);
    expect(result.structure).not.toBeNull();
    expect(result.structure!.hasBestiaryDir).toBe(true);
    expect(result.structure!.monsterFamilies).toContain('War Dogs');
    expect(result.structure!.monsterFamilies).toContain('Undead');
  });

  it('detects PDF files for character sheet', () => {
    const root = mkdirs('with-pdf');
    mkdirs('with-pdf', 'Rules', 'Chapters');
    createFile(path.join(root, 'Rules', 'Chapters', 'ch1.md'), '# Chapter 1');
    createFile(path.join(root, 'character-sheet.pdf'), 'fake pdf content');

    const result = validateGameRulesFolder(root);

    expect(result.valid).toBe(true);
    expect(result.structure).not.toBeNull();
    expect(result.structure!.hasCharacterSheetPdf).toBe(true);
  });

  it('reports no character sheet pdf when none exist', () => {
    const root = mkdirs('no-pdf');
    mkdirs('no-pdf', 'Rules', 'Chapters');
    createFile(path.join(root, 'Rules', 'Chapters', 'ch1.md'), '# Chapter 1');

    const result = validateGameRulesFolder(root);

    expect(result.valid).toBe(true);
    expect(result.structure!.hasCharacterSheetPdf).toBe(false);
  });

  it('missing Bestiary is a warning, not an error', () => {
    const root = mkdirs('no-bestiary');
    mkdirs('no-bestiary', 'Rules', 'Chapters');
    createFile(path.join(root, 'Rules', 'Chapters', 'basics.md'), '# Basics\n\nSome rules.');

    const result = validateGameRulesFolder(root);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    const bestiaryWarning = result.warnings.find((w) => w.message.includes('Bestiary'));
    expect(bestiaryWarning).toBeDefined();
  });

  it('detects classes, ancestries, and conditions directories', () => {
    const root = mkdirs('full-structure');
    mkdirs('full-structure', 'Rules', 'Chapters');
    mkdirs('full-structure', 'Rules', 'Classes');
    mkdirs('full-structure', 'Rules', 'Ancestries');
    mkdirs('full-structure', 'Rules', 'Conditions');
    createFile(path.join(root, 'Rules', 'Chapters', 'ch1.md'), '# Ch1');
    createFile(path.join(root, 'Rules', 'Classes', 'Fighter.md'), '# Fighter');
    createFile(path.join(root, 'Rules', 'Ancestries', 'Human.md'), '# Human');
    createFile(path.join(root, 'Rules', 'Conditions', 'Bleeding.md'), '# Bleeding');

    const result = validateGameRulesFolder(root);

    expect(result.valid).toBe(true);
    expect(result.structure!.classes).toContain('Fighter');
    expect(result.structure!.ancestries).toContain('Human');
    expect(result.structure!.conditions).toContain('Bleeding');
  });

  it('filters out files starting with underscore', () => {
    const root = mkdirs('underscore-filter');
    mkdirs('underscore-filter', 'Rules', 'Chapters');
    createFile(path.join(root, 'Rules', 'Chapters', '_template.md'), '# Template');
    createFile(path.join(root, 'Rules', 'Chapters', 'combat.md'), '# Combat');

    const result = validateGameRulesFolder(root);

    expect(result.valid).toBe(true);
    expect(result.structure!.rulesChapters).toContain('combat');
    expect(result.structure!.rulesChapters).not.toContain('_template');
  });
});
