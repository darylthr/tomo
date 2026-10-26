import 'fake-indexeddb/auto';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../app/testRouter';
import { useSettings } from '../../shared/settings/store';
import { useLibrary } from '../library/libraryStore';
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

beforeEach(() => useSettings.getState().reset());

const show = () => renderWithRouter(<SettingsPage />, '/settings');

it('is a page named Settings with every group', () => {
  show();
  expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  for (const name of ['Server', 'Library', 'Reading', 'Background', 'Appearance'])
    expect(screen.getByRole('region', { name })).toBeInTheDocument();
});

it('changes how titles are shown', async () => {
  show();
  await userEvent.click(screen.getByRole('radio', { name: 'Covers' }));
  expect(useSettings.getState().settings.library.display).toBe('covers');
});

it('picks the default reading mode and page fit', async () => {
  show();
  await userEvent.click(screen.getByRole('radio', { name: 'Webtoon' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Width' }));
  expect(useSettings.getState().settings.reader).toMatchObject({ defaultMode: 'webtoon', fit: 'width' });
});

it('keeps the dithered background switch off until an image is chosen', () => {
  show();
  expect(screen.getByRole('switch', { name: 'Dithered background' })).toBeDisabled();
});

it('shows a readable error when the image cannot be used', async () => {
  show();
  const input = screen.getByLabelText('Choose image');
  await userEvent.upload(input, new File(['x'], 'photo.heic', { type: 'image/heic' }));
  expect(await screen.findByText("Couldn't read that image")).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Dithered background' })).toBeDisabled();
});

it('warns when custom theme text would be hard to read', () => {
  show();
  act(() => useSettings.getState().update({ theme: { mode: 'custom', bg: '#777777', ink: '#ffffff' } }));
  expect(screen.getByText('Text may be hard to read on this background')).toBeInTheDocument();
});

it('moves through a segmented control with the arrow keys', async () => {
  show();
  const books = screen.getByRole('radio', { name: 'Books' });
  books.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(useSettings.getState().settings.library.display).toBe('covers');
  expect(screen.getByRole('radio', { name: 'Covers' })).toHaveFocus();
});

it('links to the categories, saying how many there are', async () => {
  useLibrary.setState({ status: 'ready', categories: [{ id: 0, name: 'Default', order: 0 }, { id: 5, name: 'Reading', order: 1 }] });
  show();
  const link = screen.getByRole('link', { name: 'Categories, 1' });
  await userEvent.click(link);
  expect(screen.getByTestId('location')).toHaveTextContent('/settings/categories');
});
