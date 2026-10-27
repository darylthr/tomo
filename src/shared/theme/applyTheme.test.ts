import { applyTheme, withTransitionsSuppressed } from './applyTheme';
import { resolveTheme } from './themes';

describe('applyTheme', () => {
  it('writes the theme to data-theme and the chrome variables', () => {
    const root = document.documentElement;
    applyTheme(resolveTheme({ current: 'github-dark', overrides: {}, custom: [] }), root);
    expect(root.dataset.theme).toBe('github-dark');
    expect(root.style.getPropertyValue('--c-bg')).toBe('#010409');
    expect(root.style.getPropertyValue('--c-accent')).toBe('#2f81f7');
  });
});

describe('withTransitionsSuppressed', () => {
  it('marks the document during the change and clears it after a frame', async () => {
    const root = document.documentElement;
    let during: string | undefined;
    withTransitionsSuppressed(() => {
      during = root.dataset.noTransitions;
    }, root);
    expect(during).toBe('');
    expect(root.dataset.noTransitions).toBe('');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    expect(root.dataset.noTransitions).toBeUndefined();
  });
});
