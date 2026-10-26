import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { renderWithRouter } from '../../app/testRouter';
import type { FeedEntry } from '../../shared/model/types';
import { UpdatesPage } from './UpdatesPage';
import { useUpdates } from './updatesStore';

const NOW = new Date(2026, 9, 26, 12, 0).getTime();

function entry(id: number, title: string, at: Date, read = false, number = id): FeedEntry {
  return {
    chapter: { id, titleId: id * 10, name: `Chapter ${number}`, number, order: number, read, bookmarked: false, lastPage: 0, pageCount: 0, uploadedAt: 0, scanlator: null },
    title: { id: id * 10, title, coverUrl: null, inLibrary: true },
    at: at.getTime(),
  };
}

const ENTRIES = [
  entry(12, 'Blue Hour', new Date(2026, 9, 26, 10)),
  entry(21, 'Kintsugi', new Date(2026, 9, 25, 21)),
  entry(20, 'Kintsugi', new Date(2026, 9, 21, 15), true, 11),
];

let load: Mock<() => Promise<void>>;
let check: Mock<(opts?: { force?: boolean }) => Promise<void>>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  load = vi.fn(async () => {});
  check = vi.fn(async () => {});
  useUpdates.setState({ status: 'ready', entries: ENTRIES, checking: false, load, check });
});
afterEach(() => vi.useRealTimers());

it('groups new chapters by day', () => {
  renderWithRouter(<UpdatesPage />, '/updates');
  const labels = screen.getAllByText(/^(Today|Yesterday|Wednesday, Oct 21)$/).map((el) => el.textContent);
  expect(labels).toEqual(['Today', 'Yesterday', 'Wednesday, Oct 21']);
});

it('marks unread chapters and dims read ones', () => {
  renderWithRouter(<UpdatesPage />, '/updates');
  const unread = screen.getByRole('button', { name: 'Blue Hour, Ch. 12' });
  expect(within(unread).getByLabelText('Unread')).toBeInTheDocument();
  expect(within(unread).getByText('2h')).toBeInTheDocument();
  const read = screen.getByRole('button', { name: 'Kintsugi, Ch. 11' });
  expect(within(read).getByText('Ch. 11 · Read')).toBeInTheDocument();
  expect(within(read).queryByLabelText('Unread')).toBeNull();
});

it('opens the chapter in the reader', async () => {
  renderWithRouter(<UpdatesPage />, '/updates');
  await userEvent.click(screen.getByRole('button', { name: 'Blue Hour, Ch. 12' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/read/12');
});

it('opens the title from its thumbnail', async () => {
  renderWithRouter(<UpdatesPage />, '/updates');
  await userEvent.click(screen.getByRole('link', { name: 'Open Blue Hour' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/title/120');
});

it('reloads on open and checks sources from the refresh button', async () => {
  renderWithRouter(<UpdatesPage />, '/updates');
  expect(load).toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
  expect(check).toHaveBeenCalledWith({ force: true });
});

it('says while Suwayomi is checking', () => {
  useUpdates.setState({ checking: true });
  renderWithRouter(<UpdatesPage />, '/updates');
  expect(screen.getByText('Checking sources for new chapters…')).toBeInTheDocument();
});

it('offers a retry when the list could not load', async () => {
  useUpdates.setState({ status: 'error', entries: [] });
  renderWithRouter(<UpdatesPage />, '/updates');
  expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load updates");
  load.mockClear();
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(load).toHaveBeenCalledTimes(1);
});

it('says when there is nothing new', () => {
  useUpdates.setState({ entries: [] });
  renderWithRouter(<UpdatesPage />, '/updates');
  expect(screen.getByText('No new chapters in the last 90 days.')).toBeInTheDocument();
});

it('explains when checks happen', () => {
  renderWithRouter(<UpdatesPage />, '/updates');
  expect(screen.getByText('Checked when you open Tomo or pull to refresh. No background checks.')).toBeInTheDocument();
});
