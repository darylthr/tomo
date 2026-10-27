import { DEFAULTS, parseSettings } from './schema';

describe('parseSettings', () => {
  it('returns the defaults for an empty object', () => {
    expect(parseSettings({})).toEqual(DEFAULTS);
  });

  it('has the spec defaults', () => {
    expect(DEFAULTS.theme).toEqual({ current: 'tomo-dark', overrides: {}, custom: [] });
    expect(DEFAULTS.background).toEqual({ enabled: false, levels: 6, cell: 2, imageKey: null });
    expect(DEFAULTS.library).toEqual({
      display: 'books',
      scroll: 'horizontal',
      fadeSides: true,
      styledLogos: true,
      detail: 'full',
      mirrorRtl: false,
      sortBy: 'title',
      sortDescending: false,
      gridSize: 'm',
      gridTitles: true,
      gridProgress: true,
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
    const parsed = parseSettings({ future: { x: 1 }, theme: { current: 'nord' } });
    expect(parsed.theme.current).toBe('nord');
    expect(parsed).not.toHaveProperty('future');
  });
});

describe('themes', () => {
  it('migrates the old Dark and Light modes', () => {
    expect(parseSettings({ theme: { mode: 'light', bg: '#f4f4f6', ink: '#111114', accent: '#8b6cff' } }).theme.current).toBe('tomo-light');
    expect(parseSettings({ theme: { mode: 'dark' } }).theme).toEqual({ current: 'tomo-dark', overrides: {}, custom: [] });
  });

  it('migrates an old Custom theme into a custom theme called My theme', () => {
    const { theme } = parseSettings({ theme: { mode: 'custom', bg: '#102030', ink: '#fafafa', accent: '#ff8800' } });
    expect(theme.custom).toEqual([
      { id: theme.current, name: 'My theme', colours: { bg: '#102030', surface: '#102030', ink: '#fafafa', accent: '#ff8800', chrome: '#102030' } },
    ]);
  });

  it('drops bad custom entries and bad override colours one by one', () => {
    const colours = { bg: '#000000', surface: '#111111', ink: '#ffffff', accent: '#ff0000', chrome: '#000000' };
    const { theme } = parseSettings({
      theme: {
        current: 'ok',
        overrides: { nord: { accent: 'red', bg: '#123456' } },
        custom: [{ id: 'broken', name: 'No colours' }, { id: 'ok', name: 'Fine', colours }],
      },
    });
    expect(theme.custom).toEqual([{ id: 'ok', name: 'Fine', colours }]);
    expect(theme.overrides).toEqual({ nord: { bg: '#123456' } });
  });
});
