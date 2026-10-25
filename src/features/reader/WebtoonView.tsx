import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './ReaderPage.module.css';
import { useReader } from './readerStore';

const NEAR = '300% 0px'; // mount images within about three screens of the viewport
const CURRENT_LINE = 0.4; // the page crossing 40% of the viewport height is the current one

type Props = { nextChapter: (() => void) | null };

/** Webtoon mode: one continuous vertical strip; only pages near the viewport keep their image. */
export function WebtoonView({ nextChapter }: Props) {
  const pages = useReader((s) => s.pages);
  const index = useReader((s) => s.index);
  const scroller = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState<Set<number>>(() => new Set([index - 1, index, index + 1, index + 2]));
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const reported = useRef(index);

  // Track which pages are near the viewport.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) =>
        setNear((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const i = Number((e.target as HTMLElement).dataset.page);
            if (e.isIntersecting) next.add(i);
            else next.delete(i);
          }
          return next;
        }),
      { root, rootMargin: NEAR },
    );
    root.querySelectorAll('[data-page]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pages]);

  // Start at the resume page.
  useLayoutEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-page="${useReader.getState().index}"]`);
    el?.scrollIntoView({ block: 'start' });
  }, [pages]);

  // A jump from the scrubber scrolls there; our own scroll reports don't.
  useEffect(() => {
    if (index === reported.current) return;
    reported.current = index;
    scroller.current?.querySelector<HTMLElement>(`[data-page="${index}"]`)?.scrollIntoView({ block: 'start' });
  }, [index]);

  const onScroll = () => {
    const root = scroller.current;
    if (!root) return;
    // Scrolled to the end: a short last page may never cross the current line, so count it here.
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2 && pages.length) {
      const last = pages.length - 1;
      if (useReader.getState().index !== last) {
        reported.current = last;
        useReader.getState().goTo(last);
      }
      return;
    }
    const line = root.getBoundingClientRect().top + root.clientHeight * CURRENT_LINE;
    for (const el of root.querySelectorAll<HTMLElement>('[data-page]')) {
      const r = el.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) {
        const i = Number(el.dataset.page);
        if (i !== useReader.getState().index) {
          reported.current = i;
          useReader.getState().goTo(i);
        }
        break;
      }
    }
  };

  return (
    <div
      ref={scroller}
      className={styles.webtoon}
      data-reader-surface=""
      onScroll={onScroll}
      onClick={() => useReader.getState().toggleChrome()}
    >
      {pages.map((src, i) => (
        <div key={src} data-page={i} className={styles.strip} style={{ aspectRatio: ratios[i] ?? 0.7 }}>
          {near.has(i) && (
            <img
              src={src}
              alt={`Page ${i + 1} of ${pages.length}`}
              draggable={false}
              decoding="async"
              onLoad={(e) => {
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                if (w && h) setRatios((r) => (r[i] ? r : { ...r, [i]: w / h }));
              }}
            />
          )}
        </div>
      ))}
      <div className={styles.stripEnd}>
        {nextChapter ? (
          <button
            type="button"
            className={styles.endButton}
            onClick={(e) => {
              e.stopPropagation();
              // Finishing the strip marks it read before moving on.
              reported.current = pages.length - 1;
              useReader.getState().goTo(pages.length - 1);
              nextChapter();
            }}
          >
            Next chapter
          </button>
        ) : (
          <p>You're all caught up.</p>
        )}
      </div>
    </div>
  );
}
