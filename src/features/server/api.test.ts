import { useSettings } from '../../shared/settings/store';
import aboutFixture from './__fixtures__/about.json';
import chaptersFixture from './__fixtures__/chapters-1.json';
import libraryFixture from './__fixtures__/library.json';
import pagesFixture from './__fixtures__/pages.json';
import sourceFiltersFixture from './__fixtures__/source-filters.json';
import sourceMangaFixture from './__fixtures__/source-manga.json';
import sourcesFixture from './__fixtures__/sources.json';
import updatesFixture from './__fixtures__/updates.json';
import historyFixture from './__fixtures__/history.json';
import * as operations from './operations';
import { epochMs } from './mappers';
import {
  browseSource,
  fetchTitle,
  getAbout,
  getChapters,
  getHistory,
  getLastUpdateTime,
  getUpdates,
  isLibraryUpdateRunning,
  startLibraryUpdate,
  getLibrary,
  getMaxSourcesInParallel,
  getPages,
  getSourceFilters,
  getSources,
  setInLibrary,
  setProgress,
} from './api';

type Call = { query: string; variables: Record<string, unknown> };
let calls: Call[] = [];

function serve(byOperation: Record<string, unknown>) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Call;
      calls.push(body);
      const op = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? '';
      return new Response(JSON.stringify(byOperation[op] ?? { data: {} }));
    }),
  );
}

beforeEach(() => useSettings.getState().update({ server: { url: 'https://tomo.home' } }));
afterEach(() => vi.unstubAllGlobals());

it('reads the server version', async () => {
  serve({ ABOUT: aboutFixture });
  await expect(getAbout()).resolves.toEqual({ name: 'Suwayomi-Server', version: 'v2.1.0' });
});

it('maps the library to titles and categories', async () => {
  serve({ LIBRARY: libraryFixture });
  const { titles, categories } = await getLibrary();
  expect(titles).toHaveLength(3);
  expect(titles[0]).toMatchObject({
    id: 1,
    title: 'Blue Hour',
    coverUrl: 'https://tomo.home/api/v1/manga/1/thumbnail',
    status: 'ongoing',
    unread: 4,
    chapterCount: 3,
    categoryIds: [1],
    sourceName: 'MangaDex (EN)',
    artist: '',
  });
  expect(titles[1]!.status).toBe('completed');
  expect(titles[2]).toMatchObject({ status: 'hiatus', coverUrl: null, author: '', description: '', initialized: false });
  expect(categories.map((c) => c.name)).toEqual(['Default', 'Reading', 'Plan to read']);
});

it('returns chapters newest first with numeric dates', async () => {
  serve({ CHAPTERS: chaptersFixture });
  const chapters = await getChapters(1);
  expect(chapters.map((c) => c.order)).toEqual([3, 2, 1]);
  expect(chapters[1]).toMatchObject({ id: 11, titleId: 1, lastPage: 3, pageCount: 8, read: false, uploadedAt: 1792700000000 });
  expect(calls[0]!.variables).toEqual({ mangaId: 1 });
});

it('returns absolute page URLs', async () => {
  serve({ FETCH_PAGES: pagesFixture });
  const pages = await getPages(11);
  expect(pages).toHaveLength(8);
  expect(pages[0]).toBe('https://tomo.home/api/v1/manga/1/chapter/2/page/0');
  expect(calls[0]!.variables).toEqual({ chapterId: 11 });
});

it('sends the last page read', async () => {
  serve({});
  await setProgress(11, { lastPage: 4 });
  expect(calls[0]!.query).toContain('updateChapter');
  expect(calls[0]!.variables).toEqual({ id: 11, patch: { lastPageRead: 4 } });
});

it('marks a chapter read', async () => {
  serve({});
  await setProgress(11, { read: true });
  expect(calls[0]!.variables).toEqual({ id: 11, patch: { isRead: true } });
});

it('adds a title to the library', async () => {
  serve({});
  await setInLibrary(3, true);
  expect(calls[0]!.variables).toEqual({ id: 3, inLibrary: true });
});

it('sorts the library by title itself instead of relying on server ordering', async () => {
  const nodes = [...libraryFixture.data.mangas.nodes].reverse();
  serve({ LIBRARY: { data: { ...libraryFixture.data, mangas: { nodes } } } });
  const { titles } = await getLibrary();
  expect(titles.map((t) => t.title)).toEqual([...titles.map((t) => t.title)].sort((a, b) => a.localeCompare(b)));
  expect(calls[0]!.query).not.toMatch(/\border:/);
});

