import { create } from 'zustand';

export type OpeningFrom = { left: number; top: number; width: number; height: number; coverUrl: string };

type UiState = {
  /** Unread chapters shown on the Updates tab. */
  updatesBadge: number;
  /** Where the book-opening transition starts (set just before navigating to the reader). */
  openingFrom: OpeningFrom | null;
};

/** Transient UI state; not persisted. */
export const useUi = create<UiState>()(() => ({
  updatesBadge: 0,
  openingFrom: null,
}));
