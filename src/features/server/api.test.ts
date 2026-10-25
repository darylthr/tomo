import { useSettings } from '../../shared/settings/store';
import aboutFixture from './__fixtures__/about.json';
import chaptersFixture from './__fixtures__/chapters-1.json';
import libraryFixture from './__fixtures__/library.json';
import pagesFixture from './__fixtures__/pages.json';
import { getAbout, getChapters, getLibrary, getPages, setInLibrary, setProgress } from './api';

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
