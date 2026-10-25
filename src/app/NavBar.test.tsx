import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useUi } from '../shared/ui/uiStore';
import { NavBar } from './NavBar';
import { renderWithRouter } from './testRouter';

const TABS = ['Library', 'Updates', 'History', 'Search'];

beforeEach(() => useUi.setState({ updatesBadge: 0 }));

it('shows the four sections, each with a visible label', () => {
  renderWithRouter(<NavBar />);
  const tabs = screen.getAllByRole('tab');
  expect(tabs.map((t) => t.textContent?.replace(/\d+/g, '').trim())).toEqual(TABS);
  TABS.forEach((name) => expect(screen.getByText(name)).toBeVisible());
});

it('selects the tab for the current route', () => {
  renderWithRouter(<NavBar />, '/history');
  expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  ['Library', 'Updates', 'Search'].forEach((name) =>
    expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'false'),
  );
});

it('navigates when a tab is tapped', async () => {
  renderWithRouter(<NavBar />);
  await userEvent.click(screen.getByRole('tab', { name: 'Updates' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/updates');
  expect(screen.getByRole('tab', { name: 'Updates' })).toHaveAttribute('aria-selected', 'true');
});

it('shows the unread badge on Updates only when there is something new', () => {
  renderWithRouter(<NavBar />);
  const updates = screen.getByRole('tab', { name: 'Updates' });
  expect(within(updates).queryByText(/\d+/)).toBeNull();
  act(() => useUi.setState({ updatesBadge: 12 }));
  expect(within(updates).getByText('12')).toBeInTheDocument();
});
