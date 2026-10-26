import type { Chapter } from '../../shared/model/types';
import { arrangeChapters, DEFAULT_VIEW, isDefaultView } from './chapterList';

const chapter = (id: number, number: number, patch: Partial<Chapter> = {}): Chapter => ({
  id,
  titleId: 1,
  name: `Chapter ${number}`,
  number,
  order: number,
  read: false,
  bookmarked: false,
  lastPage: 0,
  pageCount: 8,
  uploadedAt: number * 1000,
  scanlator: null,
  ...patch,
});

const ids = (cs: Chapter[]) => cs.map((c) => c.id);
const list = [chapter(3, 3), chapter(2, 2, { read: true }), chapter(1, 1, { bookmarked: true })];

it('sorts in chapter order, newest first by default', () => {
  expect(ids(arrangeChapters([list[2]!, list[0]!, list[1]!], DEFAULT_VIEW))).toEqual([3, 2, 1]);
  expect(ids(arrangeChapters(list, { ...DEFAULT_VIEW, descending: false }))).toEqual([1, 2, 3]);
});

it('sorts by upload date', () => {
  const late = chapter(9, 1.5, { uploadedAt: 99_000 });
  expect(ids(arrangeChapters([...list, late], { ...DEFAULT_VIEW, sort: 'uploaded' }))).toEqual([9, 3, 2, 1]);
  expect(ids(arrangeChapters([...list, late], { ...DEFAULT_VIEW, sort: 'uploaded', descending: false }))).toEqual([1, 2, 3, 9]);
});

it('falls back to source order when chapter numbers tie or are unknown', () => {
  const extras = [chapter(20, -1, { order: 5 }), chapter(21, -1, { order: 4 })];
  expect(ids(arrangeChapters([...extras, ...list], DEFAULT_VIEW))).toEqual([20, 21, 3, 2, 1]);
});

it('filters to unread or bookmarked chapters', () => {
  expect(ids(arrangeChapters(list, { ...DEFAULT_VIEW, unreadOnly: true }))).toEqual([3, 1]);
  expect(ids(arrangeChapters(list, { ...DEFAULT_VIEW, bookmarkedOnly: true }))).toEqual([1]);
});

it('keeps one chapter per number, preferring the one you started, then the main scanlator', () => {
  const chapters = [
    chapter(31, 3, { scanlator: 'Alpha' }),
    chapter(32, 3, { scanlator: 'Beta' }),
    chapter(21, 2, { scanlator: 'Alpha' }),
    chapter(22, 2, { scanlator: 'Beta', lastPage: 4 }),
    chapter(11, 1, { scanlator: 'Beta' }),
    chapter(10, 1, { scanlator: 'Alpha' }),
    chapter(40, -1, { order: 0, scanlator: 'Alpha' }),
    chapter(41, -1, { order: 0, scanlator: 'Gamma' }),
  ];
  expect(ids(arrangeChapters(chapters, { ...DEFAULT_VIEW, dedupe: true }))).toEqual([31, 22, 10, 40, 41]);
});

it('knows the default view', () => {
  expect(isDefaultView(DEFAULT_VIEW)).toBe(true);
  expect(isDefaultView({ ...DEFAULT_VIEW, unreadOnly: true })).toBe(false);
});
