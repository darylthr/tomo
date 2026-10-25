/** 8×8 Bayer thresholds, row-major, each `(rank + 0.5) / 64`. */
export const BAYER8: Float32Array = (() => {
  let m = [
    [0, 2],
    [3, 1],
  ];
  while (m.length < 8) {
    const n = m.length;
    const next: number[][] = [];
    for (let y = 0; y < n * 2; y++) {
      const row: number[] = [];
      for (let x = 0; x < n * 2; x++) {
        const base = 4 * m[y % n]![x % n]!;
        const quadrant = [0, 2, 3, 1][(y >= n ? 2 : 0) + (x >= n ? 1 : 0)]!;
        row.push(base + quadrant);
      }
      next.push(row);
    }
    m = next;
  }
  return Float32Array.from(m.flat(), (rank) => (rank + 0.5) / 64);
})();

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Brightness multiplier at height `y` (0 top, 1 bottom), matched to Capy's background. */
export function fadeAt(y: number): number {
  return 0.5 * (1 - smoothstep(0.2, 0.88, y)) ** 1.6;
}

/** Tone curve applied to an 8-bit channel value, returning 0–1. */
export function tone(v8: number): number {
  return (v8 / 255) ** 1.2;
}

/** Ordered-dither `v` (0–1) to one of `levels` evenly spaced 8-bit values. */
export function quantize(v: number, threshold: number, levels: number): number {
  const steps = levels - 1;
  const scaled = v * steps;
  const base = Math.floor(scaled);
  const level = Math.min(steps, base + (scaled - base > threshold ? 1 : 0));
  return Math.round((level / steps) * 255);
}

/** CPU dither of RGBA pixels: tone → fade by row → per-channel Bayer quantize. */
export function ditherPixels(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  opts: { levels: number },
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  const curve = new Float32Array(256);
  for (let v = 0; v < 256; v++) curve[v] = tone(v);
  for (let y = 0; y < h; y++) {
    const fade = fadeAt(h > 1 ? y / h : 0);
    const row = (y & 7) * 8;
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const t = BAYER8[row + (x & 7)]!;
      out[p] = quantize(curve[src[p]!]! * fade, t, opts.levels);
      out[p + 1] = quantize(curve[src[p + 1]!]! * fade, t, opts.levels);
      out[p + 2] = quantize(curve[src[p + 2]!]! * fade, t, opts.levels);
      out[p + 3] = 255;
    }
  }
  return out;
}

/** Source crop that fills `dstW × dstH` like `object-fit: cover`. */
export function coverRect(srcW: number, srcH: number, dstW: number, dstH: number) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const sw = Math.round(dstW / scale);
  const sh = Math.round(dstH / scale);
  return { sx: Math.round((srcW - sw) / 2), sy: Math.round((srcH - sh) / 2), sw, sh };
}
