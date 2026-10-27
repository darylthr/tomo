import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLongPress } from './useLongPress';
import { useZoom } from './useZoom';
import { useSettings } from '../../shared/settings/store';
import styles from './ReaderPage.module.css';
import { useReader } from './readerStore';

const SWIPE_PX = 40;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 24;
const CHROME_DELAY_MS = 250;
const FLICK_PX_PER_MS = 0.3;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

/** One page at a time: Manga (right to left), Comic (left to right) or Vertical paged. */
export function PagedView() {
  const { pages, index, view, mode, next, prev, toggleChrome, openPageActions, bookmarkedPages, chromeVisible } = useReader();
  const press = useLongPress(openPageActions, () => useReader.getState().view[0] ?? 0);
  const fit = useSettings((s) => s.settings.reader.fit);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const swiped = useRef(false);
  const vertical = mode === 'vertical';
  const surfaceRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  // Content pushed toward the reading start reveals the next page (as with a swipe).
  const forwardFrom = (dx: number, dy: number) => (vertical ? dy < 0 : mode === 'rtl' ? dx > 0 : dx < 0);
  const zoom = useZoom({
    ref: surfaceRef,
    max: 4,
    doubleTap: 2.5,
    resetKey: `${index}:${mode}`,
    measure: () => measurePage(surfaceRef.current, layerRef.current, fit),
    onEdgeTurn: (dx, dy) => (forwardFrom(dx, dy) ? next() : prev()),
  });
  // A centre tap waits this long for a second tap before showing or hiding the controls.
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null);
  const chromeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(chromeTimer.current), []);

  // Keyboard: arrows follow the reading direction; Space / PageDown always go forward.
  // Layout effect so the keys work as soon as the first page is on screen.
  useLayoutEffect(() => {
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
    if (press.consumeClick()) return;
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const f = vertical ? fy : fx;
    const centre = f > 1 / 3 && f < 2 / 3;
    if (centre || zoom.zoomed) {
      const prevTap = lastTap.current;
      const now = performance.now();
      if (prevTap && now - prevTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) < DOUBLE_TAP_PX) {
        lastTap.current = null;
        clearTimeout(chromeTimer.current);
        return zoom.toggleAt(e.clientX, e.clientY);
      }
      lastTap.current = { x: e.clientX, y: e.clientY, t: now };
      clearTimeout(chromeTimer.current);
      chromeTimer.current = setTimeout(toggleChrome, CHROME_DELAY_MS);
      return;
    }
    const early = f <= 1 / 3; // left third, or top third when vertical
    if (vertical) return early ? prev() : next();
    if (mode === 'rtl') return early ? next() : prev();
    return early ? prev() : next();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    press.onPointerDown(e);
    zoom.handlers.onPointerDown(e);
    if (zoom.zoomed || zoom.isGesturing()) {
      start.current = null;
      return;
    }
    // Touch swipes are not followed by a click, so a new press starts fresh.
    swiped.current = false;
    start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    press.onPointerUp();
    zoom.handlers.onPointerUp(e);
    if (press.consumeClick()) {
      // The long press already acted; it isn't also a swipe or a tap.
      start.current = null;
      swiped.current = true;
      return;
    }
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

  // Reading order on screen: in Manga the earlier page of a spread sits on the right.
  const shown = mode === 'rtl' ? [...view].reverse() : view;
  return (
    <div
      className={`${styles.paged} ${vertical ? styles.pagedVertical : ''} ${styles[`fit-${fit}`]}`}
      data-reader-surface=""
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={(e) => {
        press.onPointerMove(e);
        zoom.handlers.onPointerMove(e);
      }}
      onContextMenu={press.onContextMenu}
      onPointerCancel={(e) => {
        press.onPointerCancel();
        zoom.handlers.onPointerCancel(e);
        start.current = null;
      }}
      ref={surfaceRef}
    >
      <div ref={layerRef} className={styles.zoomLayer} style={zoom.style} data-zoom-layer="">
        <div className={view.length > 1 ? styles.spread : styles.single}>
          {shown.map((i) =>
            pages[i] ? (
              <img
                key={pages[i]}
                className={styles.page}
                src={pages[i]}
                alt={`Page ${i + 1} of ${pages.length}`}
                data-page={i}
                draggable={false}
                decoding="async"
              />
            ) : null,
          )}
          {chromeVisible && shown.some((i) => bookmarkedPages.includes(i)) && (
            <span className={styles.pageRibbon} role="img" aria-label="Bookmarked page" />
          )}
        </div>
      </div>
    </div>
  );
}

/** The surface's box and the page's on-screen size at 1×, for clamping a pan to the page's edges. */
function measurePage(surface: HTMLElement | null, layer: HTMLElement | null, fit: string) {
  const r = surface?.getBoundingClientRect();
  const box = { w: r?.width || 1, h: r?.height || 1 };
  const img = layer?.querySelector('img');
  if (!img?.naturalWidth || !img.naturalHeight) return { box, content: box };
  const ratio = img.naturalWidth / img.naturalHeight;
  if (fit === 'width') {
    const w = img.clientWidth || box.w;
    return { box, content: { w, h: w / ratio } };
  }
  if (fit === 'height') return { box, content: { w: box.h * ratio, h: box.h } };
  const w = Math.min(box.w, box.h * ratio);
  return { box, content: { w, h: w / ratio } };
}
