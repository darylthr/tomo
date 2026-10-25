// Shelf geometry and per-book motion (spec §6.2, validated in the prototype).

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type ShelfLayout = { H: number; W: number; D: number; pitch: number; padL: number; fadeStart: number };

/** Book size, spacing and edge-fade band for a shelf `panelW` wide and `shelfH` tall. */
export function shelfLayout(panelW: number, shelfH: number, display: 'books' | 'covers'): ShelfLayout {
  const share = panelW < 600 ? 0.46 : 0.54;
  const H = Math.round(clamp(Math.min(shelfH * 0.74, (share * Math.min(panelW, 900)) / 0.68), 140, 400));
  const W = Math.round(H * 0.68);
  const D = Math.round(H * 0.17);
  const pitch =
    display === 'covers' ? Math.round(1.04 * W + Math.max(18, 0.06 * H)) : Math.round(1.06 * W + 0.6 * D + Math.max(22, 0.09 * H));
  const padL = Math.round(panelW / 2 - pitch / 2);
  // Keep the whole centred (scaled) book fully opaque; fade only outside it.
  const half = panelW > 0 ? (((1.16 * W) / 2 + Math.max(14, 0.12 * W)) / panelW) * 100 : 22;
  const fadeStart = clamp(50 - half, 6, 30);
  return { H, W, D, pitch, padL, fadeStart };
}

export type BookMotion = {
  transform: string;
  dim: number;
  z: number;
  shadowScaleX: number;
  shadowScaleY: number;
  shadowOpacity: number;
};

/**
 * Transform for a book `t` slots away from the centre (0 = centred, ±1 = neighbours).
 * `tiltX`/`tiltY` (−1…1) lean the book toward a hovering pointer.
 */
export function bookTransform(
  t: number,
  opts: { H: number; lite: boolean; flat: boolean; tiltX?: number; tiltY?: number },
): BookMotion {
  const at = Math.abs(t);
  const c = Math.max(0, 1 - at);
  const k = c * c * (3 - 2 * c);
  const maxTurn = opts.flat ? 0 : opts.lite ? 18 : 40;
  const angle = -Math.tanh(t * 1.4) * maxTurn;
  const s = 1 + 0.16 * k;
  const lift = 18 * k + ((s - 1) * opts.H) / 2;
  const depth = -Math.min(at, 4) * 60;
  let rx = opts.flat || opts.lite ? 0 : -6;
  let ry = 0;
  if (!opts.flat) {
    rx += -(opts.tiltY ?? 0) * 7;
    ry = (opts.tiltX ?? 0) * 9;
  }
  return {
    transform:
      `perspective(1500px) translate3d(0px, ${(-lift).toFixed(2)}px, ${depth.toFixed(2)}px) ` +
      `rotateX(${rx.toFixed(2)}deg) rotateY(${(angle + ry).toFixed(2)}deg) scale(${s.toFixed(4)})`,
    dim: Math.min(0.6, at * 0.5),
    z: 1000 - Math.round(at * 10),
    shadowScaleX: 1 + 0.3 * k,
    shadowScaleY: 1 + 0.4 * k,
    shadowOpacity: 0.55 + 0.4 * k,
  };
}

/** Indices of the books to mount for the current scroll position, with a buffer on each side. */
export function visibleRange(
  scrollLeft: number,
  viewportW: number,
  padL: number,
  pitch: number,
  count: number,
  buffer = 3,
): [first: number, last: number] {
  if (count <= 0 || pitch <= 0) return [0, -1];
  const first = Math.max(0, Math.floor((scrollLeft - padL) / pitch) - buffer);
  const last = Math.min(count - 1, Math.ceil((scrollLeft + viewportW - padL) / pitch) + buffer);
  return [first, last];
}
