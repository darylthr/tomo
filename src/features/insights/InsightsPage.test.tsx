import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../app/testRouter';
import { InsightsCard } from './InsightsCard';
import { InsightsPage } from './InsightsPage';
import { useInsights } from './insightsStore';
import { summarize } from './summary';

const at = (m: number, d: number, h = 20) => new Date(2026, m - 1, d, h).getTime();
const NOW = at(10, 29, 12); // Thursday

const reads = [
  ...[1, 2, 3].map(() => ({ at: at(10, 29, 9), titleId: 1 })),
  ...[1, 2].map(() => ({ at: at(10, 28), titleId: 2 })),
  { at: at(10, 27), titleId: 1 },
  { at: at(10, 21), titleId: 3 },
];
const seconds = new Map([
  ['2026-10-29', 1800],
  ['2026-10-28', 2700],
  ['2026-10-21', 600],
]);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  useInsights.setState({ status: 'ready', reads, seconds, load: vi.fn(async () => {}) });
});
afterEach(() => vi.useRealTimers());

it('sums up this week, the streak and the year', () => {
  expect(summarize(reads, seconds, NOW)).toMatchObject({
    weekChapters: 6,
    lastWeekChapters: 1,
    weekSeconds: 4500,
    yearSeconds: 5100,
    streak: { current: 3, longest: 3 },
    yearChapters: 7,
    yearTitles: 3,
  });
});

it('shows the four numbers', () => {
  renderWithRouter(<InsightsPage />, '/insights');
  expect(screen.getByRole('heading', { level: 1, name: 'Insights' })).toBeInTheDocument();
  const tiles = screen.getByRole('list', { name: 'Reading at a glance' });
  expect(within(tiles).getByText('6')).toBeInTheDocument();
  expect(within(tiles).getByText('5 more than last week')).toBeInTheDocument();
  expect(within(tiles).getByText('1h 15m')).toBeInTheDocument();
  expect(within(tiles).getByText('3 days')).toBeInTheDocument();
  expect(within(tiles).getByText('7')).toBeInTheDocument();
});

it('names each heatmap day for screen readers and on tap', async () => {
  renderWithRouter(<InsightsPage />, '/insights');
  const day = screen.getByRole('button', { name: 'Wednesday, October 28: 2 chapters, 45 min' });
  await userEvent.click(day);
  expect(within(screen.getByRole('region', { name: 'Chapters per day' })).getByRole('status')).toHaveTextContent('Wed, Oct 28 · 2 chapters · 45 min');
});

it('charts chapters per week with a table behind it', () => {
  renderWithRouter(<InsightsPage />, '/insights');
  const table = screen.getByRole('table', { name: 'Chapters per week' });
  const rows = within(table).getAllByRole('row');
  expect(rows).toHaveLength(13);
  expect(rows.at(-1)).toHaveTextContent('6');
  expect(rows.at(-2)).toHaveTextContent('1');
});

it('offers a retry when history could not load', async () => {
  const load = vi.fn(async () => {});
  useInsights.setState({ status: 'error', reads: [], load });
  renderWithRouter(<InsightsPage />, '/insights');
  load.mockClear();
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(load).toHaveBeenCalledTimes(1);
});

it('puts a summary on History that opens Insights', async () => {
  renderWithRouter(<InsightsCard />, '/history');
  const card = screen.getByRole('link', { name: /6 chapters this week/ });
  expect(card).toHaveTextContent('1h 15m · 3-day streak');
  await userEvent.click(card);
  expect(screen.getByTestId('location')).toHaveTextContent('/insights');
});
