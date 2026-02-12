import type { ParsedAbility, AbilityCategory, PowerRollTiers } from '../types.js';

/**
 * Emoji-to-category mapping for ability classification.
 * Draw Steel uses specific emoji prefixes in ability blockquotes.
 */
const EMOJI_CATEGORY_MAP: Array<[string, AbilityCategory]> = [
  ['\u{1F5E1}', 'melee'], // 🗡
  ['\u{1F3F9}', 'ranged'], // 🏹
  ['\u{1F533}', 'area'], // 🔳
  ['\u2694\uFE0F', 'melee_ranged'], // ⚔️
  ['\u2757\uFE0F', 'triggered'], // ❗️
  ['\u2B50\uFE0F', 'trait'], // ⭐️
  ['\u{1F464}', 'move'], // 👤
  ['\u2747\uFE0F', 'special'], // ❇️
  ['\u{1F300}', 'special'], // 🌀
  ['\u2620\uFE0F', 'villain_action'], // ☠️
];

/**
 * Extracts abilities from markdown content containing blockquote-formatted abilities.
 * Abilities are separated by `<!-- -->` HTML comment dividers.
 *
 * @param content - Section content that may contain ability blockquotes
 * @returns Array of parsed abilities
 */
export function parseAbilitiesFromContent(content: string): ParsedAbility[] {
  const abilities: ParsedAbility[] = [];

  // Split on HTML comment dividers that separate abilities
  const blocks = content.split(/<!--\s*-->/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Check if this block is a blockquote (ability format)
    if (!isAbilityBlock(trimmed)) continue;

    const ability = parseAbilityBlock(trimmed);
    if (ability) {
      abilities.push(ability);
    }
  }

  return abilities;
}

/**
 * Checks if a content block looks like an ability blockquote.
 */
function isAbilityBlock(block: string): boolean {
  const lines = block.split('\n');
  // At least some lines should start with >
  const blockquoteLines = lines.filter((l) => l.trimStart().startsWith('>'));
  return blockquoteLines.length >= 2;
}

/**
 * Parses a single ability blockquote into a structured ParsedAbility.
 */
function parseAbilityBlock(block: string): ParsedAbility | null {
  // Strip blockquote markers and normalize
  const lines = block
    .split('\n')
    .map((line) => {
      const stripped = line.trimStart();
      if (stripped.startsWith('>')) {
        return stripped.slice(1).trimStart();
      }
      return stripped;
    })
    .filter((line) => line.length > 0);

  if (lines.length === 0) return null;

  // Extract the ability name and category from the first meaningful line
  const { name, category, cost } = parseAbilityHeader(lines);
  if (!name) return null;

  // Extract keywords and action type from the table
  const { keywords, actionType } = parseKeywordTable(lines);

  // Extract distance and targets
  const { distance, targets } = parseDistanceTargets(lines);

  // Extract power roll
  const { characteristic, tiers } = parsePowerRoll(lines);

  // Extract effect, trigger, special
  const effect = extractLabeledField(lines, 'Effect');
  const trigger = extractLabeledField(lines, 'Trigger');
  const special = extractLabeledField(lines, 'Special');

  return {
    name,
    category,
    actionType: actionType || 'Action',
    keywords: keywords,
    distance: distance ?? '',
    targets: targets ?? '',
    powerRollCharacteristic: characteristic,
    powerRollTiers: tiers,
    effect,
    trigger,
    special,
    cost,
    rawText: block,
  };
}

/**
 * Parses the ability header line to extract name, category, and cost.
 */
function parseAbilityHeader(lines: string[]): {
  name: string;
  category: AbilityCategory;
  cost: string | null;
} {
  // Find the line with the ability name (usually has an emoji or bold text)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // Check for emoji prefix
    for (const [emoji, cat] of EMOJI_CATEGORY_MAP) {
      if (line.includes(emoji)) {
        const nameText = line.replace(emoji, '').replace(/\*\*/g, '').trim();

        const { cleanName, cost } = extractCost(nameText);
        return { name: cleanName, category: cat, cost };
      }
    }

    // Check for heading-style name (######)
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch?.[1] !== undefined) {
      const nameText = headingMatch[1].replace(/\*\*/g, '').trim();
      const { cleanName, cost } = extractCost(nameText);
      return { name: cleanName, category: 'unknown', cost };
    }

    // Check for bold name
    const boldMatch = line.match(/^\*\*(.+?)\*\*/);
    if (boldMatch?.[1] !== undefined) {
      const nameText = boldMatch[1].trim();
      const { cleanName, cost } = extractCost(nameText);
      return { name: cleanName, category: 'unknown', cost };
    }
  }

  return { name: '', category: 'unknown', cost: null };
}

/**
 * Extracts cost from an ability name (e.g., "Fire Blast (3 Wrath)").
 */
