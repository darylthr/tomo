import type { Chapter } from '../../shared/model/types';
import { setProgress } from '../server/api';

export type ProgressPatch = { lastPage?: number; read?: boolean };
type Send = (chapterId: number, patch: ProgressPatch) => Promise<void>;

const DEBOUNCE_MS = 800;

/** Where to start: the saved page for an unfinished chapter, otherwise the first page. */
export function startPage(chapter: Pick<Chapter, 'read' | 'lastPage'>, pageCount: number): number {
  return !chapter.read && chapter.lastPage > 0 && chapter.lastPage < pageCount ? chapter.lastPage : 0;
}

let saving: Promise<unknown> = Promise.resolve();

/** Resolves once every progress save already started has finished (or failed). */
export function savesSettled(): Promise<void> {
  return saving.then(() => undefined);
}

/**
 * Saves the reading position to Suwayomi. Page turns are debounced; reaching the last page
 * marks the chapter read straight away (once). Pending pages are saved when the app is hidden,
 * the page is left, or the sync is disposed. A failed save stays pending for the next flush.
 */
export function createProgressSync(chapterId: number, pageCount: number, send: Send = setProgress, initialPage = -1) {
  let lastSent = initialPage;
  let pending: { page: number; read: boolean } | null = null;
  let readDone = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = (): Promise<void> => {
    clearTimeout(timer);
    if (!pending) return Promise.resolve();
    const job = pending;
    pending = null;
    lastSent = job.page;
    if (job.read) readDone = true;
    const request = send(chapterId, job.read ? { lastPage: job.page, read: true } : { lastPage: job.page }).catch(() => {
      if (job.read) readDone = false;
      if (pending) pending.read ||= job.read;
      else pending = job;
      lastSent = -1;
    });
    saving = Promise.allSettled([saving, request]);
    return request;
  };

  const pageChanged = (index: number) => {
    clearTimeout(timer);
    if (index === pageCount - 1 && !readDone) {
      pending = { page: index, read: true };
      void flush();
      return;
    }
    const read = pending?.read ?? false;
    if (index === lastSent && !read) {
      pending = null;
      return;
    }
    pending = { page: index, read };
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
