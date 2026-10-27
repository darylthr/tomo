import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

const HOLD_MS = 500;
const MOVE_PX = 10;

/** The page under a pointer: the nearest element carrying data-page. */
export function pageAt(target: EventTarget | null): number | null {
  const el = (target as HTMLElement | null)?.closest?.('[data-page]');
  const n = el ? Number((el as HTMLElement).dataset.page) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Press and hold (500ms, under 10px of movement) or right-click. `fallback` names the page when the
 * press isn't on one (a margin). After a long press, `consumeClick()` swallows the click that follows.
 */
export function useLongPress(onPress: (page: number) => void, fallback: () => number) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      const page = pageAt(e.target) ?? fallback();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fired.current = true;
        start.current = null;
        onPress(page);
      }, HOLD_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      cancel();
      onPress(pageAt(e.target) ?? fallback());
    },
    /** True (once) when the click that just arrived ends a long press. */
    consumeClick: () => {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