function extractCost(name: string): { cleanName: string; cost: string | null } {
  const costMatch = name.match(/\((\d+\s+\w+)\)\s*$/);
  if (costMatch?.[1] !== undefined) {
    return {
      cleanName: name.replace(costMatch[0], '').trim(),
      cost: costMatch[1],
    };
  }

  // Check for "Villain Action N" pattern
  const villainMatch = name.match(/\(Villain Action \d+\)\s*$/);
  if (villainMatch?.[0] !== undefined) {
    return {
      cleanName: name.replace(villainMatch[0], '').trim(),
      cost: villainMatch[0].replace(/[()]/g, ''),
    };
  }

  return { cleanName: name, cost: null };
}

/**
 * Extracts keywords and action type from the ability's keyword table.
 */
function parseKeywordTable(lines: string[]): {
  keywords: string[];
  actionType: string;
} {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    if (line.includes('**Keywords**') || line.includes('**Type**')) {
      // This is the header row of the keyword table
      // The data row is 2 lines later (after separator)
      const dataRow = lines[i + 2];
      if (dataRow !== undefined) {
        const cells = dataRow
          .split('|')
          .map((c) => c.trim())
          .filter((c) => c.length > 0);

        const cell0 = cells[0];
        const cell1 = cells[1];
        if (cell0 !== undefined && cell1 !== undefined) {
          const keywords = cell0
            .replace(/\*\*/g, '')
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k.length > 0 && k !== '-');
          const actionType = cell1.replace(/\*\*/g, '').trim();
          return { keywords, actionType };
        }
      }
    }
  }

  return { keywords: [], actionType: '' };
}

/**
 * Extracts distance and targets from emoji-prefixed lines.
 */
function parseDistanceTargets(lines: string[]): {
  distance: string | null;
  targets: string | null;
} {
  let distance: string | null = null;
  let targets: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // Check pipe-delimited rows with distance/target info
    if (line.includes('\u{1F4CF}') || line.includes('\u{1F3AF}')) {
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      for (const cell of cells) {
        if (cell.includes('\u{1F4CF}')) {
          // 📏
          distance = cell.replace('\u{1F4CF}', '').replace(/\*\*/g, '').trim();
        }
        if (cell.includes('\u{1F3AF}')) {
          // 🎯
          targets = cell.replace('\u{1F3AF}', '').replace(/\*\*/g, '').trim();
        }
      }
    }
  }

  return { distance, targets };
}

/**
 * Extracts power roll characteristic and tier results.
 */
function parsePowerRoll(lines: string[]): {
  characteristic: string | null;
  tiers: PowerRollTiers | null;
} {
  let characteristic: string | null = null;
  let low: string | null = null;
  let mid: string | null = null;
  let high: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // Match "Power Roll + Characteristic:"
    const prMatch = line.match(/\*\*Power Roll \+ (\w+):\*\*/i);
    if (prMatch?.[1] !== undefined) {
      characteristic = prMatch[1];
    }

    // Match tier results
    const lowMatch = line.match(/[-*]\s*\*\*≤\s*11:\*\*\s*(.+)/);
    if (lowMatch?.[1] !== undefined) {
      low = lowMatch[1].trim();
    }

    const midMatch = line.match(/[-*]\s*\*\*12[-–]16:\*\*\s*(.+)/);
    if (midMatch?.[1] !== undefined) {
      mid = midMatch[1].trim();
    }

    const highMatch = line.match(/[-*]\s*\*\*17\+:\*\*\s*(.+)/);
    if (highMatch?.[1] !== undefined) {
      high = highMatch[1].trim();
    }
  }

  if (low !== null && mid !== null && high !== null) {
    return { characteristic, tiers: { low, mid, high } };
  }

  if (characteristic) {
    return { characteristic, tiers: null };
  }

  return { characteristic: null, tiers: null };
}

/** Pre-compiled regex patterns for labeled field extraction. */
const LABELED_FIELD_PATTERNS = new Map<string, RegExp>();

function getLabeledFieldPattern(label: string): RegExp {
  let pattern = LABELED_FIELD_PATTERNS.get(label);
  if (!pattern) {
    pattern = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, 'i');
    LABELED_FIELD_PATTERNS.set(label, pattern);
  }
  return pattern;
}

/**
 * Extracts a labeled field value (e.g., "**Effect:** some text").
 */
function extractLabeledField(lines: string[], label: string): string | null {
  const pattern = getLabeledFieldPattern(label);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    const match = line.match(pattern);
    if (match?.[1] !== undefined) {
      let value = match[1].trim();

      // Collect continuation lines (non-header, non-table lines following)
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (nextLine === undefined) break;
        if (
          nextLine.startsWith('**') ||
          nextLine.startsWith('|') ||
          nextLine.startsWith('-') ||
          nextLine.startsWith('#') ||
          nextLine.includes('\u{1F4CF}') ||
          nextLine.includes('\u{1F3AF}')
        ) {
          break;
        }
        if (nextLine.trim()) {
          value += ' ' + nextLine.trim();
        }
      }

      return value;
    }
  }
  return null;
}
