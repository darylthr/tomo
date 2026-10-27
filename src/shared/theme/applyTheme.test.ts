import { applyTheme, withTransitionsSuppressed } from './applyTheme';
import { resolveTheme } from './themes';

describe('applyTheme', () => {
  it('writes the five colours, the text on accent and the scheme', () => {
    const root = document.documentElement;
    applyTheme(resolveTheme({ current: 'github-light', overrides: {}, custom: [] }), root);
    expect(root.dataset.theme).toBe('github-light');
    expect(root.dataset.scheme).toBe('light');
    expect(root.style.getPropertyValue('--bg')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--surface-base')).toBe('#f6f8fa');
    expect(root.style.getPropertyValue('--ink')).toBe('#1f2328');
    expect(root.style.getPropertyValue('--accent')).toBe('#0969da');
    expect(root.style.getPropertyValue('--on-accent')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--chrome')).toBe('#f6f8fa');
    expect(root.style.getPropertyValue('--chrome-ink')).toBe('#111114');
    expect(root.style.colorScheme).toBe('light');
  });

  it('marks a custom theme with a light background as light', () => {
    const root = document.documentElement;
    const colours = { bg: '#f5ecd7', surface: '#fffaf0', ink: '#3b2f1e', accent: '#ffd400', chrome: '#efe3c8' };
    applyTheme(resolveTheme({ current: 'p', overrides: {}, custom: [{ id: 'p', name: 'Paper', colours }] }), root);
    expect(root.dataset.scheme).toBe('light');
    expect(root.style.getPropertyValue('--on-accent')).toBe('#000000');
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
