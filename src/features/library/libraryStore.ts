import { create } from 'zustand';
import type { Category, Title } from '../../shared/model/types';
import { getLibrary } from '../server/api';
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
        if (gen === generation) set({ status: 'ready', titles, categories, error: null });
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
  };
});
