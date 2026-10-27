import { create } from 'zustand';
import type { Chapter, ReaderMode } from '../../shared/model/types';

type ReaderState = {
  chapter: Chapter | null;
  pages: string[];
  /** The first page on screen. */
  index: number;
  /** How pages are grouped on screen (pairs in spreads, else one each). */
  layout: number[][];
  /** The pages on screen now: the layout entry holding `index`. */
  view: number[];
  /** This chapter's bookmarked pages (shown as a ribbon while the controls are up). */
  bookmarkedPages: number[];
  /** The page whose actions sheet (save, bookmark) is open. */
  pageActions: number | null;
  openPageActions: (page: number) => void;
  closePageActions: () => void;
  /** Regroups the pages (spreads on or off, sizes known), keeping the current page on screen. */
  setLayout: (layout: number[][]) => void;
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
const singles = (count: number) => Array.from({ length: count }, (_, i) => [i]);
const entryOf = (layout: number[][], page: number) => Math.max(0, layout.findIndex((e) => e.includes(page)));

export const useReader = create<ReaderState>()((set, get) => {
  const turnTo = (page: number) => {
    const s = get();
    const view = s.layout[entryOf(s.layout, clamp(page, 0, Math.max(0, s.pages.length - 1)))] ?? [0];
    const next = view[0] ?? 0;
    if (next === s.index) return;
    set({ index: next, view, chromeVisible: s.turned ? s.chromeVisible : false, turned: true });
  };
  return {
    chapter: null,
    pages: [],
    index: 0,
    layout: [],
    view: [0],
    pageActions: null,
    bookmarkedPages: [],
    openPageActions: (page) => set({ pageActions: page }),
    closePageActions: () => set({ pageActions: null }),
    mode: 'rtl',
    chromeVisible: true,
    turned: false,
    onChapterEnd: null,
    onChapterStart: null,
    open: (chapter, pages, startIndex, mode) => {
      const index = clamp(startIndex, 0, Math.max(0, pages.length - 1));
      set({
        chapter,
        pages,
        index,
        layout: singles(pages.length),
        view: [index],
        pageActions: null,
        mode,
        chromeVisible: true,
        turned: false,
      });
    },
    setLayout: (layout) =>
      set((s) => {
        const view = layout[entryOf(layout, s.index)] ?? [s.index];
        return { layout, view, index: view[0] ?? s.index };
      }),
    next: () => {
      const s = get();
      const e = entryOf(s.layout, s.index);
      if (e >= s.layout.length - 1) s.onChapterEnd?.();
      else turnTo(s.layout[e + 1]![0]!);
    },
    prev: () => {
      const s = get();
      const e = entryOf(s.layout, s.index);
      if (e <= 0) s.onChapterStart?.();
      else turnTo(s.layout[e - 1]![0]!);
    },
    goTo: (index) => turnTo(index),
    setMode: (mode) => set({ mode }),
    toggleChrome: () => set((s) => ({ chromeVisible: !s.chromeVisible })),
    setChrome: (visible) => set({ chromeVisible: visible }),
  };
});
