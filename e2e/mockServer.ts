import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '..', 'src', 'features', 'server', '__fixtures__');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(fixtures, name), 'utf8'));
const IMAGE = fs.readFileSync(path.join(here, 'fixtures', 'gradient.png'));

export type Call = { op: string; variables: Record<string, unknown> };
type Handler = unknown | ((variables: Record<string, unknown>) => unknown);

/** Default responses per GraphQL operation name, from the unit-test fixtures. */
function defaults(): Record<string, Handler> {
  return {
    ABOUT: read('about.json'),
    LIBRARY: read('library.json'),
    CHAPTERS: read('chapters-1.json'),
    FETCH_CHAPTERS: { data: { fetchChapters: { chapters: read('chapters-1.json').data.chapters.nodes } } },
    CHAPTER: (v: Record<string, unknown>) => {
      const nodes = read('chapters-1.json').data.chapters.nodes as { id: number }[];
      return { data: { chapter: nodes.find((n) => n.id === v.id) ?? nodes[0] } };
    },
    TITLE: (v: Record<string, unknown>) => {
      const nodes = read('library.json').data.mangas.nodes as { id: number }[];
      return { data: { manga: nodes.find((n) => n.id === v.id) ?? nodes[0] } };
    },
    FETCH_PAGES: read('pages.json'),
    UPDATE_CHAPTER: (v: Record<string, unknown>) => ({ data: { updateChapter: { chapter: { id: v.id, isRead: false, lastPageRead: 0 } } } }),
    UPDATE_MANGA: (v: Record<string, unknown>) => ({ data: { updateManga: { manga: { id: v.id, inLibrary: v.inLibrary } } } }),
  };
}

/**
 * Serves a fake Suwayomi on the page's own origin: GraphQL by operation name,
 * and every /api/v1 image (thumbnails, pages) as the gradient fixture.
 * Pass a number as an override to answer with that HTTP status instead.
 */
export async function mockSuwayomi(page: Page, overrides: Record<string, Handler | number> = {}) {
  const calls: Call[] = [];
  const handlers = { ...defaults(), ...overrides };
  await page.route('**/api/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query: string; variables?: Record<string, unknown> };
    const op = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? 'UNKNOWN';
    const variables = body.variables ?? {};
    calls.push({ op, variables });
    const handler = handlers[op];
    if (typeof handler === 'number') return route.fulfill({ status: handler, body: '<html>Bad Gateway</html>' });
    const json = typeof handler === 'function' ? (handler as (v: Record<string, unknown>) => unknown)(variables) : (handler ?? { data: {} });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: IMAGE }));
  return { calls };
}

/** Saves settings before the app boots (same shape the store persists). */
export async function seedSettings(page: Page, settings: Record<string, unknown>) {
  await page.addInitScript((s) => {
    localStorage.setItem('tomo.settings', JSON.stringify({ state: { settings: s }, version: 1 }));
  }, settings);
}
