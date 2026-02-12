import type { ParsedClass, ParsedAncestry } from '../types.js';

// ── Character Sheet Template Types ──────────────────────────────────────────

/** A field section in the character sheet template. */
export type FieldSection =
  | 'header'
  | 'characteristics'
  | 'combat'
  | 'heroic_resource'
  | 'skills'
  | 'features'
  | 'inventory'
  | 'notes';

/** Data type for a character sheet field. */
export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'computed'
  | 'boolean'
  | 'textarea'
  | 'resource';

/** A single field definition in the character sheet template. */
export interface TemplateField {
  id: string;
  label: string;
  section: FieldSection;
  type: FieldType;
  /** For computed fields: the formula (e.g., "might + level" or function reference). */
  computedFrom?: string[];
  /** Default value. */
  defaultValue?: string | number | boolean;
  /** For select/multiselect: the options. */
  options?: string[];
  /** Whether the field is editable by the player. */
  editable: boolean;
  /** Display order within the section (lower = higher). */
  order: number;
  /** Width hint: 'full', 'half', 'third', 'quarter'. */
  width: 'full' | 'half' | 'third' | 'quarter';
  /** Tooltip/description text. */
  description?: string;
  /** Min/max for number fields. */
  min?: number;
  max?: number;
}

/** A complete character sheet template for a game system. */
export interface CharacterSheetTemplate {
  gameSystemId: string;
  gameSystemName: string;
  version: string;
  /** Section ordering and labels. */
  sectionOrder: Array<{ id: FieldSection; label: string }>;
  /** All field definitions. */
  fields: TemplateField[];
}

// ── Draw Steel Character Sheet Template ─────────────────────────────────────

/**
 * Generates the Draw Steel character sheet template.
 * Based on analysis of the Human Censor PDF v1.02 character sheet.
 *
 * Layout follows the PDF template:
 * 1. Header: Name, Class, Ancestry, Culture, Level, Echelon
 * 2. Characteristics: Might, Agility, Reason, Intuition, Presence (with modifiers)
 * 3. Combat: Stamina, Recoveries, Recovery Value, Speed, Stability, Size, Free Strike
 * 4. Heroic Resource: Class-specific (Wrath for Censor, Clarity for Talent, etc.)
 * 5. Skills: Crafting, Exploration, Interpersonal, Intrigue, Lore (last in stats block)
 * 6. Features: Class features, ancestry traits, kit bonuses
 * 7. Inventory: Equipment, weapons, implements, armor
 * 8. Notes: Free-text notes
 */
