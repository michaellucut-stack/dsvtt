import type { ParsedTable } from '../types.js';
import { cleanMarkdownCell } from './utils.js';

/**
 * Extracts markdown tables from content.
 * Tables are pipe-delimited with a separator row of dashes.
 *
 * @param content - Markdown content that may contain tables
 * @returns Array of parsed tables
 */
export function parseTablesFromContent(content: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const lines = content.split('\n');

  let i = 0;
  while (i < lines.length) {
    const currentLine = lines[i];
    const nextLine = lines[i + 1];
    // Look for a table header row (contains pipes and non-empty cells)
    if (
      currentLine !== undefined &&
      nextLine !== undefined &&
      isTableRow(currentLine) &&
      isSeparatorRow(nextLine)
    ) {
      const table = parseTable(lines, i);
      if (table) {
        // Try to extract title from preceding heading
        const title = findPrecedingTitle(lines, i);
        table.title = title;
        tables.push(table);
        // Skip past the table
        i = i + 2 + table.rows.length;
        continue;
      }
    }
    i++;
  }

  return tables;
}

/**
 * Checks if a line looks like a table row (has pipe delimiters with content).
 */
function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  const cells = trimmed.split('|').filter((c) => c.trim().length > 0);
  return cells.length >= 2;
}

/**
 * Checks if a line is a table separator row (e.g., "| --- | --- |").
 */
function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  const cells = trimmed
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  return cells.every((cell) => /^[-:\s]+$/.test(cell));
}

/**
 * Parses a complete table starting at the given line index.
 */
function parseTable(lines: string[], startIndex: number): ParsedTable | null {
  const headerLine = lines[startIndex];
  if (headerLine === undefined) return null;

  const headers = parseTableCells(headerLine);
  if (headers.length === 0) return null;

  const rows: string[][] = [];
  let i = startIndex + 2; // Skip header and separator

  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined || !isTableRow(line)) break;
    if (isSeparatorRow(line)) {
      i++;
      continue;
    }

    const cells = parseTableCells(line);
    if (cells.length > 0) {
      rows.push(cells);
    }
    i++;
  }

  return {
    title: null,
    headers,
    rows,
  };
}

/**
 * Parses a pipe-delimited table row into cell values.
 */
function parseTableCells(line: string): string[] {
  const rawCells = line.split('|');
  const cells: string[] = [];

  for (let i = 0; i < rawCells.length; i++) {
    const cell = rawCells[i];
    if (cell === undefined) continue;
    const trimmed = cell.trim();
    // Remove empty first and last cells from leading/trailing pipes
    if (i === 0 && trimmed === '') continue;
    if (i === rawCells.length - 1 && trimmed === '') continue;
    cells.push(cleanMarkdownCell(trimmed));
  }

  return cells;
}

/**
 * Searches backward from a table to find a preceding heading title.
 */
function findPrecedingTitle(lines: string[], tableIndex: number): string | null {
  for (let i = tableIndex - 1; i >= Math.max(0, tableIndex - 3); i--) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch?.[1] !== undefined) {
      return headingMatch[1].trim();
    }
    // Skip blank lines
    if (trimmed.length > 0 && !headingMatch) break;
  }
  return null;
}
