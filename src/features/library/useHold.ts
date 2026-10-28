import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

const HOLD_MS = 500;
const MOVE_PX = 10;

/**
 * Press and hold (500ms, under 10px of movement) or right-click. After a hold, `consumeClick()`
 * swallows the click that follows, so the press doesn't also open the title.
 */
export function useHold(onHold: () => void) {
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
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fired.current = true;
        start.current = null;
        onHold();
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
      fired.current = true;
      onHold();
    },
    consumeClick: () => {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
