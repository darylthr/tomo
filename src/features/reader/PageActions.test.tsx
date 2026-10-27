import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Chapter } from '../../shared/model/types';
import { PageActions } from './PageActions';
import { useReader } from './readerStore';
import * as save from './savePage';

const chapter = { id: 11, titleId: 1, name: 'Chapter 12', number: 12, order: 12 } as Chapter;

beforeEach(() => {
  useReader.getState().open(chapter, ['/p/0', '/p/1', '/p/2', '/p/3'], 0, 'rtl');
  useReader.setState({ pageActions: 1, view: [1, 2], layout: [[0], [1, 2], [3]] });
});

it('saves the pressed page with a readable name', async () => {
  const spy = vi.spyOn(save, 'savePage').mockResolvedValue('downloaded');
  render(<PageActions titleName="Blue Hour" />);
  await userEvent.click(screen.getByRole('button', { name: 'Save page' }));
  expect(spy).toHaveBeenCalledWith('/p/1', expect.any(Function));
  const name = spy.mock.calls[0]![1]('image/png');
  expect(name).toBe('Blue Hour - Ch 12 - p2.png');
});

it('lets a spread choose its left or right page', async () => {
  const spy = vi.spyOn(save, 'savePage').mockResolvedValue('downloaded');
  render(<PageActions titleName="Blue Hour" />);
  // Manga: the right page is the earlier one.
  await userEvent.click(screen.getByRole('radio', { name: 'Left page' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save page' }));
  expect(spy).toHaveBeenCalledWith('/p/2', expect.any(Function));
});

it('shows a readable error when saving fails', async () => {
  vi.spyOn(save, 'savePage').mockRejectedValue(new Error('HTTP 502'));
  render(<PageActions titleName="Blue Hour" />);
  await userEvent.click(screen.getByRole('button', { name: 'Save page' }));
  expect(await screen.findByText("Couldn't save this page")).toBeInTheDocument();
});
