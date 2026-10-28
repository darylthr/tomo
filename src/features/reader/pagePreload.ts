const KEEP = 16;
/** Pages already asked for, newest last. Holding the image keeps its decoded pixels, so showing it later paints at once. */
const held = new Map<string, { img: HTMLImageElement; done: Promise<void>; ready: boolean }>();

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
  // No decode() (old browsers, jsdom): nothing to wait for.
  const entry = { img, ready: !img.decode, done: Promise.resolve() };
  // A page that fails to load counts as settled: waiting for it forever would freeze the turn.
  if (img.decode) {
    entry.done = img.decode().then(
      () => void (entry.ready = true),
      () => void (entry.ready = true),
    );
  }
  held.set(src, entry);
  if (held.size > KEEP) held.delete(held.keys().next().value!);
}

/** True once the page has been loaded and decoded (or has failed to), so showing it paints at once. */
export function isPageReady(src: string): boolean {
  return held.get(src)?.ready ?? false;
}

/** Resolves when every page is ready, or after `timeoutMs`, whichever is first. Starts loading any that were never asked for. */
export function whenPagesReady(srcs: string[], timeoutMs: number): Promise<void> {
  for (const src of srcs) preloadPage(src);
  const all = Promise.all(srcs.map((src) => held.get(src)?.done)).then(() => {});
  return Promise.race([all, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
}
