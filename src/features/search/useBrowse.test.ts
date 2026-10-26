import { act, renderHook, waitFor } from '@testing-library/react';
import type { BrowsePage } from '../../shared/model/types';
import * as api from '../server/api';
import { clearBrowseCache, useBrowse, type BrowseQuery } from './useBrowse';

vi.mock('../server/api', () => ({ browseSource: vi.fn() }));
const browse = vi.mocked(api.browseSource);

const item = (id: number) => ({ id, title: `T${id}`, coverUrl: null, inLibrary: false });
const page = (ids: number[], hasNextPage = true): BrowsePage => ({ items: ids.map(item), hasNextPage });
const popular: BrowseQuery = { sourceId: '7', mode: 'popular' };

beforeEach(() => {
  clearBrowseCache();
  browse.mockReset();
});

it('loads the first page', async () => {
  browse.mockResolvedValueOnce(page([1, 2]));
  const { result } = renderHook(() => useBrowse(popular));
  expect(result.current.status).toBe('loading');
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.items.map((i) => i.id)).toEqual([1, 2]);
  expect(browse.mock.calls[0]![0]).toEqual({ sourceId: '7', mode: 'popular', page: 1 });
});

it('appends the next page and drops titles a source repeats', async () => {
  browse.mockResolvedValueOnce(page([1, 2])).mockResolvedValueOnce(page([2, 3], false));
  const { result } = renderHook(() => useBrowse(popular));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  act(() => result.current.loadMore());
  expect(result.current.status).toBe('more');
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.items.map((i) => i.id)).toEqual([1, 2, 3]);
  expect(result.current.hasNextPage).toBe(false);
  expect(browse.mock.calls[1]![0]).toMatchObject({ page: 2 });
});

it('shows a cached result again without asking the source', async () => {
  browse.mockResolvedValueOnce(page([1, 2]));
  const first = renderHook(() => useBrowse(popular));
  await waitFor(() => expect(first.result.current.status).toBe('ready'));
  first.unmount();
  const again = renderHook(() => useBrowse(popular));
  expect(again.result.current.status).toBe('ready');
  expect(again.result.current.items).toHaveLength(2);
  expect(browse).toHaveBeenCalledTimes(1);
});

it('switches to a new query and reports errors with a retry', async () => {
  browse.mockResolvedValueOnce(page([1])).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(page([9]));
  const { result, rerender } = renderHook((q: BrowseQuery) => useBrowse(q), { initialProps: popular });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  rerender({ sourceId: '7', mode: 'search', query: 'ferry' });
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.items).toEqual([]);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.items.map((i) => i.id)).toEqual([9]);
});

it('stops paging when a page brings nothing new', async () => {
  browse.mockResolvedValueOnce(page([1, 2])).mockResolvedValueOnce(page([1, 2], true));
  const { result } = renderHook(() => useBrowse(popular));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.hasNextPage).toBe(false);
});
