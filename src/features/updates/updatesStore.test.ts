import type { FeedEntry } from '../../shared/model/types';
import { useUi } from '../../shared/ui/uiStore';
import * as api from '../server/api';
import { useUpdates } from './updatesStore';

vi.mock('../server/api', () => ({
  getUpdates: vi.fn(),
  getLastUpdateTime: vi.fn(),
  startLibraryUpdate: vi.fn(),
  isLibraryUpdateRunning: vi.fn(),
  getLibrary: vi.fn(async () => ({ titles: [], categories: [] })),
}));

const NOW = Date.UTC(2026, 9, 26, 12);
const HOUR = 3_600_000;

function entry(id: number, read = false): FeedEntry {
  return {
    chapter: { id, titleId: 1, name: `Chapter ${id}`, number: id, order: id, read, bookmarked: false, lastPage: 0, pageCount: 0, uploadedAt: 0, scanlator: null },
    title: { id: 1, title: 'Blue Hour', coverUrl: null, inLibrary: true },
    at: NOW - id * HOUR,
  };
}

const ENTRIES = [entry(1), entry(2), entry(3), entry(4), entry(5, true)];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(api.getUpdates).mockReset().mockResolvedValue(ENTRIES);
  vi.mocked(api.getLastUpdateTime).mockReset();
  vi.mocked(api.startLibraryUpdate).mockReset().mockResolvedValue({ running: true });
  vi.mocked(api.isLibraryUpdateRunning).mockReset().mockResolvedValue(false);
  useUpdates.setState({ status: 'idle', entries: [], checking: false });
  useUi.setState({ updatesBadge: 0 });
});
afterEach(() => vi.useRealTimers());

it('starts a library update when the last check is over an hour old, then reloads when it ends', async () => {
  vi.mocked(api.getLastUpdateTime).mockResolvedValue(NOW - 2 * HOUR);
  vi.mocked(api.isLibraryUpdateRunning).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  const done = useUpdates.getState().check();
  await vi.advanceTimersByTimeAsync(0);
  expect(api.startLibraryUpdate).toHaveBeenCalledTimes(1);
  expect(useUpdates.getState().checking).toBe(true);
  await vi.advanceTimersByTimeAsync(3000);
  expect(useUpdates.getState().checking).toBe(true);
  await vi.advanceTimersByTimeAsync(3000);
  await done;
  expect(api.isLibraryUpdateRunning).toHaveBeenCalledTimes(2);
  // Loaded after two 3s polls.
  expect(api.getUpdates).toHaveBeenCalledWith(NOW + 6000 - 90 * 24 * HOUR);
  expect(useUpdates.getState()).toMatchObject({ checking: false, status: 'ready' });
});

it('only reloads when Suwayomi checked recently', async () => {
  vi.mocked(api.getLastUpdateTime).mockResolvedValue(NOW - 10 * 60_000);
  await useUpdates.getState().check();
  expect(api.startLibraryUpdate).not.toHaveBeenCalled();
  expect(api.getUpdates).toHaveBeenCalledTimes(1);
});

it('always checks when forced', async () => {
  vi.mocked(api.getLastUpdateTime).mockResolvedValue(NOW - 60_000);
  vi.mocked(api.startLibraryUpdate).mockResolvedValue({ running: false });
  await useUpdates.getState().check({ force: true });
  expect(api.startLibraryUpdate).toHaveBeenCalledTimes(1);
});

it('gives up quietly when the server cannot say when it last checked', async () => {
  vi.mocked(api.getLastUpdateTime).mockRejectedValue(new Error('Cannot query field "lastUpdateTimestamp"'));
  await expect(useUpdates.getState().check()).resolves.toBeUndefined();
  expect(api.startLibraryUpdate).not.toHaveBeenCalled();
  expect(useUpdates.getState().checking).toBe(false);
});

it('ends the check without throwing when starting the update fails', async () => {
  vi.mocked(api.getLastUpdateTime).mockResolvedValue(0);
  vi.mocked(api.startLibraryUpdate).mockRejectedValue(new Error('offline'));
  await expect(useUpdates.getState().check()).resolves.toBeUndefined();
  expect(useUpdates.getState().checking).toBe(false);
});

it('joins a check that is already running', async () => {
  vi.mocked(api.getLastUpdateTime).mockResolvedValue(0);
  vi.mocked(api.startLibraryUpdate).mockResolvedValue({ running: false });
  await Promise.all([useUpdates.getState().check(), useUpdates.getState().check()]);
  expect(api.startLibraryUpdate).toHaveBeenCalledTimes(1);
});

it('shows the unread count on the Updates tab', async () => {
  await useUpdates.getState().load();
  expect(useUi.getState().updatesBadge).toBe(4);
});

it('keeps the previous entries when a reload fails', async () => {
  await useUpdates.getState().load();
  vi.mocked(api.getUpdates).mockRejectedValue(new Error('offline'));
  await useUpdates.getState().load();
  expect(useUpdates.getState().status).toBe('error');
  expect(useUpdates.getState().entries).toHaveLength(5);
});
