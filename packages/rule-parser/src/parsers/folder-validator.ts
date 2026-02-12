import * as fs from 'node:fs';
import * as path from 'node:path';

import type {
  FolderValidationResult,
  FolderValidationError,
  FolderValidationWarning,
  FolderStructure,
  FolderErrorCode,
} from '../types.js';

/**
 * Validates a game_rules/ folder structure.
 * Checks for required directories, required files, and valid content.
 *
 * @param rootPath - Path to the game_rules/ folder
 * @returns Validation result with errors, warnings, and detected structure
 */
export function validateGameRulesFolder(rootPath: string): FolderValidationResult {
  const errors: FolderValidationError[] = [];
  const warnings: FolderValidationWarning[] = [];

  // Check root exists
  if (!fs.existsSync(rootPath)) {
    return {
      valid: false,
      errors: [createError(rootPath, 'Game rules folder does not exist', 'MISSING_REQUIRED_DIR')],
      warnings: [],
      structure: null,
    };
  }

  const stat = fs.statSync(rootPath);
  if (!stat.isDirectory()) {
    return {
      valid: false,
      errors: [createError(rootPath, 'Path is not a directory', 'MISSING_REQUIRED_DIR')],
      warnings: [],
      structure: null,
    };
  }

  // Detect structure
  const structure = detectStructure(rootPath, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    structure,
  };
}

/**
 * Detects the folder structure and validates required components.
 */
function detectStructure(
  rootPath: string,
  errors: FolderValidationError[],
  warnings: FolderValidationWarning[],
): FolderStructure {
  const rulesDir = path.join(rootPath, 'Rules');
  const bestiaryDir = path.join(rootPath, 'Bestiary');

  const hasRulesDir = fs.existsSync(rulesDir) && fs.statSync(rulesDir).isDirectory();
  const hasBestiaryDir = fs.existsSync(bestiaryDir) && fs.statSync(bestiaryDir).isDirectory();

  // Check for character sheet PDF
  const pdfFiles = findFiles(rootPath, '.pdf', false);
  const hasCharacterSheetPdf = pdfFiles.length > 0;

  if (!hasRulesDir) {
    errors.push(createError(rulesDir, 'Missing required Rules/ directory', 'MISSING_REQUIRED_DIR'));
  }

  if (!hasBestiaryDir) {
    warnings.push({ path: bestiaryDir, message: 'No Bestiary/ directory found (optional)' });
  }

  // Detect contents
  let rulesChapters: string[] = [];
  let classes: string[] = [];
  let ancestries: string[] = [];
  let conditions: string[] = [];
  let monsterFamilies: string[] = [];

  if (hasRulesDir) {
    const chaptersDir = path.join(rulesDir, 'Chapters');
    if (fs.existsSync(chaptersDir)) {
      rulesChapters = listMarkdownFiles(chaptersDir).filter((f) => !f.startsWith('_'));
    } else {
      errors.push(
        createError(chaptersDir, 'Missing Rules/Chapters/ directory', 'MISSING_REQUIRED_DIR'),
      );
    }

    const classesDir = path.join(rulesDir, 'Classes');
    if (fs.existsSync(classesDir)) {
      classes = listMarkdownFiles(classesDir).filter((f) => !f.startsWith('_'));
    }

    const ancestriesDir = path.join(rulesDir, 'Ancestries');
    if (fs.existsSync(ancestriesDir)) {
      ancestries = listMarkdownFiles(ancestriesDir).filter((f) => !f.startsWith('_'));
    }

    const conditionsDir = path.join(rulesDir, 'Conditions');
    if (fs.existsSync(conditionsDir)) {
      conditions = listMarkdownFiles(conditionsDir).filter((f) => !f.startsWith('_'));
    }
  }

  if (hasBestiaryDir) {
    const monstersDir = path.join(bestiaryDir, 'Monsters', 'Monsters');
    if (fs.existsSync(monstersDir)) {
      monsterFamilies = listDirectories(monstersDir);
    }
  }

  return {
    rootPath,
    hasRulesDir,
    hasBestiaryDir,
    hasCharacterSheetPdf,
    rulesChapters,
    classes,
    ancestries,
    monsterFamilies,
    conditions,
  };
}

/**
 * Lists markdown files (*.md) in a directory (non-recursive).
 */
function listMarkdownFiles(dirPath: string): string[] {
  try {
    return fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace('.md', ''));
  } catch {
    return [];
  }
}

/**
 * Lists subdirectories in a directory.
 */
function listDirectories(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath).filter((f) => {
      const fullPath = path.join(dirPath, f);
      return fs.statSync(fullPath).isDirectory();
    });
  } catch {
    return [];
  }
}

/**
 * Finds files with a specific extension in a directory.
 */
function findFiles(dirPath: string, extension: string, recursive: boolean): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const entryStat = fs.statSync(fullPath);
      if (entryStat.isFile() && entry.endsWith(extension)) {
        results.push(fullPath);
      } else if (recursive && entryStat.isDirectory()) {
        results.push(...findFiles(fullPath, extension, true));
      }
    }
  } catch {
    // Ignore errors
  }
  return results;
}

function createError(
  filePath: string,
  message: string,
  code: FolderErrorCode,
): FolderValidationError {
  return { path: filePath, message, code };
}
