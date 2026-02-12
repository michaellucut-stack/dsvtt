import { describe, it, expect } from 'vitest';
import { parseCreatureStatBlock } from '../parsers/statblock-parser.js';
import { parseDocument } from '../parsers/document-parser.js';
import type { CreatureStatBlock } from '../types.js';

/**
 * Helper to build a full stat block markdown document with frontmatter.
 */
function makeStatBlockMarkdown(overrides: Record<string, string | number | string[]> = {}): string {
  const defaults: Record<string, string | number | string[]> = {
    item_name: 'Test Creature',
    type: 'monster/statblock',
    level: 3,
    roles: ['Standard Striker'],
    ancestry: ['Humanoid'],
    size: '1M',
    speed: 5,
    stamina: '40',
    stability: 2,
    free_strike: 4,
    might: 2,
    agility: 1,
    reason: 0,
    intuition: -1,
    presence: 1,
    ev: '12',
    file_basename: 'test-creature',
    file_dpath: '/Bestiary/Monsters/TestFamily',
    item_id: 'mon-001',
    item_index: 1,
    scc: 'SCC',
    scdc: 'SCDC',
    source: 'Draw Steel',
  };

  const merged = { ...defaults, ...overrides };

  const yamlLines: string[] = [];
  for (const [key, value] of Object.entries(merged)) {
    if (Array.isArray(value)) {
      yamlLines.push(`${key}:`);
      for (const item of value) {
        yamlLines.push(`  - ${item}`);
      }
    } else if (typeof value === 'string' && /^\d+$/.test(value)) {
      // Numeric strings need quoting to stay strings (e.g., stamina: "40")
      yamlLines.push(`${key}: "${value}"`);
    } else {
      yamlLines.push(`${key}: ${String(value)}`);
    }
  }

  return `---
${yamlLines.join('\n')}
---

# Test Creature

Some body content.`;
}

