import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { renderWithRouter } from '../../app/testRouter';
import type { FeedEntry } from '../../shared/model/types';
import { UpdatesPage } from './UpdatesPage';
import * as api from '../server/api';
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
  const unread = screen.getByRole('button', { name: /^Blue Hour, Ch. 12,/ });
  expect(within(unread).getByLabelText('Unread')).toBeInTheDocument();
  expect(within(unread).getByText('2h')).toBeInTheDocument();
  const read = screen.getByRole('button', { name: /^Kintsugi, Ch. 11,/ });
  expect(within(read).getByText('Ch. 11 · Read')).toBeInTheDocument();
  expect(within(read).queryByLabelText('Unread')).toBeNull();
});

it('opens the chapter in the reader', async () => {
  renderWithRouter(<UpdatesPage />, '/updates');
  await userEvent.click(screen.getByRole('button', { name: /^Blue Hour, Ch. 12,/ }));
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

it('tells screen readers whether each chapter is unread, and when it came', () => {
  renderWithRouter(<UpdatesPage />, '/updates');
  expect(screen.getByRole('button', { name: 'Blue Hour, Ch. 12, unread, 2h' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Kintsugi, Ch. 11, read, 4d' })).toBeInTheDocument();
});

it('shows a back catalogue fetched in one go as one row that opens the title', async () => {
  const at = new Date(2026, 9, 26, 9).getTime();
  const catalogue = Array.from({ length: 142 }, (_, i) => ({ ...entry(1000 + 142 - i, 'Old Tome', new Date(at - i * 5)), title: { id: 77, title: 'Old Tome', coverUrl: null, inLibrary: true } }));
  useUpdates.setState({ entries: [ENTRIES[0]!, ...catalogue] });
  renderWithRouter(<UpdatesPage />, '/updates');
  expect(screen.queryByRole('button', { name: /^Old Tome/ })).toBeNull();
  const row = screen.getByRole('link', { name: 'Old Tome, 142 chapters added, 142 unread, 3h' });
  expect(within(row).getByText('142 chapters added')).toBeInTheDocument();
  await userEvent.click(row);
  expect(screen.getByTestId('location')).toHaveTextContent('/title/77');
});

describe('marking all as read', () => {
  it('marks every unread chapter read and then disables the button', async () => {
    const spy = vi.spyOn(api, 'updateChapters').mockResolvedValue([12, 21]);
    renderWithRouter(<UpdatesPage />, '/updates');
    await userEvent.click(screen.getByRole('button', { name: 'Mark all updates as read' }));
    expect(spy).toHaveBeenCalledWith([12, 21], { read: true });
    expect(useUpdates.getState().entries.every((e) => e.chapter.read)).toBe(true);
    expect(await screen.findByRole('button', { name: 'Mark all updates as read' })).toBeDisabled();
    spy.mockRestore();
  });

  it('says how many could not be marked', async () => {
    const spy = vi.spyOn(api, 'updateChapters').mockResolvedValue([12]);
    renderWithRouter(<UpdatesPage />, '/updates');
    await userEvent.click(screen.getByRole('button', { name: 'Mark all updates as read' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't mark 1 chapter as read.");
    spy.mockRestore();
  });
});
