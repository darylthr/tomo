import type { ReaderMode } from '../../shared/model/types';

type Size = { w: number; h: number } | undefined;

/** A page wider than tall is already a spread (a scan of two pages) and stands alone. */
const isWide = (s: Size) => !!s && s.w / s.h > 1;

/**
 * Groups a chapter's pages into what's shown together: pairs, with the cover alone when asked,
 * wide pages alone (pairing restarts after them), and a lone last page alone.
 */
export function pairPages(sizes: Size[], coverAlone: boolean): number[][] {
  const out: number[][] = [];
  let i = 0;
  if (coverAlone && sizes.length > 0) out.push([i++]);
  while (i < sizes.length) {
    if (isWide(sizes[i]) || i + 1 >= sizes.length || isWide(sizes[i + 1])) {
      out.push([i]);
      i += 1;
    } else {
      out.push([i, i + 1]);
      i += 2;
    }
  }
  return out;
}

/** Spreads show in Manga and Comic; Auto means landscape and at least 900px wide. */
export function wantsSpreads(setting: 'auto' | 'on' | 'off', viewport: { w: number; h: number }, mode: ReaderMode): boolean {
  if (setting === 'off' || (mode !== 'rtl' && mode !== 'ltr')) return false;
  return setting === 'on' || (viewport.w > viewport.h && viewport.w >= 900);
}

/** The chapter's layout: every page is placed, whether or not its size is known yet. */
export function layoutFor(count: number, sizes: Size[], coverAlone: boolean): number[][] {
  return pairPages(Array.from({ length: count }, (_, i) => sizes[i]), coverAlone);
}
