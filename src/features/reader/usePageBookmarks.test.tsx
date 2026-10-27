import { act, renderHook, waitFor } from '@testing-library/react';
import * as api from '../server/api';
import { usePageBookmarks } from './usePageBookmarks';

vi.mock('../server/api', () => ({ getMangaMeta: vi.fn(), setMangaMeta: vi.fn(async () => {}), deleteMangaMeta: vi.fn(async () => {}) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getMangaMeta).mockResolvedValue({});
});

it('adds, notes and removes a page bookmark, saving each change', async () => {
  const { result } = renderHook(() => usePageBookmarks(1));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(() => result.current.add(11, 3));
  expect(result.current.list).toMatchObject([{ chapterId: 11, page: 3, note: '' }]);
  vi.mocked(api.getMangaMeta).mockResolvedValue({ 'tomo.bookmarks': JSON.stringify(result.current.list) });
  const id = result.current.list[0]!.id;
  await act(() => result.current.setNote(id, 'the reveal'));
  expect(result.current.list[0]!.note).toBe('the reveal');
  vi.mocked(api.getMangaMeta).mockResolvedValue({ 'tomo.bookmarks': JSON.stringify(result.current.list) });
  await act(() => result.current.remove(id));
  expect(result.current.list).toEqual([]);
  expect(api.deleteMangaMeta).toHaveBeenCalledWith(1, 'tomo.bookmarks');
});

it("says when the title's bookmarks can't be read, and adds nothing", async () => {
  vi.mocked(api.getMangaMeta).mockResolvedValue({ 'tomo.bookmarks': '{oops' });
  const { result } = renderHook(() => usePageBookmarks(1));
  await waitFor(() => expect(result.current.status).toBe('unreadable'));
  await act(() => result.current.add(11, 3));
  expect(api.setMangaMeta).not.toHaveBeenCalled();
});
