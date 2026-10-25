import { create } from 'zustand';

type UiState = {
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  /** Unread chapters shown on the Updates tab. */
  updatesBadge: number;
};

/** Transient UI state; not persisted. */
export const useUi = create<UiState>()((set) => ({
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  updatesBadge: 0,
}));
