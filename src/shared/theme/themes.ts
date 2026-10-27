import { contrastRatio, luminance } from './contrast';

/** A theme's five colours (`#rrggbb`); everything else in the app is derived from them. */
export type Colours = { bg: string; surface: string; ink: string; accent: string; chrome: string };
export type Scheme = 'dark' | 'light';
export type BuiltinTheme = { id: string; name: string; scheme: Scheme; colours: Colours };
export type CustomTheme = { id: string; name: string; colours: Colours };
export type ThemeState = { current: string; overrides: Record<string, Partial<Colours>>; custom: CustomTheme[] };
export type ResolvedTheme = { id: string; name: string; scheme: Scheme; colours: Colours; builtin: boolean; edited: boolean };

const c = (bg: string, surface: string, ink: string, accent: string, chrome: string): Colours => ({ bg, surface, ink, accent, chrome });

/** Built-in themes, after their published palettes. Tomo Dark is today's look and the default. */
export const BUILTINS: BuiltinTheme[] = [
  { id: 'tomo-dark', name: 'Tomo Dark', scheme: 'dark', colours: c('#050506', '#07070a', '#f1f1f4', '#8b6cff', '#0e0e10') },
  { id: 'tomo-light', name: 'Tomo Light', scheme: 'light', colours: c('#f4f4f6', '#ffffff', '#111114', '#6d4bff', '#e9e9ee') },
  { id: 'github-dark', name: 'GitHub Dark', scheme: 'dark', colours: c('#0d1117', '#161b22', '#e6edf3', '#2f81f7', '#010409') },
  { id: 'github-light', name: 'GitHub Light', scheme: 'light', colours: c('#ffffff', '#f6f8fa', '#1f2328', '#0969da', '#f6f8fa') },
  { id: 'discord-dark', name: 'Discord Dark', scheme: 'dark', colours: c('#313338', '#2b2d31', '#dbdee1', '#5865f2', '#1e1f22') },
  { id: 'discord-midnight', name: 'Discord Midnight', scheme: 'dark', colours: c('#000000', '#111214', '#dbdee1', '#5865f2', '#000000') },
  { id: 'dark-modern', name: 'Dark Modern', scheme: 'dark', colours: c('#1f1f1f', '#181818', '#cccccc', '#0078d4', '#181818') },
  { id: 'one-dark', name: 'One Dark', scheme: 'dark', colours: c('#282c34', '#21252b', '#abb2bf', '#61afef', '#21252b') },
  { id: 'dracula', name: 'Dracula', scheme: 'dark', colours: c('#282a36', '#343746', '#f8f8f2', '#bd93f9', '#21222c') },
  { id: 'nord', name: 'Nord', scheme: 'dark', colours: c('#2e3440', '#3b4252', '#eceff4', '#88c0d0', '#272c36') },
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha', scheme: 'dark', colours: c('#1e1e2e', '#313244', '#cdd6f4', '#cba6f7', '#181825') },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', scheme: 'light', colours: c('#eff1f5', '#ffffff', '#4c4f69', '#8839ef', '#e6e9ef') },
];

const DEFAULT = BUILTINS[0]!;

/** Light backgrounds get light-scheme treatment (status colours, the background wash). */
export const schemeOf = (bg: string): Scheme => (luminance(bg) > 0.4 ? 'light' : 'dark');

/** Black or white, whichever reads better on the accent. */
export const onAccent = (accent: string): '#000000' | '#ffffff' =>
  contrastRatio('#000000', accent) > contrastRatio('#ffffff', accent) ? '#000000' : '#ffffff';

/** Text on the navbar and frame. */
export const chromeInk = (chrome: string): string => (schemeOf(chrome) === 'light' ? '#111114' : '#f1f1f4');

/** The theme to show: a built-in with the owner's edits, or a custom theme; Tomo Dark if neither exists. */
export function resolveTheme(state: ThemeState): ResolvedTheme {
  const custom = state.custom.find((t) => t.id === state.current);
  if (custom) return { ...custom, scheme: schemeOf(custom.colours.bg), builtin: false, edited: false };
  const base = BUILTINS.find((t) => t.id === state.current) ?? DEFAULT;
  const overrides = state.overrides[base.id] ?? {};
  const edited = Object.keys(overrides).some((k) => overrides[k as keyof Colours] !== base.colours[k as keyof Colours]);
  const colours = { ...base.colours, ...overrides };
  // An edited background can change a built-in's scheme (built-ins' declared schemes match their backgrounds).
  return { id: base.id, name: base.name, scheme: schemeOf(colours.bg), colours, builtin: true, edited };
}

const newId = () => `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** A copy of the current theme's colours as "My theme" (numbered if taken), made current. */
export function newTheme(state: ThemeState): ThemeState {
  const taken = new Set(state.custom.map((t) => t.name));
  let name = 'My theme';
  for (let n = 2; taken.has(name); n++) name = `My theme ${n}`;
  const id = newId();
  return { ...state, current: id, custom: [...state.custom, { id, name, colours: resolveTheme(state).colours }] };
}

const isBuiltin = (id: string) => BUILTINS.some((t) => t.id === id);

/** Changes one colour: a built-in keeps it as an override, a custom theme stores it. */
export function setColour(state: ThemeState, id: string, key: keyof Colours, hex: string): ThemeState {
  if (isBuiltin(id)) return { ...state, overrides: { ...state.overrides, [id]: { ...state.overrides[id], [key]: hex } } };
  return { ...state, custom: state.custom.map((t) => (t.id === id ? { ...t, colours: { ...t.colours, [key]: hex } } : t)) };
}

/** Puts a built-in back the way it shipped. */
export function resetTheme(state: ThemeState, id: string): ThemeState {
  const overrides = { ...state.overrides };
  delete overrides[id];
  return { ...state, overrides };
}

export function renameTheme(state: ThemeState, id: string, name: string): ThemeState {
  return { ...state, custom: state.custom.map((t) => (t.id === id ? { ...t, name } : t)) };
}

/** Removes a custom theme; if it was in use, Tomo Dark takes over. */
export function deleteTheme(state: ThemeState, id: string): ThemeState {
  return { ...state, current: state.current === id ? 'tomo-dark' : state.current, custom: state.custom.filter((t) => t.id !== id) };
}
