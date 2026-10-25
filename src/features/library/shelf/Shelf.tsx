import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Title } from '../../../shared/model/types';
import { prefersReducedMotion } from '../../../shared/ui/useReducedMotion';
import { Book } from './Book';
import styles from './Shelf.module.css';
import { bookTransform, shelfLayout, visibleRange, type ShelfLayout } from './shelfMath';

const FLOOR = 22; // px between the shelf's bottom edge and the books' base
const WHEEL_SETTLE_MS = 140;

type Props = {
  titles: Title[];
  display: 'books' | 'covers';
  lite: boolean;
  fadeSides: boolean;
  onCenterChange: (index: number) => void;
  /** Called when the centred book is tapped; `coverEl` is its front cover (for the opening transition). */
  onOpen: (title: Title, coverEl: HTMLElement) => void;
  initialIndex?: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The horizontal 3D shelf: native scroll + snap, virtualized books, transforms written per frame. */
export function Shelf({ titles, display, lite, fadeSides, onCenterChange, onOpen, initialIndex = 0 }: Props) {
  const shelfRef = useRef<HTMLDivElement>(null);
  const slots = useRef(new Map<number, HTMLDivElement>());
  const [layout, setLayout] = useState<ShelfLayout>(() => shelfLayout(0, 0, display));
  const [range, setRange] = useState<[number, number]>(() =>
    visibleRange(0, 0, layout.padL, layout.pitch, titles.length),
  );

  // Everything the frame loop reads lives in refs so scrolling never re-renders React.
  const live = useRef({ layout, range, titles, display, lite, onCenterChange, onOpen, center: -1 });
  const motion = useRef({ target: null as number | null, raf: 0, lastT: 0, wheelTimer: 0 });
  const tilt = useRef({ i: -1, x: 0, y: 0, tx: 0, ty: 0 });
  useEffect(() => {
    Object.assign(live.current, { layout, range, titles, display, lite, onCenterChange, onOpen });
  });

  const update = useCallback(() => {
    const el = shelfRef.current;
    if (!el) return;
    const L = live.current;
    const { pitch, padL, H } = L.layout;
    const n = L.titles.length;
    const sl = el.scrollLeft;
    const next = visibleRange(sl, el.clientWidth, padL, pitch, n);
    if (next[0] !== L.range[0] || next[1] !== L.range[1]) {
      L.range = next;
      setRange(next);
    }
    const flat = L.display === 'covers';
    const t = tilt.current;
    slots.current.forEach((slot, i) => {
      const book = slot.querySelector<HTMLElement>('[data-title-id]');
      const shadow = slot.firstElementChild as HTMLElement | null;
      if (!book || !shadow) return;
      const hovered = i === t.i;
      const m = bookTransform((i * pitch - sl) / pitch, {
        H,
        lite: L.lite,
        flat,
        tiltX: hovered ? t.x : 0,
        tiltY: hovered ? t.y : 0,
      });
      book.style.transform = m.transform;
      book.style.setProperty('--dim', m.dim.toFixed(3));
      shadow.style.transform = `scaleX(${m.shadowScaleX.toFixed(3)}) scaleY(${m.shadowScaleY.toFixed(3)})`;
      shadow.style.opacity = m.shadowOpacity.toFixed(3);
      slot.style.zIndex = String(m.z);
    });
    const center = n ? clamp(Math.round(sl / pitch), 0, n - 1) : -1;
    if (center !== L.center) {
      L.center = center;
      if (center >= 0) L.onCenterChange(center);
    }
  }, []);

  // The frame loop lives in a ref so it can reschedule itself without re-creating callbacks.
  const loop = useRef<FrameRequestCallback | null>(null);
  const schedule = useCallback(() => {
    const m = motion.current;
    if (!m.raf && loop.current) m.raf = requestAnimationFrame(loop.current);
  }, []);

  useEffect(() => {
    loop.current = (now) => {
      const m = motion.current;
      m.raf = 0;
      const el = shelfRef.current;
      if (!el) return;
      const dt = m.lastT ? Math.min(64, now - m.lastT) : 16.7;
      m.lastT = now;
      let busy = false;
      if (m.target !== null) {
        const cur = el.scrollLeft;
        const k = 1 - Math.pow(1 - 0.2, dt / 16.7);
        if (Math.abs(m.target - cur) < 0.6) {
          el.scrollLeft = m.target;
          m.target = null;
          if (!m.wheelTimer) el.classList.remove(styles.free!);
        } else {
          el.scrollLeft = cur + (m.target - cur) * k;
          busy = true;
        }
      }
      const t = tilt.current;
      const kt = 1 - Math.pow(1 - 0.16, dt / 16.7);
      t.x += (t.tx - t.x) * kt;
      t.y += (t.ty - t.y) * kt;
      if (Math.abs(t.tx - t.x) > 0.002 || Math.abs(t.ty - t.y) > 0.002) busy = true;
      update();
      if (busy) m.raf = requestAnimationFrame(loop.current!);
      else m.lastT = 0;
    };
  }, [update]);

  const go = useCallback(
    (i: number) => {
      const el = shelfRef.current;
      const { pitch } = live.current.layout;
      const n = live.current.titles.length;
      if (!el || !n) return;
      const target = clamp(i, 0, n - 1) * pitch;
      if (prefersReducedMotion()) {
        el.scrollLeft = target;
        return;
      }
      el.classList.add(styles.free!);
      motion.current.target = target;
      schedule();
    },
    [schedule],
  );

  // Measure the shelf and keep the centred book in place across resizes.
  useLayoutEffect(() => {
    const el = shelfRef.current;
    if (!el) return;
    let first = true;
    const measure = () => {
      const keep = first ? initialIndex : Math.max(0, live.current.center);
      const next = shelfLayout(el.clientWidth, Math.max(0, el.clientHeight - FLOOR - 18), display);
      live.current.layout = next;
      setLayout(next);
      el.scrollLeft = keep * next.pitch;
      first = false;
      update();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    // initialIndex only matters for the first measurement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display, update]);

  // Newly mounted books need their transforms before paint.
  useLayoutEffect(() => {
    update();
  }, [range, layout, lite, update]);

  // Vertical wheel → horizontal movement, eased, then settle on the nearest book.
  useEffect(() => {
    const el = shelfRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.ctrlKey) return;
      e.preventDefault();
      const { pitch } = live.current.layout;
      const n = live.current.titles.length;
      const d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * el.clientWidth : e.deltaY;
      if (prefersReducedMotion()) {
        el.scrollLeft += d;
        return;
      }
      const m = motion.current;
      el.classList.add(styles.free!);
      m.target = clamp((m.target ?? el.scrollLeft) + d, 0, Math.max(0, n - 1) * pitch);
      clearTimeout(m.wheelTimer);
      m.wheelTimer = window.setTimeout(() => {
        m.wheelTimer = 0;
        m.target = clamp(Math.round((m.target ?? el.scrollLeft) / pitch), 0, Math.max(0, n - 1)) * pitch;
        schedule();
      }, WHEEL_SETTLE_MS);
      schedule();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    const m = motion.current;
    return () => {
      el.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(m.raf);
      clearTimeout(m.wheelTimer);
    };
  }, [schedule]);

  const centerOf = () => Math.max(0, live.current.center);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const m = motion.current;
    const base = m.target !== null ? Math.round(m.target / live.current.layout.pitch) : centerOf();
    const steps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, PageDown: 5, PageUp: -5 };
    if (e.key in steps) {
      e.preventDefault();
      go(base + steps[e.key]!);
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      go(titles.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const slot = slots.current.get(centerOf());
      const cover = slot?.querySelector<HTMLElement>('[data-cover]');
      const title = titles[centerOf()];
      if (title && cover) onOpen(title, cover);
    }
  };

  const onClick = (e: React.MouseEvent) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-index]');
    if (!slot) return;
    const i = Number(slot.dataset.index);
    if (i !== centerOf() || motion.current.target !== null) {
      go(i);
      return;
    }
    const title = titles[i];
    const cover = slot.querySelector<HTMLElement>('[data-cover]');
    if (title && cover) onOpen(title, cover);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || prefersReducedMotion() || !window.matchMedia('(hover: hover)').matches) return;
    const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-index]');
    const t = tilt.current;
    if (!slot) {
      t.tx = t.ty = 0;
      schedule();
      return;
    }
    const i = Number(slot.dataset.index);
    if (t.i !== i) Object.assign(t, { i, x: 0, y: 0 });
    const r = slot.querySelector<HTMLElement>('[data-title-id]')!.getBoundingClientRect();
    t.tx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
    t.ty = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
    schedule();
  };

  const { W, H, D, pitch, padL, fadeStart } = layout;
  const shelfVars = {
    '--fs': `${fadeStart}%`,
    '--fe': `${100 - fadeStart}%`,
    '--f1': `${fadeStart * 0.4}%`,
    '--f2': `${100 - fadeStart * 0.4}%`,
    '--floor': `${FLOOR}px`,
  } as CSSProperties;

  const [first, last] = range;
  const mounted: number[] = [];
  for (let i = first; i <= last; i++) mounted.push(i);

  return (
    <div
      ref={shelfRef}
      className={`${styles.shelf} ${fadeSides ? styles.fade : ''}`}
      style={shelfVars}
      tabIndex={0}
      role="group"
      aria-roledescription="shelf"
      aria-label="Library shelf. Use the arrow keys to move between books and Enter to open one."
      onScroll={schedule}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        tilt.current.tx = tilt.current.ty = 0;
        schedule();
      }}
    >
      <div className={styles.track} style={{ width: padL * 2 + titles.length * pitch }}>
        {mounted.map((i) => {
          const title = titles[i]!;
          return (
            <div
              key={title.id}
              ref={(el) => {
                if (el) slots.current.set(i, el);
                else slots.current.delete(i);
              }}
              className={styles.slot}
              data-index={i}
              style={{ left: padL + i * pitch, width: pitch, '--w': `${W}px`, '--h': `${H}px`, '--d': `${D}px` } as CSSProperties}
            >
              <span className={styles.shadow} aria-hidden="true" />
              <div role="button" aria-label={title.title} tabIndex={-1} className={styles.hit}>
                <Book title={title} lite={lite} flat={display === 'covers'} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
