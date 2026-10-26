import { act, fireEvent, render, screen } from '@testing-library/react';
import { Page } from './Page';

it('shows an action beside the title', () => {
  render(<Page title="Updates" action={<button type="button">Check</button>} />);
  expect(screen.getByRole('heading', { name: 'Updates' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
});

it('refreshes when pulled down from the top', async () => {
  const onRefresh = vi.fn(async () => {});
  render(<Page title="Updates" onRefresh={onRefresh} />);
  const page = screen.getByRole('region', { name: 'Updates' });
  await act(async () => {
    fireEvent.touchStart(page, { touches: [{ clientX: 0, clientY: 100 }] });
    fireEvent.touchMove(page, { touches: [{ clientX: 0, clientY: 300 }] });
    fireEvent.touchEnd(page, { touches: [] });
  });
  expect(onRefresh).toHaveBeenCalledTimes(1);
});
