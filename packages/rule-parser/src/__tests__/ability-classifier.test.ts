import { describe, it, expect } from 'vitest';
import {
  classifyAbilityTab,
  classifyAbilities,
  filterAbilities,
  groupAbilitiesByTab,
  countAbilitiesByTab,
} from '../parsers/ability-classifier.js';
import type { ParsedAbility } from '../types.js';
import type { ClassifiedAbility, AbilityTab } from '../parsers/ability-classifier.js';

// Helper to create a minimal ParsedAbility
function createAbility(overrides: Partial<ParsedAbility>): ParsedAbility {
  return {
    name: 'Test Ability',
    category: 'melee',
    actionType: 'Action',
    keywords: [],
    distance: '',
    targets: '',
    powerRollCharacteristic: null,
    powerRollTiers: null,
    effect: null,
    trigger: null,
    special: null,
    cost: null,
    rawText: '',
    ...overrides,
  };
}

describe('classifyAbilityTab', () => {
  it('classifies Action as actions tab', () => {
    const ability = createAbility({ actionType: 'Action' });
    expect(classifyAbilityTab(ability)).toBe('actions');
  });

  it('classifies Maneuver as maneuvers tab', () => {
    const ability = createAbility({ actionType: 'Maneuver' });
    expect(classifyAbilityTab(ability)).toBe('maneuvers');
  });

  it('classifies Free Maneuver as maneuvers tab', () => {
    const ability = createAbility({ actionType: 'Free Maneuver' });
    expect(classifyAbilityTab(ability)).toBe('maneuvers');
  });

  it('classifies Triggered Action as triggered tab', () => {
    const ability = createAbility({ actionType: 'Triggered Action' });
    expect(classifyAbilityTab(ability)).toBe('triggered');
  });

  it('classifies Free Triggered Action as triggered tab', () => {
    const ability = createAbility({ actionType: 'Free Triggered Action' });
    expect(classifyAbilityTab(ability)).toBe('triggered');
  });

  it('defaults to actions for unknown types', () => {
    const ability = createAbility({ actionType: 'Special' });
    expect(classifyAbilityTab(ability)).toBe('actions');
  });

  it('classifies traits as actions', () => {
    const ability = createAbility({ category: 'trait', actionType: '' });
    expect(classifyAbilityTab(ability)).toBe('actions');
  });
});

describe('classifyAbilities', () => {
  it('adds source metadata to abilities', () => {
    const abilities = [createAbility({ name: 'Smite' })];
    const classified = classifyAbilities(abilities, {
      className: 'Censor',
      level: 1,
      isSignature: true,
    });

    expect(classified).toHaveLength(1);
    expect(classified[0]!.sourceClass).toBe('Censor');
    expect(classified[0]!.levelRequired).toBe(1);
    expect(classified[0]!.isSignature).toBe(true);
    expect(classified[0]!.tab).toBe('actions');
  });

  it('handles ancestry source', () => {
    const abilities = [createAbility({ name: 'Human Trait' })];
    const classified = classifyAbilities(abilities, {
      ancestry: 'Human',
    });

    expect(classified[0]!.sourceAncestry).toBe('Human');
    expect(classified[0]!.sourceClass).toBeNull();
  });
});

describe('filterAbilities', () => {
  const abilities: ClassifiedAbility[] = [
    {
      ...createAbility({ name: 'Holy Smite', actionType: 'Action', keywords: ['Attack', 'Magic'] }),
      tab: 'actions',
      sourceClass: 'Censor',
      sourceAncestry: null,
      sourceKit: null,
      levelRequired: 1,
      isSignature: true,
    },
    {
      ...createAbility({ name: 'Shield Bash', actionType: 'Maneuver' }),
      tab: 'maneuvers',
      sourceClass: 'Censor',
      sourceAncestry: null,
      sourceKit: 'Sword and Board',
      levelRequired: 1,
      isSignature: false,
    },
    {
      ...createAbility({
        name: 'Retribution',
        actionType: 'Triggered Action',
        trigger: 'An ally is hit',
      }),
      tab: 'triggered',
      sourceClass: 'Censor',
      sourceAncestry: null,
      sourceKit: null,
      levelRequired: 3,
      isSignature: false,
    },
    {
      ...createAbility({ name: 'Fury Strike', actionType: 'Action' }),
      tab: 'actions',
      sourceClass: 'Fury',
      sourceAncestry: null,
      sourceKit: null,
      levelRequired: 1,
      isSignature: true,
    },
    {
      ...createAbility({ name: 'Human Resolve', actionType: 'Action' }),
      tab: 'actions',
      sourceClass: null,
      sourceAncestry: 'Human',
      sourceKit: null,
      levelRequired: 1,
      isSignature: false,
    },
  ];

  it('filters by tab', () => {
    const result = filterAbilities(abilities, { tab: 'actions' });
    expect(result).toHaveLength(3);
    expect(result.every((a) => a.tab === 'actions')).toBe(true);
  });

  it('filters by class', () => {
    const result = filterAbilities(abilities, { className: 'Censor' });
    expect(result).toHaveLength(3);
    expect(result.every((a) => a.sourceClass === 'Censor')).toBe(true);
  });

  it('filters by ancestry', () => {
    const result = filterAbilities(abilities, { ancestry: 'Human' });
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Human Resolve');
  });

  it('filters by max level', () => {
    const result = filterAbilities(abilities, { maxLevel: 2 });
    expect(result).toHaveLength(4); // Retribution requires level 3
    expect(result.every((a) => a.levelRequired <= 2)).toBe(true);
  });

  it('filters by search text', () => {
    const result = filterAbilities(abilities, { search: 'smite' });
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Holy Smite');
  });

  it('combines multiple filters', () => {
    const result = filterAbilities(abilities, { tab: 'actions', className: 'Censor' });
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Holy Smite');
  });
});

