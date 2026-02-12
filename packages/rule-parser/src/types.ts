// ============================================================================
// @dsvtt/rule-parser — Type Definitions
// ============================================================================

// ── Frontmatter Types ───────────────────────────────────────────────────────

/** Common YAML frontmatter fields shared across all game rule files. */
export interface BaseFrontmatter {
  file_basename: string;
  file_dpath: string;
  item_id: string;
  item_index: number;
  item_name: string;
  scc: string;
  scdc: string;
  source: string;
  type: string;
  title?: string;
}

/** Frontmatter for creature/monster stat block files. */
export interface StatBlockFrontmatter extends BaseFrontmatter {
  type: 'monster/statblock';
  level: number;
  roles: string[];
  ancestry: string[];
  size: string;
  speed: number;
  stamina: string;
  stability: number;
  free_strike: number;
  might: number;
  agility: number;
  reason: number;
  intuition: number;
  presence: number;
  ev: string;
}

/** Frontmatter for chapter/section files. */
export interface ChapterFrontmatter extends BaseFrontmatter {
  type: 'chapter';
  chapter_num?: number;
}

/** Frontmatter for class definition files. */
export interface ClassFrontmatter extends BaseFrontmatter {
  type: 'class';
}

/** Frontmatter for ancestry definition files. */
export interface AncestryFrontmatter extends BaseFrontmatter {
  type: 'ancestry';
}

/** Frontmatter for condition definition files. */
export interface ConditionFrontmatter extends BaseFrontmatter {
  type: 'condition';
}

/** Frontmatter for monster feature files. */
export interface FeatureFrontmatter extends BaseFrontmatter {
  type: 'monster/feature';
}

/** Union of all frontmatter types. */
export type Frontmatter =
  | StatBlockFrontmatter
  | ChapterFrontmatter
  | ClassFrontmatter
  | AncestryFrontmatter
  | ConditionFrontmatter
  | FeatureFrontmatter
  | BaseFrontmatter;

// ── Parsed Content Types ────────────────────────────────────────────────────

/** A parsed markdown document with frontmatter and structured content. */
export interface ParsedDocument {
  frontmatter: Frontmatter;
  sections: ParsedSection[];
  rawContent: string;
}

/** A section of a markdown document, delineated by headings. */
export interface ParsedSection {
  level: number;
  title: string;
  content: string;
  children: ParsedSection[];
  abilities: ParsedAbility[];
  tables: ParsedTable[];
}

/** An ability parsed from a blockquote format. */
export interface ParsedAbility {
  name: string;
  /** Emoji-derived category: melee, ranged, area, triggered, trait, villain_action, move, special */
  category: AbilityCategory;
  /** e.g., "Action", "Maneuver", "Triggered Action", "Free Triggered Action" */
  actionType: string;
  keywords: string[];
  distance: string;
  targets: string;
  /** Power roll characteristic, e.g., "Might", "Agility", "Presence" */
  powerRollCharacteristic: string | null;
  /** Three-tier power roll results. */
  powerRollTiers: PowerRollTiers | null;
  /** Full effect text. */
  effect: string | null;
  /** Trigger condition for triggered abilities. */
  trigger: string | null;
  /** Special rules text. */
  special: string | null;
  /** Resource cost, e.g., "3 Wrath", "5 Malice" */
  cost: string | null;
  /** The raw blockquote text. */
  rawText: string;
}

/** Ability categories derived from emoji prefixes in the markdown. */
export type AbilityCategory =
  | 'melee'
  | 'ranged'
  | 'area'
  | 'melee_ranged'
  | 'triggered'
  | 'trait'
  | 'villain_action'
  | 'move'
  | 'special'
  | 'unknown';

/** Three-tier power roll results (Draw Steel system). */
export interface PowerRollTiers {
  low: string; // ≤11
  mid: string; // 12-16
  high: string; // 17+
}

/** A parsed markdown table. */
export interface ParsedTable {
  title: string | null;
  headers: string[];
  rows: string[][];
}

// ── Stat Block Types ────────────────────────────────────────────────────────

