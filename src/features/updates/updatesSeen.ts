import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SeenState = {
  /** Per title: the newest update (ms, the server's clock) already seen by opening the title. */
  titles: Record<number, number>;
  /** Opening a title counts as seeing its updates: they leave the Updates badge. */
  markSeen: (titleId: number, newest: number) => void;
};

/** Kept on this device, like History's removals. Opening a title never touches its read state. */
export const useUpdatesSeen = create<SeenState>()(
  persist(
    (set) => ({
      titles: {},
      markSeen: (titleId, newest) => set((s) => (newest > (s.titles[titleId] ?? 0) ? { titles: { ...s.titles, [titleId]: newest } } : s)),
    }),
    { name: 'tomo-updates-seen', partialize: ({ titles }) => ({ titles }) },
  ),
);
