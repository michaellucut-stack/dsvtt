import { parse as parseYaml } from 'yaml';

import type { Frontmatter, BaseFrontmatter, StatBlockFrontmatter } from '../types.js';

/**
 * Extracts YAML frontmatter from a markdown file.
 * Frontmatter is delimited by `---` at the start of the file.
 *
 * @param content - Raw markdown file content
 * @returns Parsed frontmatter object and remaining body content
 */
export function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const trimmed = content.trim();

  if (!trimmed.startsWith('---')) {
    return {
      frontmatter: createEmptyFrontmatter(),
      body: content,
    };
  }

  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) {
    return {
      frontmatter: createEmptyFrontmatter(),
      body: content,
    };
  }

  const yamlContent = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 3).trim();

  try {
    const parsed = parseYaml(yamlContent);
    if (typeof parsed !== 'object' || parsed === null) {
      return { frontmatter: createEmptyFrontmatter(), body };
    }
    const frontmatter = normalizeFrontmatter(parsed as Record<string, unknown>);
    return { frontmatter, body };
  } catch {
    return {
      frontmatter: createEmptyFrontmatter(),
      body: content,
    };
  }
}

/**
 * Normalizes a raw parsed YAML object into a typed Frontmatter object.
 * Detects the frontmatter type based on the `type` field and available fields.
 */
function normalizeFrontmatter(raw: Record<string, unknown>): Frontmatter {
  const base: BaseFrontmatter = {
    file_basename: asString(raw['file_basename']),
    file_dpath: asString(raw['file_dpath']),
    item_id: asString(raw['item_id']),
    item_index: asNumber(raw['item_index'], 0),
    item_name: asString(raw['item_name']),
    scc: asString(raw['scc']),
    scdc: asString(raw['scdc']),
    source: asString(raw['source']),
    type: asString(raw['type']),
    title: raw['title'] != null ? asString(raw['title']) : undefined,
  };

  // Detect stat block frontmatter by type or presence of stat fields
  if (
    base.type === 'monster/statblock' ||
    (raw['level'] != null && raw['stamina'] != null && raw['speed'] != null)
  ) {
    const statBlock: StatBlockFrontmatter = {
      ...base,
      type: 'monster/statblock',
      level: asNumber(raw['level'], 0),
      roles: asStringArray(raw['roles']),
      ancestry: asStringArray(raw['ancestry']),
      size: asString(raw['size']),
      speed: asNumber(raw['speed'], 0),
      stamina: asString(raw['stamina']),
      stability: asNumber(raw['stability'], 0),
      free_strike: asNumber(raw['free_strike'], 0),
      might: asNumber(raw['might'], 0),
      agility: asNumber(raw['agility'], 0),
      reason: asNumber(raw['reason'], 0),
      intuition: asNumber(raw['intuition'], 0),
      presence: asNumber(raw['presence'], 0),
      ev: asString(raw['ev']),
    };
    return statBlock;
  }

  return base;
}

function createEmptyFrontmatter(): BaseFrontmatter {
  return {
    file_basename: '',
    file_dpath: '',
    item_id: '',
    item_index: 0,
    item_name: '',
    scc: '',
    scdc: '',
    source: '',
    type: '',
  };
}

function asString(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

function asNumber(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}
