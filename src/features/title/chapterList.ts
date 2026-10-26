import type { Chapter } from '../../shared/model/types';

/** How a title's chapter list is sorted and filtered. Kept per title on this device. */
export type ChapterView = {
  /** chapter: the source's reading order (places numberless extras too). uploaded: upload date. */
  sort: 'chapter' | 'uploaded';
  descending: boolean;
  unreadOnly: boolean;
  bookmarkedOnly: boolean;
  /** One chapter per number when several scanlation groups released it. */
  dedupe: boolean;
};

export const DEFAULT_VIEW: ChapterView = { sort: 'chapter', descending: true, unreadOnly: false, bookmarkedOnly: false, dedupe: false };

export const isDefaultView = (view: ChapterView) =>
  (Object.keys(DEFAULT_VIEW) as (keyof ChapterView)[]).every((k) => view[k] === DEFAULT_VIEW[k]);

const started = (c: Chapter) => c.read || c.lastPage > 0;

/** Of each set of chapters sharing a number: the one you started, else the main group's, else the first. */
function dedupe(chapters: Chapter[]): Chapter[] {
  const releases = new Map<string, number>();
  for (const c of chapters) if (c.scanlator) releases.set(c.scanlator, (releases.get(c.scanlator) ?? 0) + 1);
  const rank = (c: Chapter) => (started(c) ? 2 : 0) + (c.scanlator ? (releases.get(c.scanlator) ?? 0) / chapters.length : 0);

  const keep = new Map<number, Chapter>();
  for (const c of chapters) {
    if (c.number < 0) continue;
    const kept = keep.get(c.number);
    if (!kept || rank(c) > rank(kept)) keep.set(c.number, c);
  }
  return chapters.filter((c) => c.number < 0 || keep.get(c.number) === c);
}

export function arrangeChapters(chapters: Chapter[], view: ChapterView): Chapter[] {
  const key = view.sort === 'uploaded' ? (c: Chapter) => c.uploadedAt : (c: Chapter) => c.order;
  const dir = view.descending ? -1 : 1;
  let list = [...chapters].sort((a, b) => dir * (key(a) - key(b) || a.order - b.order));
  if (view.dedupe) list = dedupe(list);
  if (view.unreadOnly) list = list.filter((c) => !c.read);
  if (view.bookmarkedOnly) list = list.filter((c) => c.bookmarked);
  return list;
}
