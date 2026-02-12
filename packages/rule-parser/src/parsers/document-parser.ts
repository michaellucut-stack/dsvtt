import type { ParsedDocument } from '../types.js';
import { parseFrontmatter } from './frontmatter-parser.js';
import { parseSections } from './section-parser.js';

/**
 * Parses a complete markdown document into structured data.
 * Extracts frontmatter, sections, abilities, and tables.
 *
 * @param content - Raw markdown file content
 * @returns A fully parsed document
 */
export function parseDocument(content: string): ParsedDocument {
  const { frontmatter, body } = parseFrontmatter(content);
  const sections = parseSections(body);

  return {
    frontmatter,
    sections,
    rawContent: body,
  };
}
