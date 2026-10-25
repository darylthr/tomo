import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { applyTheme } from '../theme/applyTheme';
import { DEFAULTS, parseSettings, type DeepPartial, type Settings } from './schema';

type SettingsState = {
  settings: Settings;
  update: (patch: DeepPartial<Settings>) => void;
  reset: () => void;
};

function merge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object'
        ? merge(current, value as DeepPartial<typeof current>)
        : value;
  }
  return out as T;
}

/** localStorage that treats unreadable JSON as "nothing saved". */
const safeStorage: StateStorage = {
  getItem: (name) => {
    const raw = localStorage.getItem(name);
    if (raw === null) return null;
    try {
      JSON.parse(raw);
      return raw;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULTS,
      update: (patch) => set((s) => ({ settings: parseSettings(merge(s.settings, patch)) })),
      reset: () => set({ settings: DEFAULTS }),
    }),
    {
      name: 'tomo.settings',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ settings: s.settings }),
      migrate: (persisted) => ({ settings: parseSettings((persisted as { settings?: unknown } | null)?.settings) }),
      merge: (persisted, current) => ({
        ...current,
        settings: parseSettings((persisted as { settings?: unknown } | null)?.settings),
      }),
    },
  ),
);

let lastTheme = useSettings.getState().settings.theme;
applyTheme(lastTheme);
useSettings.subscribe((state) => {
  const t = state.settings.theme;
  if (t.mode !== lastTheme.mode || t.bg !== lastTheme.bg || t.ink !== lastTheme.ink || t.accent !== lastTheme.accent) {
    lastTheme = state.settings.theme;
    applyTheme(lastTheme);
  }
});