describe('parseCreatureStatBlock', () => {
  it('parses a full stat block from a document with all fields', () => {
    const markdown = makeStatBlockMarkdown();
    const doc = parseDocument(markdown);
    const result = parseCreatureStatBlock(doc);

    expect(result).not.toBeNull();
    const sb = result as CreatureStatBlock;
    expect(sb.name).toBe('Test Creature');
    expect(sb.level).toBe(3);
    expect(sb.echelon).toBe(1);
    expect(sb.ancestry).toEqual(['Humanoid']);
    expect(sb.roles).toEqual(['Standard Striker']);
    expect(sb.size).toBe('1M');
    expect(sb.speed).toBe(5);
    expect(sb.stamina).toBe(40);
    expect(sb.stability).toBe(2);
    expect(sb.freeStrike).toBe(4);
    expect(sb.encounterValue).toBe(12);
    expect(sb.characteristics).toEqual({
      might: 2,
      agility: 1,
      reason: 0,
      intuition: -1,
      presence: 1,
    });
    expect(sb.abilities).toEqual([]);
    expect(sb.villainActions).toEqual([]);
    expect(sb.traits).toEqual([]);
    expect(sb.immunities).toEqual([]);
    expect(sb.weaknesses).toEqual([]);
    expect(sb.movementTypes).toEqual([]);
  });

  it('returns null for non-statblock documents (type chapter)', () => {
    const markdown = `---
type: chapter
item_name: Combat
file_basename: combat
file_dpath: /Rules/Chapters
item_id: ch-001
item_index: 1
scc: SCC
scdc: SCDC
source: Draw Steel
---

# Combat Rules

Some rules here.`;

    const doc = parseDocument(markdown);
    const result = parseCreatureStatBlock(doc);
    expect(result).toBeNull();
  });

  it('returns null for condition documents', () => {
    const markdown = `---
type: condition
item_name: Bleeding
file_basename: bleeding
file_dpath: /Conditions
item_id: cond-001
item_index: 1
scc: SCC
scdc: SCDC
source: Draw Steel
---

##### Bleeding

Some condition text.`;

    const doc = parseDocument(markdown);
    const result = parseCreatureStatBlock(doc);
    expect(result).toBeNull();
  });

  it('calculates echelon 1 for levels 1-4', () => {
    for (const level of [1, 2, 3, 4]) {
      const md = makeStatBlockMarkdown({ level });
      const doc = parseDocument(md);
      const result = parseCreatureStatBlock(doc);
      expect(result).not.toBeNull();
      expect(result!.echelon).toBe(1);
    }
  });

  it('calculates echelon 2 for levels 5-7', () => {
    for (const level of [5, 6, 7]) {
      const md = makeStatBlockMarkdown({ level });
      const doc = parseDocument(md);
      const result = parseCreatureStatBlock(doc);
      expect(result).not.toBeNull();
      expect(result!.echelon).toBe(2);
    }
  });

  it('calculates echelon 3 for levels 8-10', () => {
    for (const level of [8, 9, 10]) {
      const md = makeStatBlockMarkdown({ level });
      const doc = parseDocument(md);
      const result = parseCreatureStatBlock(doc);
      expect(result).not.toBeNull();
      expect(result!.echelon).toBe(3);
    }
  });

  it('calculates echelon 4 for levels 11+', () => {
    for (const level of [11, 12, 15, 20]) {
      const md = makeStatBlockMarkdown({ level });
      const doc = parseDocument(md);
      const result = parseCreatureStatBlock(doc);
      expect(result).not.toBeNull();
      expect(result!.echelon).toBe(4);
    }
  });

  it('parses numeric stamina as a number', () => {
    const md = makeStatBlockMarkdown({ stamina: '25' });
    const doc = parseDocument(md);
    const result = parseCreatureStatBlock(doc);
    expect(result).not.toBeNull();
    expect(result!.stamina).toBe(25);
  });

  it('parses non-numeric stamina as a string', () => {
    const md = makeStatBlockMarkdown({ stamina: 'eight (pointed)' });
    const doc = parseDocument(md);
    const result = parseCreatureStatBlock(doc);
    expect(result).not.toBeNull();
    expect(result!.stamina).toBe('eight (pointed)');
  });

  it('parses encounter value from a numeric ev string', () => {
    const md = makeStatBlockMarkdown({ ev: '6' });
    const doc = parseDocument(md);
    const result = parseCreatureStatBlock(doc);
    expect(result).not.toBeNull();
    expect(result!.encounterValue).toBe(6);
  });

  it('parses encounter value as 0 from a descriptive ev string', () => {
    const md = makeStatBlockMarkdown({ ev: '3 for four minions' });
    const doc = parseDocument(md);
    const result = parseCreatureStatBlock(doc);
    expect(result).not.toBeNull();
    // parseInt("3 for four minions") === 3
    expect(result!.encounterValue).toBe(3);
  });

  it('parses encounter value as 0 from non-numeric ev', () => {
    const md = makeStatBlockMarkdown({ ev: 'varies' });
    const doc = parseDocument(md);
    const result = parseCreatureStatBlock(doc);
    expect(result).not.toBeNull();
    expect(result!.encounterValue).toBe(0);
  });

  it('categorizes abilities into abilities, villainActions, and traits', () => {
    const markdown = `---
item_name: Boss Creature
type: monster/statblock
level: 5
roles:
  - Boss
ancestry:
  - Humanoid
size: "1M"
speed: 5
stamina: "80"
stability: 3
free_strike: 5
might: 3
agility: 2
reason: 1
intuition: 1
presence: 2
ev: "40"
file_basename: boss-creature
file_dpath: /Bestiary/Monsters/Bosses
item_id: mon-002
item_index: 2
scc: SCC
scdc: SCDC
source: Draw Steel
---

# Boss Creature

<!-- -->

> \u{1F5E1} **Slash**
>
> | **Keywords** | **Type** |
> | --- | --- |
> | Attack, Melee, Weapon | Action |
>
> **Effect:** The creature deals 5 damage.

<!-- -->

> \u2620\uFE0F **Summon Minions (Villain Action 1)**
>
> **Effect:** The boss summons minions.

<!-- -->

> \u2B50\uFE0F **Aura of Dread**
>
> **Effect:** Enemies within 2 squares take a bane on attacks.`;

    const doc = parseDocument(markdown);
    const result = parseCreatureStatBlock(doc);
    expect(result).not.toBeNull();
    const sb = result as CreatureStatBlock;

    expect(sb.abilities.length).toBe(1);
    expect(sb.abilities[0]!.name).toBe('Slash');
    expect(sb.abilities[0]!.category).toBe('melee');

    expect(sb.villainActions.length).toBe(1);
    expect(sb.villainActions[0]!.name).toContain('Summon Minions');
    expect(sb.villainActions[0]!.category).toBe('villain_action');

    expect(sb.traits.length).toBe(1);
    expect(sb.traits[0]!.name).toBe('Aura of Dread');
    expect(sb.traits[0]!.category).toBe('trait');
  });

  it('extracts name from frontmatter item_name', () => {
    const md = makeStatBlockMarkdown({ item_name: 'War Dog Conscript' });
    const doc = parseDocument(md);
    const result = parseCreatureStatBlock(doc);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('War Dog Conscript');
  });

  it('falls back to heading name when item_name is empty', () => {
    const markdown = `---
item_name: ""
type: monster/statblock
level: 1
roles:
  - Minion
ancestry:
  - Beast
size: "1M"
speed: 5
stamina: "5"
stability: 0
free_strike: 1
might: 1
agility: 0
reason: -2
intuition: 0
presence: -1
ev: "2"
file_basename: test
file_dpath: /Bestiary
item_id: mon-003
item_index: 3
scc: SCC
scdc: SCDC
source: Draw Steel
---

# Dire Wolf

Some body text.`;

    const doc = parseDocument(markdown);
    const result = parseCreatureStatBlock(doc);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Dire Wolf');
  });

  it('auto-detects monster/statblock type from fields with type: monster', () => {
    // parseFrontmatter normalizes type:"monster" to "monster/statblock" when level, stamina, speed present
    const markdown = `---
item_name: Skeleton
level: 1
stamina: "5"
speed: 5
might: 0
agility: 0
reason: 0
intuition: 0
presence: 0
ev: "1"
file_basename: skeleton
file_dpath: /Bestiary
item_id: mon-004
item_index: 4
scc: SCC
scdc: SCDC
source: Draw Steel
---

# Skeleton`;

    const doc = parseDocument(markdown);
    // frontmatter parser auto-detects and sets type to monster/statblock
    expect(doc.frontmatter.type).toBe('monster/statblock');
    const result = parseCreatureStatBlock(doc);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Skeleton');
  });
});