describe('groupAbilitiesByTab', () => {
  const abilities: ClassifiedAbility[] = [
    {
      ...createAbility({ name: 'Action 1' }),
      tab: 'actions',
      sourceClass: null,
      sourceAncestry: null,
      sourceKit: null,
      levelRequired: 1,
      isSignature: false,
    },
    {
      ...createAbility({ name: 'Maneuver 1' }),
      tab: 'maneuvers',
      sourceClass: null,
      sourceAncestry: null,
      sourceKit: null,
      levelRequired: 1,
      isSignature: false,
    },
    {
      ...createAbility({ name: 'Triggered 1' }),
      tab: 'triggered',
      sourceClass: null,
      sourceAncestry: null,
      sourceKit: null,
      levelRequired: 1,
      isSignature: false,
    },
    {
      ...createAbility({ name: 'Signature Action' }),
      tab: 'actions',
      sourceClass: null,
      sourceAncestry: null,
      sourceKit: null,
      levelRequired: 1,
      isSignature: true,
    },
  ];

  it('groups abilities into three tabs', () => {
    const groups = groupAbilitiesByTab(abilities);
    expect(groups.actions).toHaveLength(2);
    expect(groups.maneuvers).toHaveLength(1);
    expect(groups.triggered).toHaveLength(1);
  });

  it('sorts signature abilities first within a tab', () => {
    const groups = groupAbilitiesByTab(abilities);
    expect(groups.actions[0]!.name).toBe('Signature Action');
    expect(groups.actions[0]!.isSignature).toBe(true);
  });
});

describe('countAbilitiesByTab', () => {
  it('counts abilities per tab', () => {
    const abilities: ClassifiedAbility[] = [
      {
        ...createAbility({}),
        tab: 'actions',
        sourceClass: null,
        sourceAncestry: null,
        sourceKit: null,
        levelRequired: 1,
        isSignature: false,
      },
      {
        ...createAbility({}),
        tab: 'actions',
        sourceClass: null,
        sourceAncestry: null,
        sourceKit: null,
        levelRequired: 1,
        isSignature: false,
      },
      {
        ...createAbility({}),
        tab: 'maneuvers',
        sourceClass: null,
        sourceAncestry: null,
        sourceKit: null,
        levelRequired: 1,
        isSignature: false,
      },
    ];

    const counts = countAbilitiesByTab(abilities);
    expect(counts.actions).toBe(2);
    expect(counts.maneuvers).toBe(1);
    expect(counts.triggered).toBe(0);
  });
});

// ── Edge Case Tests ─────────────────────────────────────────────────────────

