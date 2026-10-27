import 'fake-indexeddb/auto';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../app/testRouter';
import { useSettings } from '../../shared/settings/store';
import { useLibrary } from '../library/libraryStore';
import { CustomizationSettings } from './CustomizationSettings';
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
      'CustomizationDark · No background image',
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

  it('goes back to Settings', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
  });
});

describe('Reader', () => {
  it('picks the default reading mode and page fit', async () => {
    renderWithRouter(<ReaderSettings />, '/settings/reader');
    await userEvent.click(screen.getByRole('radio', { name: 'Webtoon' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Width' }));
    expect(useSettings.getState().settings.reader).toMatchObject({ defaultMode: 'webtoon', fit: 'width' });
  });
});

describe('Customization', () => {
  const show = () => renderWithRouter(<CustomizationSettings />, '/settings/customization');

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

  it('warns when custom theme text would be hard to read', () => {
    show();
    act(() => useSettings.getState().update({ theme: { mode: 'custom', bg: '#777777', ink: '#ffffff' } }));
    expect(screen.getByText('Text may be hard to read on this background')).toBeInTheDocument();
  });
});
