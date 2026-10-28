import type { CategoryFilter } from './CategoryBar';

/**
 * Where the shelf was left, kept for the session: leaving a title (its page or its reader) and coming back
 * finds the same tab with the same title on screen. Not persisted; a fresh app open starts at the default category.
 */
export const libraryView: { filter: CategoryFilter | null; titleId: number | null } = {
  filter: null,
  titleId: null,
};
