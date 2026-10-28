import 'fake-indexeddb/auto';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../app/testRouter';
import { useSettings } from '../../shared/settings/store';
import { BUILTINS } from '../../shared/theme/themes';
import { useLibrary } from '../library/libraryStore';
import { AppearanceSettings } from './AppearanceSettings';
import { LibrarySettings } from './LibrarySettings';
import { ReaderSettings } from './ReaderSettings';
import { SettingsPage } from './SettingsPage';

vi.mock('../background/backgroundImage', () => ({
  saveBackgroundImage: vi.fn(async () => {
    const { BackgroundImageError } = await vi.importActual<typeof import('../background/backgroundImage')>(
      '../background/backgroundImage',
    );
    throw new BackgroundImageError();
  }),
  clearBackgroundImage: vi.fn(async () => {}),
}));

beforeEach(() => {
  useSettings.getState().reset();
  useLibrary.setState({ status: 'idle', categories: [] });
});

describe('the Settings tab', () => {
  const show = () => renderWithRouter(<SettingsPage />, '/settings');

  it('lists each section with a summary of what it holds', () => {
    useLibrary.setState({ status: 'ready', categories: [{ id: 0, name: 'Default', order: 0 }, { id: 5, name: 'Reading', order: 1 }] });
    show();
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    const links = within(screen.getByRole('list', { name: 'Settings sections' })).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'ServerSame address as Tomo',
      'LibraryBooks · 1 category',
      'ReaderManga · Fit screen',
      'AppearanceTomo Dark · No background image',
    ]);
  });

  it('opens a section', async () => {
    show();
    await userEvent.click(screen.getByRole('link', { name: /^Reader/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings/reader');
  });

  it('shows the server address once one is set', () => {
    act(() => useSettings.getState().update({ server: { url: 'https://tomo.home' } }));
    show();
    expect(screen.getByRole('link', { name: /^Server/ })).toHaveTextContent('https://tomo.home');
  });
});

describe('Library', () => {
  const show = () => renderWithRouter(<LibrarySettings />, '/settings/library');

  it('changes how titles are shown', async () => {
    show();
    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Covers' }));
    expect(useSettings.getState().settings.library.display).toBe('covers');
  });

  it('moves through a segmented control with the arrow keys', async () => {
    show();
    screen.getByRole('radio', { name: 'Books' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(useSettings.getState().settings.library.display).toBe('covers');
    expect(screen.getByRole('radio', { name: 'Covers' })).toHaveFocus();
  });

  it('links to the categories, saying how many there are', async () => {
    useLibrary.setState({ status: 'ready', categories: [{ id: 0, name: 'Default', order: 0 }, { id: 5, name: 'Reading', order: 1 }] });
    show();
    await userEvent.click(screen.getByRole('link', { name: 'Categories, 1' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings/categories');
  });

  it('sets the default category and whether the All tab shows', async () => {
    useLibrary.setState({ status: 'ready', categories: [{ id: 5, name: 'Reading', order: 1 }, { id: 6, name: 'Paused', order: 2 }] });
    show();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Default category' }), 'Paused');
    expect(useSettings.getState().settings.library.defaultCategory).toBe(6);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Default category' }), 'All');
    expect(useSettings.getState().settings.library.defaultCategory).toBeNull();
    await userEvent.click(screen.getByRole('switch', { name: 'Show the All tab' }));
    expect(useSettings.getState().settings.library.showAllTab).toBe(false);
    expect(screen.queryByRole('option', { name: 'All' })).toBeNull();
  });

  it('shows grid options only with vertical scrolling', async () => {
    show();
    expect(screen.queryByRole('radiogroup', { name: 'Grid size' })).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Vertical' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Large' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Show titles under books' }));
    expect(useSettings.getState().settings.library).toMatchObject({ gridSize: 'l', gridTitles: false });
  });

  it('goes back to Settings', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
  });
});

describe('Reader', () => {
  it('sets spreads, tap zones, page-turn animation and crop borders', async () => {
    renderWithRouter(<ReaderSettings />, '/settings/reader');
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Double pages' })).getByRole('radio', { name: 'On' }));
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Tap zones' })).getByRole('radio', { name: 'Inverted' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Page-turn animation' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Crop white borders' }));
    await userEvent.click(screen.getByRole('switch', { name: 'First page is a cover' }));
    expect(useSettings.getState().settings.reader).toMatchObject({
      spreads: 'on',
      tapZones: 'inverted',
      pageTransitions: false,
      cropBorders: true,
      coverAlone: false,
    });
  });

  it('picks the default reading mode and page fit', async () => {
    renderWithRouter(<ReaderSettings />, '/settings/reader');
    await userEvent.click(screen.getByRole('radio', { name: 'Webtoon' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Width' }));
    expect(useSettings.getState().settings.reader).toMatchObject({ defaultMode: 'webtoon', fit: 'width' });
  });
});

describe('Appearance', () => {
  const show = () => renderWithRouter(<AppearanceSettings />, '/settings/appearance');

  it('lists every built-in and custom theme, marking the current one', () => {
    const colours = { bg: '#f5ecd7', surface: '#fffaf0', ink: '#3b2f1e', accent: '#b5651d', chrome: '#efe3c8' };
    useSettings.getState().setTheme({ current: 'tomo-dark', overrides: {}, custom: [{ id: 'p', name: 'Paper', colours }] });
    show();
    const grid = screen.getByRole('radiogroup', { name: 'Theme' });
    const names = within(grid).getAllByRole('radio').map((r) => r.getAttribute('aria-label'));
    expect(names).toEqual([...BUILTINS.map((t) => t.name), 'Paper']);
    expect(within(grid).getByRole('radio', { name: 'Tomo Dark' })).toHaveAttribute('aria-checked', 'true');
    expect(within(grid).getByRole('button', { name: 'Edit Paper' })).toBeInTheDocument();
  });

  it('moves through the themes with the arrow keys, with one Tab stop for the group', async () => {
    show();
    const radios = within(screen.getByRole('radiogroup', { name: 'Theme' })).getAllByRole('radio');
    expect(radios.filter((r) => r.tabIndex === 0)).toEqual([screen.getByRole('radio', { name: 'Tomo Dark' })]);
    screen.getByRole('radio', { name: 'Tomo Dark' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(useSettings.getState().settings.theme.current).toBe('tomo-light');
    expect(screen.getByRole('radio', { name: 'Tomo Light' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(useSettings.getState().settings.theme.current).toBe('catppuccin-latte');
  });

  it('applies a theme when it is picked', async () => {
    show();
    await userEvent.click(screen.getByRole('radio', { name: 'GitHub Light' }));
    expect(useSettings.getState().settings.theme.current).toBe('github-light');
    expect(document.documentElement.dataset.scheme).toBe('light');
  });

  it('makes a new theme from the current one and opens it', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'New theme' }));
    const { theme } = useSettings.getState().settings;
    expect(theme.custom).toHaveLength(1);
    expect(theme.current).toBe(theme.custom[0]!.id);
    expect(screen.getByRole('radio', { name: 'My theme' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('dialog', { name: 'My theme' })).toBeInTheDocument();
  });

  it('opens the editor from a theme card', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Dracula' }));
    expect(screen.getByRole('dialog', { name: 'Dracula' })).toBeInTheDocument();
  });

  it('holds the theme and the background', () => {
    show();
    for (const name of ['Theme', 'Background']) expect(screen.getByRole('region', { name })).toBeInTheDocument();
  });

  it('keeps the dithered background switch off until an image is chosen', () => {
    show();
    expect(screen.getByRole('switch', { name: 'Dithered background' })).toBeDisabled();
  });

  it('shows a readable error when the image cannot be used', async () => {
    show();
    await userEvent.upload(screen.getByLabelText('Choose image'), new File(['x'], 'photo.heic', { type: 'image/heic' }));
    expect(await screen.findByText("Couldn't read that image")).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Dithered background' })).toBeDisabled();
  });
});
