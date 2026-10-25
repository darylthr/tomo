import { applyTheme, withTransitionsSuppressed } from './applyTheme';

describe('applyTheme', () => {
  it('writes the custom theme to data-theme and CSS variables', () => {
    const root = document.documentElement;
    applyTheme({ mode: 'custom', bg: '#102030', ink: '#fafafa', accent: '#8b6cff' }, root);
    expect(root.dataset.theme).toBe('custom');
    expect(root.style.getPropertyValue('--c-bg')).toBe('#102030');
    expect(root.style.getPropertyValue('--c-ink')).toBe('#fafafa');
    expect(root.style.getPropertyValue('--c-accent')).toBe('#8b6cff');
  });

  it('uses the preset colors for dark, ignoring custom ones', () => {
    const root = document.documentElement;
    applyTheme({ mode: 'dark', bg: '#ffffff', ink: '#000000', accent: '#8b6cff' }, root);
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.getPropertyValue('--c-bg')).toBe('#0e0e10');
    expect(root.style.getPropertyValue('--c-ink')).toBe('#f1f1f4');
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