/** Characteristic scores for a creature or character. */
export interface Characteristics {
  might: number;
  agility: number;
  reason: number;
  intuition: number;
  presence: number;
}

/** A fully parsed creature stat block. */
export interface CreatureStatBlock {
  name: string;
  level: number;
  echelon: number;
  /** e.g., ["Humanoid", "War Dog"] */
  ancestry: string[];
  /** e.g., "Minion Harrier", "Elite Mount", "Boss" */
  roles: string[];
  size: string;
  speed: number;
  stamina: number | string;
  stability: number;
  freeStrike: number;
  encounterValue: number;
  characteristics: Characteristics;
  /** Immunities, e.g., "Fire 5" */
  immunities: string[];
  /** Weaknesses, e.g., "Holy 5" */
  weaknesses: string[];
  /** Special movement types, e.g., "Fly", "Burrow", "Teleport" */
  movementTypes: string[];
  abilities: ParsedAbility[];
  /** Villain actions (if boss/leader). */
  villainActions: ParsedAbility[];
  /** Traits (passive abilities). */
  traits: ParsedAbility[];
}

// ── Condition Types ─────────────────────────────────────────────────────────

/** A parsed game condition (e.g., Bleeding, Dazed). */
export interface ParsedCondition {
  name: string;
  description: string;
  mechanicalEffects: string[];
}

// ── Class Types ─────────────────────────────────────────────────────────────

/** A parsed character class. */
export interface ParsedClass {
  name: string;
  /** Starting characteristics options. */
  characteristics: Characteristics[];
  /** Heroic resource name (e.g., "Wrath", "Clarity", "Focus"). */
  heroicResource: string | null;
  /** Subclass options (e.g., ["Exorcist", "Oracle", "Paragon"] for Censor). */
  subclasses: string[];
  /** All abilities organized by level. */
  abilitiesByLevel: Map<number, ParsedAbility[]>;
  /** Class features organized by level. */
  featuresByLevel: Map<number, ParsedSection[]>;
}

// ── Ancestry Types ──────────────────────────────────────────────────────────

/** A parsed ancestry (e.g., Human, Dwarf). */
export interface ParsedAncestry {
  name: string;
  signatureTrait: string;
  purchasableTraits: Array<{
    name: string;
    cost: number;
    description: string;
  }>;
}

// ── Game System Aggregate ───────────────────────────────────────────────────

/** Complete parsed game system data. */
export interface GameSystemData {
  name: string;
  version: string;
  source: string;
  /** All parsed conditions. */
  conditions: ParsedCondition[];
  /** All parsed creature stat blocks. */
  creatures: CreatureStatBlock[];
  /** All parsed classes. */
  classes: ParsedClass[];
  /** All parsed ancestries. */
  ancestries: ParsedAncestry[];
  /** Combat rules (movement, action economy, etc.). */
  combatRules: ParsedSection[];
  /** Raw parsed documents for reference. */
  documents: ParsedDocument[];
}

// ── Folder Validation Types ─────────────────────────────────────────────────

/** Result of validating a game_rules/ folder structure. */
export interface FolderValidationResult {
  valid: boolean;
  errors: FolderValidationError[];
  warnings: FolderValidationWarning[];
  /** Detected structure of the folder. */
  structure: FolderStructure | null;
}

export interface FolderValidationError {
  path: string;
  message: string;
  code: FolderErrorCode;
}

export interface FolderValidationWarning {
  path: string;
  message: string;
}

export type FolderErrorCode =
  | 'MISSING_REQUIRED_DIR'
  | 'MISSING_REQUIRED_FILE'
  | 'INVALID_FRONTMATTER'
  | 'INVALID_FILE_TYPE'
  | 'PARSE_ERROR';

/** Detected structure of a game_rules/ folder. */
export interface FolderStructure {
  rootPath: string;
  hasRulesDir: boolean;
  hasBestiaryDir: boolean;
  hasCharacterSheetPdf: boolean;
  rulesChapters: string[];
  classes: string[];
  ancestries: string[];
  monsterFamilies: string[];
  conditions: string[];
}
