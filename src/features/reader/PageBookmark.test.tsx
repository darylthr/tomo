import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageBookmark } from './PageBookmark';

const mark = { id: 'a', chapterId: 11, page: 3, note: '', createdAt: 1 };

it('bookmarks the page, then offers a note', async () => {
  const onAdd = vi.fn(async () => {});
  const { rerender } = render(<PageBookmark bookmark={undefined} onAdd={onAdd} onRemove={vi.fn()} onNote={vi.fn()} error={null} />);
  await userEvent.click(screen.getByRole('button', { name: 'Bookmark page' }));
  expect(onAdd).toHaveBeenCalled();
  const onNote = vi.fn(async () => {});
  rerender(<PageBookmark bookmark={mark} onAdd={onAdd} onRemove={vi.fn()} onNote={onNote} error={null} />);
  await userEvent.click(screen.getByRole('button', { name: 'Add a note' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'the reveal');
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
  expect(onNote).toHaveBeenCalledWith('a', 'the reveal');
});

it('removes a bookmark', async () => {
  const onRemove = vi.fn(async () => {});
  render(<PageBookmark bookmark={mark} onAdd={vi.fn()} onRemove={onRemove} onNote={vi.fn()} error={null} />);
  await userEvent.click(screen.getByRole('button', { name: 'Remove bookmark' }));
  expect(onRemove).toHaveBeenCalledWith('a');
});

it('shows why a bookmark could not be saved', () => {
  render(<PageBookmark bookmark={undefined} onAdd={vi.fn()} onRemove={vi.fn()} onNote={vi.fn()} error="Couldn't save the bookmark" />);
  expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save the bookmark");
});