it('does not ask the server to order chapters', async () => {
  serve({ CHAPTERS: chaptersFixture });
  await getChapters(1);
  expect(calls[0]!.query).not.toMatch(/\border:/);
});

it('keeps progress saves alive while the page unloads', async () => {
  serve({ UPDATE_CHAPTER: { data: { updateChapter: { chapter: { id: 11 } } } } });
  await setProgress(11, { lastPage: 2 });
  const init = (vi.mocked(fetch).mock.calls[0] as unknown as [string, RequestInit])[1];
  expect(init.keepalive).toBe(true);
});

describe('Tomo metadata from the server job', () => {
  it('uses the matched cover, logo, display title and reading mode', async () => {
    serve({ LIBRARY: libraryFixture });
    const { titles } = await getLibrary();
    expect(titles.find((t) => t.id === 2)).toMatchObject({
      title: 'Kintsugi: Golden Seams',
      coverUrl: 'https://tomo.home/tomo-meta/2/cover.jpg',
      logoUrl: 'https://tomo.home/tomo-meta/2/logo.png',
      readingMode: 'webtoon',
    });
  });

  it('falls back to what the source gave when nothing was matched', async () => {
    serve({ LIBRARY: libraryFixture });
    const { titles } = await getLibrary();
    expect(titles.find((t) => t.id === 1)).toMatchObject({
      title: 'Blue Hour',
      coverUrl: 'https://tomo.home/api/v1/manga/1/thumbnail',
      logoUrl: null,
      bannerUrl: null,
      readingMode: null,
    });
  });

  it('asks for the metadata with every title', async () => {
    serve({ LIBRARY: libraryFixture });
    await getLibrary();
    expect(calls[0]!.query).toMatch(/meta\s*\{\s*key\s+value\s*\}/);
  });
});

describe('sources and browsing', () => {
  it('lists the Local source first as Home server, then sources by name', async () => {
    serve({ SOURCES: sourcesFixture });
    const sources = await getSources();
    expect(sources.map((s) => s.name)).toEqual(['Home server', 'Asura Scans', 'MANGA Plus by SHUEISHA', 'MangaDex']);
    expect(sources[0]).toMatchObject({ id: '0', isLocal: true, lang: '', version: '' });
    expect(sources[3]).toMatchObject({
      id: '2499283573021220255',
      lang: 'en',
      version: '1.4.190',
      supportsLatest: true,
      iconUrl: 'https://tomo.home/api/v1/extension/icon/tachiyomi-all.mangadex-v1.4.190.apk',
    });
  });

  it('maps a source filter list, groups included', async () => {
    serve({ SOURCE: sourceFiltersFixture });
    const filters = await getSourceFilters('2499283573021220255');
    expect(calls[0]!.variables).toEqual({ id: '2499283573021220255' });
    expect(filters.map((f) => f.type)).toEqual(['header', 'checkbox', 'select', 'sort', 'separator', 'text', 'group']);
    expect(filters[2]).toEqual({ type: 'select', name: 'Original language', values: ['All', 'Japanese', 'Korean', 'Chinese'], default: 0 });
    expect(filters[3]).toMatchObject({ type: 'sort', default: { index: 0, ascending: false } });
    expect(filters[6]).toMatchObject({ type: 'group', filters: [{ type: 'tristate', name: 'Action', default: 'ignore' }, {}, {}] });
  });

  it('browses popular titles without a query or filters', async () => {
    serve({ FETCH_SOURCE_MANGA: sourceMangaFixture });
    const page = await browseSource({ sourceId: '42', mode: 'popular', page: 1, query: 'ignored' });
    expect(calls[0]!.variables).toEqual({ input: { source: '42', type: 'POPULAR', page: 1 } });
    expect(page.hasNextPage).toBe(true);
    expect(page.items[0]).toEqual({ id: 1, title: 'Blue Hour', coverUrl: 'https://tomo.home/api/v1/manga/1/thumbnail', inLibrary: true });
    expect(page.items.find((i) => i.id === 2)?.title).toBe('Kintsugi: Golden Seams');
  });

  it('searches with a query and changed filters', async () => {
    serve({ FETCH_SOURCE_MANGA: sourceMangaFixture });
    await browseSource({ sourceId: '42', mode: 'search', page: 2, query: 'ferry', filters: [{ position: 1, checkBoxState: true }] });
    expect(calls[0]!.variables).toEqual({
      input: { source: '42', type: 'SEARCH', page: 2, query: 'ferry', filters: [{ position: 1, checkBoxState: true }] },
    });
  });

  it('reads how many sources can be searched at once, with a default', async () => {
    serve({ SERVER_SETTINGS: { data: { settings: { maxSourcesInParallel: 3 } } } });
    await expect(getMaxSourcesInParallel()).resolves.toBe(3);
    serve({ SERVER_SETTINGS: { errors: [{ message: "Cannot query field 'maxSourcesInParallel'" }] } });
    await expect(getMaxSourcesInParallel()).resolves.toBe(6);
  });

  it('fetches details for a title found while browsing', async () => {
    const manga = { ...libraryFixture.data.mangas.nodes[2], initialized: true, description: 'Fetched' };
    serve({ FETCH_MANGA: { data: { fetchManga: { manga } } } });
    const title = await fetchTitle(3);
    expect(calls[0]!.variables).toEqual({ id: 3 });
    expect(title).toMatchObject({ id: 3, description: 'Fetched', initialized: true });
  });
});

