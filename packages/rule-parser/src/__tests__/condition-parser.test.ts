import { describe, it, expect } from 'vitest';
import { parseCondition } from '../parsers/condition-parser.js';
import { parseDocument } from '../parsers/document-parser.js';

describe('parseCondition', () => {
  it('parses a condition document', () => {
    const content = `---
type: condition
item_name: Bleeding
file_basename: Bleeding
file_dpath: /Conditions
item_id: cond-001
item_index: 1
scc: SCC
scdc: SCDC
source: Draw Steel
---

##### Bleeding

While bleeding, at the start of each of your turns, you take damage equal to the amount of bleeding you have. Bleeding ends when you are healed or when an adjacent ally uses a maneuver to make a successful Heal check.`;

    const doc = parseDocument(content);
    const condition = parseCondition(doc);

    expect(condition).not.toBeNull();
    expect(condition!.name).toBe('Bleeding');
    expect(condition!.description).toContain('start of each of your turns');
    expect(condition!.mechanicalEffects.length).toBeGreaterThan(0);
  });

  it('parses Dazed condition with mechanical keywords', () => {
    const content = `---
type: condition
item_name: Dazed
file_basename: Dazed
file_dpath: /Conditions
item_id: cond-002
item_index: 2
scc: SCC
scdc: SCDC
source: Draw Steel
---

##### Dazed

While you are dazed, you can't use triggered actions, and on your turn, you can use either an action or a maneuver, but not both.`;

    const doc = parseDocument(content);
    const condition = parseCondition(doc);

    expect(condition).not.toBeNull();
    expect(condition!.name).toBe('Dazed');
    expect(condition!.mechanicalEffects.length).toBeGreaterThan(0);
    // Should detect "can't" keyword
    expect(condition!.mechanicalEffects.some((e) => e.includes("can't"))).toBe(true);
  });

  it('returns null for non-condition documents', () => {
    const content = `---
type: chapter
item_name: Combat
---

# Combat Rules`;

    const doc = parseDocument(content);
    const condition = parseCondition(doc);
    expect(condition).toBeNull();
  });
});
