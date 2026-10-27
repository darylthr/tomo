import { create } from 'zustand';
import { getGlobalMetas, getHistory } from '../server/api';
import { addDays } from './stats';
import { mergeDevices, useReadingTime } from './readingTime';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type InsightsState = {
  status: Status;
  /** When each chapter finished in the last year was read (ms), with its title. */
  reads: { at: number; titleId: number }[];
  /** Seconds read per day across devices (this device only, if the server's copies can't be read). */
  seconds: Map<string, number>;
  load: () => Promise<void>;
};

let generation = 0;

/** Reading Insights data: chapters from Suwayomi's read history, time from every device's saved clock. */
export const useInsights = create<InsightsState>()((set) => ({
  status: 'idle',
  reads: [],
  seconds: new Map(),
  load: async () => {
    const gen = ++generation;
    set((s) => ({ status: s.status === 'ready' ? 'ready' : 'loading' }));
    const since = addDays(Date.now(), -371);
    const [history, metas] = await Promise.allSettled([(async () => getHistory(since))(), (async () => getGlobalMetas())()]);
    if (gen !== generation) return;
    if (history.status === 'rejected') {
      set({ status: 'error' });
      return;
    }
    const { deviceId, days } = useReadingTime.getState();
    set({
      status: 'ready',
      // Only finished chapters count; Suwayomi only dates a chapter when it's actually read in a reader.
      reads: history.value.filter((e) => e.chapter.read).map((e) => ({ at: e.at, titleId: e.title.id })),
      seconds: mergeDevices(metas.status === 'fulfilled' ? metas.value : [], deviceId, days),
    });
  },
}));
