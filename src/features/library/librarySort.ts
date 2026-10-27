import type { LibrarySettings } from '../../shared/settings/schema';
import type { SortInfo, Title } from '../../shared/model/types';

export type { SortInfo };
export type LibrarySort = LibrarySettings['sortBy'];

export const SORTS: { value: LibrarySort; label: string; directions: [desc: string, asc: string] }[] = [
  { value: 'title', label: 'Title', directions: ['Z–A', 'A–Z'] },
  { value: 'unread', label: 'Chapters left', directions: ['Most', 'Fewest'] },
  { value: 'chapters', label: 'Total chapters', directions: ['Most', 'Fewest'] },
  { value: 'lastRead', label: 'Last read', directions: ['Recent', 'Oldest'] },
  { value: 'latest', label: 'Latest chapter', directions: ['Newest', 'Oldest'] },
  { value: 'added', label: 'Date added', directions: ['Newest', 'Oldest'] },
];

export const needsInfo = (sort: LibrarySort) => sort === 'lastRead' || sort === 'latest' || sort === 'added';

/** Which way a sort starts when chosen: A–Z for titles, biggest or most recent first for the rest. */
export const naturalDescending = (sort: LibrarySort) => sort !== 'title';

const byTitle = (a: Title, b: Title) => a.title.localeCompare(b.title);

export function sortTitles(titles: Title[], sort: LibrarySort, descending: boolean, info: SortInfo | null): Title[] {
  if (sort === 'title') return [...titles].sort((a, b) => (descending ? -1 : 1) * byTitle(a, b));
  if (needsInfo(sort) && !info) return [...titles].sort(byTitle);

  const value = (t: Title): number => {
    switch (sort) {
      case 'unread':
        return t.unread;
      case 'chapters':
        return t.chapterCount;
      default: {
        const i = info?.get(t.id);
        return (sort === 'lastRead' ? i?.lastReadAt : sort === 'latest' ? i?.latestAt : i?.addedAt) ?? 0;
      }
    }
  };
  // Caught-up titles (for Chapters left) and titles without a date sit at the end in both directions.
  const last = (t: Title) => (sort === 'unread' || needsInfo(sort)) && value(t) === 0;
  return [...titles].sort(
    (a, b) => Number(last(a)) - Number(last(b)) || (descending ? value(b) - value(a) : value(a) - value(b)) || byTitle(a, b),
  );
}
