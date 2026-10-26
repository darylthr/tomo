import { create } from 'zustand';
import type { Source } from '../../shared/model/types';
import { ServerError } from '../server/client';
import { getMaxSourcesInParallel, getSources } from '../server/api';

type State =
  | { state: 'idle' | 'loading'; sources: Source[]; limit: number; error: null }
  | { state: 'ready'; sources: Source[]; limit: number; error: null }
  | { state: 'error'; sources: Source[]; limit: number; error: string };

/** Installed sources, loaded once per session (Retry or a new server reloads them). */
export const useSources = create<State>()(() => ({ state: 'idle', sources: [], limit: 6, error: null }));

let inFlight: Promise<void> | null = null;

export function loadSources(force = false): Promise<void> {
  const { state } = useSources.getState();
  if (!force && (state === 'ready' || inFlight)) return inFlight ?? Promise.resolve();
  useSources.setState({ state: 'loading', error: null });
  inFlight = Promise.all([getSources(), getMaxSourcesInParallel()])
    .then(([sources, limit]) => useSources.setState({ state: 'ready', sources, limit, error: null }))
    .catch((e) =>
      useSources.setState({ state: 'error', error: e instanceof ServerError ? e.message : "Couldn't load your sources" }),
    )
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export const findSource = (id: string) => useSources.getState().sources.find((s) => s.id === id);
