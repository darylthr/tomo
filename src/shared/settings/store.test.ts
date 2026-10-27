import { DEFAULTS } from './schema';

async function freshStore() {
  vi.resetModules();
  return (await import('./store')).useSettings;
}

describe('useSettings', () => {
  it('boots with the defaults when saved data is corrupt JSON', async () => {
    localStorage.setItem('tomo.settings', '{not json');
    const useSettings = await freshStore();
    expect(useSettings.getState().settings).toEqual(DEFAULTS);
  });

  it('boots with defaults for bad fields in an old saved blob', async () => {
    localStorage.setItem(
      'tomo.settings',
      JSON.stringify({ state: { settings: { library: { display: 'covers', scroll: 'sideways' } } }, version: 0 }),
    );
    const useSettings = await freshStore();
    expect(useSettings.getState().settings.library.display).toBe('covers');
    expect(useSettings.getState().settings.library.scroll).toBe('horizontal');
  });

  it('merges a deep partial update and persists it', async () => {
    const useSettings = await freshStore();
    useSettings.getState().update({ library: { display: 'covers' } });
    const { library } = useSettings.getState().settings;
    expect(library.display).toBe('covers');
    expect(library.fadeSides).toBe(true);
    const saved = JSON.parse(localStorage.getItem('tomo.settings') ?? '{}');
    expect(saved.state.settings.library.display).toBe('covers');
  });

  it('replaces the theme section whole, so a reset override is gone', async () => {
    const useSettings = await freshStore();
    useSettings.getState().setTheme({ current: 'nord', overrides: { nord: { accent: '#ff0000' } }, custom: [] });
    useSettings.getState().setTheme({ current: 'nord', overrides: {}, custom: [] });
    expect(useSettings.getState().settings.theme.overrides).toEqual({});
  });

  it('applies the theme when it changes', async () => {
    const useSettings = await freshStore();
    useSettings.getState().update({ theme: { current: 'tomo-light' } });
    expect(document.documentElement.dataset.theme).toBe('tomo-light');
  });

  it('reset restores the defaults', async () => {
    const useSettings = await freshStore();
    useSettings.getState().update({ background: { levels: 9 } });
    useSettings.getState().reset();
    expect(useSettings.getState().settings).toEqual(DEFAULTS);
  });
});
