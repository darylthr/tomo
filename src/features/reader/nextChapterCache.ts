import { getPages } from '../server/api';

/** One chapter's page list fetched ahead of time, with its first images warmed. */
let entry: { chapterId: number; pages: Promise<string[]> } | null = null;

export function prefetchChapter(chapterId: number): void {
  if (entry?.chapterId === chapterId) return;
  const pages = getPages(chapterId);
  entry = { chapterId, pages };
  pages
    .then((list) => list.slice(0, 2).forEach((src) => (new Image().src = src)))
    .catch(() => {
      if (entry?.chapterId === chapterId) entry = null;
    });
}

/** The prefetched page list for this chapter (once), or undefined to fetch it now. */
export function takePrefetched(chapterId: number): Promise<string[]> | undefined {
  if (entry?.chapterId !== chapterId) return undefined;
  const { pages } = entry;
  entry = null;
  return pages;
}
