import type {
  CreatureStatBlock,
  Characteristics,
  ParsedAbility,
  StatBlockFrontmatter,
  ParsedDocument,
} from '../types.js';
import { parseAbilitiesFromContent } from './ability-parser.js';
import { getEchelon, extractFirstHeading, cleanMarkdownCell } from './utils.js';

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
    name: statFm.item_name || extractFirstHeading(doc.rawContent, 'Unknown Creature'),
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
 * Parses the encounter value (EV) from a string.
 */
function parseEncounterValue(ev: string): number {
  const num = parseInt(ev, 10);
  return Number.isNaN(num) ? 0 : num;
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

    // Match movement types only in stat-block style lines (tables or labeled lines),
    // not in prose descriptions. Look for "Speed X (Fly, Teleport)" patterns or
    // standalone movement keywords preceded by a number or comma.
    if (line.includes('|') || lowerLine.includes('speed')) {
      const movementMatch = line.match(/\b(Fly|Burrow|Teleport|Swim|Climb)\s*\d*/gi);
      if (movementMatch) {
        movementTypes.push(
          ...movementMatch.map((m) => {
            const word = m.trim().split(/\s/)[0]!;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          }),
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
    const cleaned = cleanMarkdownCell(cell);
    if (cleaned && cleaned !== '-' && cleaned.length > 1) {
      values.push(cleaned);
    }
  }
  return values;
}
