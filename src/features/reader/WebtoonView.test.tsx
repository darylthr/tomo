import { fireEvent, render, screen } from '@testing-library/react';
import type { Chapter } from '../../shared/model/types';
import { useReader } from './readerStore';
import { WebtoonView } from './WebtoonView';

const chapter: Chapter = {
  id: 11,
  titleId: 1,
  name: 'Chapter 2',
  number: 2,
  order: 2,
  read: false,
  bookmarked: false,
  lastPage: 0,
  pageCount: 6,
  uploadedAt: 0,
  scanlator: null,
};

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterAll(() => vi.unstubAllGlobals());

function show(nextChapter: (() => void) | null = null) {
  useReader.getState().open(chapter, ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'], 0, 'webtoon');
  const { container } = render(<WebtoonView nextChapter={nextChapter} />);
  return container.firstElementChild as HTMLElement;
}

it('counts the last page as read once the strip is scrolled to the end', () => {
  const strip = show();
  Object.defineProperties(strip, {
    scrollTop: { configurable: true, value: 4200 },
    clientHeight: { configurable: true, value: 800 },
    scrollHeight: { configurable: true, value: 5000 },
  });
  fireEvent.scroll(strip);
  expect(useReader.getState().index).toBe(5);
});

it('finishes the chapter before Next chapter moves on', () => {
  const next = vi.fn(() => expect(useReader.getState().index).toBe(5));
  show(next);
  fireEvent.click(screen.getByRole('button', { name: 'Next chapter' }));
  expect(next).toHaveBeenCalledTimes(1);
});
