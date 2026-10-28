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

type FeedNode = { fetchedAt: string; lastReadAt: string; manga: { inLibraryAt: string } };

/**
 * Moves a feed fixture's timestamps (epoch seconds) so its newest one was an hour ago,
 * keeping the gaps between them. Zero ("never") stays zero. Pass one `now` per mock, so the
 * times stay put across requests and reloads, as a real server's do.
 */
export function recent(json: { data: { chapters: { nodes: FeedNode[] } } }, now: number) {
  const nodes = json.data.chapters.nodes;
  const newest = Math.max(...nodes.flatMap((n) => [Number(n.fetchedAt), Number(n.lastReadAt)]));
  const shift = Math.floor(now / 1000) - 3600 - newest;
  const move = (v: string) => (Number(v) > 0 ? String(Number(v) + shift) : v);
  for (const n of nodes) {
    n.fetchedAt = move(n.fetchedAt);
    n.lastReadAt = move(n.lastReadAt);
    n.manga = { ...n.manga, inLibraryAt: move(n.manga.inLibraryAt) };
  }
  return json;
}

/** Default responses per GraphQL operation name, from the unit-test fixtures. */
function defaults(): Record<string, Handler> {
  const now = Date.now();
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
    MANGA_META: { data: { manga: { meta: [] } } },
    SET_MANGA_META: { data: { setMangaMeta: { meta: { key: 'tomo.bookmarks' } } } },
    UPDATE_CHAPTER: (v: Record<string, unknown>) => ({ data: { updateChapter: { chapter: { id: v.id, isRead: false, lastPageRead: 0 } } } }),
    UPDATE_CHAPTERS: { data: { updateChapters: { chapters: [] } } },
    UPDATE_MANGA: (v: Record<string, unknown>) => ({ data: { updateManga: { manga: { id: v.id, inLibrary: v.inLibrary } } } }),
    SOURCES: read('sources.json'),
    SOURCE: read('source-filters.json'),
    SERVER_SETTINGS: { data: { settings: { maxSourcesInParallel: 2 } } },
    FETCH_SOURCE_MANGA: read('source-manga.json'),
    UPDATES: () => recent(read('updates.json'), now),
    HISTORY: () => recent(read('history.json'), now),
    // Fresh by default, so opening the app doesn't start a library update in unrelated tests.
    LAST_UPDATE: () => ({ data: { lastUpdateTimestamp: { timestamp: String(Date.now()) } } }),
    UPDATE_LIBRARY: { data: { updateLibraryManga: { updateStatus: { isRunning: true } } } },
    UPDATE_STATUS: { data: { updateStatus: { isRunning: false } } },
    FETCH_MANGA: (v: Record<string, unknown>) => {
      const nodes = read('library.json').data.mangas.nodes as { id: number }[];
      return { data: { fetchManga: { manga: nodes.find((n) => n.id === v.id) ?? nodes[0] } } };
    },
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

export type DavFile = { path: string; body: Uint8Array };

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Serves a fake WebDAV share under /dav/ the way the home server's proxy does: it strips its own
 * prefix, so hrefs have none. PROPFIND lists a folder one level deep; GET returns a file.
 */
export async function mockDav(page: Page, files: DavFile[]) {
  const requests: { method: string; path: string }[] = [];
  await page.route('**/dav/**', async (route) => {
    const req = route.request();
    const rel = decodeURIComponent(new URL(req.url()).pathname.replace(/^\/dav\/?/, ''));
    requests.push({ method: req.method(), path: rel });
    if (req.method() === 'GET') {
      const file = files.find((f) => f.path === rel);
      return file
        ? route.fulfill({ status: 200, contentType: 'application/epub+zip', body: Buffer.from(file.body) })
        : route.fulfill({ status: 404, body: 'not found' });
    }
    const dir = rel === '' || rel.endsWith('/') ? rel : `${rel}/`;
    const inside = files.filter((f) => f.path.startsWith(dir) && f.path !== dir);
    if (!inside.length && dir !== '') return route.fulfill({ status: 404, body: 'not found' });
    const children = new Map<string, { folder: boolean; size: number }>();
    for (const f of inside) {
      const rest = f.path.slice(dir.length);
      const slash = rest.indexOf('/');
      if (slash < 0) children.set(rest, { folder: false, size: f.body.length });
      else children.set(`${rest.slice(0, slash)}/`, { folder: true, size: 0 });
    }
    const href = (p: string) => `/${p.split('/').map(encodeURIComponent).join('/')}`;
    const self = `<D:response><D:href>${href(dir)}</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`;
    const rows = [...children].map(
      ([name, c]) =>
        `<D:response><D:href>${escapeXml(href(dir + name))}</D:href><D:propstat><D:prop>${c.folder ? '<D:resourcetype><D:collection/></D:resourcetype>' : `<D:resourcetype/><D:getcontentlength>${c.size}</D:getcontentlength>`}</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`,
    );
    return route.fulfill({
      status: 207,
      contentType: 'application/xml; charset=utf-8',
      body: `<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:">${self}${rows.join('')}</D:multistatus>`,
    });
  });
  return { requests };
}
