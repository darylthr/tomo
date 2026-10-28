import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Finger travel is halved, so the list feels like it resists. */
const DAMPING = 0.5;
export const PULL_MAX = 96;
export const PULL_TRIGGER = 64;

/**
 * Pull down from the top to refresh (touch only). `pull` is the damped distance, for the indicator.
 * `atTop` says whether the content is at its top; by default that is the element's own scroll position.
 * A drag that starts out sideways is left alone, so it can swipe a shelf or change a tab.
 */
export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  onRefresh: (() => Promise<void>) | undefined,
  atTop: (el: HTMLElement) => boolean = (el) => el.scrollTop <= 0,
): { pull: number; refreshing: boolean } {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const callback = useRef(onRefresh);
  useLayoutEffect(() => {
    callback.current = onRefresh;
  });
  const enabled = Boolean(onRefresh);
  const top = useRef(atTop);
  useLayoutEffect(() => {
    top.current = atTop;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let startX = 0;
    let startY: number | null = null;
    let vertical = false;
    let distance = 0;
    let busy = false;

    const start = (e: TouchEvent) => {
      distance = 0;
      vertical = false;
      const ok = top.current(el) && e.touches.length === 1;
      startX = ok ? e.touches[0]!.clientX : 0;
      startY = ok ? e.touches[0]!.clientY : null;
    };
    const move = (e: TouchEvent) => {
      if (startY === null || !e.touches[0]) return;
      if (!vertical) {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = e.touches[0].clientY - startY;
        if (Math.max(dx, Math.abs(dy)) < 8) return;
        // Sideways, or upwards: not a pull.
        if (dy <= 0 || dx > dy) {
          startY = null;
          return;
        }
        vertical = true;
      }
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
