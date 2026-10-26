import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { Chapter, Title } from '../../shared/model/types';
import * as api from '../server/api';
import { TitlePage } from './TitlePage';

vi.mock('../server/api', () => ({
  getTitle: vi.fn(),
  fetchTitle: vi.fn(),
  getChapters: vi.fn(),
  fetchChapters: vi.fn(),
  setProgress: vi.fn(async () => {}),
  setInLibrary: vi.fn(async () => {}),
}));

const title: Title = {
  id: 1,
  title: 'Blue Hour',
  coverUrl: null,
  author: 'Aoi Mizu',
  artist: '',
  description: 'A night train that only runs at dusk.',
  genres: ['Drama'],
  status: 'ongoing',
  unread: 2,
  chapterCount: 3,
  inLibrary: false,
  categoryIds: [],
  sourceName: 'MangaDex (EN)',
  initialized: true,
  logoUrl: null,
  bannerUrl: null,
  readingMode: null,
};

const chapter = (id: number, order: number, patch: Partial<Chapter> = {}): Chapter => ({
  id,
  titleId: 1,
  name: `Chapter ${order}`,
  number: order,
  order,
  read: false,
  bookmarked: false,
  lastPage: 0,
  pageCount: 8,
  uploadedAt: 1792600000000,
  scanlator: null,
  ...patch,
});

const three = [chapter(12, 3), chapter(11, 2, { lastPage: 3 }), chapter(10, 1, { read: true })];

function open() {
  const router = createMemoryRouter(
    [
      { path: '/title/:id', element: <TitlePage /> },
      { path: '/read/:chapterId', element: <p>reader</p> },
    ],
    { initialEntries: ['/title/1'] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.mocked(api.getTitle).mockResolvedValue(title);
  vi.mocked(api.getChapters).mockResolvedValue(three);
  vi.mocked(api.fetchChapters).mockResolvedValue(three);
  vi.mocked(api.setProgress).mockClear();
  vi.mocked(api.fetchChapters).mockClear();
  vi.mocked(api.fetchTitle).mockReset();
});

it('shows the title and its chapters newest first', async () => {
  open();
  expect(await screen.findByRole('heading', { name: 'Blue Hour' })).toBeInTheDocument();
  expect(screen.getByText('Aoi Mizu')).toBeInTheDocument();
  const rows = within(screen.getByRole('list', { name: 'Chapters' })).getAllByRole('listitem');
  expect(rows.map((r) => r.querySelector('[data-chapter-name]')?.textContent)).toEqual(['Chapter 3', 'Chapter 2', 'Chapter 1']);
  expect(within(rows[1]!).getByText('Page 4')).toBeInTheDocument();
});

it('fetches chapters from the source the first time', async () => {
  vi.mocked(api.getChapters).mockResolvedValue([]);
  open();
  expect(await screen.findByText('Chapter 3')).toBeInTheDocument();
  expect(api.fetchChapters).toHaveBeenCalledTimes(1);
});

it('marks a chapter read', async () => {
  open();
  await screen.findByText('Chapter 3');
  await userEvent.click(screen.getAllByRole('button', { name: 'Mark Chapter 3 as read' })[0]!);
  expect(api.setProgress).toHaveBeenCalledWith(12, { read: true });
  expect(screen.getByRole('button', { name: 'Mark Chapter 3 as unread' })).toBeInTheDocument();
});

it('adds the title to the library', async () => {
  open();
  await userEvent.click(await screen.findByRole('button', { name: 'Add to library' }));
  expect(api.setInLibrary).toHaveBeenCalledWith(1, true);
  expect(screen.getByRole('button', { name: 'In library' })).toBeInTheDocument();
});

it('continues at the oldest unread chapter', async () => {
  open();
  await userEvent.click(await screen.findByRole('button', { name: 'Continue · Ch. 2' }));
  expect(await screen.findByText('reader')).toBeInTheDocument();
});

it('loads details from the source for a title found while browsing', async () => {
  vi.mocked(api.getTitle).mockResolvedValue({ ...title, initialized: false, description: '', author: '' });
  vi.mocked(api.fetchTitle).mockResolvedValue({ ...title, description: 'Fetched from the source.' });
  open();
  expect(await screen.findByText('Fetched from the source.')).toBeInTheDocument();
  expect(screen.getByText('Aoi Mizu')).toBeInTheDocument();
  expect(api.fetchTitle).toHaveBeenCalledWith(1);
});

it('does not fetch details the server already has', async () => {
  open();
  await screen.findByText('Chapter 3');
  expect(api.fetchTitle).not.toHaveBeenCalled();
});
