import type { ResolvedTheme } from './themes';

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
export function applyTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  withTransitionsSuppressed(() => {
    root.dataset.theme = theme.id;
    root.style.setProperty('--c-bg', theme.colours.chrome);
    root.style.setProperty('--c-ink', theme.scheme === 'light' ? '#111114' : '#f1f1f4');
    root.style.setProperty('--c-accent', theme.colours.accent);
  }, root);
}
