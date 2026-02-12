import { describe, it, expect } from 'vitest';
import { parseDocument } from '../parsers/document-parser.js';

describe('parseDocument', () => {
  it('parses a complete document with frontmatter and body', () => {
    const content = `---
type: chapter
item_name: Combat Basics
file_basename: combat-basics
file_dpath: /Rules/Chapters
item_id: ch-001
item_index: 1
scc: SCC
scdc: SCDC
source: Draw Steel
---

# Combat Basics

This chapter covers the basics of combat.

## Initiative

Each creature rolls initiative at the start of combat.`;

    const doc = parseDocument(content);

    expect(doc.frontmatter.type).toBe('chapter');
    expect(doc.frontmatter.item_name).toBe('Combat Basics');
    expect(doc.rawContent).toContain('# Combat Basics');
    expect(doc.rawContent).toContain('## Initiative');
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('handles document with no frontmatter', () => {
    const content = `# Just a Heading

Some paragraph text here.

## Sub Heading

More text.`;

    const doc = parseDocument(content);

    expect(doc.frontmatter.type).toBe('');
    expect(doc.frontmatter.item_name).toBe('');
    expect(doc.rawContent).toContain('# Just a Heading');
    expect(doc.rawContent).toContain('## Sub Heading');
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('returns correct rawContent (body without frontmatter)', () => {
    const content = `---
type: condition
item_name: Dazed
file_basename: dazed
file_dpath: /Conditions
item_id: cond-001
item_index: 1
scc: SCC
scdc: SCDC
source: Draw Steel
---

##### Dazed

You are dazed and confused.`;

    const doc = parseDocument(content);

    // rawContent should NOT contain the YAML frontmatter delimiters
    expect(doc.rawContent).not.toContain('type: condition');
    expect(doc.rawContent).not.toContain('item_name: Dazed');
    expect(doc.rawContent).toContain('##### Dazed');
    expect(doc.rawContent).toContain('You are dazed and confused.');
  });

  it('parses sections from the body correctly', () => {
    const content = `---
type: chapter
item_name: Movement
file_basename: movement
file_dpath: /Rules/Chapters
item_id: ch-002
item_index: 2
scc: SCC
scdc: SCDC
source: Draw Steel
---

# Movement

Heroes can move during their turn.

## Speed

Your speed determines how far you can move.

## Forced Movement

Some abilities can move creatures against their will.

### Push

Push moves a creature away from you.`;

    const doc = parseDocument(content);

    // Top-level section: "Movement"
    const topSections = doc.sections.filter((s) => s.level === 1);
    expect(topSections.length).toBe(1);
    expect(topSections[0]!.title).toBe('Movement');

    // "Speed" and "Forced Movement" should be children of "Movement"
    const movementSection = topSections[0]!;
    expect(movementSection.children.length).toBe(2);
    expect(movementSection.children[0]!.title).toBe('Speed');
    expect(movementSection.children[1]!.title).toBe('Forced Movement');

    // "Push" should be child of "Forced Movement"
    const forcedMovement = movementSection.children[1]!;
    expect(forcedMovement.children.length).toBe(1);
    expect(forcedMovement.children[0]!.title).toBe('Push');
  });

  it('returns defaults for empty document', () => {
    const doc = parseDocument('');

    expect(doc.frontmatter.type).toBe('');
    expect(doc.frontmatter.item_name).toBe('');
    expect(doc.rawContent).toBe('');
    expect(doc.sections).toEqual([]);
  });

  it('handles document with only frontmatter and no body', () => {
    const content = `---
type: chapter
item_name: Empty Chapter
file_basename: empty
file_dpath: /Rules
item_id: ch-003
item_index: 3
scc: SCC
scdc: SCDC
source: Draw Steel
---`;

    const doc = parseDocument(content);

    expect(doc.frontmatter.type).toBe('chapter');
    expect(doc.frontmatter.item_name).toBe('Empty Chapter');
    expect(doc.rawContent).toBe('');
    expect(doc.sections).toEqual([]);
  });

  it('preserves content within sections', () => {
    const content = `# Abilities

Each hero has unique abilities.

| Name | Type |
| --- | --- |
| Slash | Melee |
| Fireball | Ranged |

## Using Abilities

You use an action to activate most abilities.`;

    const doc = parseDocument(content);

    const abilitiesSection = doc.sections.find((s) => s.title === 'Abilities');
    expect(abilitiesSection).toBeDefined();
    expect(abilitiesSection!.content).toContain('Each hero has unique abilities.');
    expect(abilitiesSection!.content).toContain('| Name | Type |');
  });
});
