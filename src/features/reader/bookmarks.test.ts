import * as api from '../server/api';
import { BookmarksUnreadable, parseBookmarks, updateBookmarks, type PageBookmark } from './bookmarks';

vi.mock('../server/api', () => ({ getMangaMeta: vi.fn(), setMangaMeta: vi.fn(async () => {}), deleteMangaMeta: vi.fn(async () => {}) }));

const mark = (id: string, page = 3): PageBookmark => ({ id, chapterId: 11, page, note: '', createdAt: 1 });

beforeEach(() => vi.clearAllMocks());

it('reads an empty list when there are no bookmarks', () => {
  expect(parseBookmarks(undefined)).toEqual([]);
});

it('drops bad entries and shortens long notes', () => {
  const value = JSON.stringify([mark('a'), { id: 'b' }, { ...mark('c'), note: 'x'.repeat(200) }]);
  const list = parseBookmarks(value);
  expect(list === 'unreadable' ? null : list.map((b) => b.id)).toEqual(['a', 'c']);
  expect(list !== 'unreadable' && list[1]!.note).toHaveLength(140);
});

it("calls a value it can't parse unreadable", () => {
  expect(parseBookmarks('{oops')).toBe('unreadable');
  expect(parseBookmarks('{"not":"a list"}')).toBe('unreadable');
});

it("refuses to write over bookmarks it can't read", async () => {
  vi.mocked(api.getMangaMeta).mockResolvedValue({ 'tomo.bookmarks': '{oops' });
  await expect(updateBookmarks(1, (l) => [...l, mark('b')])).rejects.toBeInstanceOf(BookmarksUnreadable);
  expect(api.setMangaMeta).not.toHaveBeenCalled();
});

it('merges with what another device saved', async () => {
  vi.mocked(api.getMangaMeta).mockResolvedValue({ 'tomo.bookmarks': JSON.stringify([mark('a')]) });
  const list = await updateBookmarks(1, (l) => [...l, mark('b', 5)]);
  expect(list.map((b) => b.id)).toEqual(['a', 'b']);
  expect(api.setMangaMeta).toHaveBeenCalledWith(1, 'tomo.bookmarks', JSON.stringify([mark('a'), mark('b', 5)]));
});

it('deletes the key when the last bookmark goes', async () => {
  vi.mocked(api.getMangaMeta).mockResolvedValue({ 'tomo.bookmarks': JSON.stringify([mark('a')]) });
  await updateBookmarks(1, () => []);
  expect(api.deleteMangaMeta).toHaveBeenCalledWith(1, 'tomo.bookmarks');
  expect(api.setMangaMeta).not.toHaveBeenCalled();
});

it("keeps entries and fields it doesn't understand when it writes", async () => {
  const odd = { id: 'x', chapterId: 'eleven' };
  vi.mocked(api.getMangaMeta).mockResolvedValue({ 'tomo.bookmarks': JSON.stringify([{ ...mark('a'), colour: 'red' }, odd]) });
  const list = await updateBookmarks(1, (l) => l.filter((b) => b.id !== 'a'));
  expect(list).toEqual([]);
  expect(api.setMangaMeta).toHaveBeenCalledWith(1, 'tomo.bookmarks', JSON.stringify([odd]));
  vi.mocked(api.setMangaMeta).mockClear();
  await updateBookmarks(1, (l) => [...l, mark('b', 5)]);
  expect(api.setMangaMeta).toHaveBeenCalledWith(1, 'tomo.bookmarks', JSON.stringify([{ ...mark('a'), colour: 'red' }, mark('b', 5), odd]));
});
