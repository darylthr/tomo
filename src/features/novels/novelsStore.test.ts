import { db } from '../../shared/db/db';
import { useSettings } from '../../shared/settings/store';
import { openEpub } from './epub';
import { bookKey, isNovelTitleId, loadBook, novelRowId, novelToTitle, overallProgress, titleFromPath, useNovels } from './novelsStore';
import { makeEpub } from './testEpub';

const bytes = () => makeEpub().slice().buffer;

beforeEach(async () => {
  await db.novels.clear();
  await db.blobs.clear();
  useNovels.setState({ loaded: false, rows: [], covers: {} });
  useSettings.getState().reset();
  useSettings.getState().update({ server: { webdavUrl: '/dav/' } });
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:cover/${++n}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

describe('ids and names', () => {
  it('keeps novels apart from Suwayomi titles with negative ids', () => {
    expect(novelRowId(-7)).toBe(7);
    expect(isNovelTitleId(-7)).toBe(true);
    expect(isNovelTitleId(7)).toBe(false);
  });

  it('names a file by its title until the book is read', () => {
    expect(titleFromPath('Light Novels/Re_Zero Vol 1.epub')).toBe('Re Zero Vol 1');
  });
});

describe('overallProgress', () => {
  it('counts chapters and the place in the current one', () => {
    expect(overallProgress({ spine: 1, fraction: 0.5, spineCount: 5, finished: false })).toBeCloseTo(0.3);
    expect(overallProgress({ spine: 0, fraction: 0, spineCount: 0, finished: false })).toBe(0);
    expect(overallProgress({ spine: 2, fraction: 0.1, spineCount: 5, finished: true })).toBe(1);
  });
});

describe('the store', () => {
  it('makes one row per file and keeps reading progress', async () => {
    const store = useNovels.getState();
    const a = await store.ensure({ path: 'Dune.epub', size: 10 });
    const again = await store.ensure({ path: 'Dune.epub', size: 10 });
    expect(again.id).toBe(a.id);
    expect(a).toMatchObject({ title: 'Dune', inLibrary: false, spine: 0, finished: false });

    await store.saveProgress(a.id, { spine: 2, fraction: 0.4, finished: false });
    expect((await db.novels.get(a.id))?.spine).toBe(2);
    expect(useNovels.getState().rows[0]).toMatchObject({ spine: 2, fraction: 0.4 });
    expect(useNovels.getState().rows[0]!.lastReadAt).toBeGreaterThan(0);
  });

  it('reloads rows and covers after a restart', async () => {
    const store = useNovels.getState();
    const a = await store.ensure({ path: 'Dune.epub', size: 10 });
    await store.describe(a.id, openEpub(bytes()));
    useNovels.setState({ loaded: false, rows: [], covers: {} });
    await useNovels.getState().load();
    expect(useNovels.getState().rows).toHaveLength(1);
    expect(useNovels.getState().covers[a.id]).toMatch(/^blob:cover\//);
  });

  it('takes title, author, chapters and cover from the book', async () => {
    const store = useNovels.getState();
    const a = await store.ensure({ path: 'x.epub', size: 1 });
    const row = await store.describe(a.id, openEpub(bytes()));
    expect(row).toMatchObject({ title: 'The Test Book', author: 'A. Writer', spineCount: 3, hasCover: true });
    expect(useNovels.getState().covers[a.id]).toBeTruthy();
    expect(await db.blobs.get(`novel-cover:${a.id}`)).toBeTruthy();
  });

  it('downloads and reads a book from the share when added to the library, and keeps a copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes())));
    const store = useNovels.getState();
    const a = await store.ensure({ path: 'x.epub', size: 1 });
    await store.setInLibrary(a.id, true);
    const row = await store.hydrate(a.id);
    expect(row).toMatchObject({ title: 'The Test Book', inLibrary: true });
    expect(await db.blobs.get(bookKey(a.id))).toBeTruthy();

    // Offline: the kept copy opens without the share.
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    expect(openEpub(await loadBook(row)).title).toBe('The Test Book');

    // Removing it from the library frees the copy.
    await store.setInLibrary(a.id, false);
    expect(await db.blobs.get(bookKey(a.id))).toBeUndefined();
  });

  it('shows a library novel on the shelf as a title with a negative id', async () => {
    const a = await useNovels.getState().ensure({ path: 'x.epub', size: 1 });
    await useNovels.getState().saveProgress(a.id, { spine: 1, fraction: 0, finished: false });
    await useNovels.getState().describe(a.id, openEpub(bytes()));
    const title = novelToTitle(useNovels.getState().rows[0]!, 'blob:c');
    expect(title).toMatchObject({ id: -a.id, kind: 'novel', title: 'The Test Book', author: 'A. Writer', coverUrl: 'blob:c', unread: 67 });
  });
});
