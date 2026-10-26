import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type HiddenState = {
  /** Everything read up to this time (ms) is hidden. */
  clearedAt: number;
  /** Per title: hidden while its latest read is at or before this time (ms). */
  titles: Record<number, number>;
  hide: (titleId: number, at: number) => void;
  clearAll: (now: number) => void;
};

/**
 * History comes from Suwayomi, which can't forget when a chapter was read, so Remove and
 * Clear all hide entries on this device only (owner's ruling, 2026-10-26).
 */
export const useHistoryHidden = create<HiddenState>()(
  persist(
    (set) => ({
      clearedAt: 0,
      titles: {},
      hide: (titleId, at) => set((s) => ({ titles: { ...s.titles, [titleId]: Math.max(at, s.titles[titleId] ?? 0) } })),
      clearAll: (now) => set({ clearedAt: now, titles: {} }),
    }),
    {
      name: 'tomo-history-hidden',
      partialize: ({ clearedAt, titles }) => ({ clearedAt, titles }),
    },
  ),
);
