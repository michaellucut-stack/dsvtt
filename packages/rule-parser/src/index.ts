// ============================================================================
// @dsvtt/rule-parser — Public API
// ============================================================================

// Types
export type {
  // Frontmatter
  BaseFrontmatter,
  StatBlockFrontmatter,
  ChapterFrontmatter,
  ClassFrontmatter,
  AncestryFrontmatter,
  ConditionFrontmatter,
  FeatureFrontmatter,
  Frontmatter,
  // Parsed content
  ParsedDocument,
  ParsedSection,
  ParsedAbility,
  AbilityCategory,
  PowerRollTiers,
  ParsedTable,
  // Stat blocks
  Characteristics,
  CreatureStatBlock,
  // Conditions
  ParsedCondition,
  // Classes
  ParsedClass,
  // Ancestries
  ParsedAncestry,
  // Game system
  GameSystemData,
  // Folder validation
  FolderValidationResult,
  FolderValidationError,
  FolderValidationWarning,
  FolderErrorCode,
  FolderStructure,
} from './types.js';

// Parsers
export { parseFrontmatter } from './parsers/frontmatter-parser.js';
export { parseSections } from './parsers/section-parser.js';
export { parseAbilitiesFromContent } from './parsers/ability-parser.js';
export { parseTablesFromContent } from './parsers/table-parser.js';
export { parseCreatureStatBlock } from './parsers/statblock-parser.js';
export { parseCondition } from './parsers/condition-parser.js';
export { parseDocument } from './parsers/document-parser.js';

// Folder operations
export { validateGameRulesFolder } from './parsers/folder-validator.js';
export { loadGameSystem } from './parsers/game-system-loader.js';

// Ability classification (Sprint 10)
export type { AbilityTab, ClassifiedAbility, AbilityFilter } from './parsers/ability-classifier.js';
export {
  classifyAbilityTab,
  classifyAbilities,
  filterAbilities,
  groupAbilitiesByTab,
  countAbilitiesByTab,
} from './parsers/ability-classifier.js';

// Character sheet templates
export type {
  FieldSection,
  FieldType,
  TemplateField,
  CharacterSheetTemplate,
} from './parsers/character-template-parser.js';
export {
  generateDrawSteelTemplate,
  computeFieldValue,
} from './parsers/character-template-parser.js';
