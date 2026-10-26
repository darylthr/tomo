import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_VIEW, isDefaultView, type ChapterView } from './chapterList';

type ViewsState = {
  /** Only titles whose view differs from the default. */
  views: Record<number, ChapterView>;
  setView: (titleId: number, view: ChapterView) => void;
};

/** Each title's chapter sort and filters, on this device. */
export const useChapterViews = create<ViewsState>()(
  persist(
    (set) => ({
      views: {},
      setView: (titleId, view) =>
        set((s) => {
          const views = { ...s.views };
          if (isDefaultView(view)) delete views[titleId];
          else views[titleId] = view;
          return { views };
        }),
    }),
    { name: 'tomo-chapter-views', partialize: ({ views }) => ({ views }) },
  ),
);

export const useChapterView = (titleId: number): ChapterView => useChapterViews((s) => s.views[titleId] ?? DEFAULT_VIEW);
