import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../parsers/frontmatter-parser.js';
import type { StatBlockFrontmatter } from '../types.js';

describe('parseFrontmatter', () => {
  it('parses valid YAML frontmatter from a markdown file', () => {
    const content = `---
file_basename: Griffon
type: monster/statblock
item_name: Griffon
level: 2
source: Draw Steel
---
# Griffon

Some content here.`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter.item_name).toBe('Griffon');
    expect(result.frontmatter.type).toBe('monster/statblock');
    expect(result.frontmatter.source).toBe('Draw Steel');
    expect(result.body).toContain('# Griffon');
    expect(result.body).toContain('Some content here.');
  });

  it('parses stat block frontmatter with all characteristic fields', () => {
    const content = `---
file_basename: War Dog Conscript
type: monster/statblock
item_name: War Dog Conscript
level: 1
roles:
  - Minion Harrier
ancestry:
  - Humanoid
  - Soulless
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
source: Draw Steel
scc: SCC-001
scdc: SCDC-001
item_id: id-001
item_index: 1
file_dpath: /Bestiary/Monsters/War Dogs
---
Body content here`;

    const result = parseFrontmatter(content);
    const fm = result.frontmatter as StatBlockFrontmatter;

    expect(fm.type).toBe('monster/statblock');
    expect(fm.level).toBe(1);
    expect(fm.roles).toEqual(['Minion Harrier']);
    expect(fm.ancestry).toEqual(['Humanoid', 'Soulless', 'War Dog']);
    expect(fm.size).toBe('1M');
    expect(fm.speed).toBe(5);
    expect(fm.stamina).toBe('8');
    expect(fm.stability).toBe(0);
    expect(fm.free_strike).toBe(2);
    expect(fm.might).toBe(0);
    expect(fm.agility).toBe(1);
    expect(fm.reason).toBe(-1);
    expect(fm.intuition).toBe(0);
    expect(fm.presence).toBe(-1);
    expect(fm.ev).toBe('4');
  });

  it('returns empty frontmatter when no frontmatter markers exist', () => {
    const content = '# Just a heading\n\nSome text.';
    const result = parseFrontmatter(content);

    expect(result.frontmatter.type).toBe('');
    expect(result.body).toBe(content);
  });

  it('returns empty frontmatter when closing --- is missing', () => {
    const content = '---\ntype: chapter\n# Heading';
    const result = parseFrontmatter(content);

    expect(result.frontmatter.type).toBe('');
  });

  it('handles condition frontmatter type', () => {
    const content = `---
type: condition
item_name: Bleeding
file_basename: Bleeding
source: Draw Steel
scc: SCC
scdc: SCDC
item_id: cond-001
item_index: 1
file_dpath: /Conditions
---
##### Bleeding

A bleeding creature takes damage at the start of each turn.`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter.type).toBe('condition');
    expect(result.frontmatter.item_name).toBe('Bleeding');
    expect(result.body).toContain('Bleeding');
  });

  it('handles malformed YAML gracefully', () => {
    const content = `---
type: [invalid yaml
  broken: {
---
# Heading`;

    const result = parseFrontmatter(content);
    // Should fall back to empty frontmatter
    expect(result.frontmatter.type).toBe('');
  });

  it('auto-detects stat block type from fields even without explicit type', () => {
    const content = `---
item_name: Test Creature
level: 3
stamina: "20"
speed: 6
might: 2
agility: 1
reason: 0
intuition: 1
presence: -1
---
Body`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter.type).toBe('monster/statblock');
  });

  it('handles single-value roles as string', () => {
    const content = `---
type: monster/statblock
item_name: Test
level: 1
stamina: "5"
speed: 5
roles: Elite Mount
ancestry: Beast
might: 0
agility: 0
reason: 0
intuition: 0
presence: 0
ev: "10"
---
Body`;

    const result = parseFrontmatter(content);
    const fm = result.frontmatter as StatBlockFrontmatter;
    expect(fm.roles).toEqual(['Elite Mount']);
    expect(fm.ancestry).toEqual(['Beast']);
  });
});
