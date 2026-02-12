import type { ParsedSection } from '../types.js';
import { parseAbilitiesFromContent } from './ability-parser.js';
import { parseTablesFromContent } from './table-parser.js';

/**
 * Parses markdown body content into a tree of sections based on heading levels.
 * Each section contains its text content, child sections, extracted abilities, and tables.
 *
 * @param body - Markdown content without frontmatter
 * @returns Array of top-level sections
 */
export function parseSections(body: string): ParsedSection[] {
  const lines = body.split('\n');
  const rootSections: ParsedSection[] = [];
  const stack: ParsedSection[] = [];

  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Flush current content to the top of the stack
      flushContent(stack, currentContent);
      currentContent = [];

      const level = headingMatch[1]!.length;
      const title = headingMatch[2]!.trim();

      const section: ParsedSection = {
        level,
        title,
        content: '',
        children: [],
        abilities: [],
        tables: [],
      };

      // Pop stack until we find a parent with lower level
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top !== undefined && top.level >= level) {
          stack.pop();
        } else {
          break;
        }
      }

      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        if (parent !== undefined) {
          parent.children.push(section);
        }
      } else {
        rootSections.push(section);
      }

      stack.push(section);
    } else {
      currentContent.push(line);
    }
  }

  // Flush remaining content
  flushContent(stack, currentContent);

  // Post-process: extract abilities and tables from each section's content
  postProcessSections(rootSections);

  return rootSections;
}

/**
 * Flushes accumulated content lines to the current section on the stack.
 */
function flushContent(stack: ParsedSection[], lines: string[]): void {
  if (lines.length === 0) return;

  const content = lines.join('\n').trim();
  if (content.length === 0) return;

  if (stack.length > 0) {
    const current = stack[stack.length - 1];
    if (current !== undefined) {
      current.content = current.content ? current.content + '\n' + content : content;
    }
  }
}

/**
 * Recursively extracts abilities and tables from section content.
 */
function postProcessSections(sections: ParsedSection[]): void {
  for (const section of sections) {
    if (section.content) {
      section.abilities = parseAbilitiesFromContent(section.content);
      section.tables = parseTablesFromContent(section.content);
    }
    postProcessSections(section.children);
  }
}