describe('updates, history and library update checks', () => {
  const OCT_1 = Date.UTC(2026, 9, 1);

  it('reads Suwayomi timestamps as milliseconds whether they come in seconds or not', () => {
    expect(epochMs('1761472800')).toBe(1761472800000);
    expect(epochMs(1761472800000)).toBe(1761472800000);
    expect(epochMs(null)).toBe(0);
    expect(epochMs(undefined)).toBe(0);
  });

  it('lists new library chapters newest first, with Tomo metadata on the titles', async () => {
    serve({ UPDATES: updatesFixture });
    const entries = await getUpdates(OCT_1);
    expect(entries.map((e) => e.chapter.id)).toEqual([12, 11, 32, 21, 20]);
    expect(entries[0]).toMatchObject({
      at: 1793008800000,
      title: { id: 1, title: 'Blue Hour', coverUrl: 'https://tomo.home/api/v1/manga/1/thumbnail', inLibrary: true },
    });
    expect(entries[3]!.title).toMatchObject({ title: 'Kintsugi: Golden Seams', coverUrl: 'https://tomo.home/tomo-meta/2/cover.jpg' });
    expect(entries[4]!.chapter).toMatchObject({ number: 11, read: true });
  });

  it('leaves out chapters found when a title was added to the library', async () => {
    serve({ UPDATES: updatesFixture });
    const entries = await getUpdates(OCT_1);
    expect(entries.some((e) => e.chapter.id === 31)).toBe(false);
  });

  it('asks for chapters found since a time in seconds, and drops older ones the server returns anyway', async () => {
    serve({ UPDATES: updatesFixture });
    const since = Date.UTC(2026, 9, 22);
    const entries = await getUpdates(since);
    expect(calls[0]!.variables).toEqual({ since: String(Math.floor(since / 1000)) });
    expect(entries.map((e) => e.chapter.id)).toEqual([12, 11, 32, 21]);
  });

  it('lists read chapters by when they were last read, including titles outside the library', async () => {
    serve({ HISTORY: historyFixture });
    const entries = await getHistory(OCT_1);
    expect(entries.map((e) => e.chapter.id)).toEqual([12, 11, 21, 40, 41]);
    expect(entries[0]).toMatchObject({ at: 1793008800000, chapter: { lastPage: 3, pageCount: 24 } });
    expect(entries[3]!.title).toEqual({ id: 4, title: 'Paper Moon', coverUrl: null, inLibrary: false });
  });

  it('reads when Suwayomi last checked for new chapters', async () => {
    serve({ LAST_UPDATE: { data: { lastUpdateTimestamp: { timestamp: '1793001600000' } } } });
    await expect(getLastUpdateTime()).resolves.toBe(1793001600000);
  });

  it('starts a library update and reports whether one is running', async () => {
    serve({
      UPDATE_LIBRARY: { data: { updateLibraryManga: { updateStatus: { isRunning: true } } } },
      UPDATE_STATUS: { data: { updateStatus: { isRunning: false } } },
    });
    await expect(startLibraryUpdate()).resolves.toEqual({ running: true });
    await expect(isLibraryUpdateRunning()).resolves.toBe(false);
  });

  it('never sends order arguments, which older servers reject', () => {
    for (const [name, doc] of Object.entries(operations)) {
      expect(doc, name).not.toMatch(/\border\s*:/);
    }
  });
});
