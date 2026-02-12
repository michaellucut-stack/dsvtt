import type { ParsedAbility, AbilityCategory } from '../types.js';

// ── Ability Tab Classification ──────────────────────────────────────────────

/** The three tabs in the ability browser. */
export type AbilityTab = 'actions' | 'maneuvers' | 'triggered';

/** An ability with its tab classification and metadata for filtering. */
export interface ClassifiedAbility extends ParsedAbility {
  /** Which tab this ability belongs to. */
  tab: AbilityTab;
  /** Class that grants this ability (e.g., "Censor", "Fury"). */
  sourceClass: string | null;
  /** Ancestry that grants this ability (e.g., "Human", "Dwarf"). */
  sourceAncestry: string | null;
  /** Minimum level required. */
  levelRequired: number;
  /** Source kit if any. */
  sourceKit: string | null;
  /** Whether this is a signature (free) ability. */
  isSignature: boolean;
}

/** Filters for querying abilities. */
export interface AbilityFilter {
  tab?: AbilityTab;
  className?: string;
  ancestry?: string;
  maxLevel?: number;
  kit?: string;
  search?: string;
}

/**
 * Classifies a parsed ability into one of the three ability tabs.
 *
 * Classification rules (based on Draw Steel's action economy):
 * - **Actions**: Abilities with action type "Action", or abilities that use the main action
 * - **Maneuvers**: Abilities with action type "Maneuver" or "Free Maneuver"
 * - **Triggered**: Abilities with action type containing "Triggered"
 *
 * Traits (passive abilities) go under "actions" as they're always-on features.
 * Villain Actions go under "actions" (for Director-controlled NPCs).
 */
export function classifyAbilityTab(ability: ParsedAbility): AbilityTab {
  const actionType = ability.actionType.toLowerCase();

  if (actionType.includes('triggered')) {
    return 'triggered';
  }

  if (actionType.includes('maneuver')) {
    return 'maneuvers';
  }

  // Default: actions (includes Action, Free Strike, Trait, Villain Action)
  return 'actions';
}

/**
 * Classifies an array of parsed abilities with source metadata.
 *
 * @param abilities - Raw parsed abilities
 * @param source - Where these abilities come from
 * @returns Classified abilities ready for the ability browser
 */
export function classifyAbilities(
  abilities: ParsedAbility[],
  source: {
    className?: string;
    ancestry?: string;
    kit?: string;
    level?: number;
    isSignature?: boolean;
  },
): ClassifiedAbility[] {
  return abilities.map((ability) => ({
    ...ability,
    tab: classifyAbilityTab(ability),
    sourceClass: source.className ?? null,
    sourceAncestry: source.ancestry ?? null,
    sourceKit: source.kit ?? null,
    levelRequired: source.level ?? 1,
    isSignature: source.isSignature ?? false,
  }));
}

/**
 * Filters a list of classified abilities based on filter criteria.
 *
 * @param abilities - All classified abilities
 * @param filter - Filter criteria
 * @returns Filtered abilities
 */
export function filterAbilities(
  abilities: ClassifiedAbility[],
  filter: AbilityFilter,
): ClassifiedAbility[] {
  return abilities.filter((ability) => {
    // Tab filter
    if (filter.tab && ability.tab !== filter.tab) return false;

    // Class filter
    if (filter.className && ability.sourceClass !== filter.className) return false;

    // Ancestry filter
    if (filter.ancestry && ability.sourceAncestry !== filter.ancestry) return false;

    // Level filter
    if (filter.maxLevel !== undefined && ability.levelRequired > filter.maxLevel) return false;

    // Kit filter
    if (filter.kit && ability.sourceKit !== filter.kit) return false;

    // Text search
    if (filter.search) {
      const search = filter.search.toLowerCase();
      const searchableText = [
        ability.name,
        ability.effect ?? '',
        ability.trigger ?? '',
        ability.special ?? '',
        ...ability.keywords,
      ]
        .join(' ')
        .toLowerCase();
      if (!searchableText.includes(search)) return false;
    }

    return true;
  });
}

/**
 * Groups abilities by tab for the 3-tab browser.
 */
export function groupAbilitiesByTab(
  abilities: ClassifiedAbility[],
): Record<AbilityTab, ClassifiedAbility[]> {
  const groups: Record<AbilityTab, ClassifiedAbility[]> = {
    actions: [],
    maneuvers: [],
    triggered: [],
  };

  for (const ability of abilities) {
    groups[ability.tab].push(ability);
  }

  // Sort within each tab: signature first, then by level, then alphabetically
  for (const tab of Object.keys(groups) as AbilityTab[]) {
    groups[tab].sort((a, b) => {
      if (a.isSignature !== b.isSignature) return a.isSignature ? -1 : 1;
      if (a.levelRequired !== b.levelRequired) return a.levelRequired - b.levelRequired;
      return a.name.localeCompare(b.name);
    });
  }

  return groups;
}

/**
 * Counts abilities per tab for badge display.
 */
export function countAbilitiesByTab(abilities: ClassifiedAbility[]): Record<AbilityTab, number> {
  const counts: Record<AbilityTab, number> = { actions: 0, maneuvers: 0, triggered: 0 };
  for (const ability of abilities) {
    counts[ability.tab]++;
  }
  return counts;
}
