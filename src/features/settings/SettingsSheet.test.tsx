import 'fake-indexeddb/auto';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSettings } from '../../shared/settings/store';
import { useUi } from '../../shared/ui/uiStore';
import { SettingsSheet } from './SettingsSheet';

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
  useUi.setState({ settingsOpen: false });
});

function openSheet() {
  render(
    <>
      <button onClick={() => useUi.getState().openSettings()}>Settings</button>
      <SettingsSheet />
    </>,
  );
  return screen.getByRole('button', { name: 'Settings' });
}

it('opens as a dialog named Settings', async () => {
  const trigger = openSheet();
  await userEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Settings' })).toBeVisible();
});

it('changes how titles are shown', async () => {
  await userEvent.click(openSheet());
  const group = screen.getByRole('radiogroup', { name: 'Show titles as' });
  await userEvent.click(screen.getByRole('radio', { name: 'Covers' }));
  expect(group).toBeInTheDocument();
  expect(useSettings.getState().settings.library.display).toBe('covers');
});

it('keeps the dithered background switch off until an image is chosen', async () => {
  await userEvent.click(openSheet());
  expect(screen.getByRole('switch', { name: 'Dithered background' })).toBeDisabled();
});

it('shows a readable error when the image cannot be used', async () => {
  await userEvent.click(openSheet());
  const input = screen.getByLabelText('Choose image');
  await userEvent.upload(input, new File(['x'], 'photo.heic', { type: 'image/heic' }));
  expect(await screen.findByText("Couldn't read that image")).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Dithered background' })).toBeDisabled();
});

it('warns when custom theme text would be hard to read', async () => {
  await userEvent.click(openSheet());
  act(() => useSettings.getState().update({ theme: { mode: 'custom', bg: '#777777', ink: '#ffffff' } }));
  expect(screen.getByText('Text may be hard to read on this background')).toBeInTheDocument();
});

it('closes on Escape and returns focus to the button that opened it', async () => {
  const trigger = openSheet();
  await userEvent.click(trigger);
  await userEvent.keyboard('{Escape}');
  expect(useUi.getState().settingsOpen).toBe(false);
  expect(trigger).toHaveFocus();
});

it('moves through a segmented control with the arrow keys', async () => {
  await userEvent.click(openSheet());
  const books = screen.getByRole('radio', { name: 'Books' });
  books.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(useSettings.getState().settings.library.display).toBe('covers');
  expect(screen.getByRole('radio', { name: 'Covers' })).toHaveFocus();
});
