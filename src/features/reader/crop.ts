/** Border cropping: find uniform white or black margins on a scan and the content box inside them. */

const TOLERANCE = 12;
const SAFETY_PX = 4;
const MAX_SIDE = 0.3;

type Box = { x: number; y: number; w: number; h: number };

export function cropBox(data: Uint8ClampedArray, w: number, h: number): Box {
  const full = { x: 0, y: 0, w, h };
  const r0 = data[0]!;
  const g0 = data[1]!;
  const b0 = data[2]!;
  const white = r0 >= 235 && g0 >= 235 && b0 >= 235;
  const black = r0 <= 20 && g0 <= 20 && b0 <= 20;
  if (!white && !black) return full;

  const plain = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return Math.abs(data[i]! - r0) <= TOLERANCE && Math.abs(data[i + 1]! - g0) <= TOLERANCE && Math.abs(data[i + 2]! - b0) <= TOLERANCE;
  };
  const rowPlain = (y: number) => {
    for (let x = 0; x < w; x++) if (!plain(x, y)) return false;
    return true;
  };
  const colPlain = (x: number, top: number, bottom: number) => {
    for (let y = top; y < bottom; y++) if (!plain(x, y)) return false;
    return true;
  };

  let top = 0;
  while (top < h && rowPlain(top)) top++;
  if (top === h) return full; // a blank page: nothing to frame
  let bottom = h;
  while (bottom > top && rowPlain(bottom - 1)) bottom--;
  let left = 0;
  while (left < w && colPlain(left, top, bottom)) left++;
  let right = w;
  while (right > left && colPlain(right - 1, top, bottom)) right--;

  if (top > h * MAX_SIDE || h - bottom > h * MAX_SIDE || left > w * MAX_SIDE || w - right > w * MAX_SIDE) return full;
  const x = Math.max(0, left - SAFETY_PX);
  const y = Math.max(0, top - SAFETY_PX);
  return { x, y, w: Math.min(w, right + SAFETY_PX) - x, h: Math.min(h, bottom + SAFETY_PX) - y };
}
