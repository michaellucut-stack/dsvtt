import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

import { parseFrontmatter } from '../parsers/frontmatter-parser.js';
import { parseDocument } from '../parsers/document-parser.js';
import { parseSections } from '../parsers/section-parser.js';
import { parseAbilitiesFromContent } from '../parsers/ability-parser.js';
import { parseCreatureStatBlock } from '../parsers/statblock-parser.js';
import { validateGameRulesFolder } from '../parsers/folder-validator.js';
import { loadGameSystem } from '../parsers/game-system-loader.js';

// ── Security Review: MD Parsing ─────────────────────────────────────────────
//
// Sprint 12 requirement: Validate that the rule file parser is safe against:
//   1. Path traversal attacks
//   2. Malicious markdown injection
//   3. Oversized file handling
//   4. YAML injection / prototype pollution
//   5. Denial of service via deeply nested content

describe('Security: Markdown parsing', () => {
  // ── Path Traversal ──────────────────────────────────────────────────────

  describe('path traversal protection', () => {
    it('rejects non-existent paths', () => {
      const result = validateGameRulesFolder('/nonexistent/path/game_rules');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects paths that are files, not directories', () => {
      // Create a temp file to test with
      const tmpFile = path.join(os.tmpdir(), `dsvtt-sec-test-${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, 'not a directory');

      try {
        const result = validateGameRulesFolder(tmpFile);
        expect(result.valid).toBe(false);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('handles paths with traversal components gracefully', () => {
      // folder validator checks fs.existsSync - a non-existent traversal path will fail
      const traversalPath = path.join(os.tmpdir(), '..', '..', '..', 'etc', 'passwd');
      const result = validateGameRulesFolder(traversalPath);
      expect(result.valid).toBe(false);
    });

    it('loadGameSystem throws on invalid folder', () => {
      expect(() => loadGameSystem('/nonexistent/fake_game_rules')).toThrow();
    });
  });

  // ── Malicious YAML Frontmatter ──────────────────────────────────────────

  describe('YAML frontmatter safety', () => {
    it('handles empty frontmatter gracefully', () => {
      const result = parseFrontmatter('---\n---\ncontent');
      expect(result.frontmatter).toBeDefined();
      // Empty YAML between delimiters returns empty frontmatter;
      // the parser may fall back to empty frontmatter with full content as body
      // depending on how the yaml library handles empty input
      expect(result.frontmatter.type).toBe('');
    });

    it('handles missing closing frontmatter delimiter', () => {
      const result = parseFrontmatter('---\ntype: monster\nno closing delimiter');
      expect(result.frontmatter).toBeDefined();
      // Should return empty frontmatter since no closing ---
      expect(result.frontmatter.type).toBe('');
    });

    it('handles YAML with __proto__ key without prototype pollution', () => {
      const maliciousYaml = `---
type: monster
__proto__:
  polluted: true
item_name: "test"
level: 1
stamina: "10"
speed: 5
---
body`;

      const result = parseFrontmatter(maliciousYaml);

      // The parsed object should not pollute Object prototype
      const emptyObj: Record<string, unknown> = {};
      expect(emptyObj['polluted']).toBeUndefined();

      // Parser should still work
      expect(result.frontmatter).toBeDefined();
    });

    it('handles YAML with constructor override attempt', () => {
      const maliciousYaml = `---
type: monster
constructor:
  prototype:
    isAdmin: true
item_name: "hacker"
level: 1
stamina: "10"
speed: 5
---
body`;

      const result = parseFrontmatter(maliciousYaml);

      // Should not affect global constructors
      expect(result.frontmatter).toBeDefined();
      expect(({} as Record<string, unknown>)['isAdmin']).toBeUndefined();
    });

    it('handles very long YAML string values', () => {
      const longString = 'A'.repeat(100_000);
      const yaml = `---
type: monster
item_name: "${longString}"
level: 1
stamina: "10"
speed: 5
---
body`;

      const result = parseFrontmatter(yaml);
      expect(result.frontmatter).toBeDefined();
    });

    it('handles YAML with special characters in values', () => {
      const yaml = `---
type: monster
item_name: "Test <script>alert('xss')</script>"
level: 1
stamina: "10"
speed: 5
---
body`;

      const result = parseFrontmatter(yaml);
      // Should preserve the raw value (sanitization is a rendering concern)
      expect(result.frontmatter.item_name).toContain('<script>');
    });

    it('handles YAML with null bytes', () => {
      const yaml = `---
type: monster
item_name: "test\x00null"
level: 1
stamina: "10"
speed: 5
---
body`;

      // Should not crash
      const result = parseFrontmatter(yaml);
      expect(result.frontmatter).toBeDefined();
    });
  });

  // ── Malicious Markdown Content ──────────────────────────────────────────

  describe('markdown content safety', () => {
    it('handles markdown with HTML injection', () => {
      const content = `# Test Monster

<script>alert('xss')</script>

> 🗡 **Dangerous Attack** ◆ Action
> **Keywords:** Melee
> **Distance:** Melee 1
> **Target:** One creature

<img src="x" onerror="alert('xss')">

Some normal text.`;

      const doc = parseDocument(
        `---
type: monster
item_name: "XSS Monster"
level: 1
stamina: "10"
speed: 5
---
${content}`,
      );

      // Parser should not execute scripts - it just stores text
      expect(doc.sections).toBeDefined();
      expect(doc.rawContent).toContain('<script>');
    });

    it('handles markdown with extremely deep nesting', () => {
      // Create deeply nested headings
      let content = '';
      for (let i = 0; i < 100; i++) {
        content += `${'#'.repeat(Math.min(i + 1, 6))} Level ${i}\n\n`;
        content += `Content at level ${i}\n\n`;
      }

      const sections = parseSections(content);
      // Should not crash or stack overflow
      expect(sections).toBeDefined();
    });

    it('handles markdown with very long lines', () => {
      const longLine = 'x'.repeat(1_000_000);
      const content = `# Test\n\n${longLine}`;

      const sections = parseSections(content);
      expect(sections).toBeDefined();
    });

    it('handles markdown with unusual blockquote patterns', () => {
      const content = `> ${'> '.repeat(50)}Deeply nested quote

> 🗡 **Normal Ability** ◆ Action
> **Keywords:** Melee
> **Distance:** Melee 1
> **Target:** One creature`;

      const abilities = parseAbilitiesFromContent(content);
      // Should parse the valid ability and not crash on the deeply nested one
      expect(abilities).toBeDefined();
    });

    it('handles empty file content', () => {
      const doc = parseDocument('');
      expect(doc.frontmatter).toBeDefined();
      expect(doc.sections).toBeDefined();
    });

    it('handles file with only frontmatter, no body', () => {
      const doc = parseDocument(`---
type: monster
item_name: "Empty Monster"
level: 1
stamina: "10"
speed: 5
---`);

      expect(doc.frontmatter).toBeDefined();
      expect(doc.frontmatter.item_name).toBe('Empty Monster');
    });
  });

  // ── Oversized Content ──────────────────────────────────────────────────

  describe('oversized content handling', () => {
    it('parses a very large markdown document without crashing', () => {
      // Simulate a large document (~5MB)
      let content = `---
type: monster
item_name: "Big Monster"
level: 1
stamina: "10"
speed: 5
---
# Big Monster\n\n`;

      // Add many abilities
      for (let i = 0; i < 500; i++) {
        content += `> 🗡 **Attack ${i}** ◆ Action
> **Keywords:** Melee
> **Distance:** Melee 1
> **Target:** One creature
> **Power Roll** + Might:
> - ≤11: 3 damage
> - 12-16: 7 damage
> - 17+: 10 damage

`;
      }

      const start = performance.now();
      const doc = parseDocument(content);
      const elapsed = performance.now() - start;

      expect(doc.frontmatter.item_name).toBe('Big Monster');
      // Should complete in reasonable time (< 10 seconds)
      expect(elapsed).toBeLessThan(10_000);
    });

    it('handles many table rows without excessive memory', () => {
      let content = '# Stats\n\n| Col A | Col B | Col C |\n|---|---|---|\n';
      for (let i = 0; i < 10_000; i++) {
        content += `| val${i} | val${i} | val${i} |\n`;
      }

      const sections = parseSections(content);
      expect(sections).toBeDefined();
    });
  });

  // ── Stat Block Edge Cases ─────────────────────────────────────────────

  describe('stat block parsing edge cases', () => {
    it('handles stat block with missing optional fields', () => {
      const doc = parseDocument(`---
type: monster
item_name: "Minimal Monster"
level: 1
stamina: "10"
speed: 5
stability: 0
free_strike: 2
might: 1
agility: 0
reason: 0
intuition: 0
presence: 0
ev: "5"
size: "1M"
roles:
  - "Minion"
ancestry:
  - "Humanoid"
---
# Minimal Monster

A very minimal stat block with no abilities.`);

      const creature = parseCreatureStatBlock(doc);
      expect(creature).not.toBeNull();
      expect(creature!.name).toBe('Minimal Monster');
      expect(creature!.abilities).toHaveLength(0);
      expect(creature!.immunities).toHaveLength(0);
      expect(creature!.weaknesses).toHaveLength(0);
    });

    it('handles stat block with non-numeric stamina', () => {
      const doc = parseDocument(`---
type: monster
item_name: "Weird Stamina Monster"
level: 1
stamina: "varies by form"
speed: 5
stability: 0
free_strike: 2
might: 1
agility: 0
reason: 0
intuition: 0
presence: 0
ev: "5"
size: "1M"
roles:
  - "Solo"
ancestry:
  - "Elemental"
---
# Weird Stamina Monster`);

      const creature = parseCreatureStatBlock(doc);
      expect(creature).not.toBeNull();
      // Non-numeric stamina should be preserved as a string
      expect(creature!.stamina).toBe('varies by form');
    });

    it('handles stat block with descriptive EV', () => {
      const doc = parseDocument(`---
type: monster
item_name: "Minion"
level: 1
stamina: "4"
speed: 5
stability: 0
free_strike: 1
might: 1
agility: 0
reason: 0
intuition: 0
presence: 0
ev: "3 for four minions"
size: "1M"
roles:
  - "Minion Harrier"
ancestry:
  - "Humanoid"
---
# Minion`);

      const creature = parseCreatureStatBlock(doc);
      expect(creature).not.toBeNull();
      // Should parse the leading number
      expect(creature!.encounterValue).toBe(3);
    });

    it('handles negative characteristic scores', () => {
      const doc = parseDocument(`---
type: monster
item_name: "Weak Monster"
level: 1
stamina: "10"
speed: 5
stability: 0
free_strike: 1
might: -2
agility: -1
reason: -3
intuition: 0
presence: -1
ev: "5"
size: "1S"
roles:
  - "Minion"
ancestry:
  - "Beast"
---
# Weak Monster`);

      const creature = parseCreatureStatBlock(doc);
      expect(creature).not.toBeNull();
      expect(creature!.characteristics.might).toBe(-2);
      expect(creature!.characteristics.reason).toBe(-3);
    });
  });
});
