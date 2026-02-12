import { describe, it, expect } from 'vitest';
import { parseAbilitiesFromContent } from '../parsers/ability-parser.js';

describe('parseAbilitiesFromContent', () => {
  it('parses a melee ability with power roll', () => {
    const content = `
<!-- -->

> \u{1F5E1} **Claw**
>
> | **Keywords** | **Type** |
> | :--- | ---: |
> | Attack, Melee | Action |
>
> | \u{1F4CF} Reach 1 | \u{1F3AF} 1 creature |
>
> **Power Roll + Might:**
> - **\u226411:** 3 damage
> - **12-16:** 6 damage
> - **17+:** 9 damage

<!-- -->`;

    const abilities = parseAbilitiesFromContent(content);
    expect(abilities).toHaveLength(1);

    const claw = abilities[0]!;
    expect(claw.name).toBe('Claw');
    expect(claw.category).toBe('melee');
    expect(claw.actionType).toBe('Action');
    expect(claw.keywords).toContain('Attack');
    expect(claw.keywords).toContain('Melee');
    expect(claw.powerRollCharacteristic).toBe('Might');
    expect(claw.powerRollTiers).not.toBeNull();
    expect(claw.powerRollTiers!.low).toContain('3 damage');
    expect(claw.powerRollTiers!.mid).toContain('6 damage');
    expect(claw.powerRollTiers!.high).toContain('9 damage');
  });

  it('parses a trait ability (no power roll)', () => {
    const content = `
<!-- -->

> \u2B50\uFE0F **Pack Tactics**
>
> This creature has an edge on attacks when an ally is adjacent to the target.

<!-- -->`;

    const abilities = parseAbilitiesFromContent(content);
    expect(abilities).toHaveLength(1);

    const trait = abilities[0]!;
    expect(trait.name).toBe('Pack Tactics');
    expect(trait.category).toBe('trait');
    expect(trait.powerRollTiers).toBeNull();
  });

  it('parses a triggered ability', () => {
    const content = `
<!-- -->

> \u2757\uFE0F **Retaliating Strike**
>
> | **Keywords** | **Type** |
> | :--- | ---: |
> | Attack, Melee | Triggered Action |
>
> **Trigger:** An adjacent enemy attacks the creature.
>
> | \u{1F4CF} Reach 1 | \u{1F3AF} 1 creature |
>
> **Power Roll + Agility:**
> - **\u226411:** 2 damage
> - **12-16:** 5 damage
> - **17+:** 7 damage

<!-- -->`;

    const abilities = parseAbilitiesFromContent(content);
    expect(abilities).toHaveLength(1);

    const triggered = abilities[0]!;
    expect(triggered.name).toBe('Retaliating Strike');
    expect(triggered.category).toBe('triggered');
    expect(triggered.actionType).toBe('Triggered Action');
    expect(triggered.trigger).toContain('adjacent enemy attacks');
    expect(triggered.powerRollCharacteristic).toBe('Agility');
  });

  it('parses an ability with a resource cost', () => {
    const content = `
<!-- -->

> \u{1F533} **Fire Blast (3 Wrath)**
>
> | **Keywords** | **Type** |
> | :--- | ---: |
> | Attack, Magic, Area | Action |
>
> | \u{1F4CF} 5 burst | \u{1F3AF} All enemies in the area |
>
> **Power Roll + Presence:**
> - **\u226411:** 4 fire damage
> - **12-16:** 8 fire damage
> - **17+:** 12 fire damage

<!-- -->`;

    const abilities = parseAbilitiesFromContent(content);
    expect(abilities).toHaveLength(1);

    const blast = abilities[0]!;
    expect(blast.name).toBe('Fire Blast');
    expect(blast.cost).toBe('3 Wrath');
    expect(blast.category).toBe('area');
  });

  it('parses a villain action', () => {
    const content = `
<!-- -->

> \u2620\uFE0F **Rallying Cry (Villain Action 1)**
>
> **Effect:** All allies within 10 squares gain 5 temporary stamina.

<!-- -->`;

    const abilities = parseAbilitiesFromContent(content);
    expect(abilities).toHaveLength(1);

    const villain = abilities[0]!;
    expect(villain.name).toBe('Rallying Cry');
    expect(villain.category).toBe('villain_action');
    expect(villain.cost).toBe('Villain Action 1');
    expect(villain.effect).toContain('temporary stamina');
  });

  it('parses multiple abilities separated by comment dividers', () => {
    const content = `
<!-- -->

> \u{1F5E1} **Bite**
>
> | **Keywords** | **Type** |
> | :--- | ---: |
> | Attack, Melee | Action |
>
> **Power Roll + Might:**
> - **\u226411:** 2 damage
> - **12-16:** 4 damage
> - **17+:** 6 damage

<!-- -->

> \u2B50\uFE0F **Regeneration**
>
> This creature regains 5 stamina at the start of each turn.

<!-- -->`;

    const abilities = parseAbilitiesFromContent(content);
    expect(abilities).toHaveLength(2);
    expect(abilities[0]!.name).toBe('Bite');
    expect(abilities[1]!.name).toBe('Regeneration');
  });

  it('returns empty array for content with no abilities', () => {
    const content = `# Just a Heading

Some plain text without any ability blockquotes.

A regular paragraph.`;

    const abilities = parseAbilitiesFromContent(content);
    expect(abilities).toHaveLength(0);
  });

  it('handles an ability with an effect field', () => {
    const content = `
<!-- -->

> \u2747\uFE0F **Teleport**
>
> **Effect:** The creature teleports up to 5 squares to an unoccupied space.

<!-- -->`;

    const abilities = parseAbilitiesFromContent(content);
    expect(abilities).toHaveLength(1);

    const tp = abilities[0]!;
    expect(tp.name).toBe('Teleport');
    expect(tp.effect).toContain('teleports up to 5 squares');
  });
});
