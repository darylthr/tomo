import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';
import { renderWithRouter } from './testRouter';

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

it('shows the brand and the search button', () => {
  renderWithRouter(<Header />);
  expect(screen.getByText('Tomo')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Search all sources' })).toBeInTheDocument();
});

it('expands the search icon into a focused field', async () => {
  renderWithRouter(<Header />);
  await user().click(screen.getByRole('button', { name: 'Search all sources' }));
  const input = screen.getByRole('searchbox', { name: 'Search all sources' });
  expect(input).toHaveFocus();
  expect(screen.getByRole('banner')).toHaveAttribute('data-search-open', 'true');
});

it('searches all sources after a short pause in typing', async () => {
  renderWithRouter(<Header />);
  const u = user();
  await u.click(screen.getByRole('button', { name: 'Search all sources' }));
  await u.type(screen.getByRole('searchbox'), 'blue');
  act(() => vi.advanceTimersByTime(280));
  expect(screen.getByTestId('location')).toHaveTextContent('/search?q=blue');
});

it('goes back to the screen the search started from', async () => {
  const { router } = renderWithRouter(<Header />, '/updates');
  const u = user();
  await u.click(screen.getByRole('button', { name: 'Search all sources' }));
  await u.type(screen.getByRole('searchbox'), 'moon');
  act(() => vi.advanceTimersByTime(280));
  await u.type(screen.getByRole('searchbox'), 'light');
  act(() => vi.advanceTimersByTime(280));
  expect(screen.getByTestId('location')).toHaveTextContent('/search?q=moonlight');
  await act(() => router.navigate(-1));
  expect(screen.getByTestId('location')).toHaveTextContent('/updates');
});

it('closes and clears on Escape, returning focus to the search button', async () => {
  renderWithRouter(<Header />);
  const u = user();
  const button = screen.getByRole('button', { name: 'Search all sources' });
  await u.click(button);
  await u.type(screen.getByRole('searchbox'), 'moon');
  await u.keyboard('{Escape}');
  expect(screen.getByRole('searchbox', { hidden: true })).toHaveValue('');
  expect(screen.getByRole('banner')).toHaveAttribute('data-search-open', 'false');
  expect(button).toHaveFocus();
});

it('opens search with the / key', async () => {
  renderWithRouter(<Header />);
  await user().keyboard('/');
  expect(screen.getByRole('searchbox')).toHaveFocus();
});

it('uses a 16px input so iOS does not zoom', () => {
  renderWithRouter(<Header />);
  expect(screen.getByRole('searchbox', { hidden: true })).toHaveClass('input');
});

it('leaves settings to the navbar', () => {
  renderWithRouter(<Header />);
  expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
});
