import { useEffect, useState } from 'react';

type Size = { w: number; h: number } | undefined;
const NEAR = 6;

/**
 * Pages' natural sizes, for pairing spreads. Pages near `around` load first, the rest when idle;
 * nothing here blocks the first page, and unknown sizes read as `undefined`.
 */
export function usePageSizes(pages: string[], around: number, enabled: boolean): Size[] {
  const [state, setState] = useState<{ pages: string[]; sizes: Size[] }>({ pages, sizes: [] });
  const sizes = state.pages === pages ? state.sizes : [];

  useEffect(() => {
    if (!enabled || pages.length === 0) return;
    let alive = true;
    const order = pages.map((_, i) => i).sort((a, b) => Math.abs(a - around) - Math.abs(b - around));
    const probe = (i: number) => {
      const img = new Image();
      img.onload = () => {
        if (!alive || !img.naturalWidth) return;
        setState((s) => {
          const base = s.pages === pages ? s.sizes : [];
          if (base[i]) return s;
          const next = base.slice();
          next[i] = { w: img.naturalWidth, h: img.naturalHeight };
          return { pages, sizes: next };
        });
      };
      img.src = pages[i]!;
    };
    order.slice(0, NEAR * 2 + 1).forEach(probe);
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => order.slice(NEAR * 2 + 1).forEach(probe));
    return () => {
      alive = false;
      cancel(handle as number);
    };
    // `around` only orders the first batch; a new page shouldn't restart the probing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, enabled]);

  return sizes;
}
