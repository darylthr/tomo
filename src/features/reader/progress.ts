import type { Chapter } from '../../shared/model/types';
import { setProgress } from '../server/api';

export type ProgressPatch = { lastPage?: number; read?: boolean };
type Send = (chapterId: number, patch: ProgressPatch) => Promise<void>;

const DEBOUNCE_MS = 800;

/** Where to start: the saved page for an unfinished chapter, otherwise the first page. */
export function startPage(chapter: Pick<Chapter, 'read' | 'lastPage'>, pageCount: number): number {
  return !chapter.read && chapter.lastPage > 0 && chapter.lastPage < pageCount ? chapter.lastPage : 0;
}

/**
 * Saves the reading position to Suwayomi. Page turns are debounced; reaching the last page
 * marks the chapter read straight away (once). Pending pages are saved when the app is hidden,
 * the page is left, or the sync is disposed.
 */
export function createProgressSync(chapterId: number, pageCount: number, send: Send = setProgress, initialPage = -1) {
  let lastSent = initialPage;
  let pending: number | null = null;
  let readSent = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const post = (patch: ProgressPatch) => send(chapterId, patch).catch(() => {});

  const flush = (): Promise<void> => {
    clearTimeout(timer);
    if (pending === null) return Promise.resolve();
    const page = pending;
    pending = null;
    lastSent = page;
    return post({ lastPage: page });
  };

  const pageChanged = (index: number) => {
    if (index === pageCount - 1 && !readSent) {
      clearTimeout(timer);
      pending = null;
      readSent = true;
      lastSent = index;
      void post({ lastPage: index, read: true });
      return;
    }
    clearTimeout(timer);
    if (index === lastSent) {
      pending = null;
      return;
    }
    pending = index;
    timer = setTimeout(() => void flush(), DEBOUNCE_MS);
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void flush();
  };
  const onPageHide = () => void flush();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);

  return {
    pageChanged,
    flush,
    dispose() {
      void flush();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    },
  };
}
