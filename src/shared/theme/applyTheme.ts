import { chromeInk, onAccent, type ResolvedTheme } from './themes';

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

/**
 * Writes the theme's five colours, the text colours that sit on accent and chrome, and the scheme.
 * Every other token is derived from these in tokens.css.
 */
export function applyTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  const { bg, surface, ink, accent, chrome } = theme.colours;
  const vars: Record<string, string> = {
    '--bg': bg,
    '--surface-base': surface,
    '--ink': ink,
    '--accent': accent,
    '--on-accent': onAccent(accent),
    '--chrome': chrome,
    '--chrome-ink': chromeInk(chrome),
  };
  withTransitionsSuppressed(() => {
    root.dataset.theme = theme.id;
    root.dataset.scheme = theme.scheme;
    root.style.colorScheme = theme.scheme;
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  }, root);
}
