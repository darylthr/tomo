import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BrowseItem } from '../../shared/model/types';
import { browseSource, type BrowseRequest } from '../server/api';
import { ServerError } from '../server/client';

export type BrowseQuery = Omit<BrowseRequest, 'page'>;

type Entry = { items: BrowseItem[]; page: number; hasNextPage: boolean; scrollTop: number };

/** loading: first page; more: a later page; moreError: a later page failed (items stay). */
export type BrowseStatus = 'loading' | 'ready' | 'error' | 'more' | 'moreError';

type View = { key: string; status: BrowseStatus; entry: Entry; error: string | null };

// Browsed pages and scroll positions, kept for the session so Back from a title restores them.
const cache = new Map<string, Entry>();
const CACHE_LIMIT = 30;

export function clearBrowseCache() {
  cache.clear();
}

const EMPTY: Entry = { items: [], page: 0, hasNextPage: false, scrollTop: 0 };

function viewFor(key: string): View {
  const entry = cache.get(key);
  return entry ? { key, status: 'ready', entry, error: null } : { key, status: 'loading', entry: EMPTY, error: null };
}

function remember(key: string, entry: Entry) {
  cache.delete(key);
  cache.set(key, entry);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}

/** Pages through one source listing (popular, latest, or a search with filters). */
export function useBrowse(query: BrowseQuery) {
  const key = JSON.stringify([query.sourceId, query.mode, query.query ?? '', query.filters ?? []]);
  const queryRef = useRef(query);
  useLayoutEffect(() => {
    queryRef.current = query;
  });
  const controller = useRef<AbortController | null>(null);

  const [stored, setView] = useState<View>(() => viewFor(key));
  // A new listing replaces the old one in the same render, so stale items never flash.
  const view = stored.key === key ? stored : viewFor(key);
  if (stored.key !== key) setView(view);

  // Asks the source for a page; state only changes when it answers.
  const request = useCallback(
    (page: number) => {
      controller.current?.abort();
      const run = new AbortController();
      controller.current = run;
      browseSource({ ...queryRef.current, page }, run.signal)
        .then((res) => {
          if (run.signal.aborted) return;
          setView((v) => {
            if (v.key !== key) return v;
            const kept = page === 1 ? [] : v.entry.items;
            const seen = new Set(kept.map((i) => i.id));
            const fresh = res.items.filter((i) => !seen.has(i.id) && !!seen.add(i.id));
            // A page that adds nothing new would page forever (some sources repeat their last page).
            const hasNextPage = res.hasNextPage && (page === 1 || fresh.length > 0);
            const entry = { items: [...kept, ...fresh], page, hasNextPage, scrollTop: v.entry.scrollTop };
            remember(key, entry);
            return { key, status: 'ready', entry, error: null };
          });
        })
        .catch((e: unknown) => {
          if (run.signal.aborted) return;
          const error = e instanceof ServerError ? e.message : "Couldn't load this source";
          setView((v) => (v.key === key ? { ...v, status: page === 1 ? 'error' : 'moreError', error } : v));
        });
    },
    [key],
  );

  const fetchPage = (page: number) => {
    setView((v) => (v.key === key ? { ...v, status: page === 1 ? 'loading' : 'more', error: null } : v));
    request(page);
  };

  // A listing that isn't cached starts out loading, so the first request needs no state change.
  useEffect(() => {
    if (!cache.has(key)) request(1);
    return () => controller.current?.abort();
  }, [key, request]);

  const { status, entry, error } = view;
  return {
    /** Identifies the listing (source, mode, query, filters). */
    key,
    status,
    error,
    items: entry.items,
    hasNextPage: entry.hasNextPage,
    /** Where the grid was scrolled when this listing was last shown. */
    scrollTop: entry.scrollTop,
    loadMore: () => {
      if (status === 'ready' && entry.hasNextPage) fetchPage(entry.page + 1);
    },
    retry: () => fetchPage(status === 'moreError' ? entry.page + 1 : 1),
    saveScroll: (top: number) => {
      const cached = cache.get(key);
      if (cached) cached.scrollTop = top;
    },
  };
}