describe('filterAbilities edge cases', () => {
  // Shared abilities fixture for edge-case tests
  const abilities: ClassifiedAbility[] = [
    {
      ...createAbility({ name: 'Holy Smite', actionType: 'Action', keywords: ['Attack', 'Magic'] }),
      tab: 'actions',
      sourceClass: 'Censor',
      sourceAncestry: null,
      sourceKit: null,
      levelRequired: 1,
      isSignature: true,
    },
    {
      ...createAbility({ name: 'Shield Bash', actionType: 'Maneuver' }),
      tab: 'maneuvers',
      sourceClass: 'Censor',
      sourceAncestry: null,
      sourceKit: 'Sword and Board',
      levelRequired: 1,
      isSignature: false,
    },
    {
      ...createAbility({
        name: 'Retribution',
        actionType: 'Triggered Action',
        trigger: 'An ally is hit',
      }),
      tab: 'triggered',
      sourceClass: 'Censor',
      sourceAncestry: null,
      sourceKit: null,
      levelRequired: 3,
      isSignature: false,
    },
    {
      ...createAbility({ name: 'Fury Strike', actionType: 'Action' }),
      tab: 'actions',
      sourceClass: 'Fury',
      sourceAncestry: null,
      sourceKit: null,
      levelRequired: 1,
      isSignature: true,
    },
    {
      ...createAbility({ name: 'Human Resolve', actionType: 'Action' }),
      tab: 'actions',
      sourceClass: null,
      sourceAncestry: 'Human',
      sourceKit: null,
      levelRequired: 1,
      isSignature: false,
    },
    {
      ...createAbility({ name: 'Whirlwind', actionType: 'Action' }),
      tab: 'actions',
      sourceClass: 'Fury',
      sourceAncestry: null,
      sourceKit: 'Panther',
      levelRequired: 5,
      isSignature: false,
    },
  ];

  it('filters by kit and matches only that kit', () => {
    const result = filterAbilities(abilities, { kit: 'Sword and Board' });
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Shield Bash');
    expect(result[0]!.sourceKit).toBe('Sword and Board');
  });

  it('returns all abilities when search is an empty string', () => {
    const result = filterAbilities(abilities, { search: '' });
    expect(result).toHaveLength(abilities.length);
  });

  it('returns empty array when search matches nothing', () => {
    const result = filterAbilities(abilities, { search: 'xyznonexistent' });
    expect(result).toHaveLength(0);
  });

  it('applies multiple criteria (tab + className + maxLevel) — all must match', () => {
    const result = filterAbilities(abilities, {
      tab: 'actions',
      className: 'Fury',
      maxLevel: 3,
    });
    // Only Fury Strike (level 1, actions) qualifies; Whirlwind is level 5
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Fury Strike');
  });

  it('filters by ancestry', () => {
    const result = filterAbilities(abilities, { ancestry: 'Human' });
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Human Resolve');
    expect(result[0]!.sourceAncestry).toBe('Human');
  });
});

describe('groupAbilitiesByTab edge cases', () => {
  it('returns empty arrays for all tabs when given an empty array', () => {
    const groups = groupAbilitiesByTab([]);
    expect(groups).toEqual({ actions: [], maneuvers: [], triggered: [] });
  });

  it('places all abilities in the same tab when they share the same tab', () => {
    const allActions: ClassifiedAbility[] = [
      {
        ...createAbility({ name: 'Strike' }),
        tab: 'actions',
        sourceClass: null,
        sourceAncestry: null,
        sourceKit: null,
        levelRequired: 1,
        isSignature: false,
      },
      {
        ...createAbility({ name: 'Smash' }),
        tab: 'actions',
        sourceClass: null,
        sourceAncestry: null,
        sourceKit: null,
        levelRequired: 2,
        isSignature: false,
      },
      {
        ...createAbility({ name: 'Cleave' }),
        tab: 'actions',
        sourceClass: null,
        sourceAncestry: null,
        sourceKit: null,
        levelRequired: 3,
        isSignature: false,
      },
    ];

    const groups = groupAbilitiesByTab(allActions);
    expect(groups.actions).toHaveLength(3);
    expect(groups.maneuvers).toHaveLength(0);
    expect(groups.triggered).toHaveLength(0);
  });
});

describe('countAbilitiesByTab edge cases', () => {
  it('returns zero for all tabs when given an empty array', () => {
    const counts = countAbilitiesByTab([]);
    expect(counts).toEqual({ actions: 0, maneuvers: 0, triggered: 0 });
  });

  it('returns correct counts for mixed abilities', () => {
    const mixed: ClassifiedAbility[] = [
      {
        ...createAbility({ name: 'A1' }),
        tab: 'actions',
        sourceClass: null,
        sourceAncestry: null,
        sourceKit: null,
        levelRequired: 1,
        isSignature: false,
      },
      {
        ...createAbility({ name: 'A2' }),
        tab: 'actions',
        sourceClass: null,
        sourceAncestry: null,
        sourceKit: null,
        levelRequired: 1,
        isSignature: false,
      },
      {
        ...createAbility({ name: 'M1' }),
        tab: 'maneuvers',
        sourceClass: null,
        sourceAncestry: null,
        sourceKit: null,
        levelRequired: 1,
        isSignature: false,
      },
      {
        ...createAbility({ name: 'T1' }),
        tab: 'triggered',
        sourceClass: null,
        sourceAncestry: null,
        sourceKit: null,
        levelRequired: 1,
        isSignature: false,
      },
      {
        ...createAbility({ name: 'T2' }),
        tab: 'triggered',
        sourceClass: null,
        sourceAncestry: null,
        sourceKit: null,
        levelRequired: 1,
        isSignature: false,
      },
      {
        ...createAbility({ name: 'T3' }),
        tab: 'triggered',
        sourceClass: null,
        sourceAncestry: null,
        sourceKit: null,
        levelRequired: 1,
        isSignature: false,
      },
    ];

    const counts = countAbilitiesByTab(mixed);
    expect(counts.actions).toBe(2);
    expect(counts.maneuvers).toBe(1);
    expect(counts.triggered).toBe(3);
  });
});
