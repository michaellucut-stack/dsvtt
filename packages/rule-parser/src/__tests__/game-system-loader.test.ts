import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadGameSystem } from '../parsers/game-system-loader.js';

let tempRoot: string;

beforeAll(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'game-system-loader-test-'));
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

/** Builds a minimal valid folder and returns its root path. */
function buildMinimalFolder(name: string): string {
  const root = mkdirs(name);
  const chaptersDir = path.join(root, 'Rules', 'Chapters');
  fs.mkdirSync(chaptersDir, { recursive: true });
  createFile(
    path.join(chaptersDir, 'test.md'),
    `---
type: chapter
item_name: Test Chapter
file_basename: test
file_dpath: /Rules/Chapters
item_id: ch-001
item_index: 1
scc: SCC
scdc: SCDC
source: Draw Steel
---

# Test Chapter

Some rules content here.`,
  );
  return root;
}

describe('loadGameSystem', () => {
  it('throws on invalid folder (missing root)', () => {
    const nonExistent = path.join(tempRoot, 'nonexistent-folder');
    expect(() => loadGameSystem(nonExistent)).toThrow('Invalid game_rules/ folder structure');
  });

  it('throws on invalid folder (missing Rules/)', () => {
    const root = mkdirs('invalid-no-rules');
    expect(() => loadGameSystem(root)).toThrow('Invalid game_rules/ folder structure');
  });

  it('loads from a minimal valid folder', () => {
    const root = buildMinimalFolder('minimal-valid');

    const system = loadGameSystem(root);

    expect(system.name).toBeTruthy();
    expect(system.version).toBe('1.0');
    expect(system.source).toBe('DRAW STEEL Creator License');
    expect(system.documents.length).toBeGreaterThan(0);
    expect(system.creatures).toEqual([]);
    expect(system.conditions).toEqual([]);
    expect(system.classes).toEqual([]);
    expect(system.ancestries).toEqual([]);
  });

  it('loads conditions from Rules/Conditions/', () => {
    const root = buildMinimalFolder('with-conditions');
    const conditionsDir = path.join(root, 'Rules', 'Conditions');
    fs.mkdirSync(conditionsDir, { recursive: true });
    createFile(
      path.join(conditionsDir, 'Bleeding.md'),
      `---
type: condition
item_name: Bleeding
file_basename: Bleeding
file_dpath: /Rules/Conditions
item_id: cond-001
item_index: 1
scc: SCC
scdc: SCDC
source: Draw Steel
---

##### Bleeding

While bleeding, you take damage at the start of each of your turns.`,
    );

    const system = loadGameSystem(root);

    expect(system.conditions.length).toBe(1);
    expect(system.conditions[0]!.name).toBe('Bleeding');
  });

  it('monster filter works (filters by family name)', () => {
    const root = buildMinimalFolder('monster-filter');
    // Create two monster families
    const wdStatblocks = path.join(
      root,
      'Bestiary',
      'Monsters',
      'Monsters',
      'War Dogs',
      'Statblocks',
    );
    const undeadStatblocks = path.join(
      root,
      'Bestiary',
      'Monsters',
      'Monsters',
      'Undead',
      'Statblocks',
    );
    fs.mkdirSync(wdStatblocks, { recursive: true });
    fs.mkdirSync(undeadStatblocks, { recursive: true });

    createFile(
      path.join(wdStatblocks, 'conscript.md'),
      `---
type: monster/statblock
item_name: War Dog Conscript
level: 1
roles:
  - Minion Harrier
ancestry:
  - Humanoid
  - War Dog
size: "1M"
speed: 5
stamina: "8"
stability: 0
free_strike: 2
might: 0
agility: 1
reason: -1
intuition: 0
presence: -1
ev: "4"
file_basename: conscript
file_dpath: /Bestiary/Monsters/War Dogs
item_id: wd-001
item_index: 1
scc: SCC
scdc: SCDC
source: Draw Steel
---

# War Dog Conscript`,
    );

    createFile(
      path.join(undeadStatblocks, 'skeleton.md'),
      `---
type: monster/statblock
item_name: Skeleton
level: 1
roles:
  - Minion Harrier
ancestry:
  - Undead
size: "1M"
speed: 5
stamina: "5"
stability: 0
free_strike: 1
might: 0
agility: 0
reason: -2
intuition: 0
presence: -1
ev: "2"
file_basename: skeleton
file_dpath: /Bestiary/Monsters/Undead
item_id: un-001
item_index: 1
scc: SCC
scdc: SCDC
source: Draw Steel
---

# Skeleton`,
    );

    // Filter to only War Dogs
    const system = loadGameSystem(root, ['War Dogs']);

    expect(system.creatures.length).toBe(1);
    expect(system.creatures[0]!.name).toBe('War Dog Conscript');
  });

  it('empty monster filter loads nothing', () => {
    const root = buildMinimalFolder('empty-filter');
    const statblocks = path.join(
      root,
      'Bestiary',
      'Monsters',
      'Monsters',
      'War Dogs',
      'Statblocks',
    );
    fs.mkdirSync(statblocks, { recursive: true });

    createFile(
      path.join(statblocks, 'conscript.md'),
      `---
type: monster/statblock
item_name: War Dog Conscript
level: 1
roles:
  - Minion
ancestry:
  - Humanoid
size: "1M"
speed: 5
stamina: "5"
stability: 0
free_strike: 1
might: 0
agility: 0
reason: 0
intuition: 0
presence: 0
ev: "2"
file_basename: conscript
file_dpath: /Bestiary/Monsters/War Dogs
item_id: wd-001
item_index: 1
scc: SCC
scdc: SCDC
source: Draw Steel
---

# War Dog Conscript`,
    );

    // Empty array filter matches nothing
    const system = loadGameSystem(root, []);
    expect(system.creatures).toEqual([]);
  });

  it('detects system name from README', () => {
    const root = buildMinimalFolder('readme-name');
    createFile(
      path.join(root, 'Rules', 'README.md'),
      `# Draw Steel Ruleset

This is the official Draw Steel rules reference.`,
    );

    const system = loadGameSystem(root);
    expect(system.name).toBe('Draw Steel Ruleset');
  });

  it('falls back to folder name when no README exists', () => {
    const root = buildMinimalFolder('my-game-system');

    const system = loadGameSystem(root);
    expect(system.name).toBe('my-game-system');
  });

  it('handles files that fail to parse without crashing', () => {
    const root = buildMinimalFolder('bad-files');
    const chaptersDir = path.join(root, 'Rules', 'Chapters');

    // Create a file with broken content (shouldn't crash the loader)
    createFile(
      path.join(chaptersDir, 'broken.md'),
      `---
type: [broken yaml {{{
  this is not valid
---

# Broken`,
    );

    // Should not throw - broken files are skipped
    const system = loadGameSystem(root);
    expect(system).toBeDefined();
    // The valid test.md should still be loaded
    expect(system.documents.length).toBeGreaterThanOrEqual(1);
  });

  it('loads monsters from echelon subdirectories', () => {
    const root = buildMinimalFolder('echelon-monsters');
    const echelonStatblocks = path.join(
      root,
      'Bestiary',
      'Monsters',
      'Monsters',
      'Demons',
      '1st Echelon',
      'Statblocks',
    );
    fs.mkdirSync(echelonStatblocks, { recursive: true });

    createFile(
      path.join(echelonStatblocks, 'imp.md'),
      `---
type: monster/statblock
item_name: Imp
level: 1
roles:
  - Minion Hexer
ancestry:
  - Demon
size: "1T"
speed: 5
stamina: "4"
stability: 0
free_strike: 1
might: -1
agility: 2
reason: 0
intuition: 1
presence: 0
ev: "2"
file_basename: imp
file_dpath: /Bestiary/Monsters/Demons
item_id: dem-001
item_index: 1
scc: SCC
scdc: SCDC
source: Draw Steel
---

# Imp`,
    );

    const system = loadGameSystem(root);
    expect(system.creatures.length).toBe(1);
    expect(system.creatures[0]!.name).toBe('Imp');
  });

  it('includes combat-related chapters in combatRules', () => {
    const root = buildMinimalFolder('combat-rules');
    const chaptersDir = path.join(root, 'Rules', 'Chapters');

    createFile(
      path.join(chaptersDir, 'combat.md'),
      `---
type: chapter
item_name: Combat
file_basename: combat
file_dpath: /Rules/Chapters
item_id: ch-002
item_index: 2
scc: SCC
scdc: SCDC
source: Draw Steel
---

# Combat

## Actions

On your turn you may take one action and one maneuver.`,
    );

    const system = loadGameSystem(root);
    expect(system.combatRules.length).toBeGreaterThan(0);
  });
});
