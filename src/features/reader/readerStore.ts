import { create } from 'zustand';
import type { Chapter, ReaderMode } from '../../shared/model/types';

type ReaderState = {
  chapter: Chapter | null;
  pages: string[];
  index: number;
  mode: ReaderMode;
  chromeVisible: boolean;
  /** Whether the reader has turned a page since opening (the controls hide after the first turn). */
  turned: boolean;
  /** Set by the reader page: what to do past the last page / before the first. */
  onChapterEnd: (() => void) | null;
  onChapterStart: (() => void) | null;
  open: (chapter: Chapter, pages: string[], startIndex: number, mode: ReaderMode) => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  setMode: (mode: ReaderMode) => void;
  toggleChrome: () => void;
  setChrome: (visible: boolean) => void;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const useReader = create<ReaderState>()((set, get) => {
  const turnTo = (index: number) => {
    const s = get();
    const next = clamp(index, 0, Math.max(0, s.pages.length - 1));
    if (next === s.index) return;
    set({ index: next, chromeVisible: s.turned ? s.chromeVisible : false, turned: true });
  };
  return {
    chapter: null,
    pages: [],
    index: 0,
    mode: 'rtl',
    chromeVisible: true,
    turned: false,
    onChapterEnd: null,
    onChapterStart: null,
    open: (chapter, pages, startIndex, mode) =>
      set({
        chapter,
        pages,
        index: clamp(startIndex, 0, Math.max(0, pages.length - 1)),
        mode,
        chromeVisible: true,
        turned: false,
      }),
    next: () => {
      const s = get();
      if (s.index >= s.pages.length - 1) s.onChapterEnd?.();
      else turnTo(s.index + 1);
    },
    prev: () => {
      const s = get();
      if (s.index <= 0) s.onChapterStart?.();
      else turnTo(s.index - 1);
    },
    goTo: (index) => turnTo(index),
    setMode: (mode) => set({ mode }),
    toggleChrome: () => set((s) => ({ chromeVisible: !s.chromeVisible })),
    setChrome: (visible) => set({ chromeVisible: visible }),
  };
});
