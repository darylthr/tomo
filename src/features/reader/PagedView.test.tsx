import { act, fireEvent, render, screen } from '@testing-library/react';
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

it('toggles the controls from the middle, once a double-tap is ruled out', () => {
  vi.useFakeTimers();
  const surface = show('rtl');
  const before = useReader.getState().chromeVisible;
  fireEvent.click(surface, { clientX: 500, clientY: 500 });
  expect(useReader.getState().chromeVisible).toBe(before);
  act(() => vi.advanceTimersByTime(300));
  expect(useReader.getState().chromeVisible).toBe(!before);
  vi.useRealTimers();
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

describe('zoom', () => {
  const layer = () => document.querySelector<HTMLElement>('[data-zoom-layer]')!;
  const doubleTap = (surface: HTMLElement, x = 500, y = 500) => {
    fireEvent.click(surface, { clientX: x, clientY: y });
    fireEvent.click(surface, { clientX: x, clientY: y });
  };
  const drag = (surface: HTMLElement, from: number, to: number) => {
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: from, clientY: 500 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: to, clientY: 500 });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: to, clientY: 500 });
  };

  it('double-tap zooms in and double-tap again zooms out', () => {
    const surface = show('rtl');
    doubleTap(surface);
    expect(layer().style.transform).toContain('scale(2.5)');
    expect(useReader.getState().chromeVisible).toBe(true);
    doubleTap(surface);
    expect(layer().style.transform).toContain('scale(1)');
  });

  it('a swipe pans while zoomed and only turns past the edge', () => {
    const surface = show('ltr');
    doubleTap(surface);
    // 2.5× of a 1000px page in a 1000px box leaves 750px to pan on each side.
    drag(surface, 900, 100);
    expect(index()).toBe(0);
    expect(layer().style.transform).toContain('translate(-750px');
    drag(surface, 900, 800);
    expect(index()).toBe(1);
    expect(layer().style.transform).toContain('scale(1)');
  });

  it('side taps do not turn the page while zoomed', () => {
    const surface = show('ltr');
    doubleTap(surface);
    fireEvent.click(surface, { clientX: 950, clientY: 500 });
    expect(index()).toBe(0);
  });

  it('keys zoom on the laptop', () => {
    show('rtl');
    fireEvent.keyDown(window, { key: '+' });
    expect(layer().style.transform).toContain('scale(1.5)');
    fireEvent.keyDown(window, { key: '0' });
    expect(layer().style.transform).toContain('scale(1)');
  });

  it('turning the page resets zoom', () => {
    show('rtl');
    fireEvent.keyDown(window, { key: '+' });
    act(() => useReader.getState().next());
    expect(layer().style.transform).toContain('scale(1)');
  });
});

describe('spreads', () => {
  it('shows the earlier page on the right in Manga mode', () => {
    useReader.getState().open(chapter, ['p0', 'p1', 'p2', 'p3', 'p4'], 0, 'rtl');
    useReader.getState().setLayout([[0], [1, 2], [3, 4]]);
    useReader.getState().goTo(3);
    render(<PagedView />);
    const names = screen.getAllByRole('img').map((i) => i.getAttribute('alt'));
    expect(names).toEqual(['Page 5 of 5', 'Page 4 of 5']);
  });

  it('shows the earlier page on the left in Comic mode', () => {
    useReader.getState().open(chapter, ['p0', 'p1', 'p2', 'p3', 'p4'], 0, 'ltr');
    useReader.getState().setLayout([[0], [1, 2], [3, 4]]);
    useReader.getState().goTo(3);
    render(<PagedView />);
    expect(screen.getAllByRole('img').map((i) => i.getAttribute('alt'))).toEqual(['Page 4 of 5', 'Page 5 of 5']);
  });
});

describe('long press', () => {
  it('long-pressing a page opens its actions and does not turn the page', () => {
    vi.useFakeTimers();
    const surface = show('ltr', 1);
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 900, clientY: 500 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 900, clientY: 500 });
    fireEvent.click(surface, { clientX: 900, clientY: 500 });
    expect(useReader.getState().pageActions).toBe(1);
    expect(index()).toBe(1);
    vi.useRealTimers();
  });

  it('a press that moves is a swipe, not a long press', () => {
    vi.useFakeTimers();
    const surface = show('ltr', 1);
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 900, clientY: 500 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 880, clientY: 500 });
    act(() => vi.advanceTimersByTime(600));
    expect(useReader.getState().pageActions).toBeNull();
    vi.useRealTimers();
  });

  it('right-click opens the actions on the laptop', () => {
    const surface = show('ltr', 2);
    fireEvent.contextMenu(surface.querySelector('img')!);
    expect(useReader.getState().pageActions).toBe(2);
  });
});

it('marks a bookmarked page while the controls show', () => {
  show('rtl', 1);
  act(() => useReader.setState({ bookmarkedPages: [1], chromeVisible: true }));
  expect(screen.getByLabelText('Bookmarked page')).toBeInTheDocument();
  act(() => useReader.setState({ chromeVisible: false }));
  expect(screen.queryByLabelText('Bookmarked page')).toBeNull();
});
