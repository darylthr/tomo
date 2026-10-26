import type { FeedEntry } from '../../shared/model/types';
import { clockTime, dayLabel } from '../../shared/time/days';
import { chapterLabel } from '../../shared/ui/ListRow';
import { loadChapters } from '../library/continueReading';

/** History loads this far back, and "Show older" goes back this much more each time. */
export const HISTORY_STEP_MS = 90 * 86_400_000;

export type Hidden = { clearedAt: number; titles: Record<number, number> };

/** One entry per title: its most recently read chapter. Input newest first; output keeps that order. */
export function latestPerTitle(entries: FeedEntry[]): FeedEntry[] {
  const seen = new Set<number>();
  return entries.filter((e) => !seen.has(e.title.id) && Boolean(seen.add(e.title.id)));
}

/** Drops entries removed on this device; a title read again after its removal comes back. */
export function visible(entries: FeedEntry[], hidden: Hidden): FeedEntry[] {
  return entries.filter((e) => e.at > hidden.clearedAt && e.at > (hidden.titles[e.title.id] ?? 0));
}

/** The chapter Resume opens: this one if unfinished, else the next by source order, else this one. */
export async function resumeChapterId(entry: FeedEntry): Promise<number> {
  const { chapter } = entry;
  if (!chapter.read) return chapter.id;
  const chapters = await loadChapters(chapter.titleId);
  const next = chapters.filter((c) => c.order > chapter.order).sort((a, b) => a.order - b.order)[0];
  return next?.id ?? chapter.id;
}

/** "Ch. 12 · Page 4 of 24 · 14:05": the page part drops "of N" when the count is unknown. */
export function historyLine(entry: FeedEntry, now: number): string {
  const { chapter, at } = entry;
  const progress = chapter.read
    ? 'Read'
    : chapter.pageCount > 0
      ? `Page ${chapter.lastPage + 1} of ${chapter.pageCount}`
      : `Page ${chapter.lastPage + 1}`;
  const label = dayLabel(at, now);
  const when =
    label === 'Today' || label === 'Yesterday'
      ? clockTime(at)
      : new Date(at).toLocaleDateString('en-US', { weekday: 'short' });
  return `${chapterLabel(chapter)} · ${progress} · ${when}`;
}
