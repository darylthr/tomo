import type { ThemeSettings } from '../settings/schema';

const PRESETS: Record<'dark' | 'light', { bg: string; ink: string }> = {
  dark: { bg: '#0e0e10', ink: '#f1f1f4' },
  light: { bg: '#f4f4f6', ink: '#111114' },
};

/**
 * Turns off every transition while `fn` changes colors, so a theme switch
 * doesn't smear (better-ui: suppress transitions on theme switch).
 */
export function withTransitionsSuppressed(fn: () => void, root: HTMLElement = document.documentElement): void {
  root.dataset.noTransitions = '';
  fn();
  void getComputedStyle(root).opacity; // force a style flush before transitions return
  requestAnimationFrame(() => {
    delete root.dataset.noTransitions;
  });
}

/** Writes the theme to `data-theme` and the `--c-*` CSS variables on `root`. */
export function applyTheme(theme: ThemeSettings, root: HTMLElement = document.documentElement): void {
  const colors = theme.mode === 'custom' ? { bg: theme.bg, ink: theme.ink } : PRESETS[theme.mode];
  withTransitionsSuppressed(() => {
    root.dataset.theme = theme.mode;
    root.style.setProperty('--c-bg', colors.bg);
    root.style.setProperty('--c-ink', colors.ink);
    root.style.setProperty('--c-accent', theme.accent);
  }, root);
}
