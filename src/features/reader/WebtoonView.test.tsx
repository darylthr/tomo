import { act, fireEvent, render, screen } from '@testing-library/react';
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

function show(end?: React.ReactNode) {
  useReader.getState().open(chapter, ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'], 0, 'webtoon');
  const { container } = render(<WebtoonView end={end} />);
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

it('ends the strip with what it is given', () => {
  show(<button type="button">Next chapter</button>);
  expect(screen.getByRole('button', { name: 'Next chapter' })).toBeInTheDocument();
});

describe('zoom', () => {
  const zoomOf = (strip: HTMLElement) => strip.querySelector<HTMLElement>('[data-webtoon-column]')!.style.getPropertyValue('--zoom');

  it('double-tap widens the strip to 2× and back', () => {
    const strip = show();
    fireEvent.click(strip, { clientX: 200, clientY: 300 });
    fireEvent.click(strip, { clientX: 200, clientY: 300 });
    expect(zoomOf(strip)).toBe('2');
    fireEvent.click(strip, { clientX: 200, clientY: 300 });
    fireEvent.click(strip, { clientX: 200, clientY: 300 });
    expect(zoomOf(strip)).toBe('1');
  });

  it('Ctrl + wheel zooms up to 3×', () => {
    const strip = show();
    for (let i = 0; i < 20; i++) fireEvent.wheel(strip, { ctrlKey: true, deltaY: -100 });
    expect(zoomOf(strip)).toBe('3');
  });

  it('a single tap still shows or hides the controls', () => {
    vi.useFakeTimers();
    const strip = show();
    const before = useReader.getState().chromeVisible;
    fireEvent.click(strip, { clientX: 200, clientY: 300 });
    act(() => vi.advanceTimersByTime(300));
    expect(useReader.getState().chromeVisible).toBe(!before);
    vi.useRealTimers();
  });
});
