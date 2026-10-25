import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Title } from '../../shared/model/types';
import { useSettings } from '../../shared/settings/store';
import { useUi } from '../../shared/ui/uiStore';
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
  ...patch,
});

function showLibrary(state: Partial<ReturnType<typeof useLibrary.getState>>) {
  useLibrary.setState({ status: 'ready', titles: [], categories: [], error: null, load: async () => {}, ...state });
  return render(
    <MemoryRouter>
      <LibraryPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useSettings.getState().reset();
  useUi.setState({ settingsOpen: false });
});

it('explains an unreachable server and offers a retry', async () => {
  const refresh = vi.fn(async () => {});
  useSettings.getState().update({ server: { url: 'https://tomo.home', configured: true } });
  showLibrary({ status: 'error', error: new ServerError('unreachable'), refresh });
  expect(screen.getByText("Can't reach your server")).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(refresh).toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Server settings' }));
  expect(useUi.getState().settingsOpen).toBe(true);
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
    categories: [
      { id: 0, name: 'Default', order: 0 },
      { id: 1, name: 'Reading', order: 1 },
    ],
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
