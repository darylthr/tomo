import { create } from 'zustand';
import type { FeedEntry } from '../../shared/model/types';
import { useUi } from '../../shared/ui/uiStore';
import { useLibrary } from '../library/libraryStore';
import { collapseBatches, unreadCount } from './batches';
import { useUpdatesSeen } from './updatesSeen';
import { getLastUpdateTime, getUpdates, isLibraryUpdateRunning, startCategoryUpdate, startLibraryUpdate } from '../server/api';

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
  check: (opts?: { force?: boolean; category?: number }) => Promise<void>;
  /** Clears the badge: every update in the list counts as seen. The chapters keep their read state. */
  markAllRead: () => void;
};

let generation = 0;
let running: Promise<void> | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves when Suwayomi's update ends, or after 10 minutes, or after 3 failed polls in a row. */
async function waitWhileUpdating() {
  let failures = 0;
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);
    try {
      if (!(await isLibraryUpdateRunning())) return;
      failures = 0;
    } catch {
      // A dropped connection (Wi-Fi to cellular) shouldn't end the check on the spot.
      if (++failures >= 3) return;
    }
  }
}

export const useUpdates = create<UpdatesState>()((set, get) => {
  const runCheck = async (force: boolean, category?: number) => {
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
      let updated = false;
      try {
        const { running: started } = await (category === undefined ? startLibraryUpdate() : startCategoryUpdate([category]));
        if (started) await waitWhileUpdating();
        updated = true;
      } finally {
        // Whatever happened to the update, show what the server has now.
        await get().load();
      }
      // New chapters change the shelf's unread counts too.
      if (updated && useLibrary.getState().status !== 'idle') void useLibrary.getState().refresh();
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
    markAllRead: () => {
      const newest = new Map<number, number>();
      for (const e of get().entries) newest.set(e.title.id, Math.max(e.at, newest.get(e.title.id) ?? 0));
      for (const [titleId, at] of newest) useUpdatesSeen.getState().markSeen(titleId, at);
    },
    check: ({ force = false, category } = {}) => {
      running ??= runCheck(force || category !== undefined, category).finally(() => {
        running = null;
      });
      return running;
    },
  };
});

const refreshBadge = () =>
  useUi.setState({ updatesBadge: unreadCount(collapseBatches(useUpdates.getState().entries), useUpdatesSeen.getState().titles) });

useUpdates.subscribe((state, prev) => {
  if (state.entries !== prev.entries) refreshBadge();
});
useUpdatesSeen.subscribe(refreshBadge);

/** Opening a title (its page or its reader) counts as seeing its updates: they leave the badge. */
export function markTitleSeen(titleId: number) {
  const times = useUpdates.getState().entries.filter((e) => e.title.id === titleId).map((e) => e.at);
  if (times.length) useUpdatesSeen.getState().markSeen(titleId, Math.max(...times));
}
