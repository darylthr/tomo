import { DEFAULTS, parseSettings } from './schema';

describe('parseSettings', () => {
  it('returns the defaults for an empty object', () => {
    expect(parseSettings({})).toEqual(DEFAULTS);
  });

  it('has the spec defaults', () => {
    expect(DEFAULTS.theme).toEqual({ mode: 'dark', bg: '#0e0e10', ink: '#f1f1f4', accent: '#8b6cff' });
    expect(DEFAULTS.background).toEqual({ enabled: false, levels: 6, cell: 2, imageKey: null });
    expect(DEFAULTS.library).toEqual({
      display: 'books',
      scroll: 'horizontal',
      fadeSides: true,
      styledLogos: true,
      detail: 'full',
      mirrorRtl: false,
    });
  });

  it('has server and reader defaults', () => {
    expect(DEFAULTS.server).toEqual({ url: '', webUiUrl: '', authMode: 'none', configured: false });
    expect(DEFAULTS.reader).toEqual({
      defaultMode: 'rtl',
      modes: {},
      fit: 'screen',
      brightness: 1,
      warm: 0,
      pageTransitions: true,
    });
  });

  it('keeps reader values in range', () => {
    expect(parseSettings({ reader: { brightness: 5, warm: -1 } }).reader).toMatchObject({ brightness: 1, warm: 0 });
    expect(parseSettings({ reader: { modes: { 12: 'webtoon', 13: 'sideways' } } }).reader.modes).toEqual({ 12: 'webtoon' });
  });

  it('resets an invalid value to its default', () => {
    expect(parseSettings({ background: { levels: 7 } }).background.levels).toBe(6);
  });

  it('resets only the bad field and keeps its valid neighbours', () => {
    expect(parseSettings({ library: { display: 'covers', scroll: 42 } }).library).toMatchObject({
      display: 'covers',
      scroll: 'horizontal',
    });
  });

  it('returns the defaults for garbage', () => {
    expect(parseSettings('garbage')).toEqual(DEFAULTS);
    expect(parseSettings(null)).toEqual(DEFAULTS);
  });

  it('drops unknown keys and keeps known ones', () => {
    const parsed = parseSettings({ future: { x: 1 }, theme: { mode: 'light' } });
    expect(parsed.theme.mode).toBe('light');
    expect(parsed).not.toHaveProperty('future');
  });
});