export function generateDrawSteelTemplate(gameSystemId: string): CharacterSheetTemplate {
  const fields: TemplateField[] = [
    // ── Header Section ──────────────────────────────────────────────────
    {
      id: 'name',
      label: 'Character Name',
      section: 'header',
      type: 'text',
      editable: true,
      order: 1,
      width: 'half',
    },
    {
      id: 'class',
      label: 'Class',
      section: 'header',
      type: 'select',
      options: [
        'Censor',
        'Conduit',
        'Elementalist',
        'Fury',
        'Null',
        'Shadow',
        'Tactician',
        'Talent',
        'Troubadour',
      ],
      editable: true,
      order: 2,
      width: 'quarter',
    },
    {
      id: 'subclass',
      label: 'Subclass',
      section: 'header',
      type: 'text',
      editable: true,
      order: 3,
      width: 'quarter',
    },
    {
      id: 'ancestry',
      label: 'Ancestry',
      section: 'header',
      type: 'select',
      options: [
        'Devil',
        'Dragon Knight',
        'Dwarf',
        'Hakaan',
        'High Elf',
        'Human',
        'Memonek',
        'Orc',
        'Polder',
        'Revenant',
        'Time Raider',
        'Wode Elf',
      ],
      editable: true,
      order: 4,
      width: 'quarter',
    },
    {
      id: 'culture',
      label: 'Culture',
      section: 'header',
      type: 'text',
      editable: true,
      order: 5,
      width: 'quarter',
    },
    {
      id: 'career',
      label: 'Career',
      section: 'header',
      type: 'text',
      editable: true,
      order: 6,
      width: 'quarter',
    },
    {
      id: 'level',
      label: 'Level',
      section: 'header',
      type: 'number',
      defaultValue: 1,
      editable: true,
      order: 7,
      width: 'quarter',
      min: 1,
      max: 10,
    },
    {
      id: 'echelon',
      label: 'Echelon',
      section: 'header',
      type: 'computed',
      computedFrom: ['level'],
      editable: false,
      order: 8,
      width: 'quarter',
      description: '1st (L1-4), 2nd (L5-7), 3rd (L8-10), 4th (L11+)',
    },
    {
      id: 'kit',
      label: 'Kit',
      section: 'header',
      type: 'text',
      editable: true,
      order: 9,
      width: 'quarter',
    },
    {
      id: 'xp',
      label: 'Experience Points',
      section: 'header',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 10,
      width: 'quarter',
      min: 0,
    },

    // ── Characteristics Section ─────────────────────────────────────────
    {
      id: 'might',
      label: 'Might',
      section: 'characteristics',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 1,
      width: 'fifth' as 'quarter',
      description: 'Physical strength and power',
    },
    {
      id: 'agility',
      label: 'Agility',
      section: 'characteristics',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 2,
      width: 'fifth' as 'quarter',
      description: 'Speed, reflexes, and coordination',
    },
    {
      id: 'reason',
      label: 'Reason',
      section: 'characteristics',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 3,
      width: 'fifth' as 'quarter',
      description: 'Logic, knowledge, and analysis',
    },
    {
      id: 'intuition',
      label: 'Intuition',
      section: 'characteristics',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 4,
      width: 'fifth' as 'quarter',
      description: 'Awareness, empathy, and instinct',
    },
    {
      id: 'presence',
      label: 'Presence',
      section: 'characteristics',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 5,
      width: 'fifth' as 'quarter',
      description: 'Force of personality and willpower',
    },

    // ── Combat Section ──────────────────────────────────────────────────
    {
      id: 'maxStamina',
      label: 'Max Stamina',
      section: 'combat',
      type: 'number',
      defaultValue: 21,
      editable: true,
      order: 1,
      width: 'quarter',
    },
    {
      id: 'currentStamina',
      label: 'Current Stamina',
      section: 'combat',
      type: 'number',
      defaultValue: 21,
      editable: true,
      order: 2,
      width: 'quarter',
    },
    {
      id: 'temporaryStamina',
      label: 'Temporary Stamina',
      section: 'combat',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 3,
      width: 'quarter',
    },
    {
      id: 'recoveries',
      label: 'Recoveries',
      section: 'combat',
      type: 'number',
      defaultValue: 8,
      editable: true,
      order: 4,
      width: 'quarter',
    },
    {
      id: 'recoveryValue',
      label: 'Recovery Value',
      section: 'combat',
      type: 'computed',
      computedFrom: ['maxStamina'],
      editable: false,
      order: 5,
      width: 'quarter',
      description: 'Max Stamina / 3 (rounded down)',
    },
    {
      id: 'speed',
      label: 'Speed',
      section: 'combat',
      type: 'number',
      defaultValue: 5,
      editable: true,
      order: 6,
      width: 'quarter',
    },
    {
      id: 'stability',
      label: 'Stability',
      section: 'combat',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 7,
      width: 'quarter',
    },
    {
      id: 'size',
      label: 'Size',
      section: 'combat',
      type: 'text',
      defaultValue: '1M',
      editable: true,
      order: 8,
      width: 'quarter',
    },

    // ── Heroic Resource Section ─────────────────────────────────────────
    {
      id: 'heroicResourceName',
      label: 'Heroic Resource',
      section: 'heroic_resource',
      type: 'text',
      defaultValue: 'Wrath',
      editable: false,
      order: 1,
      width: 'half',
      description: 'Class-specific heroic resource (Wrath, Clarity, Focus, etc.)',
    },
    {
      id: 'heroicResourceCurrent',
      label: 'Current',
      section: 'heroic_resource',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 2,
      width: 'quarter',
    },
    {
      id: 'heroicResourceMax',
      label: 'Maximum',
      section: 'heroic_resource',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 3,
      width: 'quarter',
      description: 'Set by class features; 0 means no fixed max',
    },
    {
      id: 'victories',
      label: 'Victories',
      section: 'heroic_resource',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 4,
      width: 'quarter',
    },
    {
      id: 'heroTokens',
      label: 'Hero Tokens',
      section: 'heroic_resource',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 5,
      width: 'quarter',
    },

    // ── Skills Section (last in stats block per requirement) ────────────
    {
      id: 'craftingSkills',
      label: 'Crafting',
      section: 'skills',
      type: 'multiselect',
      options: [
        'Alchemy',
        'Architecture',
        'Blacksmithing',
        'Fletching',
        'Forgery',
        'Jewelry',
        'Mechanics',
        'Tailoring',
      ],
      editable: true,
      order: 1,
      width: 'full',
    },
    {
      id: 'explorationSkills',
      label: 'Exploration',
      section: 'skills',
      type: 'multiselect',
      options: [
        'Climb',
        'Drive',
        'Endurance',
        'Gymnastics',
        'Heal',
        'Jump',
        'Lift',
        'Navigate',
        'Ride',
        'Swim',
      ],
      editable: true,
      order: 2,
      width: 'full',
    },
    {
      id: 'interpersonalSkills',
      label: 'Interpersonal',
      section: 'skills',
      type: 'multiselect',
      options: [
        'Brag',
        'Empathize',
        'Flirt',
        'Gamble',
        'Handle Animals',
        'Interrogate',
        'Intimidate',
        'Lead',
        'Lie',
        'Music',
        'Perform',
        'Persuade',
        'Read Person',
      ],
      editable: true,
      order: 3,
      width: 'full',
    },
    {
      id: 'intrigueSkills',
      label: 'Intrigue',
      section: 'skills',
      type: 'multiselect',
      options: [
        'Alertness',
        'Conceal Object',
        'Disguise',
        'Eavesdrop',
        'Escape Artist',
        'Hide',
        'Pick Lock',
        'Pick Pocket',
        'Sabotage',
        'Search',
        'Sneak',
        'Track',
      ],
      editable: true,
      order: 4,
      width: 'full',
    },
    {
      id: 'loreSkills',
      label: 'Lore',
      section: 'skills',
      type: 'multiselect',
      options: [
        'Culture',
        'Criminal Underworld',
        'History',
        'Magic',
        'Monsters',
        'Nature',
        'Psionics',
        'Religion',
        'Rumors',
        'Society',
        'Timescape',
      ],
      editable: true,
      order: 5,
      width: 'full',
    },

    // ── Inventory Section ───────────────────────────────────────────────
    {
      id: 'weapon',
      label: 'Weapon',
      section: 'inventory',
      type: 'text',
      editable: true,
      order: 1,
      width: 'half',
    },
    {
      id: 'armor',
      label: 'Armor',
      section: 'inventory',
      type: 'text',
      editable: true,
      order: 2,
      width: 'half',
    },
    {
      id: 'implement',
      label: 'Implement',
      section: 'inventory',
      type: 'text',
      editable: true,
      order: 3,
      width: 'half',
    },
    {
      id: 'equipment',
      label: 'Other Equipment',
      section: 'inventory',
      type: 'textarea',
      editable: true,
      order: 4,
      width: 'full',
    },
    {
      id: 'gold',
      label: 'Gold',
      section: 'inventory',
      type: 'number',
      defaultValue: 0,
      editable: true,
      order: 5,
      width: 'quarter',
    },

    // ── Notes Section ───────────────────────────────────────────────────
    {
      id: 'personalNotes',
      label: 'Notes',
      section: 'notes',
      type: 'textarea',
      editable: true,
      order: 1,
      width: 'full',
    },
    {
      id: 'complications',
      label: 'Complications',
      section: 'notes',
      type: 'textarea',
      editable: true,
      order: 2,
      width: 'full',
    },
    {
      id: 'connections',
      label: 'Connections',
      section: 'notes',
      type: 'textarea',
      editable: true,
      order: 3,
      width: 'full',
    },
  ];

  return {
    gameSystemId,
    gameSystemName: 'Draw Steel',
    version: '1.0',
    sectionOrder: [
      { id: 'header', label: 'Character Info' },
      { id: 'characteristics', label: 'Characteristics' },
      { id: 'combat', label: 'Combat Stats' },
      { id: 'heroic_resource', label: 'Heroic Resource' },
      { id: 'skills', label: 'Skills' },
      { id: 'features', label: 'Features & Abilities' },
      { id: 'inventory', label: 'Inventory' },
      { id: 'notes', label: 'Notes' },
    ],
    fields,
  };
}

/**
 * Computes derived field values based on current character data.
 */
export function computeFieldValue(
  fieldId: string,
  characterData: Record<string, unknown>,
): unknown {
  switch (fieldId) {
    case 'echelon': {
      const level = (characterData['level'] as number) ?? 1;
      if (level <= 4) return 1;
      if (level <= 7) return 2;
      if (level <= 10) return 3;
      return 4;
    }
    case 'recoveryValue': {
      const maxStamina = (characterData['maxStamina'] as number) ?? 0;
      return Math.floor(maxStamina / 3);
    }
    default:
      return null;
  }
}
