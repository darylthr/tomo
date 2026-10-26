import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../app/testRouter';
import type { Title } from '../../shared/model/types';
import { useLibrary } from '../library/libraryStore';
import * as api from '../server/api';
import { CategoriesPage } from './CategoriesPage';

vi.mock('../server/api', () => ({
  createCategory: vi.fn(async (name: string) => ({ id: 9, name, order: 4 })),
  renameCategory: vi.fn(async () => {}),
  moveCategory: vi.fn(async () => {}),
  deleteCategory: vi.fn(async () => {}),
  getLibrary: vi.fn(),
}));

const CATEGORIES = [
  { id: 0, name: 'Default', order: 0 },
  { id: 5, name: 'Reading', order: 1 },
  { id: 6, name: 'Paused', order: 2 },
  { id: 7, name: 'Dropped', order: 3 },
];

const titleIn = (id: number, categoryIds: number[]) => ({ id, categoryIds }) as Title;
const TITLES = [titleIn(1, [5]), titleIn(2, [5, 6]), titleIn(3, [])];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getLibrary).mockImplementation(async () => ({ titles: TITLES, categories: useLibrary.getState().categories }));
  useLibrary.setState({ status: 'ready', titles: TITLES, categories: CATEGORIES });
});

const rows = () =>
  within(screen.getByRole('list', { name: 'Your categories' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

it("lists the owner's categories in shelf order with how many titles each holds", () => {
  renderWithRouter(<CategoriesPage />, '/settings/categories');
  expect(rows()).toEqual(['Reading2', 'Paused1', 'Dropped0']);
});

it('creates a category', async () => {
  renderWithRouter(<CategoriesPage />, '/settings/categories');
  await userEvent.click(screen.getByRole('button', { name: 'New category' }));
  const sheet = screen.getByRole('dialog', { name: 'New category' });
  await userEvent.type(within(sheet).getByRole('textbox', { name: 'Name' }), 'To Read');
  await userEvent.click(within(sheet).getByRole('button', { name: 'Create' }));
  expect(api.createCategory).toHaveBeenCalledWith('To Read');
  expect(await screen.findByText('To Read')).toBeInTheDocument();
});

it('renames a category', async () => {
  renderWithRouter(<CategoriesPage />, '/settings/categories');
  await userEvent.click(screen.getByRole('button', { name: 'Options for Paused' }));
  const sheet = screen.getByRole('dialog', { name: 'Paused' });
  const field = within(sheet).getByRole('textbox', { name: 'Name' });
  await userEvent.clear(field);
  await userEvent.type(field, 'On hold');
  await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
  expect(api.renameCategory).toHaveBeenCalledWith(6, 'On hold');
  expect(rows()).toContain('On hold1');
});

it('deletes a category after confirming, keeping its titles', async () => {
  renderWithRouter(<CategoriesPage />, '/settings/categories');
  await userEvent.click(screen.getByRole('button', { name: 'Options for Reading' }));
  const sheet = screen.getByRole('dialog', { name: 'Reading' });
  await userEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
  expect(api.deleteCategory).not.toHaveBeenCalled();
  expect(within(sheet).getByText('Its 2 titles stay in your library.')).toBeInTheDocument();
  await userEvent.click(within(sheet).getByRole('button', { name: 'Delete Reading' }));
  expect(api.deleteCategory).toHaveBeenCalledWith(5);
  expect(rows()).toEqual(['Paused1', 'Dropped0']);
});

it('moves a category with the keyboard, which is the shelf tab order', async () => {
  renderWithRouter(<CategoriesPage />, '/settings/categories');
  screen.getByRole('button', { name: 'Move Reading' }).focus();
  await userEvent.keyboard('{ArrowDown}');
  expect(rows()).toEqual(['Paused1', 'Reading2', 'Dropped0']);
  expect(api.moveCategory).toHaveBeenCalledWith(5, 2);
  expect(screen.getByRole('button', { name: 'Move Reading' })).toHaveFocus();
});

it('says when there are no categories yet', () => {
  useLibrary.setState({ categories: [CATEGORIES[0]!] });
  renderWithRouter(<CategoriesPage />, '/settings/categories');
  expect(screen.getByText(/No categories yet/)).toBeInTheDocument();
});
