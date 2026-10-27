import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSettings } from '../../shared/settings/store';
import { ThemeEditor } from './ThemeEditor';

const paper = { bg: '#f5ecd7', surface: '#fffaf0', ink: '#3b2f1e', accent: '#b5651d', chrome: '#efe3c8' };

beforeEach(() => useSettings.getState().setTheme({ current: 'tomo-dark', overrides: {}, custom: [{ id: 'p', name: 'Paper', colours: paper }] }));

const pick = (sheet: HTMLElement, row: string, hex: string) => fireEvent.change(within(sheet).getByLabelText(row), { target: { value: hex } });

it('changes a colour of a built-in and resets it', async () => {
  render(<ThemeEditor id="nord" onClose={() => {}} />);
  const sheet = screen.getByRole('dialog', { name: 'Nord' });
  expect(within(sheet).queryByRole('button', { name: 'Reset to Nord' })).toBeNull();
  pick(sheet, 'Accent', '#ff0000');
  expect(useSettings.getState().settings.theme.overrides).toEqual({ nord: { accent: '#ff0000' } });
  expect(within(sheet).getByText('#FF0000')).toBeInTheDocument();
  await userEvent.click(within(sheet).getByRole('button', { name: 'Reset to Nord' }));
  expect(useSettings.getState().settings.theme.overrides).toEqual({});
});

it('warns when text would be hard to read', () => {
  render(<ThemeEditor id="nord" onClose={() => {}} />);
  const sheet = screen.getByRole('dialog', { name: 'Nord' });
  expect(within(sheet).queryByText('Text may be hard to read on this background')).toBeNull();
  pick(sheet, 'Text', '#3b4252');
  expect(within(sheet).getByText('Text may be hard to read on this background')).toBeInTheDocument();
});

it('renames and deletes a custom theme after confirming', async () => {
  const onClose = vi.fn();
  render(<ThemeEditor id="p" onClose={onClose} />);
  const sheet = screen.getByRole('dialog', { name: 'Paper' });
  const name = within(sheet).getByRole('textbox', { name: 'Name' });
  await userEvent.clear(name);
  await userEvent.type(name, 'Sepia');
  expect(useSettings.getState().settings.theme.custom[0]!.name).toBe('Sepia');
  await userEvent.click(within(sheet).getByRole('button', { name: 'Delete theme' }));
  expect(useSettings.getState().settings.theme.custom).toHaveLength(1);
  await userEvent.click(within(sheet).getByRole('button', { name: 'Delete Sepia' }));
  expect(useSettings.getState().settings.theme.custom).toEqual([]);
  expect(onClose).toHaveBeenCalled();
});

it('keeps a custom theme with an empty name from being saved nameless', async () => {
  render(<ThemeEditor id="p" onClose={() => {}} />);
  await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
  expect(useSettings.getState().settings.theme.custom[0]!.name).toBe('Paper');
});
