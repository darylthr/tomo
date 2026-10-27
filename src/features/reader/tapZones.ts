import type { ReaderMode } from '../../shared/model/types';

/**
 * What a tap does at fraction `f` (0–1) across the reading axis (down it in Vertical):
 * thirds, with the middle showing or hiding the controls. Inverted swaps the sides; Off leaves
 * page turns to swipes and keys.
 */
export function tapAction(f: number, mode: ReaderMode, zones: 'default' | 'inverted' | 'off'): 'prev' | 'next' | 'chrome' {
  if (zones === 'off' || (f > 1 / 3 && f < 2 / 3)) return 'chrome';
  const early = f <= 1 / 3; // left third, or top third when vertical
  // Manga reads right to left: its left side goes forward.
  const forward = mode === 'rtl' ? early : !early;
  const action = forward ? 'next' : 'prev';
  if (zones === 'inverted') return action === 'next' ? 'prev' : 'next';
  return action;
}

/** The labels of the three zones, left (or top) to right (or bottom). */
export function zoneLabels(mode: ReaderMode, zones: 'default' | 'inverted' | 'off'): [string, string, string] {
  const name = (f: number) => {
    const a = tapAction(f, mode, zones);
    return a === 'next' ? 'Next page' : a === 'prev' ? 'Previous page' : 'Menu';
  };
  return [name(0.1), 'Menu', name(0.9)];
}
