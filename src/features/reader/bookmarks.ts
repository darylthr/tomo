import { z } from 'zod';
import { deleteMangaMeta, getMangaMeta, setMangaMeta } from '../server/api';

/** Page bookmarks live in the title's Suwayomi meta, so every device sees them. */
export const BOOKMARKS_KEY = 'tomo.bookmarks';
export const NOTE_MAX = 140;

// Loose: fields another client added ride along untouched.
const bookmarkSchema = z.looseObject({
  id: z.string().min(1),
  chapterId: z.number().int(),
  page: z.number().int().min(0),
  note: z.string().catch('').transform((n) => n.slice(0, NOTE_MAX)),
  createdAt: z.number().catch(0),
});
export type PageBookmark = z.infer<typeof bookmarkSchema>;

/** Thrown when the stored value can't be read: Tomo then never writes over it. */
export class BookmarksUnreadable extends Error {
  constructor() {
    super("Couldn't read this title's bookmarks");
    this.name = 'BookmarksUnreadable';
  }
}

/** The readable bookmarks, plus the raw entries that aren't, which writes put back as they were. */
function parseStored(value: string | undefined): { list: PageBookmark[]; other: unknown[] } | 'unreadable' {
  if (value === undefined) return { list: [], other: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return 'unreadable';
  }
  if (!Array.isArray(raw)) return 'unreadable';
  const list: PageBookmark[] = [];
  const other: unknown[] = [];
  for (const b of raw) {
    const parsed = bookmarkSchema.safeParse(b);
    if (parsed.success) list.push(parsed.data);
    else other.push(b);
  }
  return { list, other };
}

export function parseBookmarks(value: string | undefined): PageBookmark[] | 'unreadable' {
  const stored = parseStored(value);
  return stored === 'unreadable' ? stored : stored.list;
}

async function readStored(titleId: number) {
  const stored = parseStored((await getMangaMeta(titleId))[BOOKMARKS_KEY]);
  if (stored === 'unreadable') throw new BookmarksUnreadable();
  return stored;
}

export async function readBookmarks(titleId: number): Promise<PageBookmark[]> {
  return (await readStored(titleId)).list;
}

/**
 * Changes the bookmarks against what the server holds right now, so two devices adding bookmarks
 * minutes apart keep both. Nothing left at all removes the key.
 */
export async function updateBookmarks(titleId: number, change: (list: PageBookmark[]) => PageBookmark[]): Promise<PageBookmark[]> {
  const { list, other } = await readStored(titleId);
  const next = change(list);
  const stored = [...next, ...other];
  if (stored.length === 0) await deleteMangaMeta(titleId, BOOKMARKS_KEY);
  else await setMangaMeta(titleId, BOOKMARKS_KEY, JSON.stringify(stored));
  return next;
}

export const newBookmarkId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
