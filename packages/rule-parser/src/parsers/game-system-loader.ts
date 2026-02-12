import * as fs from 'node:fs';
import * as path from 'node:path';

import type {
  GameSystemData,
  ParsedDocument,
  CreatureStatBlock,
  ParsedCondition,
} from '../types.js';
import { parseDocument } from './document-parser.js';
import { parseCreatureStatBlock } from './statblock-parser.js';
import { parseCondition } from './condition-parser.js';
import { validateGameRulesFolder } from './folder-validator.js';

/**
 * Loads and parses an entire game system from a game_rules/ folder.
 *
 * @param rootPath - Path to the game_rules/ folder
 * @param monsterFilter - Optional list of monster family names to include (for partial loading)
 * @returns Complete parsed game system data
 * @throws Error if the folder structure is invalid
 */
export function loadGameSystem(rootPath: string, monsterFilter?: string[]): GameSystemData {
  // Validate folder structure
  const validation = validateGameRulesFolder(rootPath);
  if (!validation.valid) {
    const errorMessages = validation.errors.map((e) => `  - ${e.message} (${e.path})`).join('\n');
    throw new Error(`Invalid game_rules/ folder structure:\n${errorMessages}`);
  }

  const structure = validation.structure;
  if (!structure) {
    throw new Error('Folder validation passed but structure is null');
  }

  const documents: ParsedDocument[] = [];
  const creatures: CreatureStatBlock[] = [];
  const conditions: ParsedCondition[] = [];

  // Load conditions
  if (structure.hasRulesDir) {
    const conditionsDir = path.join(rootPath, 'Rules', 'Conditions');
    if (fs.existsSync(conditionsDir)) {
      const conditionDocs = loadMarkdownFiles(conditionsDir);
      for (const doc of conditionDocs) {
        documents.push(doc);
        const condition = parseCondition(doc);
        if (condition) {
          conditions.push(condition);
        }
      }
    }
  }

  // Load combat rules chapters
  const combatRules: GameSystemData['combatRules'] = [];
  if (structure.hasRulesDir) {
    const chaptersDir = path.join(rootPath, 'Rules', 'Chapters');
    if (fs.existsSync(chaptersDir)) {
      const chapterDocs = loadMarkdownFiles(chaptersDir);
      for (const doc of chapterDocs) {
        documents.push(doc);
        // Combat-related chapters go into combatRules
        const name = doc.frontmatter.item_name?.toLowerCase() ?? '';
        if (name.includes('combat') || name.includes('basics') || name.includes('movement')) {
          combatRules.push(...doc.sections);
        }
      }
    }
  }

  // Load bestiary (monsters)
  if (structure.hasBestiaryDir) {
    const monstersDir = path.join(rootPath, 'Bestiary', 'Monsters', 'Monsters');
    if (fs.existsSync(monstersDir)) {
      const families = structure.monsterFamilies;
      const filteredFamilies = monsterFilter
        ? families.filter((f) =>
            monsterFilter.some((mf) => f.toLowerCase().includes(mf.toLowerCase())),
          )
        : families;

      for (const family of filteredFamilies) {
        const familyDir = path.join(monstersDir, family);
        const familyCreatures = loadMonsterFamily(familyDir, documents);
        creatures.push(...familyCreatures);
      }
    }
  }

  // Determine system name from README or folder name
  const systemName = detectSystemName(rootPath);

  return {
    name: systemName,
    version: '1.0',
    source: 'DRAW STEEL Creator License',
    conditions,
    creatures,
    classes: [], // Loaded separately in Sprint 10
    ancestries: [], // Loaded separately in Sprint 10
    combatRules,
    documents,
  };
}

/**
 * Loads all monster stat blocks from a monster family directory.
 * Handles both flat structures and nested echelon structures.
 */
function loadMonsterFamily(familyDir: string, documents: ParsedDocument[]): CreatureStatBlock[] {
  const creatures: CreatureStatBlock[] = [];

  // Check for Statblocks/ directory
  const statblocksDir = path.join(familyDir, 'Statblocks');
  if (fs.existsSync(statblocksDir)) {
    const docs = loadMarkdownFiles(statblocksDir);
    for (const doc of docs) {
      documents.push(doc);
      const creature = parseCreatureStatBlock(doc);
      if (creature) {
        creatures.push(creature);
      }
    }
  }

  // Check for echelon subdirectories (e.g., "1st Echelon/Statblocks/")
  const entries = safeReaddir(familyDir);
  for (const entry of entries) {
    const entryPath = path.join(familyDir, entry);
    if (fs.statSync(entryPath).isDirectory() && entry.includes('Echelon')) {
      const echelonStatblocks = path.join(entryPath, 'Statblocks');
      if (fs.existsSync(echelonStatblocks)) {
        const docs = loadMarkdownFiles(echelonStatblocks);
        for (const doc of docs) {
          documents.push(doc);
          const creature = parseCreatureStatBlock(doc);
          if (creature) {
            creatures.push(creature);
          }
        }
      }
    }
  }

  return creatures;
}

/**
 * Loads and parses all markdown files in a directory.
 */
function loadMarkdownFiles(dirPath: string): ParsedDocument[] {
  const docs: ParsedDocument[] = [];
  const files = safeReaddir(dirPath).filter((f) => f.endsWith('.md') && !f.startsWith('_'));

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const doc = parseDocument(content);
      docs.push(doc);
    } catch {
      // Skip files that fail to parse
    }
  }

  return docs;
}

/**
 * Safely reads a directory, returning an empty array on error.
 */
function safeReaddir(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

/**
 * Detects the game system name from README files or folder name.
 */
function detectSystemName(rootPath: string): string {
  // Check for README in Rules/
  const rulesReadme = path.join(rootPath, 'Rules', 'README.md');
  if (fs.existsSync(rulesReadme)) {
    const content = fs.readFileSync(rulesReadme, 'utf-8');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch?.[1] !== undefined) {
      return titleMatch[1].trim();
    }
  }

  // Fall back to folder name
  return path.basename(rootPath);
}
