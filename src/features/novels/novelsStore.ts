import { create } from 'zustand';
import { db, type NovelRow } from '../../shared/db/db';
import type { Title } from '../../shared/model/types';
import { openEpub, type EpubBook } from './epub';
import { fetchFile } from './webdav';

/** Ids on the shelf: novels are the negative of their row id, so they never clash with Suwayomi's. */
export const novelTitleId = (rowId: number) => -rowId;
export const isNovelTitleId = (id: number) => id < 0;
export const novelRowId = (titleId: number) => -titleId;

export const bookKey = (id: number) => `novel:${id}`;
export const coverKey = (id: number) => `novel-cover:${id}`;

/** The file name without its folders and extension: the title until the book itself is read. */
export const titleFromPath = (path: string) =>
  (path.split('/').pop() ?? path)
    .replace(/\.[^.]+$/, '')
    .replace(/_+/g, ' ')
    .trim();

/** How far through the whole book, 0 to 1. */
export function overallProgress(n: Pick<NovelRow, 'spine' | 'fraction' | 'spineCount' | 'finished'>): number {
  if (n.finished) return 1;
  return n.spineCount > 0 ? Math.min(1, (n.spine + n.fraction) / n.spineCount) : 0;
}

/** A novel in the shape the shelf takes. */
export function novelToTitle(n: NovelRow, coverUrl: string | null): Title {
  const progress = overallProgress(n);
  return {
    id: novelTitleId(n.id),
    title: n.title,
    coverUrl,
    author: n.author,
    artist: '',
    description: '',
    genres: [],
    status: 'unknown',
    // Percent points stand in for chapters: "left" is how much of the book remains.
    unread: Math.round((1 - progress) * 100),
    chapterCount: 100,
    inLibrary: n.inLibrary,
    categoryIds: [],
    sourceName: 'Novel',
    initialized: true,
    logoUrl: null,
    bannerUrl: null,
    readingMode: null,
    kind: 'novel',
  };
}

const COVER_TYPES: [RegExp, string][] = [
  [/\.png$/i, 'image/png'],
  [/\.webp$/i, 'image/webp'],
  [/\.gif$/i, 'image/gif'],
  [/\.svg$/i, 'image/svg+xml'],
];
const coverType = (path: string) => COVER_TYPES.find(([re]) => re.test(path))?.[1] ?? 'image/jpeg';

type NovelsState = {
  loaded: boolean;
  rows: NovelRow[];
  /** Object URLs of the covers, by row id; kept for the session. */
  covers: Record<number, string>;
  load: () => Promise<void>;
  /** The row for a file of the share, made on first sight. */
  ensure: (file: { path: string; size: number }) => Promise<NovelRow>;
  /** Takes the title, author and cover from a book that was just opened. */
  describe: (id: number, book: EpubBook, data?: ArrayBuffer) => Promise<NovelRow>;
  /** Reads the book once for its title, author and cover (and keeps a copy when it's in the library). */
  hydrate: (id: number, signal?: AbortSignal) => Promise<NovelRow>;
  setInLibrary: (id: number, inLibrary: boolean) => Promise<void>;
  saveProgress: (id: number, progress: Pick<NovelRow, 'spine' | 'fraction' | 'finished'>) => Promise<void>;
};

let loading: Promise<void> | null = null;

const replace = (rows: NovelRow[], row: NovelRow) => (rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row]);

export const useNovels = create<NovelsState>()((set, get) => {
  const put = (row: NovelRow) => set((s) => ({ rows: replace(s.rows, row) }));
  const update = async (id: number, patch: Partial<NovelRow>) => {
    await db.novels.update(id, patch);
    const row = await db.novels.get(id);
    if (row) put(row);
    return row;
  };

  return {
    loaded: false,
    rows: [],
    covers: {},
    load: () =>
      (loading ??= (async () => {
        const rows = await db.novels.toArray();
        const covers: Record<number, string> = {};
        await Promise.all(
          rows
            .filter((r) => r.hasCover)
            .map(async (r) => {
              const stored = await db.blobs.get(coverKey(r.id));
              if (stored) covers[r.id] = URL.createObjectURL(new Blob([stored.bytes], { type: stored.type }));
            }),
        );
        set({ rows, covers, loaded: true });
      })().finally(() => {
        loading = null;
      })),
    ensure: async ({ path, size }) => {
      const existing = get().rows.find((r) => r.path === path) ?? (await db.novels.where('path').equals(path).first());
      if (existing) {
        put(existing);
        return existing;
      }
      const draft: Omit<NovelRow, 'id'> = {
        path,
        title: titleFromPath(path),
        author: '',
        size,
        inLibrary: false,
        addedAt: 0,
        spineCount: 0,
        spine: 0,
        fraction: 0,
        lastReadAt: 0,
        finished: false,
        hasCover: false,
      };
      const id = (await db.novels.add(draft as NovelRow)) as number;
      const row = { ...draft, id };
      put(row);
      return row;
    },
    describe: async (id, book, data) => {
      const row = get().rows.find((r) => r.id === id) ?? (await db.novels.get(id));
      if (!row) throw new Error('Unknown novel');
      const patch: Partial<NovelRow> = { spineCount: book.spine.length };
      if (book.title) patch.title = book.title;
      if (book.author) patch.author = book.author;
      const cover = book.coverPath && !row.hasCover ? book.bytes(book.coverPath) : undefined;
      if (cover && book.coverPath) {
        const type = coverType(book.coverPath);
        const bytes = cover.slice().buffer;
        await db.blobs.put({ key: coverKey(id), bytes, type, updatedAt: Date.now() });
        patch.hasCover = true;
        const url = URL.createObjectURL(new Blob([bytes], { type }));
        set((s) => ({ covers: { ...s.covers, [id]: url } }));
      }
      if (row.inLibrary && data) await db.blobs.put({ key: bookKey(id), bytes: data, type: 'application/epub+zip', updatedAt: Date.now() });
      return (await update(id, patch)) ?? row;
    },
    hydrate: async (id, signal) => {
      const row = get().rows.find((r) => r.id === id) ?? (await db.novels.get(id));
      if (!row) throw new Error('Unknown novel');
      const data = await fetchFile(row.path, signal);
      return get().describe(id, openEpub(data), data);
    },
    setInLibrary: async (id, inLibrary) => {
      await update(id, inLibrary ? { inLibrary, addedAt: Date.now() } : { inLibrary });
      // A copy is kept for offline reading only while the book is in the library.
      if (!inLibrary) await db.blobs.delete(bookKey(id));
    },
    saveProgress: async (id, progress) => {
      await update(id, { ...progress, lastReadAt: Date.now() });
    },
  };
});

/** The book's bytes: the kept copy when there is one, else from the share (and kept, if it's in the library). */
export async function loadBook(row: NovelRow, signal?: AbortSignal): Promise<ArrayBuffer> {
  const stored = await db.blobs.get(bookKey(row.id));
  if (stored) return stored.bytes;
  const data = await fetchFile(row.path, signal);
  if (row.inLibrary) await db.blobs.put({ key: bookKey(row.id), bytes: data, type: 'application/epub+zip', updatedAt: Date.now() });
  return data;
}
