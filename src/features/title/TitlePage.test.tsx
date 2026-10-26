import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { Chapter, Title } from '../../shared/model/types';
import * as api from '../server/api';
import { useLibrary } from '../library/libraryStore';
import { useChapterViews } from './chapterViewStore';
import { TitlePage } from './TitlePage';

vi.mock('../server/api', () => ({
  getTitle: vi.fn(),
  fetchTitle: vi.fn(),
  getChapters: vi.fn(),
  fetchChapters: vi.fn(),
  setProgress: vi.fn(async () => {}),
  setInLibrary: vi.fn(async () => {}),
  setTitleCategories: vi.fn(async () => {}),
  createCategory: vi.fn(async (name: string) => ({ id: 9, name, order: 4 })),
  getLibrary: vi.fn(async () => ({ titles: [], categories: CATEGORIES })),
}));

const CATEGORIES = [
  { id: 0, name: 'Default', order: 0 },
  { id: 5, name: 'Reading', order: 1 },
  { id: 6, name: 'Paused', order: 2 },
];

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
  useChapterViews.setState({ views: {} });
  useLibrary.setState({ status: 'ready', titles: [], categories: [] });
  vi.mocked(api.setInLibrary).mockClear();
  vi.mocked(api.setTitleCategories).mockClear();
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

const names = () =>
  within(screen.getByRole('list', { name: 'Chapters' }))
    .getAllByRole('listitem')
    .map((r) => r.querySelector('[data-chapter-name]')?.textContent);

it('sorts chapters oldest first and remembers it for the title', async () => {
  open();
  await screen.findByText('Chapter 3');
  const toggle = screen.getByRole('button', { name: 'Sort and filter chapters' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(screen.getByRole('radio', { name: 'Oldest first' }));
  expect(names()).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3']);
  expect(useChapterViews.getState().views[1]).toMatchObject({ descending: false });
});

it('sorts by upload date', async () => {
  vi.mocked(api.getChapters).mockResolvedValue([chapter(12, 3, { uploadedAt: 1 }), chapter(11, 2, { uploadedAt: 3 }), chapter(10, 1, { uploadedAt: 2 })]);
  open();
  await screen.findByText('Chapter 3');
  await userEvent.click(screen.getByRole('button', { name: 'Sort and filter chapters' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Upload date' }));
  expect(names()).toEqual(['Chapter 2', 'Chapter 1', 'Chapter 3']);
});

it('shows only unread chapters and says how many are shown', async () => {
  open();
  await screen.findByText('Chapter 3');
  await userEvent.click(screen.getByRole('button', { name: 'Sort and filter chapters' }));
  await userEvent.click(screen.getByRole('switch', { name: 'Unread only' }));
  expect(names()).toEqual(['Chapter 3', 'Chapter 2']);
  expect(screen.getByRole('heading', { name: '2 of 3 chapters' })).toBeInTheDocument();
});

it('opens with the view saved for the title, and offers Show all when nothing matches', async () => {
  useChapterViews.setState({ views: { 1: { sort: 'chapter', descending: true, unreadOnly: false, bookmarkedOnly: true, dedupe: false } } });
  open();
  expect(await screen.findByText('No chapters match these filters.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Show all' }));
  expect(names()).toEqual(['Chapter 3', 'Chapter 2', 'Chapter 1']);
  expect(useChapterViews.getState().views[1]).toBeUndefined();
});

it('hides duplicate releases of a chapter', async () => {
  vi.mocked(api.getChapters).mockResolvedValue([
    chapter(13, 2, { name: 'Chapter 2', number: 2, scanlator: 'Beta' }),
    ...three.map((c) => ({ ...c, scanlator: 'Alpha' })),
  ]);
  open();
  await screen.findByText('Chapter 3');
  await userEvent.click(screen.getByRole('button', { name: 'Sort and filter chapters' }));
  await userEvent.click(screen.getByRole('switch', { name: 'Hide duplicates' }));
  expect(names()).toEqual(['Chapter 3', 'Chapter 2', 'Chapter 1']);
});

describe('categories', () => {
  beforeEach(() => useLibrary.setState({ categories: CATEGORIES }));

  it('asks for categories when adding a title, if there are any', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Add to library' }));
    const sheet = screen.getByRole('dialog', { name: 'Add Blue Hour to library' });
    expect(within(sheet).queryByRole('checkbox', { name: /Default/ })).toBeNull();
    await userEvent.click(within(sheet).getByRole('checkbox', { name: /Reading/ }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add' }));
    expect(api.setInLibrary).toHaveBeenCalledWith(1, true);
    await vi.waitFor(() => expect(api.setTitleCategories).toHaveBeenCalledWith(1, [5]));
    expect(screen.getByRole('button', { name: 'In library' })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Categories' })).getByText('Reading')).toBeInTheDocument();
  });

  it('moves a title in the library to other categories', async () => {
    vi.mocked(api.getTitle).mockResolvedValue({ ...title, inLibrary: true, categoryIds: [5] });
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit categories' }));
    const sheet = screen.getByRole('dialog', { name: 'Categories for Blue Hour' });
    expect(within(sheet).getByRole('checkbox', { name: /Reading/ })).toBeChecked();
    await userEvent.click(within(sheet).getByRole('checkbox', { name: /Reading/ }));
    await userEvent.click(within(sheet).getByRole('checkbox', { name: /Paused/ }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(api.setTitleCategories).toHaveBeenCalledWith(1, [6]);
    expect(api.setInLibrary).not.toHaveBeenCalled();
    expect(within(screen.getByRole('list', { name: 'Categories' })).getByText('Paused')).toBeInTheDocument();
  });

  it('removes the title from the library when every category is unticked', async () => {
    vi.mocked(api.getTitle).mockResolvedValue({ ...title, inLibrary: true, categoryIds: [5] });
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit categories' }));
    const sheet = screen.getByRole('dialog', { name: 'Categories for Blue Hour' });
    await userEvent.click(within(sheet).getByRole('checkbox', { name: /Reading/ }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Remove from library' }));
    expect(api.setInLibrary).toHaveBeenCalledWith(1, false);
    expect(screen.getByRole('button', { name: 'Add to library' })).toBeInTheDocument();
  });

  it('creates a category from the sheet and ticks it', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Add to library' }));
    const sheet = screen.getByRole('dialog', { name: 'Add Blue Hour to library' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'New category' }));
    await userEvent.type(within(sheet).getByRole('textbox', { name: 'Category name' }), 'Dropped{Enter}');
    expect(api.createCategory).toHaveBeenCalledWith('Dropped');
    expect(await within(sheet).findByRole('checkbox', { name: /Dropped/ })).toBeChecked();
  });
});
