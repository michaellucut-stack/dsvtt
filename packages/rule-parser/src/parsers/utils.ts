// ============================================================================
// Shared parser utilities — extracted to eliminate duplication across parsers.
// ============================================================================

/**
 * Determines the echelon (1-4) from a creature or character level.
 * Draw Steel: 1st = levels 1-4, 2nd = 5-7, 3rd = 8-10, 4th = 11+
 */
export function getEchelon(level: number): number {
  if (level <= 4) return 1;
  if (level <= 7) return 2;
  if (level <= 10) return 3;
  return 4;
}

/**
 * Extracts the first markdown heading from content.
 * Strips bold formatting and trims whitespace.
 *
 * @param content - Markdown content
 * @param fallback - Value to return if no heading is found
 * @returns The heading text, or the fallback value
 */
export function extractFirstHeading(content: string, fallback: string): string {
  const headingMatch = content.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch?.[1] !== undefined) {
    return headingMatch[1].replace(/\*\*/g, '').trim();
  }
  return fallback;
}

/**
 * Cleans markdown formatting from a table cell value.
 * Removes bold markers and converts `<br>` tags to spaces.
 */
export function cleanMarkdownCell(cell: string): string {
  return cell
    .replace(/\*\*/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .trim();
}
