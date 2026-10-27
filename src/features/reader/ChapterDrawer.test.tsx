import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Chapter } from '../../shared/model/types';
import { useChapterViews } from '../title/chapterViewStore';
import { ChapterDrawer } from './ChapterDrawer';

const ch = (id: number, number: number, read = false) => ({ id, number, order: number, name: `Chapter ${number}`, read, bookmarked: false }) as Chapter;
const chapters = [ch(10, 1, true), ch(11, 2), ch(12, 3)];

it("lists every chapter in the title's order and opens one", async () => {
  // The title page sorts this title oldest first and filters to unread; the drawer keeps the order, not the filter.
  useChapterViews.setState({ views: { 1: { sort: 'chapter', descending: false, unreadOnly: true, bookmarkedOnly: false, dedupe: false } } });
  const onPick = vi.fn();
  render(<ChapterDrawer open titleId={1} chapters={chapters} currentId={11} onPick={onPick} onClose={vi.fn()} />);
  const list = within(screen.getByRole('dialog', { name: 'Chapters' })).getByRole('list');
  const rows = within(list).getAllByRole('button');
  expect(rows.map((r) => r.textContent)).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3']);
  expect(rows[1]).toHaveAttribute('aria-current', 'true');
  await userEvent.click(rows[2]!);
  expect(onPick).toHaveBeenCalledWith(chapters[2]);
});
