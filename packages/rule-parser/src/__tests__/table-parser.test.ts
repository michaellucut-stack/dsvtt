import { describe, it, expect } from 'vitest';
import { parseTablesFromContent } from '../parsers/table-parser.js';

describe('parseTablesFromContent', () => {
  it('parses a simple 2-column table', () => {
    const content = `
###### Advancement Table

| Level | Feature |
| --- | --- |
| 1 | Base Class |
| 2 | Subclass |
| 3 | Advanced Feature |
`;

    const tables = parseTablesFromContent(content);
    expect(tables).toHaveLength(1);

    const table = tables[0]!;
    expect(table.title).toBe('Advancement Table');
    expect(table.headers).toEqual(['Level', 'Feature']);
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0]).toEqual(['1', 'Base Class']);
    expect(table.rows[1]).toEqual(['2', 'Subclass']);
    expect(table.rows[2]).toEqual(['3', 'Advanced Feature']);
  });

  it('parses a table with bold and HTML formatting', () => {
    const content = `
| **Size** | **Speed** | **Stamina** |
| --- | --- | --- |
| **1M**<br/> Medium | **5** | **20** |
`;

    const tables = parseTablesFromContent(content);
    expect(tables).toHaveLength(1);

    const table = tables[0]!;
    expect(table.headers).toEqual(['Size', 'Speed', 'Stamina']);
    expect(table.rows[0]![0]).toBe('1M  Medium');
    expect(table.rows[0]![1]).toBe('5');
    expect(table.rows[0]![2]).toBe('20');
  });

  it('returns empty array for content without tables', () => {
    const content = `# Heading

Just a paragraph without any tables.

- Bullet 1
- Bullet 2`;

    const tables = parseTablesFromContent(content);
    expect(tables).toHaveLength(0);
  });

  it('parses multiple tables in the same content', () => {
    const content = `
###### Table 1

| A | B |
| --- | --- |
| 1 | 2 |

Some text between tables.

###### Table 2

| X | Y | Z |
| --- | --- | --- |
| a | b | c |
`;

    const tables = parseTablesFromContent(content);
    expect(tables).toHaveLength(2);

    expect(tables[0]!.title).toBe('Table 1');
    expect(tables[0]!.headers).toEqual(['A', 'B']);
    expect(tables[0]!.rows).toHaveLength(1);

    expect(tables[1]!.title).toBe('Table 2');
    expect(tables[1]!.headers).toEqual(['X', 'Y', 'Z']);
    expect(tables[1]!.rows).toHaveLength(1);
  });

  it('handles table with center-aligned separator', () => {
    const content = `
| Col1 | Col2 |
| :---: | :---: |
| val1 | val2 |
`;

    const tables = parseTablesFromContent(content);
    expect(tables).toHaveLength(1);
    expect(tables[0]!.rows[0]).toEqual(['val1', 'val2']);
  });
});
