import { create } from 'zustand';
import type { Category, SortInfo, Title } from '../../shared/model/types';
import { getLibrary, getLibrarySortInfo } from '../server/api';
import { ServerError } from '../server/client';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type LibraryState = {
  status: Status;
  titles: Title[];
  categories: Category[];
  error: ServerError | null;
  /** Loads once; joins a load already running, and is a no-op once loaded. */
  load: () => Promise<void>;
  /** Always refetches from the server; an older request still running is ignored. */
  refresh: () => Promise<void>;
  patchTitle: (id: number, patch: Partial<Title>) => void;
  /** Dates for the date sorts; fetched on demand, refetched after a refresh. */
  sortInfo: SortInfo | null;
  /** unsupported: the server is too old to have these fields. error: try again on the next refresh. */
  sortInfoState: 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';
  loadSortInfo: () => Promise<void>;
};

let inflight: Promise<void> | null = null;
let generation = 0;

export const useLibrary = create<LibraryState>()((set, get) => {
  const fetchLibrary = () => {
    const gen = ++generation;
    set({ status: 'loading', error: null });
    const request = (async () => {
      try {
        const { titles, categories } = await getLibrary();
        // New titles or reads change the dates too; the shelf asks again if it needs them.
        if (gen === generation)
          set((s) => ({ status: 'ready', titles, categories, error: null, sortInfoState: s.sortInfoState === 'unsupported' ? 'unsupported' : 'idle' }));
      } catch (e) {
        if (gen === generation)
          set({ status: 'error', error: e instanceof ServerError ? e : new ServerError('server', String(e)) });
      } finally {
        if (gen === generation) inflight = null;
      }
    })();
    inflight = request;
    return request;
  };

  return {
    status: 'idle',
    titles: [],
    categories: [],
    error: null,
    load: () => (get().status === 'ready' ? Promise.resolve() : (inflight ?? fetchLibrary())),
    refresh: () => fetchLibrary(),
    patchTitle: (id, patch) => set((s) => ({ titles: s.titles.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    sortInfo: null,
    sortInfoState: 'idle',
    loadSortInfo: async () => {
      if (get().sortInfoState === 'loading') return;
      set({ sortInfoState: 'loading' });
      try {
        set({ sortInfo: await getLibrarySortInfo(), sortInfoState: 'ready' });
      } catch (e) {
        set({ sortInfoState: e instanceof ServerError && e.kind === 'version' ? 'unsupported' : 'error' });
      }
    },
  };
});
