import type {
  CreatureStatBlock,
  Characteristics,
  ParsedAbility,
  StatBlockFrontmatter,
  ParsedDocument,
} from '../types.js';
import { parseAbilitiesFromContent } from './ability-parser.js';

/**
 * Parses a creature stat block from a parsed document.
 * Combines frontmatter data with abilities extracted from the markdown body.
 *
 * @param doc - A parsed document with stat block frontmatter
 * @returns A fully structured creature stat block, or null if not a stat block
 */
export function parseCreatureStatBlock(doc: ParsedDocument): CreatureStatBlock | null {
  const fm = doc.frontmatter;

  if (fm.type !== 'monster/statblock') {
    return null;
  }

  const statFm = fm as StatBlockFrontmatter;

  const characteristics: Characteristics = {
    might: statFm.might,
    agility: statFm.agility,
    reason: statFm.reason,
    intuition: statFm.intuition,
    presence: statFm.presence,
  };

  // Parse the stamina value (can be a formula like "8 (pointed)" or a number)
  const stamina = parseStamina(statFm.stamina);

  // Determine echelon from level
  const echelon = getEchelon(statFm.level);

  // Extract abilities from the body content
  const allAbilities = parseAbilitiesFromContent(doc.rawContent);

  // Categorize abilities
  const regularAbilities: ParsedAbility[] = [];
  const villainActions: ParsedAbility[] = [];
  const traits: ParsedAbility[] = [];

  for (const ability of allAbilities) {
    if (ability.category === 'villain_action') {
      villainActions.push(ability);
    } else if (ability.category === 'trait') {
      traits.push(ability);
    } else {
      regularAbilities.push(ability);
    }
  }

  // Extract immunities, weaknesses, and movement types from body
  const { immunities, weaknesses, movementTypes } = parseSpecialProperties(doc.rawContent);

  return {
    name: statFm.item_name || extractNameFromContent(doc.rawContent),
    level: statFm.level,
    echelon,
    ancestry: statFm.ancestry,
    roles: statFm.roles,
    size: statFm.size,
    speed: statFm.speed,
    stamina,
    stability: statFm.stability,
    freeStrike: statFm.free_strike,
    encounterValue: parseEncounterValue(statFm.ev),
    characteristics,
    immunities,
    weaknesses,
    movementTypes,
    abilities: regularAbilities,
    villainActions,
    traits,
  };
}

/**
 * Parses the stamina value from a string representation.
 * Can be a number, or a formula like "8" or descriptive text.
 */
function parseStamina(stamina: string): number | string {
  const num = parseInt(stamina, 10);
  if (!Number.isNaN(num)) {
    return num;
  }
  return stamina;
}

/**
 * Determines the echelon (1-4) from the creature level.
 * Draw Steel: 1st = levels 1-4, 2nd = 5-7, 3rd = 8-10, 4th = 11+
 */
function getEchelon(level: number): number {
  if (level <= 4) return 1;
  if (level <= 7) return 2;
  if (level <= 10) return 3;
  return 4;
}

/**
 * Parses the encounter value (EV) from a string.
 */
function parseEncounterValue(ev: string): number {
  const num = parseInt(ev, 10);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Extracts the creature name from the body content (first heading).
 */
function extractNameFromContent(content: string): string {
  const headingMatch = content.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch?.[1] !== undefined) {
    return headingMatch[1].replace(/\*\*/g, '').trim();
  }
  return 'Unknown Creature';
}

/**
 * Extracts immunities, weaknesses, and movement types from the stat block table.
 */
function parseSpecialProperties(content: string): {
  immunities: string[];
  weaknesses: string[];
  movementTypes: string[];
} {
  const immunities: string[] = [];
  const weaknesses: string[] = [];
  const movementTypes: string[] = [];

  const lines = content.split('\n');
  for (const line of lines) {
    // Look for immunity patterns in table rows
    const lowerLine = line.toLowerCase();

    if (lowerLine.includes('immunity') || lowerLine.includes('immune')) {
      const immunityValues = extractTableValues(line);
      immunities.push(...immunityValues);
    }

    if (lowerLine.includes('weakness') || lowerLine.includes('vulnerable')) {
      const weaknessValues = extractTableValues(line);
      weaknesses.push(...weaknessValues);
    }

    if (
      lowerLine.includes('fly') ||
      lowerLine.includes('burrow') ||
      lowerLine.includes('teleport') ||
      lowerLine.includes('swim')
    ) {
      const movementMatch = line.match(/\b(Fly|Burrow|Teleport|Swim|Climb)\b/gi);
      if (movementMatch) {
        movementTypes.push(
          ...movementMatch.map((m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()),
        );
      }
    }
  }

  return {
    immunities: [...new Set(immunities)],
    weaknesses: [...new Set(weaknesses)],
    movementTypes: [...new Set(movementTypes)],
  };
}

/**
 * Extracts values from a table row that contains a specific keyword.
 */
function extractTableValues(line: string): string[] {
  const cells = line
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const values: string[] = [];
  for (const cell of cells) {
    const cleaned = cell
      .replace(/\*\*/g, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .trim();
    if (cleaned && cleaned !== '-' && cleaned.length > 1) {
      values.push(cleaned);
    }
  }
  return values;
}
