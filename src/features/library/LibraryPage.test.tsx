import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Title } from '../../shared/model/types';
import { useSettings } from '../../shared/settings/store';
import * as api from '../server/api';
import { ServerError } from '../server/client';
import { pickContinueChapter } from './continueReading';
import { LibraryPage } from './LibraryPage';
import { useLibrary } from './libraryStore';
import { TitleInfo } from './TitleInfo';

const title = (id: number, patch: Partial<Title> = {}): Title => ({
  id,
  title: `Title ${id}`,
  coverUrl: null,
  author: '',
  artist: '',
  description: '',
  genres: [],
  status: 'ongoing',
  unread: 1,
  chapterCount: 10,
  inLibrary: true,
  categoryIds: [],
  sourceName: 'MangaDex',
  initialized: true,
  logoUrl: null,
  bannerUrl: null,
  readingMode: null,
  ...patch,
});

function showLibrary(state: Partial<ReturnType<typeof useLibrary.getState>>) {
  useLibrary.setState({ status: 'ready', titles: [], categories: [], error: null, load: async () => {}, ...state });
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/settings" element={<p>Settings page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

vi.mock('../server/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../server/api')>()),
  getLibrarySortInfo: vi.fn(),
}));

beforeEach(() => {
  useSettings.getState().reset();
  useLibrary.setState({ sortInfo: null, sortInfoState: 'idle' });
  vi.mocked(api.getLibrarySortInfo).mockReset();
});

it('explains an unreachable server and offers a retry', async () => {
  const refresh = vi.fn(async () => {});
  useSettings.getState().update({ server: { url: 'https://tomo.home', configured: true } });
  showLibrary({ status: 'error', error: new ServerError('unreachable'), refresh });
  expect(screen.getByText("Can't reach your server")).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(refresh).toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Server settings' }));
  expect(screen.getByText('Settings page')).toBeInTheDocument();
});

