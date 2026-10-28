const KEEP = 12;
/** Pages already asked for, newest last. Holding the image keeps its decoded pixels, so showing it later paints at once. */
const held = new Map<string, HTMLImageElement>();

/** Loads and decodes a page ahead of time so turning to it doesn't flash blank while the browser decodes it. */
export function preloadPage(src: string): void {
  const kept = held.get(src);
  if (kept) {
    // Re-touch so the pages near the reader are the last to be dropped.
    held.delete(src);
    held.set(src, kept);
    return;
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  held.set(src, img);
  if (held.size > KEEP) held.delete(held.keys().next().value!);
  void img.decode?.().catch(() => {});
}
