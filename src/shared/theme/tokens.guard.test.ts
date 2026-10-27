/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Every colour in a component stylesheet must come from the theme (spec: themes §5.1).
// The books' own faces are not themed by design.
// Vitest runs from the repo root.
const SRC = join(process.cwd(), 'src');
const EXEMPT = new Set(['features/library/shelf/Book.module.css']);
const FORBIDDEN = [
  'oklch(1 0 0',
  '0.008 280',
  '#050506',
  'var(--panel)',
  'var(--on-ink)',
  'var(--c-',
  '#ffb4b4',
  '#ffc879',
  '#8fe3a5',
  '#aab4ff',
];

function moduleSheets(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return moduleSheets(path);
    return name.endsWith('.module.css') ? [path] : [];
  });
}

it('keeps hard-coded colours out of every component stylesheet', () => {
  const sheets = moduleSheets(SRC);
  expect(sheets.length).toBeGreaterThan(20);
  const found: string[] = [];
  for (const path of sheets) {
    const file = relative(SRC, path).replaceAll('\\', '/');
    if (EXEMPT.has(file)) continue;
    const css = readFileSync(path, 'utf8');
    for (const literal of FORBIDDEN) if (css.includes(literal)) found.push(`${file}: ${literal}`);
  }
  expect(found).toEqual([]);
});
