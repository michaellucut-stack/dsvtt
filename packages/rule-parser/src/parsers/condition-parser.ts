import type { ParsedCondition, ParsedDocument } from '../types.js';
import { extractFirstHeading } from './utils.js';

/**
 * Parses a condition from a parsed document.
 *
 * @param doc - A parsed document with condition frontmatter
 * @returns A parsed condition, or null if not a condition document
 */
export function parseCondition(doc: ParsedDocument): ParsedCondition | null {
  if (doc.frontmatter.type !== 'condition') {
    return null;
  }

  const name =
    doc.frontmatter.item_name || extractFirstHeading(doc.rawContent, 'Unknown Condition');
  const description = extractConditionDescription(doc.rawContent);
  const mechanicalEffects = extractMechanicalEffects(description);

  return {
    name,
    description,
    mechanicalEffects,
  };
}

/**
 * Extracts the condition description (all content after the first heading).
 */
function extractConditionDescription(content: string): string {
  const lines = content.split('\n');
  let pastHeading = false;
  const descLines: string[] = [];

  for (const line of lines) {
    if (line.match(/^#{1,6}\s+/)) {
      pastHeading = true;
      continue;
    }
    if (pastHeading) {
      descLines.push(line);
    }
  }

  return descLines.join('\n').trim();
}

/**
 * Extracts mechanical effects from a condition description.
 * Looks for bullet points and sentences that describe game mechanics.
 */
function extractMechanicalEffects(description: string): string[] {
  const effects: string[] = [];
  const lines = description.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Bullet point items are usually mechanical effects
    if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
      effects.push(trimmed.replace(/^[-*]\s*/, '').trim());
      continue;
    }

    // Sentences containing game keywords
    if (
      trimmed.length > 0 &&
      (trimmed.includes("can't") ||
        trimmed.includes('cannot') ||
        trimmed.includes('must') ||
        trimmed.includes('takes') ||
        trimmed.includes('damage') ||
        trimmed.includes('save') ||
        trimmed.includes('end of') ||
        trimmed.includes('speed') ||
        trimmed.includes('edge') ||
        trimmed.includes('bane'))
    ) {
      effects.push(trimmed);
    }
  }

  return effects;
}
