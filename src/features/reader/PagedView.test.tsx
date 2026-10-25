import { fireEvent, render, screen } from '@testing-library/react';
import type { Chapter, ReaderMode } from '../../shared/model/types';
import { PagedView } from './PagedView';
import { useReader } from './readerStore';

const chapter: Chapter = {
  id: 11,
  titleId: 1,
  name: 'Chapter 2',
  number: 2,
  order: 2,
  read: false,
  bookmarked: false,
  lastPage: 0,
  pageCount: 5,
  uploadedAt: 0,
  scanlator: null,
};

beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 1000,
    height: 1000,
    right: 1000,
    bottom: 1000,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

function show(mode: ReaderMode, start = 0) {
  useReader.getState().open(chapter, ['p0', 'p1', 'p2', 'p3', 'p4'], start, mode);
  render(<PagedView />);
  return screen.getByRole('img', { name: /Page/ }).closest('[data-reader-surface]') as HTMLElement;
}

const index = () => useReader.getState().index;

it('reads manga right to left: the left side turns forward', () => {
  const surface = show('rtl');
  fireEvent.click(surface, { clientX: 100, clientY: 500 });
  expect(index()).toBe(1);
  fireEvent.click(surface, { clientX: 900, clientY: 500 });
  expect(index()).toBe(0);
});

it('maps the arrow keys to the manga direction', () => {
  show('rtl', 1);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(index()).toBe(0);
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(index()).toBe(2);
});

it('reads comics left to right', () => {
  const surface = show('ltr');
  fireEvent.click(surface, { clientX: 900, clientY: 500 });
  expect(index()).toBe(1);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(index()).toBe(2);
});

it('turns vertical pages from the bottom', () => {
  const surface = show('vertical');
  fireEvent.click(surface, { clientX: 500, clientY: 900 });
  expect(index()).toBe(1);
  fireEvent.click(surface, { clientX: 500, clientY: 100 });
  expect(index()).toBe(0);
});

it('toggles the controls from the middle', () => {
  const surface = show('rtl');
  const before = useReader.getState().chromeVisible;
  fireEvent.click(surface, { clientX: 500, clientY: 500 });
  expect(useReader.getState().chromeVisible).toBe(!before);
});

it('turns forward with space in every mode', () => {
  show('vertical');
  fireEvent.keyDown(window, { key: ' ' });
  expect(index()).toBe(1);
});

it('names each page for screen readers', () => {
  show('rtl', 2);
  expect(screen.getByRole('img', { name: 'Page 3 of 5' })).toBeInTheDocument();
});

it('a tap right after a touch swipe still turns the page', () => {
  const surface = show('ltr', 0);
  // A touch swipe: no click follows it.
  fireEvent.pointerDown(surface, { clientX: 600, clientY: 500 });
  fireEvent.pointerUp(surface, { clientX: 300, clientY: 500 });
  expect(index()).toBe(1);
  // Then a tap on the right third.
  fireEvent.pointerDown(surface, { clientX: 900, clientY: 500 });
  fireEvent.pointerUp(surface, { clientX: 900, clientY: 500 });
  fireEvent.click(surface, { clientX: 900, clientY: 500 });
  expect(index()).toBe(2);
});
