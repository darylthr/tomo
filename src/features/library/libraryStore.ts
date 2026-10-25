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
  /** Loads once; a no-op while a load is already running or done. */
  load: () => Promise<void>;
  /** Always refetches from the server. */
  refresh: () => Promise<void>;
  patchTitle: (id: number, patch: Partial<Title>) => void;
};

let inflight: Promise<void> | null = null;

export const useLibrary = create<LibraryState>()((set, get) => {
  const fetchLibrary = () => {
    inflight ??= (async () => {
      set({ status: 'loading', error: null });
      try {
        const { titles, categories } = await getLibrary();
        set({ status: 'ready', titles, categories, error: null });
      } catch (e) {
        set({ status: 'error', error: e instanceof ServerError ? e : new ServerError('server', String(e)) });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };

  return {
    status: 'idle',
    titles: [],
    categories: [],
    error: null,
    load: () => (get().status === 'ready' ? Promise.resolve() : fetchLibrary()),
    refresh: () => fetchLibrary(),
    patchTitle: (id, patch) => set((s) => ({ titles: s.titles.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  };
});
