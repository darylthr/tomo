const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/** Average RGBA pixels, skipping near-white paper and near-black ink when other colors exist. */
export function averageColor(data: Uint8ClampedArray): string {
  const sum = (filter: (r: number, g: number, b: number) => boolean) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const pr = data[i]!;
      const pg = data[i + 1]!;
      const pb = data[i + 2]!;
      if (!filter(pr, pg, pb)) continue;
      r += pr;
      g += pg;
      b += pb;
      n++;
    }
    return n ? `#${hex(r / n)}${hex(g / n)}${hex(b / n)}` : null;
  };
  const colorful = (r: number, g: number, b: number) =>
    !(r > 235 && g > 235 && b > 235) && !(r < 20 && g < 20 && b < 20);
  return sum(colorful) ?? sum(() => true) ?? '#2a2a30';
}

const cache = new Map<string, string>();

/** Dominant color of a loaded cover image; falls back for tainted (cross-origin) images. */
export function dominantColor(img: HTMLImageElement, fallback = '#2a2a30'): string {
  const key = img.currentSrc || img.src;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 12;
    canvas.height = 18;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.drawImage(img, 0, 0, 12, 18);
    const color = averageColor(ctx.getImageData(0, 0, 12, 18).data);
    cache.set(key, color);
    return color;
  } catch {
    return fallback;
  }
}

/** Readable text color for a spine of the given hex color. */
export function spineInk(color: string): string {
  const n = Number.parseInt(color.replace('#', ''), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.55 ? '#111111' : '#f4f4f6';
}