it('asks to connect a server when none is set up and the same address has no Suwayomi', () => {
  showLibrary({ status: 'error', error: new ServerError('unreachable') });
  expect(screen.getByText('Connect your Suwayomi server to see your library')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument();
});

it('shows a hint for an empty library', () => {
  showLibrary({ titles: [] });
  expect(screen.getByText('Your library is empty. Add titles from Search.')).toBeInTheDocument();
});

it('narrows the shelf to a category', async () => {
  showLibrary({
    titles: [title(1, { categoryIds: [1] }), title(2), title(3)],
    categories: [{ id: 1, name: 'Reading', order: 1 }],
  });
  const tabs = screen.getByRole('tablist', { name: 'Categories' });
  expect(within(tabs).getByRole('tab', { name: /All/ })).toHaveTextContent('3');
  expect(within(tabs).getByRole('tab', { name: /Reading/ })).toHaveTextContent('1');
  await userEvent.click(within(tabs).getByRole('tab', { name: /Reading/ }));
  expect(screen.getAllByRole('button', { name: /^Title \d$/ })).toHaveLength(1);
});

it('shows a grid when vertical scrolling is chosen', () => {
  act(() => useSettings.getState().update({ library: { scroll: 'vertical' } }));
  showLibrary({ titles: [title(1), title(2), title(3)] });
  expect(screen.getByRole('list', { name: 'Library' }).querySelectorAll('li')).toHaveLength(3);
  expect(screen.queryByRole('group', { name: /Library shelf/ })).toBeNull();
});

describe('sorting', () => {
  const gridNames = () =>
    within(screen.getByRole('list', { name: 'Library' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
      .filter((name) => !name?.startsWith('Details and chapters'));
  beforeEach(() => act(() => useSettings.getState().update({ library: { scroll: 'vertical' } })));
  const titles = [title(1, { unread: 0, chapterCount: 50 }), title(2, { unread: 7, chapterCount: 9 }), title(3, { unread: 2, chapterCount: 30 })];

  it('sorts by chapters left from the sort sheet and remembers it', async () => {
    showLibrary({ titles });
    const button = screen.getByRole('button', { name: 'Sort library: Title, A–Z' });
    await userEvent.click(button);
    const sheet = screen.getByRole('dialog', { name: 'Sort library' });
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Chapters left' }));
    expect(gridNames()).toEqual(['Title 2', 'Title 3', 'Title 1']);
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Fewest' }));
    expect(gridNames()).toEqual(['Title 3', 'Title 2', 'Title 1']);
    expect(useSettings.getState().settings.library).toMatchObject({ sortBy: 'unread', sortDescending: false });
    expect(screen.getByRole('button', { name: 'Sort library: Chapters left, Fewest' })).toBeInTheDocument();
  });

  it('fetches dates from the server for the date sorts', async () => {
    vi.mocked(api.getLibrarySortInfo).mockResolvedValue(
      new Map([
        [1, { addedAt: 1, lastReadAt: 300, latestAt: 1 }],
        [2, { addedAt: 1, lastReadAt: 100, latestAt: 1 }],
        [3, { addedAt: 1, lastReadAt: 200, latestAt: 1 }],
      ]),
    );
    act(() => useSettings.getState().update({ library: { sortBy: 'lastRead', sortDescending: true } }));
    showLibrary({ titles });
    await vi.waitFor(() => expect(gridNames()).toEqual(['Title 1', 'Title 3', 'Title 2']));
    expect(api.getLibrarySortInfo).toHaveBeenCalledTimes(1);
  });

  it('says when the server is too old to sort by dates, and keeps title order', async () => {
    vi.mocked(api.getLibrarySortInfo).mockRejectedValue(new ServerError('version', 'Cannot query field "lastReadChapter"'));
    act(() => useSettings.getState().update({ library: { sortBy: 'latest', sortDescending: true } }));
    showLibrary({ titles });
    await userEvent.click(await screen.findByRole('button', { name: /^Sort library/ }));
    expect(await screen.findByText("Your Suwayomi version can't sort by this. Showing titles A–Z.")).toBeInTheDocument();
    expect(gridNames()).toEqual(['Title 1', 'Title 2', 'Title 3']);
  });
});

describe('grid options', () => {
  beforeEach(() => act(() => useSettings.getState().update({ library: { scroll: 'vertical' } })));

  it('hides titles and chapters left under the books when turned off', () => {
    act(() => useSettings.getState().update({ library: { gridTitles: false, gridProgress: false } }));
    showLibrary({ titles: [title(1, { unread: 4 })] });
    const grid = screen.getByRole('list', { name: 'Library' });
    // The book itself still shows the name (spine, coverless placeholder); the caption under it is gone.
    expect(within(grid).getAllByText('Title 1').every((el) => el.closest('[data-tile]'))).toBe(true);
    expect(within(grid).queryByText('4 left')).toBeNull();
    expect(within(grid).getByRole('button', { name: 'Title 1' })).toBeInTheDocument();
  });

  it('sizes the grid', () => {
    act(() => useSettings.getState().update({ library: { gridSize: 'l' } }));
    showLibrary({ titles: [title(1)] });
    expect(screen.getByRole('list', { name: 'Library' })).toHaveAttribute('data-size', 'l');
  });
});

describe('TitleInfo', () => {
  it('shows progress and where reading continues', () => {
    render(<TitleInfo title={title(1, { unread: 4, chapterCount: 12 })} onContinue={() => {}} onChapters={() => {}} />);
    expect(screen.getByText('Chapter 8 of 12')).toBeInTheDocument();
    expect(screen.getByText('4 left')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue · Ch. 9' })).toBeInTheDocument();
  });

  it('offers to read again when caught up', () => {
    render(<TitleInfo title={title(1, { unread: 0, chapterCount: 12 })} onContinue={() => {}} onChapters={() => {}} />);
    expect(screen.getByText('Caught up')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read again' })).toBeInTheDocument();
  });

  it('offers to start an unread title', () => {
    render(<TitleInfo title={title(1, { unread: 12, chapterCount: 12 })} onContinue={() => {}} onChapters={() => {}} />);
    expect(screen.getByText('Not started')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start reading' })).toBeInTheDocument();
  });
});

describe('pickContinueChapter', () => {
  const ch = (id: number, order: number, read: boolean) => ({
    id,
    titleId: 1,
    name: '',
    number: order,
    order,
    read,
    bookmarked: false,
    lastPage: 0,
    pageCount: 0,
    uploadedAt: 0,
    scanlator: null,
  });

  it('continues at the oldest unread chapter', () => {
    expect(pickContinueChapter([ch(3, 3, false), ch(2, 2, false), ch(1, 1, true)])?.id).toBe(2);
  });

  it('rereads the first chapter when everything is read', () => {
    expect(pickContinueChapter([ch(3, 3, true), ch(2, 2, true), ch(1, 1, true)])?.id).toBe(1);
  });

  it('has nothing to continue without chapters', () => {
    expect(pickContinueChapter([])).toBeNull();
  });
});

describe('title logos', () => {
  const withLogo = title(7, { title: 'Blue Hour', logoUrl: 'https://tomo.home/tomo-meta/7/logo.png' });

  it('shows the official logo in place of the name, named for screen readers', () => {
    render(<TitleInfo title={withLogo} onContinue={() => {}} onChapters={() => {}} />);
    const heading = screen.getByRole('heading', { name: 'Blue Hour' });
    expect(within(heading).getByRole('img', { name: 'Blue Hour' })).toHaveAttribute('src', withLogo.logoUrl);
  });

  it('shows the plain name when styled logos are off', () => {
    useSettings.getState().update({ library: { styledLogos: false } });
    render(<TitleInfo title={withLogo} onContinue={() => {}} onChapters={() => {}} />);
    expect(screen.queryByRole('img', { name: 'Blue Hour' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Blue Hour' })).toHaveTextContent('Blue Hour');
  });

  it('falls back to the name when the logo fails to load', () => {
    render(<TitleInfo title={withLogo} onContinue={() => {}} onChapters={() => {}} />);
    fireEvent.error(screen.getByRole('img', { name: 'Blue Hour' }));
    expect(screen.queryByRole('img', { name: 'Blue Hour' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Blue Hour' })).toHaveTextContent('Blue Hour');
  });
});

describe('choosing several titles', () => {
  beforeEach(() => act(() => useSettings.getState().update({ library: { scroll: 'vertical' } })));
  const three = [title(1), title(2), title(3)];

  it('has only All and the categories made in Tomo (no Default tab)', () => {
    showLibrary({ titles: [title(1, { categoryIds: [1] }), title(2)], categories: [{ id: 1, name: 'Reading', order: 1 }] });
    const tabs = within(screen.getByRole('tablist', { name: 'Categories' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['All2', 'Reading1']);
  });

  it('opens a title page from the grid with its details button', async () => {
    showLibrary({ titles: three });
    await userEvent.click(screen.getByRole('button', { name: 'Details and chapters of Title 2' }));
    // The memory router has no title route, so the library is gone.
    expect(screen.queryByRole('list', { name: 'Library' })).toBeNull();
  });

  /** Long-presses a tile, which is the only way into selecting. */
  const longPress = (name: string) => {
    vi.useFakeTimers();
    try {
      const tile = screen.getByRole('button', { name });
      fireEvent.pointerDown(tile, { clientX: 5, clientY: 5 });
      act(() => void vi.advanceTimersByTime(600));
      fireEvent.pointerUp(tile);
      fireEvent.click(tile);
    } finally {
      vi.useRealTimers();
    }
  };

  it('has no Select button on the category bar', () => {
    showLibrary({ titles: three });
    expect(screen.queryByRole('button', { name: 'Select titles' })).toBeNull();
  });

  it('removes the chosen titles after a confirmation, then reloads', async () => {
    const set = vi.spyOn(api, 'setInLibrary').mockResolvedValue();
    const refresh = vi.fn(async () => {});
    showLibrary({ titles: three, refresh });
    longPress('Title 1');
    expect(screen.getByRole('status')).toHaveTextContent('1 selected');
    await userEvent.click(screen.getByRole('button', { name: 'Title 3' }));
    expect(screen.getByRole('status')).toHaveTextContent('2 selected');
    expect(screen.getByRole('button', { name: 'Title 1' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Remove selected from library' }));
    expect(set).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Remove from library' }));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(set.mock.calls.map((c) => c[0]).sort()).toEqual([1, 3]);
    expect(set.mock.calls.every((c) => c[1] === false)).toBe(true);
    // Done: back to the normal bar.
    expect(screen.queryByRole('navigation', { name: 'Selection' })).toBeNull();
  });

  it('selects all, clears, and cancels with Escape', async () => {
    showLibrary({ titles: three });
    longPress('Title 1');
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByRole('status')).toHaveTextContent('3 selected');
    await userEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(screen.getByRole('status')).toHaveTextContent('Select titles');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: 'Selection' })).toBeNull();
  });

  it('keeps titles that could not be removed selected and says so', async () => {
    vi.spyOn(api, 'setInLibrary').mockImplementation(async (id) => {
      if (id === 2) throw new ServerError('unreachable');
    });
    showLibrary({ titles: three, refresh: async () => {} });
    longPress('Title 1');
    await userEvent.click(screen.getByRole('button', { name: 'Title 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove selected from library' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove from library' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't remove 1 title");
    expect(screen.getByRole('status')).toHaveTextContent('1 selected');
  });

  it('long-pressing a tile starts selecting it', async () => {
    vi.useFakeTimers();
    try {
      showLibrary({ titles: three });
      const tile = screen.getByRole('button', { name: 'Title 2' });
      fireEvent.pointerDown(tile, { clientX: 5, clientY: 5 });
      act(() => void vi.advanceTimersByTime(600));
      fireEvent.pointerUp(tile);
      fireEvent.click(tile);
      expect(screen.getByRole('status')).toHaveTextContent('1 selected');
    } finally {
      vi.useRealTimers();
    }
  });
});
