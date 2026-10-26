import type { FeedEntry } from '../../shared/model/types';

/** A fetch of more than this many chapters of one title shows as one row. */
export const BATCH_MIN = 10;
/** Chapters of one title found within this gap of each other came from the same fetch. */
const BATCH_GAP_MS = 60_000;

export type UpdateItem =
  | { kind: 'chapter'; entry: FeedEntry }
  /** A title's back catalogue, fetched in one go (a title added outside Tomo, say). */
  | { kind: 'batch'; title: FeedEntry['title']; entries: FeedEntry[]; at: number };

/** Collapses big single fetches into one item, kept where their newest chapter was. Expects newest first. */
export function collapseBatches(entries: FeedEntry[]): UpdateItem[] {
  const fetchOf = new Map<FeedEntry, FeedEntry[]>();
  const lastFetch = new Map<number, FeedEntry[]>();
  for (const e of entries) {
    let group = lastFetch.get(e.title.id);
    const prev = group?.[group.length - 1];
    if (!group || !prev || prev.at - e.at > BATCH_GAP_MS) {
      group = [];
      lastFetch.set(e.title.id, group);
    }
    group.push(e);
    fetchOf.set(e, group);
  }

  const items: UpdateItem[] = [];
  for (const e of entries) {
    const group = fetchOf.get(e)!;
    if (group.length <= BATCH_MIN) items.push({ kind: 'chapter', entry: e });
    else if (group[0] === e) items.push({ kind: 'batch', title: e.title, entries: group, at: e.at });
  }
  return items;
}

/** The badge count: unread chapters, with a batch counting once. */
export function unreadCount(items: UpdateItem[]): number {
  return items.filter((i) => (i.kind === 'chapter' ? !i.entry.chapter.read : i.entries.some((e) => !e.chapter.read))).length;
}
