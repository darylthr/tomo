import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import styles from './ReaderPage.module.css';
import { useLongPress } from './useLongPress';
import { useReader } from './readerStore';

const NEAR = '300% 0px'; // mount images within about three screens of the viewport
const CURRENT_LINE = 0.4; // the page crossing 40% of the viewport height is the current one
const MAX_ZOOM = 3;
const DOUBLE_TAP_ZOOM = 2;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 24;
const CHROME_DELAY_MS = 250;

type Props = { nextChapter: (() => void) | null };

/** Webtoon mode: one continuous vertical strip; only pages near the viewport keep their image. */
export function WebtoonView({ nextChapter }: Props) {
  const pages = useReader((s) => s.pages);
  const index = useReader((s) => s.index);
  const bookmarkedPages = useReader((s) => s.bookmarkedPages);
  const chromeVisible = useReader((s) => s.chromeVisible);
  const scroller = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState<Set<number>>(() => new Set([index - 1, index, index + 1, index + 2]));
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const reported = useRef(index);
  const zoom = useStripZoom(scroller, pages);
  const press = useLongPress((p) => useReader.getState().openPageActions(p), () => useReader.getState().index);

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
      onClick={(e) => {
        if (!press.consumeClick()) zoom.onClick(e);
      }}
      onPointerDown={(e) => {
        press.onPointerDown(e);
        zoom.onPointerDown(e);
      }}
      onPointerMove={(e) => {
        // In webtoon a press that moves more than 10px is a scroll, not a long press.
        press.onPointerMove(e);
        zoom.onPointerMove(e);
      }}
      onPointerUp={(e) => {
        press.onPointerUp();
        zoom.onPointerUp(e);
      }}
      onPointerCancel={(e) => {
        press.onPointerCancel();
        zoom.onPointerUp(e);
      }}
      onContextMenu={press.onContextMenu}
    >
      <div className={styles.webtoonColumn} style={{ '--zoom': zoom.scale } as CSSProperties} data-webtoon-column="">
      {pages.map((src, i) => (
        <div key={src} data-page={i} className={styles.strip} style={{ aspectRatio: ratios[i] ?? 0.7 }}>
          {chromeVisible && bookmarkedPages.includes(i) && <span className={styles.pageRibbon} role="img" aria-label="Bookmarked page" />}
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
      </div>
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

/**
 * Webtoon zoom widens the strip (up to 3×) rather than transforming it, so the whole zoomed
 * strip stays scrollable. The point under the fingers or cursor stays put.
 */
function useStripZoom(scroller: React.RefObject<HTMLDivElement | null>, pages: string[]) {
  // Zoom belongs to the chapter it was made in: new pages read as 1× without an effect.
  const [state, setState] = useState({ pages, scale: 1 });
  const scale = state.pages === pages ? state.scale : 1;
  const scaleRef = useRef({ pages, scale: 1 });
  const currentScale = () => (scaleRef.current.pages === pages ? scaleRef.current.scale : 1);
  const anchor = useRef<{ px: number; py: number; ox: number; oy: number; k: number } | null>(null);
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null);
  const chromeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef(0);

  const zoomTo = (next: number, clientX: number, clientY: number) => {
    const root = scroller.current;
    const target = Math.min(MAX_ZOOM, Math.max(1, next));
    const was = currentScale();
    if (!root || target === was) return;
    const r = root.getBoundingClientRect();
    const ox = clientX - r.left;
    const oy = clientY - r.top;
    anchor.current = { px: root.scrollLeft + ox, py: root.scrollTop + oy, ox, oy, k: target / was };
    scaleRef.current = { pages, scale: target };
    setState(scaleRef.current);
  };

  // After the strip has its new width, scroll so the anchor point is back under the finger.
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    scroller.current?.scrollTo(a.px * a.k - a.ox, a.py * a.k - a.oy);
  }, [scale, scroller]);

  useEffect(() => () => clearTimeout(chromeTimer.current), []);

  // Ctrl/⌘ + wheel (and trackpad pinch); non-passive so the browser doesn't zoom the app.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomTo(currentScale() * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    };
    const stop = (e: Event) => e.preventDefault();
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('gesturestart', stop);
    return () => {
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('gesturestart', stop);
    };
  });

  const onClick = (e: MouseEvent) => {
    const prev = lastTap.current;
    const now = performance.now();
    clearTimeout(chromeTimer.current);
    if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DOUBLE_TAP_PX) {
      lastTap.current = null;
      zoomTo(currentScale() > 1 ? 1 : DOUBLE_TAP_ZOOM, e.clientX, e.clientY);
      return;
    }
    lastTap.current = { x: e.clientX, y: e.clientY, t: now };
    chromeTimer.current = setTimeout(() => useReader.getState().toggleChrome(), CHROME_DELAY_MS);
  };

  const onPointerDown = (e: PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) pinchDist.current = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length !== 2 || !pinchDist.current) return;
    const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    zoomTo(currentScale() * (dist / pinchDist.current), (a.x + b.x) / 2, (a.y + b.y) / 2);
    pinchDist.current = dist;
  };
  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = 0;
  };

  return { scale, onClick, onPointerDown, onPointerMove, onPointerUp };
}
