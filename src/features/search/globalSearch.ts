import { create } from 'zustand';
import type { BrowseItem, BrowsePage, Source } from '../../shared/model/types';
import { browseSource, type BrowseRequest } from '../server/api';

export type SourceSearch = {
  /** waiting: queued behind other sources; searching: the request is out. */
  status: 'waiting' | 'searching' | 'done' | 'error';
  items: BrowseItem[];
  hasNextPage: boolean;
};

type State = { query: string; results: Record<string, SourceSearch> };

/** Global search across sources. Kept in memory so Back from a title shows the same results. */
export const useGlobalSearch = create<State>()(() => ({ query: '', results: {} }));

type Search = (req: BrowseRequest, signal?: AbortSignal) => Promise<BrowsePage>;

let controller: AbortController | null = null;

const patch = (id: string, value: Partial<SourceSearch>) =>
  useGlobalSearch.setState((s) => ({ results: { ...s.results, [id]: { ...s.results[id]!, ...value } } }));

async function searchOne(id: string, query: string, signal: AbortSignal, search: Search) {
  patch(id, { status: 'searching' });
  try {
    const page = await search({ sourceId: id, mode: 'search', page: 1, query }, signal);
    if (!signal.aborted) patch(id, { status: 'done', items: page.items, hasNextPage: page.hasNextPage });
  } catch {
    if (!signal.aborted) patch(id, { status: 'error' });
  }
}

/**
 * Searches every source for `query`, `limit` at a time (Suwayomi's MAX_SOURCES_IN_PARALLEL).
 * Each source's row updates as it answers. A new query cancels the old one; the same query
 * over the same sources keeps what's already there.
 */
export function startGlobalSearch(query: string, sources: Source[], limit: number, search: Search = browseSource) {
  const current = useGlobalSearch.getState();
  if (current.query === query && sources.every((s) => s.id in current.results)) return;

  controller?.abort();
  const run = new AbortController();
  controller = run;
  useGlobalSearch.setState({
    query,
    results: Object.fromEntries(sources.map((s) => [s.id, { status: 'waiting', items: [], hasNextPage: false }])),
  });

  let next = 0;
  const worker = async () => {
    while (next < sources.length && !run.signal.aborted) {
      await searchOne(sources[next++]!.id, query, run.signal, search);
    }
  };
  for (let i = 0; i < Math.min(Math.max(1, limit), sources.length); i++) void worker();
}

export function retryGlobalSource(id: string, search: Search = browseSource) {
  const { query, results } = useGlobalSearch.getState();
  if (!controller || !(id in results)) return;
  void searchOne(id, query, controller.signal, search);
}
