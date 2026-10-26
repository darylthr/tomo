import { act, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { usePullToRefresh } from './usePullToRefresh';

function Scroller({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const ref = useRef<HTMLDivElement>(null);
  const { refreshing } = usePullToRefresh(ref, onRefresh);
  return <div ref={ref} data-testid="scroller" data-refreshing={refreshing} />;
}

function pull(el: HTMLElement, distance: number) {
  fireEvent.touchStart(el, { touches: [{ clientX: 0, clientY: 100 }] });
  fireEvent.touchMove(el, { touches: [{ clientX: 0, clientY: 100 + distance }] });
  fireEvent.touchEnd(el, { touches: [] });
}

it('refreshes when pulled down far enough at the top', async () => {
  const onRefresh = vi.fn(async () => {});
  const { getByTestId } = render(<Scroller onRefresh={onRefresh} />);
  await act(async () => pull(getByTestId('scroller'), 200));
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

it('ignores pulls when the list is scrolled down', async () => {
  const onRefresh = vi.fn(async () => {});
  const { getByTestId } = render(<Scroller onRefresh={onRefresh} />);
  const el = getByTestId('scroller');
  el.scrollTop = 50;
  await act(async () => pull(el, 200));
  expect(onRefresh).not.toHaveBeenCalled();
});

it('ignores short pulls', async () => {
  const onRefresh = vi.fn(async () => {});
  const { getByTestId } = render(<Scroller onRefresh={onRefresh} />);
  await act(async () => pull(getByTestId('scroller'), 80));
  expect(onRefresh).not.toHaveBeenCalled();
});
