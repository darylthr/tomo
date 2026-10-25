import { fireEvent, render } from '@testing-library/react';
import type { Title } from '../../../shared/model/types';
import { Shelf } from './Shelf';

const title = (id: number): Title => ({
  id,
  title: `Title ${id}`,
  coverUrl: null,
  author: '',
  artist: '',
  description: '',
  genres: [],
  status: 'ongoing',
  unread: 1,
  chapterCount: 10,
  inLibrary: true,
  categoryIds: [],
  sourceName: '',
  initialized: true,
});

const many = Array.from({ length: 2000 }, (_, i) => title(i + 1));

it('mounts only a handful of books for a huge library', () => {
  const { container } = render(<Shelf titles={many} display="books" lite={false} fadeSides onCenterChange={() => {}} onOpen={() => {}} />);
  const books = container.querySelectorAll('[data-title-id]');
  expect(books.length).toBeGreaterThan(0);
  expect(books.length).toBeLessThanOrEqual(12);
});

it('opens only the centred book; tapping a side book centres it instead', () => {
  const onOpen = vi.fn();
  const { container } = render(
    <Shelf titles={many.slice(0, 5)} display="books" lite={false} fadeSides onCenterChange={() => {}} onOpen={onOpen} />,
  );
  fireEvent.click(container.querySelector('[data-index="0"]')!);
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), expect.any(HTMLElement));
  fireEvent.click(container.querySelector('[data-index="2"]')!);
  expect(onOpen).toHaveBeenCalledTimes(1);
});

it('labels books for screen readers', () => {
  const { getByRole } = render(
    <Shelf titles={many.slice(0, 3)} display="books" lite={false} fadeSides onCenterChange={() => {}} onOpen={() => {}} />,
  );
  expect(getByRole('button', { name: 'Title 1' })).toBeInTheDocument();
});
