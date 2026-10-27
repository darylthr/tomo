import { z } from 'zod';
import { deleteMangaMeta, getMangaMeta, setMangaMeta } from '../server/api';

/** Page bookmarks live in the title's Suwayomi meta, so every device sees them. */
export const BOOKMARKS_KEY = 'tomo.bookmarks';
export const NOTE_MAX = 140;

const bookmarkSchema = z.object({
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

export function parseBookmarks(value: string | undefined): PageBookmark[] | 'unreadable' {
  if (value === undefined) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return 'unreadable';
  }
  if (!Array.isArray(raw)) return 'unreadable';
  return raw.flatMap((b) => {
    const parsed = bookmarkSchema.safeParse(b);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function readBookmarks(titleId: number): Promise<PageBookmark[]> {
  const list = parseBookmarks((await getMangaMeta(titleId))[BOOKMARKS_KEY]);
  if (list === 'unreadable') throw new BookmarksUnreadable();
  return list;
}

/**
 * Changes the bookmarks against what the server holds right now, so two devices adding bookmarks
 * minutes apart keep both. An empty list removes the key.
 */
export async function updateBookmarks(titleId: number, change: (list: PageBookmark[]) => PageBookmark[]): Promise<PageBookmark[]> {
  const next = change(await readBookmarks(titleId));
  if (next.length === 0) await deleteMangaMeta(titleId, BOOKMARKS_KEY);
  else await setMangaMeta(titleId, BOOKMARKS_KEY, JSON.stringify(next));
  return next;
}

export const newBookmarkId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
