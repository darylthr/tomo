import type { FeedEntry } from '../../shared/model/types';
import { useUi } from '../../shared/ui/uiStore';
import { markTitleSeen, useUpdates } from './updatesStore';
import { useUpdatesSeen } from './updatesSeen';

const entry = (titleId: number, chapterId: number, at: number, read = false): FeedEntry => ({
  chapter: { id: chapterId, titleId, name: `Ch ${chapterId}`, number: chapterId, order: chapterId, read, bookmarked: false, lastPage: 0, pageCount: 5, uploadedAt: at, scanlator: null },
  title: { id: titleId, title: `T${titleId}`, coverUrl: null, inLibrary: true },
  at,
});

beforeEach(() => {
  useUpdatesSeen.setState({ titles: {} });
  useUpdates.setState({ entries: [entry(1, 10, 3000), entry(1, 9, 2000), entry(2, 20, 1000)] });
});

it('counts every unread update at first', () => {
  expect(useUi.getState().updatesBadge).toBe(3);
});

it('drops a title from the badge once it has been opened, leaving its read state alone', () => {
  markTitleSeen(1);
  expect(useUi.getState().updatesBadge).toBe(1);
  expect(useUpdates.getState().entries.every((e) => !e.chapter.read)).toBe(true);
});

it('counts chapters that arrive after the title was opened', () => {
  markTitleSeen(1);
  useUpdates.setState({ entries: [entry(1, 11, 4000), ...useUpdates.getState().entries] });
  expect(useUi.getState().updatesBadge).toBe(2);
});

it('does nothing for a title with no updates', () => {
  markTitleSeen(99);
  expect(useUpdatesSeen.getState().titles).toEqual({});
});
