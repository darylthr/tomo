import { useLayoutEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from './useReducedMotion';

type Options = {
  /** Selector for a child of the active item to size the pill to (for example the icon box). */
  measure?: string;
};

function findItem(container: HTMLElement, key: string): HTMLElement | null {
  for (const el of container.querySelectorAll<HTMLElement>('[data-pill-key]')) {
    if (el.dataset.pillKey === key) return el;
  }
  return null;
}

/**
 * Positions `pillRef` under the container's `[data-pill-key=activeKey]` item.
 * Writes straight to the pill's style so scrolling and resizing never re-render.
 * `data-instant="true"` marks placements that should skip the slide transition:
 * the first one, resizes, and everything under reduced motion.
 */
export function useSlidingPill(
  containerRef: RefObject<HTMLElement | null>,
  pillRef: RefObject<HTMLElement | null>,
  activeKey: string,
  opts: Options = {},
): void {
  const lastKey = useRef<string | null>(null);
  const { measure } = opts;

  useLayoutEffect(() => {
    const container = containerRef.current;
    const pill = pillRef.current;
    if (!container || !pill) return;

    const place = (instant: boolean) => {
      const item = findItem(container, activeKey);
      if (!item) {
        pill.style.width = '0px';
        return;
      }
      const target = (measure && item.querySelector<HTMLElement>(measure)) || item;
      const x = item.offsetLeft + (target === item ? 0 : target.offsetLeft);
      const y = target === item ? 0 : item.offsetTop + target.offsetTop;
      pill.dataset.instant = String(instant || prefersReducedMotion());
      pill.style.width = `${target.offsetWidth}px`;
      if (target !== item) pill.style.height = `${target.offsetHeight}px`;
      pill.style.transform = `translate(${x}px, ${y}px)`;
    };

    // Only a change of active item slides; first placement and effect re-runs snap.
    place(lastKey.current === null || lastKey.current === activeKey);
    lastKey.current = activeKey;

    const observer = new ResizeObserver(() => place(true));
    observer.observe(container);
    let alive = true;
    document.fonts?.ready.then(() => alive && place(true));
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [containerRef, pillRef, activeKey, measure]);
}
