import { describe, it, expect } from 'vitest';
import { parseSections } from '../parsers/section-parser.js';

describe('parseSections', () => {
  it('parses a flat list of sections', () => {
    const body = `# Section 1

Content for section 1.

# Section 2

Content for section 2.`;

    const sections = parseSections(body);
    expect(sections).toHaveLength(2);
    expect(sections[0]!.title).toBe('Section 1');
    expect(sections[0]!.level).toBe(1);
    expect(sections[0]!.content).toContain('Content for section 1');
    expect(sections[1]!.title).toBe('Section 2');
  });

  it('parses nested sections correctly', () => {
    const body = `# Top Level

## Subsection A

Content A.

## Subsection B

### Sub-sub B1

Deep content.

# Another Top`;

    const sections = parseSections(body);
    expect(sections).toHaveLength(2);

    // First top-level has 2 children
    expect(sections[0]!.title).toBe('Top Level');
    expect(sections[0]!.children).toHaveLength(2);
    expect(sections[0]!.children[0]!.title).toBe('Subsection A');
    expect(sections[0]!.children[1]!.title).toBe('Subsection B');

    // Subsection B has 1 child
    expect(sections[0]!.children[1]!.children).toHaveLength(1);
    expect(sections[0]!.children[1]!.children[0]!.title).toBe('Sub-sub B1');

    // Second top-level
    expect(sections[1]!.title).toBe('Another Top');
  });

  it('handles content before any heading', () => {
    const body = `Some preamble text.

# First Section

Section content.`;

    const sections = parseSections(body);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.title).toBe('First Section');
    expect(sections[0]!.content).toContain('Section content');
  });

  it('returns empty array for empty content', () => {
    const sections = parseSections('');
    expect(sections).toHaveLength(0);
  });

  it('handles heading levels from 1 to 6', () => {
    const body = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;

    const sections = parseSections(body);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.title).toBe('H1');
    expect(sections[0]!.children[0]!.title).toBe('H2');
    expect(sections[0]!.children[0]!.children[0]!.title).toBe('H3');
  });
});
