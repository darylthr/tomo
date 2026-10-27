import { useCallback, useEffect, useState } from 'react';
import { BookmarksUnreadable, newBookmarkId, NOTE_MAX, readBookmarks, updateBookmarks, type PageBookmark } from './bookmarks';

type Status = 'loading' | 'ready' | 'unreadable' | 'error';

/** A title's page bookmarks, read from Suwayomi and changed read-modify-write. */
export function usePageBookmarks(titleId: number | null) {
  const [state, setState] = useState<{ titleId: number | null; status: Status; list: PageBookmark[] }>({ titleId, status: 'loading', list: [] });
  const [error, setError] = useState<string | null>(null);
  const current = state.titleId === titleId ? state : { titleId, status: 'loading' as Status, list: [] };

  useEffect(() => {
    if (titleId === null) return;
    let alive = true;
    readBookmarks(titleId)
      .then((list) => alive && setState({ titleId, status: 'ready', list }))
      .catch((e) => alive && setState({ titleId, status: e instanceof BookmarksUnreadable ? 'unreadable' : 'error', list: [] }));
    return () => {
      alive = false;
    };
  }, [titleId]);

  const change = useCallback(
    async (fn: (list: PageBookmark[]) => PageBookmark[]) => {
      if (titleId === null || current.status === 'unreadable') return;
      setError(null);
      try {
        const list = await updateBookmarks(titleId, fn);
        setState({ titleId, status: 'ready', list });
      } catch (e) {
        if (e instanceof BookmarksUnreadable) setState({ titleId, status: 'unreadable', list: [] });
        else setError("Couldn't save the bookmark");
      }
    },
    [titleId, current.status],
  );

  return {
    status: current.status,
    list: current.list,
    error,
    add: (chapterId: number, page: number) =>
      change((l) => (l.some((b) => b.chapterId === chapterId && b.page === page) ? l : [...l, { id: newBookmarkId(), chapterId, page, note: '', createdAt: Date.now() }])),
    remove: (id: string) => change((l) => l.filter((b) => b.id !== id)),
    setNote: (id: string, note: string) => change((l) => l.map((b) => (b.id === id ? { ...b, note: note.slice(0, NOTE_MAX) } : b))),
  };
}

export type PageBookmarks = ReturnType<typeof usePageBookmarks>;
