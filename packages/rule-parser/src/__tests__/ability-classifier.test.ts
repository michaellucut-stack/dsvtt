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
