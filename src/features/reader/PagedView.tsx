import { useEffect, useRef } from 'react';
import { useSettings } from '../../shared/settings/store';
import styles from './ReaderPage.module.css';
import { useReader } from './readerStore';

const SWIPE_PX = 40;
const FLICK_PX_PER_MS = 0.3;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

/** One page at a time: Manga (right to left), Comic (left to right) or Vertical paged. */
export function PagedView() {
  const { pages, index, mode, next, prev, toggleChrome } = useReader();
  const fit = useSettings((s) => s.settings.reader.fit);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const swiped = useRef(false);
  const vertical = mode === 'vertical';

  // Keyboard: arrows follow the reading direction; Space / PageDown always go forward.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
      const { next: fwd, prev: back, mode: m } = useReader.getState();
      const map: Record<string, (() => void) | undefined> = {
        ' ': fwd,
        PageDown: fwd,
        PageUp: back,
        ArrowLeft: m === 'rtl' ? fwd : m === 'ltr' ? back : undefined,
        ArrowRight: m === 'rtl' ? back : m === 'ltr' ? fwd : undefined,
        ArrowDown: m === 'vertical' ? fwd : undefined,
        ArrowUp: m === 'vertical' ? back : undefined,
      };
      const action = map[e.key];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Preload the next two pages and the previous one.
  useEffect(() => {
    for (const i of [index + 1, index + 2, index - 1]) {
      const src = pages[i];
      if (src) new Image().src = src;
    }
  }, [pages, index]);

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const f = vertical ? fy : fx;
    if (f > 1 / 3 && f < 2 / 3) return toggleChrome();
    const early = f <= 1 / 3; // left third, or top third when vertical
    if (vertical) return early ? prev() : next();
    if (mode === 'rtl') return early ? next() : prev();
    return early ? prev() : next();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const d = vertical ? dy : dx;
    const across = vertical ? dx : dy;
    const fast = Math.abs(d) / Math.max(1, e.timeStamp - s.t) > FLICK_PX_PER_MS;
    if (Math.abs(d) < Math.abs(across) || (Math.abs(d) < SWIPE_PX && !fast) || Math.abs(d) < 12) return;
    swiped.current = true;
    // Content follows the finger: swiping toward the reading start reveals the next page.
    const forward = vertical ? d < 0 : mode === 'rtl' ? d > 0 : d < 0;
    if (forward) next();
    else prev();
  };

  const src = pages[index];
  return (
    <div
      className={`${styles.paged} ${styles[`fit-${fit}`]}`}
      data-reader-surface=""
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {src && (
        <img
          key={src}
          className={styles.page}
          src={src}
          alt={`Page ${index + 1} of ${pages.length}`}
          draggable={false}
          decoding="async"
        />
      )}
    </div>
  );
}
