import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { Chapter, Title } from '../../shared/model/types';
import { useSettings } from '../../shared/settings/store';
import * as api from '../server/api';
import { ReaderPage } from './ReaderPage';
import { useReader } from './readerStore';

vi.mock('../server/api', () => ({
  getChapter: vi.fn(),
  getTitle: vi.fn(),
  getPages: vi.fn(),
  getChapters: vi.fn(),
  fetchChapters: vi.fn(),
  setProgress: vi.fn(async () => {}),
  setGlobalMeta: vi.fn(async () => {}),
  getMangaMeta: vi.fn(async () => ({})),
}));

const chapter = (id: number, number: number, patch: Partial<Chapter> = {}): Chapter => ({
  id,
  titleId: 1,
  name: `Chapter ${number}`,
  number,
  order: number,
  read: false,
  bookmarked: false,
  lastPage: 0,
  pageCount: 24,
  uploadedAt: 0,
  scanlator: null,
  ...patch,
});
const title = { id: 1, title: 'Blue Hour', genres: [], readingMode: null, coverUrl: null } as unknown as Title;
const pages = (n: number) => Array.from({ length: n }, (_, i) => `/p/${i}`);

function open(path: string) {
  const router = createMemoryRouter([{ path: '/read/:chapterId', element: <ReaderPage /> }], { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  useSettings.getState().reset();
  vi.mocked(api.getChapter).mockResolvedValue(chapter(11, 2));
  vi.mocked(api.getTitle).mockResolvedValue(title);
  vi.mocked(api.getChapters).mockResolvedValue([chapter(11, 2)]);
  vi.mocked(api.getPages).mockResolvedValue(pages(24));
});

it('keeps one page at a time on a narrow screen', async () => {
  useSettings.getState().update({ reader: { spreads: 'off' } });
  open('/read/11');
  await screen.findByRole('img', { name: 'Page 1 of 24' });
  expect(screen.queryByRole('img', { name: 'Page 2 of 24' })).toBeNull();
});

it('pairs pages on a wide screen, then saves the last page of a spread and marks read', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // A laptop window: landscape and wide enough for Auto spreads.
  Object.defineProperties(window, { innerWidth: { configurable: true, value: 1280 }, innerHeight: { configurable: true, value: 800 } });
  useSettings.getState().update({ reader: { coverAlone: false } });
  open('/read/11');
  await screen.findByRole('img', { name: 'Page 1 of 24' });
  expect(await screen.findByRole('img', { name: 'Page 2 of 24' })).toBeInTheDocument();
  act(() => useReader.getState().goTo(22));
  expect(useReader.getState().view).toEqual([22, 23]);
  await act(async () => vi.advanceTimersByTime(1000));
  expect(api.setProgress).toHaveBeenCalledWith(11, { lastPage: 23, read: true });
  vi.useRealTimers();
});

it('opens at ?page=, clamped to the chapter', async () => {
  useSettings.getState().update({ reader: { spreads: 'off' } });
  vi.mocked(api.getPages).mockResolvedValue(pages(8));
  open('/read/11?page=99');
  expect(await screen.findByRole('img', { name: 'Page 8 of 8' })).toBeInTheDocument();
});

it('opens at ?page= inside the chapter, over the saved position', async () => {
  useSettings.getState().update({ reader: { spreads: 'off' } });
  vi.mocked(api.getChapter).mockResolvedValue(chapter(11, 2, { lastPage: 5 }));
  vi.mocked(api.getPages).mockResolvedValue(pages(8));
  open('/read/11?page=2');
  expect(await screen.findByRole('img', { name: 'Page 3 of 8' })).toBeInTheDocument();
});
