import { useEffect, useState } from 'react';
import { cropBox } from './crop';

const PROBE_PX = 400;
const KEEP = 40;
/** Cropped versions of pages, by source URL (the original URL when there's nothing to crop). */
const cache = new Map<string, Promise<string>>();

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function crop(src: string): Promise<string> {
  const img = await load(src);
  const probe = document.createElement('canvas');
  const k = Math.min(1, PROBE_PX / Math.max(img.naturalWidth, img.naturalHeight));
  probe.width = Math.max(1, Math.round(img.naturalWidth * k));
  probe.height = Math.max(1, Math.round(img.naturalHeight * k));
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  if (!pctx) return src;
  pctx.drawImage(img, 0, 0, probe.width, probe.height);
  const box = cropBox(pctx.getImageData(0, 0, probe.width, probe.height).data, probe.width, probe.height);
  if (box.w === probe.width && box.h === probe.height) return src;
  // Cut at full resolution, near-lossless, so the page keeps its quality.
  const out = document.createElement('canvas');
  out.width = Math.round(box.w / k);
  out.height = Math.round(box.h / k);
  const octx = out.getContext('2d');
  if (!octx) return src;
  octx.drawImage(img, box.x / k, box.y / k, out.width, out.height, 0, 0, out.width, out.height);
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/webp', 0.95));
  return blob ? URL.createObjectURL(blob) : src;
}

/** The page to show with "Crop white borders" on: a cropped copy, or the original while it's made or if it can't be. */
export function useCrop(src: string | undefined, enabled: boolean): string | undefined {
  const [state, setState] = useState<{ src?: string; shown?: string }>({});
  const shown = enabled && state.src === src ? state.shown : src;

  useEffect(() => {
    if (!enabled || !src) return;
    let alive = true;
    let job = cache.get(src);
    if (!job) {
      job = crop(src).catch(() => src);
      cache.set(src, job);
      if (cache.size > KEEP) {
        const oldest = cache.keys().next().value!;
        void cache.get(oldest)?.then((u) => u.startsWith('blob:') && URL.revokeObjectURL(u));
        cache.delete(oldest);
      }
    }
    void job.then((url) => alive && setState({ src, shown: url }));
    return () => {
      alive = false;
    };
  }, [src, enabled]);

  return shown;
}
