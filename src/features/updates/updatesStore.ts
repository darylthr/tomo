import { create } from 'zustand';
import type { FeedEntry } from '../../shared/model/types';
import { useUi } from '../../shared/ui/uiStore';
import { useLibrary } from '../library/libraryStore';
import { getLastUpdateTime, getUpdates, isLibraryUpdateRunning, startLibraryUpdate } from '../server/api';

/** How far back Updates looks. */
export const UPDATES_WINDOW_MS = 90 * 86_400_000;
/** On app open, Tomo asks Suwayomi to check its sources only if the last check is older than this. */
export const STALE_AFTER_MS = 3_600_000;

const POLL_MS = 3000;
const MAX_POLLS = 200; // 10 minutes

type Status = 'idle' | 'loading' | 'ready' | 'error';

type UpdatesState = {
  status: Status;
  entries: FeedEntry[];
  /** True while Suwayomi is checking sources for new chapters. */
  checking: boolean;
  /** Refetches the list; an older request still running is ignored. */
  load: () => Promise<void>;
  /** Spec §10: checks on app open (when stale) and on pull-to-refresh (forced). Never throws. */
  check: (opts?: { force?: boolean }) => Promise<void>;
};

let generation = 0;
let running: Promise<void> | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitWhileUpdating() {
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);
    if (!(await isLibraryUpdateRunning())) return;
  }
}

export const useUpdates = create<UpdatesState>()((set, get) => {
  const runCheck = async (force: boolean) => {
    try {
      if (!force) {
        let last: number;
        try {
          last = await getLastUpdateTime();
        } catch {
          // An older or unreachable server: show what it already has, without starting a check.
          await get().load();
          return;
        }
        if (Date.now() - last < STALE_AFTER_MS) {
          await get().load();
          return;
        }
      }
      set({ checking: true });
      const { running: started } = await startLibraryUpdate();
      if (started) await waitWhileUpdating();
      await get().load();
      // New chapters change the shelf's unread counts too.
      if (useLibrary.getState().status !== 'idle') void useLibrary.getState().refresh();
    } catch {
      // The check is best effort; Updates shows its own load errors.
    } finally {
      set({ checking: false });
    }
  };

  return {
    status: 'idle',
    entries: [],
    checking: false,
    load: async () => {
      const gen = ++generation;
      set({ status: 'loading' });
      try {
        const entries = await getUpdates(Date.now() - UPDATES_WINDOW_MS);
        if (gen === generation) set({ status: 'ready', entries });
      } catch {
        if (gen === generation) set({ status: 'error' });
      }
    },
    check: ({ force = false } = {}) => {
      running ??= runCheck(force).finally(() => {
        running = null;
      });
      return running;
    },
  };
});

useUpdates.subscribe((state, prev) => {
  if (state.entries !== prev.entries)
    useUi.setState({ updatesBadge: state.entries.filter((e) => !e.chapter.read).length });
});
