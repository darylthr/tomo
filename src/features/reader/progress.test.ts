import { createProgressSync, startPage, type ProgressPatch } from './progress';

const sender = () => vi.fn<(id: number, patch: ProgressPatch) => Promise<void>>(async () => {});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const chapter = { read: false, lastPage: 0 };

it('sends the page once you stop turning for a moment', () => {
  const send = sender();
  const sync = createProgressSync(11, 8, send);
  sync.pageChanged(3);
  sync.pageChanged(4);
  expect(send).not.toHaveBeenCalled();
  vi.advanceTimersByTime(800);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(11, { lastPage: 4 });
  sync.dispose();
});

it('marks the chapter read on the last page, once', () => {
  const send = sender();
  const sync = createProgressSync(11, 8, send);
  sync.pageChanged(7);
  expect(send).toHaveBeenCalledWith(11, { lastPage: 7, read: true });
  sync.pageChanged(6);
  sync.pageChanged(7);
  vi.advanceTimersByTime(800);
  expect(send.mock.calls.filter(([, p]) => p.read)).toHaveLength(1);
  sync.dispose();
});

it('saves the pending page when the app is hidden', () => {
  const send = sender();
  const sync = createProgressSync(11, 8, send);
  sync.pageChanged(2);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(send).toHaveBeenCalledWith(11, { lastPage: 2 });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  sync.dispose();
});

it('saves the pending page when leaving the page', () => {
  const send = sender();
  const sync = createProgressSync(11, 8, send);
  sync.pageChanged(5);
  window.dispatchEvent(new Event('pagehide'));
  expect(send).toHaveBeenCalledWith(11, { lastPage: 5 });
  sync.dispose();
});

it('has nothing to flush when nothing changed', async () => {
  const send = sender();
  const sync = createProgressSync(11, 8, send);
  await sync.flush();
  expect(send).not.toHaveBeenCalled();
  sync.dispose();
});

it('flushes on dispose so Back never loses the page', () => {
  const send = sender();
  const sync = createProgressSync(11, 8, send);
  sync.pageChanged(3);
  sync.dispose();
  expect(send).toHaveBeenCalledWith(11, { lastPage: 3 });
});

it('does not resend the page the reader opened on', () => {
  const send = sender();
  const sync = createProgressSync(11, 8, send, 3);
  sync.pageChanged(3);
  vi.advanceTimersByTime(800);
  expect(send).not.toHaveBeenCalled();
  sync.dispose();
});

describe('startPage', () => {
  it('resumes an unfinished chapter at its saved page', () => {
    expect(startPage({ ...chapter, lastPage: 3 }, 8)).toBe(3);
  });
  it('starts a finished chapter from the beginning', () => {
    expect(startPage({ read: true, lastPage: 7 }, 8)).toBe(0);
  });
  it('ignores a saved page past the end', () => {
    expect(startPage({ ...chapter, lastPage: 12 }, 8)).toBe(0);
  });
});
