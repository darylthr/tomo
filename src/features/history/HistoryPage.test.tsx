import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../app/testRouter';
import type { FeedEntry } from '../../shared/model/types';
import * as continueReading from '../library/continueReading';
import * as api from '../server/api';
import { HistoryPage } from './HistoryPage';
import { HISTORY_STEP_MS } from './history';
import { useHistoryHidden } from './historyHidden';

vi.mock('../server/api', () => ({ getHistory: vi.fn() }));
vi.mock('../library/continueReading', () => ({ loadChapters: vi.fn() }));

const NOW = new Date(2026, 9, 26, 12, 0).getTime();

type Opts = { read?: boolean; lastPage?: number; pageCount?: number; coverUrl?: string | null; inLibrary?: boolean };
function entry(id: number, titleId: number, title: string, at: Date, o: Opts = {}): FeedEntry {
  return {
    chapter: {
      id, titleId, name: `Chapter ${id}`, number: id, order: id, read: o.read ?? false, bookmarked: false,
      lastPage: o.lastPage ?? 0, pageCount: o.pageCount ?? 24, uploadedAt: 0, scanlator: null,
    },
    title: { id: titleId, title, coverUrl: o.coverUrl === undefined ? 'https://tomo.home/c.jpg' : o.coverUrl, inLibrary: o.inLibrary ?? true },
    at: at.getTime(),
  };
}

const ENTRIES = [
  entry(12, 1, 'Blue Hour', new Date(2026, 9, 26, 10), { lastPage: 3 }),
  entry(11, 1, 'Blue Hour', new Date(2026, 9, 26, 9), { read: true }),
  entry(21, 2, 'Kintsugi', new Date(2026, 9, 25, 21), { read: true }),
  entry(5, 4, 'Paper Moon', new Date(2026, 9, 21, 15), { lastPage: 2, pageCount: 0, coverUrl: null, inLibrary: false }),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.mocked(api.getHistory).mockReset().mockResolvedValue(ENTRIES);
  useHistoryHidden.setState({ clearedAt: 0, titles: {} });
});
afterEach(() => vi.useRealTimers());

const row = (title: string) => screen.getByRole('button', { name: `Resume ${title}` }).closest('li')!;

it('shows one row per title, grouped by day, with chapter and page', async () => {
  renderWithRouter(<HistoryPage />, '/history');
  expect(await screen.findByText('Today')).toBeInTheDocument();
  expect(screen.getByText('Yesterday')).toBeInTheDocument();
  expect(screen.getByText('Wednesday, Oct 21')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Resume / })).toHaveLength(3);
  expect(within(row('Blue Hour')).getByText(/^Ch\. 12 · Page 4 of 24 · /)).toBeInTheDocument();
  expect(within(row('Kintsugi')).getByText(/^Ch\. 21 · Read · /)).toBeInTheDocument();
  expect(api.getHistory).toHaveBeenCalledWith(NOW - HISTORY_STEP_MS);
});

it('leaves out the page count when it is unknown, and shows a letter without a cover', async () => {
  renderWithRouter(<HistoryPage />, '/history');
  await screen.findByText('Today');
  const paper = row('Paper Moon');
  expect(within(paper).getByText('Ch. 5 · Page 3 · Wed')).toBeInTheDocument();
  expect(within(paper).getByText('P')).toBeInTheDocument();
});

it('resumes an unfinished chapter where it was left', async () => {
  renderWithRouter(<HistoryPage />, '/history');
  await userEvent.click(await screen.findByRole('button', { name: 'Resume Blue Hour' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/read/12');
});

it('resumes at the next chapter after a finished one', async () => {
  vi.mocked(continueReading.loadChapters).mockResolvedValue([
    { ...ENTRIES[2]!.chapter },
    { ...ENTRIES[2]!.chapter, id: 22, order: 22, number: 22, read: false },
  ]);
  renderWithRouter(<HistoryPage />, '/history');
  await userEvent.click(await screen.findByRole('button', { name: 'Resume Kintsugi' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/read/22');
});

it('opens the title from its thumbnail', async () => {
  renderWithRouter(<HistoryPage />, '/history');
  await userEvent.click(await screen.findByRole('link', { name: 'Open Paper Moon' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/title/4');
});

it('removes a title on this device', async () => {
  renderWithRouter(<HistoryPage />, '/history');
  await userEvent.click(await screen.findByRole('button', { name: 'Remove Kintsugi from history' }));
  expect(screen.queryByRole('button', { name: 'Resume Kintsugi' })).toBeNull();
  expect(useHistoryHidden.getState().titles).toEqual({ 2: ENTRIES[2]!.at });
});

it('clears all after a second tap', async () => {
  renderWithRouter(<HistoryPage />, '/history');
  await screen.findByText('Today');
  await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(screen.getAllByRole('button', { name: /^Resume / })).toHaveLength(3);
  await userEvent.click(screen.getByRole('button', { name: 'Clear history?' }));
  expect(screen.queryAllByRole('button', { name: /^Resume / })).toHaveLength(0);
  expect(screen.getByText('Chapters you read will show up here.')).toBeInTheDocument();
});

it('loads older history on request', async () => {
  renderWithRouter(<HistoryPage />, '/history');
  await userEvent.click(await screen.findByRole('button', { name: 'Show older' }));
  expect(api.getHistory).toHaveBeenLastCalledWith(NOW - 2 * HISTORY_STEP_MS);
  // Nothing new came back, so there is nothing older to show.
  await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Show older' })).toBeNull());
});

it('offers a retry when history could not load', async () => {
  vi.mocked(api.getHistory).mockRejectedValueOnce(new Error('offline'));
  renderWithRouter(<HistoryPage />, '/history');
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load history");
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Today')).toBeInTheDocument();
});
