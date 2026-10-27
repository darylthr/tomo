import { act, fireEvent, render, screen } from '@testing-library/react';
import { useSettings } from '../../shared/settings/store';
import { DirectionHint } from './DirectionHint';

beforeEach(() => useSettings.getState().reset());

it('shows once per title and mode', () => {
  const { unmount } = render(<DirectionHint titleId={7} mode="rtl" />);
  expect(screen.getByText('Swipe → to read')).toBeInTheDocument();
  act(() => {
    fireEvent.pointerDown(window);
  });
  expect(screen.queryByText('Swipe → to read')).toBeNull();
  expect(useSettings.getState().settings.reader.hintsSeen).toEqual({ '7:rtl': true });
  unmount();
  render(<DirectionHint titleId={7} mode="rtl" />);
  expect(screen.queryByText('Swipe → to read')).toBeNull();
});

it('says which way to read in each mode', () => {
  render(<DirectionHint titleId={8} mode="webtoon" />);
  expect(screen.getByText('Scroll down to read')).toBeInTheDocument();
});

it('fades out on its own after two seconds', () => {
  vi.useFakeTimers();
  render(<DirectionHint titleId={9} mode="ltr" />);
  expect(screen.getByText('Swipe ← to read')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(2200));
  expect(screen.queryByText('Swipe ← to read')).toBeNull();
  vi.useRealTimers();
});
