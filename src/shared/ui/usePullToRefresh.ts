import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Finger travel is halved, so the list feels like it resists. */
const DAMPING = 0.5;
export const PULL_MAX = 96;
export const PULL_TRIGGER = 64;

/**
 * Pull down from the top of a scrolling list to refresh (touch only; Page also shows a button,
 * so the gesture always has an alternative). `pull` is the damped distance, for the indicator.
 */
export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  onRefresh: (() => Promise<void>) | undefined,
): { pull: number; refreshing: boolean } {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const callback = useRef(onRefresh);
  useLayoutEffect(() => {
    callback.current = onRefresh;
  });
  const enabled = Boolean(onRefresh);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let startY: number | null = null;
    let distance = 0;
    let busy = false;

    const start = (e: TouchEvent) => {
      distance = 0;
      startY = el.scrollTop <= 0 && e.touches.length === 1 ? e.touches[0]!.clientY : null;
    };
    const move = (e: TouchEvent) => {
      if (startY === null || !e.touches[0]) return;
      distance = Math.min(PULL_MAX, Math.max(0, (e.touches[0].clientY - startY) * DAMPING));
      setPull(distance);
    };
    const end = () => {
      if (startY === null) return;
      startY = null;
      setPull(0);
      if (distance < PULL_TRIGGER || busy) return;
      busy = true;
      setRefreshing(true);
      Promise.resolve(callback.current?.())
        .catch(() => {})
        .finally(() => {
          busy = false;
          setRefreshing(false);
        });
    };
    const cancel = () => {
      startY = null;
      setPull(0);
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', cancel);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', cancel);
    };
  }, [ref, enabled]);

  return { pull, refreshing };
}
