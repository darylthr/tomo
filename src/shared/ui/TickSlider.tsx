import { useLayoutEffect, useRef, useState } from 'react';
import styles from './TickSlider.module.css';

type Props = {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  /** Spoken value, e.g. "Page 3 of 8". */
  valueText?: (value: number) => string;
  /** rtl runs from the right (manga): the left arrow moves forward. */
  dir?: 'ltr' | 'rtl';
  className?: string;
};

const TICK_SPACING = 5; // px per line at most, so lines never merge into a bar
const FALLBACK_TICKS = 120; // before the width is known (and in tests)

/** A slider drawn as a row of vertical lines: one per step, the current one tall and bright. */
export function TickSlider({ label, min, max, step = 1, value, onChange, valueText, dir = 'ltr', className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const [width, setWidth] = useState(0);
  const rtl = dir === 'rtl';
  const range = max - min;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const snap = (v: number) => {
    const snapped = min + Math.round((v - min) / step) * step;
    return Number(Math.min(max, Math.max(min, snapped)).toFixed(6));
  };
  const set = (v: number) => {
    const next = snap(v);
    if (next !== value) onChange(next);
  };

  const steps = range > 0 ? Math.round(range / step) + 1 : 1;
  const room = width > 0 ? Math.max(2, Math.floor(width / TICK_SPACING)) : FALLBACK_TICKS;
  const count = Math.min(steps, room);
  const at = (i: number) => (count > 1 ? snap(min + (i * range) / (count - 1)) : min);
  const current = range > 0 ? Math.round(((value - min) / range) * (count - 1)) : 0;

  const fromPointer = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    if (!r.width) return;
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    set(min + (rtl ? 1 - f : f) * range);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const big = Math.max(step, range / 10);
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    const moves: Record<string, number> = {
      [forward]: value + step,
      [back]: value - step,
      ArrowUp: value + step,
      ArrowDown: value - step,
      PageUp: value + big,
      PageDown: value - big,
      Home: min,
      End: max,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    set(moves[e.key]!);
  };

  return (
    <div
      ref={ref}
      className={`${styles.slider} ${className ?? ''}`}
      role="slider"
      tabIndex={0}
      dir={dir}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText?.(value)}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        dragging.current = e.pointerId;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        fromPointer(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current === e.pointerId) fromPointer(e.clientX);
      }}
      onPointerUp={() => (dragging.current = null)}
      onPointerCancel={() => (dragging.current = null)}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={styles.tick}
          data-tick={at(i)}
          data-done={i <= current || undefined}
          data-current={i === current || undefined}
        />
      ))}
    </div>
  );
}
