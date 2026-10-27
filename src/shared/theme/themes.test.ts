import { contrastRatio } from './contrast';
import { BUILTINS, deleteTheme, newTheme, onAccent, renameTheme, resetTheme, resolveTheme, schemeOf, setColour, type ThemeState } from './themes';

const state = (patch: Partial<ThemeState>): ThemeState => ({ current: 'tomo-dark', overrides: {}, custom: [], ...patch });

it('every built-in theme keeps text readable', () => {
  for (const t of BUILTINS) {
    expect(contrastRatio(t.colours.ink, t.colours.bg), `${t.name} text on background`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.colours.ink, t.colours.surface), `${t.name} text on cards`).toBeGreaterThanOrEqual(4.5);
  }
});

it("Tomo Dark is today's look", () => {
  expect(BUILTINS[0]).toMatchObject({
    id: 'tomo-dark',
    colours: { bg: '#050506', surface: '#07070a', ink: '#f1f1f4', accent: '#8b6cff', chrome: '#0e0e10' },
  });
});

it('built-ins declare the scheme their background implies', () => {
  for (const t of BUILTINS) expect(schemeOf(t.colours.bg), t.name).toBe(t.scheme);
});

it('resolves a built-in with overrides', () => {
  const t = resolveTheme(state({ current: 'nord', overrides: { nord: { accent: '#ff0000' } } }));
  expect(t).toMatchObject({ id: 'nord', builtin: true, edited: true, colours: { accent: '#ff0000', bg: '#2e3440' } });
  expect(resolveTheme(state({ current: 'nord' })).edited).toBe(false);
  expect(resolveTheme(state({ current: 'nord', overrides: { nord: { bg: '#fafafa' } } })).scheme).toBe('light');
});

it('resolves a custom theme and computes its scheme', () => {
  const colours = { bg: '#f5ecd7', surface: '#fffaf0', ink: '#3b2f1e', accent: '#b5651d', chrome: '#efe3c8' };
  const t = resolveTheme(state({ current: 'c1', custom: [{ id: 'c1', name: 'Paper', colours }] }));
  expect(t).toMatchObject({ id: 'c1', name: 'Paper', scheme: 'light', builtin: false, colours });
});

it('falls back to Tomo Dark for an unknown or deleted theme', () => {
  expect(resolveTheme(state({ current: 'gone' })).id).toBe('tomo-dark');
});

it('puts dark text on light accents', () => {
  expect(onAccent('#ffd400')).toBe('#000000');
  expect(onAccent('#5865f2')).toBe('#ffffff');
});

it('makes a new theme from the current one, numbering repeated names', () => {
  const first = newTheme(state({ current: 'nord' }));
  const made = first.custom[0]!;
  expect(made).toMatchObject({ name: 'My theme', colours: BUILTINS.find((t) => t.id === 'nord')!.colours });
  expect(first.current).toBe(made.id);
  const second = newTheme(first);
  expect(second.custom.map((t) => t.name)).toEqual(['My theme', 'My theme 2']);
  expect(new Set(second.custom.map((t) => t.id)).size).toBe(2);
});

describe('editing themes', () => {
  const colours = { bg: '#f5ecd7', surface: '#fffaf0', ink: '#3b2f1e', accent: '#b5651d', chrome: '#efe3c8' };
  const withPaper = state({ current: 'p', custom: [{ id: 'p', name: 'Paper', colours }] });

  it('edits a built-in through overrides, and a custom theme directly', () => {
    expect(setColour(state({}), 'nord', 'accent', '#ff0000').overrides).toEqual({ nord: { accent: '#ff0000' } });
    expect(setColour(withPaper, 'p', 'ink', '#000000').custom[0]!.colours.ink).toBe('#000000');
  });

  it('resets a built-in to how it shipped', () => {
    const edited = setColour(state({}), 'nord', 'accent', '#ff0000');
    expect(resetTheme(edited, 'nord').overrides).toEqual({});
  });

  it('renames a custom theme', () => {
    expect(renameTheme(withPaper, 'p', 'Sepia').custom[0]!.name).toBe('Sepia');
  });

  it('deletes a custom theme, falling back to Tomo Dark when it was current', () => {
    const after = deleteTheme(withPaper, 'p');
    expect(after.custom).toEqual([]);
    expect(after.current).toBe('tomo-dark');
    expect(deleteTheme({ ...withPaper, current: 'nord' }, 'p').current).toBe('nord');
  });
});
