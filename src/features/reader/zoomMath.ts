/**
 * Zoom as a transform: `translate(x, y) scale(scale)` about the content's centre.
 * Points are measured from that centre, in screen pixels.
 */
export type Zoom = { scale: number; x: number; y: number };
type Size = { w: number; h: number };

export const IDENTITY: Zoom = { scale: 1, x: 0, y: 0 };

/** Scales by `factor` keeping the point (cx, cy) where it is on screen; 1× is always the plain page. */
export function zoomAt(z: Zoom, factor: number, cx: number, cy: number, max: number): Zoom {
  const scale = Math.min(max, Math.max(1, z.scale * factor));
  if (scale === 1) return IDENTITY;
  const k = scale / z.scale;
  return { scale, x: cx - k * (cx - z.x), y: cy - k * (cy - z.y) };
}

/** How far the content may move on each axis before its edge leaves the box's edge. */
function limits(scale: number, box: Size, content: Size) {
  return { x: Math.max(0, (content.w * scale - box.w) / 2), y: Math.max(0, (content.h * scale - box.h) / 2) };
}

const clamp = (v: number, lim: number) => Math.min(lim, Math.max(-lim, v)) || 0;

export function clampPan(z: Zoom, box: Size, content: Size): Zoom {
  const lim = limits(z.scale, box, content);
  return { scale: z.scale, x: clamp(z.x, lim.x), y: clamp(z.y, lim.y) };
}

/** How far a wanted pan position lies past the clamped edge (signed, per axis). */
export function overscroll(z: Zoom, wanted: { x: number; y: number }, box: Size, content: Size): { x: number; y: number } {
  const lim = limits(z.scale, box, content);
  return { x: wanted.x - clamp(wanted.x, lim.x) || 0, y: wanted.y - clamp(wanted.y, lim.y) || 0 };
}

/**
 * The pages' on-screen size at 1×, side by side in a spread (width/height ratios, one per page).
 * Matches the CSS: Screen fits each page into its share of the box; Width caps pages at
 * 1000px (500px each in a spread); Height fills the box's height.
 */
export function fitContent(box: Size, ratios: number[], fit: string): Size {
  const n = ratios.length;
  if (n === 0) return box;
  const sizes = ratios.map((r) => {
    if (fit === 'height') return { w: box.h * r, h: box.h };
    if (fit === 'width') {
      const w = Math.min(box.w / n, n > 1 ? 500 : 1000);
      return { w, h: w / r };
    }
    const w = Math.min(box.w / n, box.h * r);
    return { w, h: w / r };
  });
  return { w: sizes.reduce((sum, s) => sum + s.w, 0), h: Math.max(...sizes.map((s) => s.h)) };
}
