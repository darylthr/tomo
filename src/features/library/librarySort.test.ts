import type { Title } from '../../shared/model/types';
import { naturalDescending, sortTitles, type SortInfo } from './librarySort';

const t = (id: number, title: string, unread: number, chapterCount: number) => ({ id, title, unread, chapterCount }) as Title;
const A = t(1, 'Ash', 3, 40);
const B = t(2, 'Birch', 0, 120);
const C = t(3, 'Cedar', 12, 12);
const D = t(4, 'Dawn', 1, 8);
const ALL = [C, A, D, B];
const names = (ts: Title[]) => ts.map((x) => x.title);

it('sorts by title', () => {
  expect(names(sortTitles(ALL, 'title', false, null))).toEqual(['Ash', 'Birch', 'Cedar', 'Dawn']);
  expect(names(sortTitles(ALL, 'title', true, null))).toEqual(['Dawn', 'Cedar', 'Birch', 'Ash']);
});

it('sorts by chapters left, keeping caught-up titles at the end either way', () => {
  expect(names(sortTitles(ALL, 'unread', true, null))).toEqual(['Cedar', 'Ash', 'Dawn', 'Birch']);
  expect(names(sortTitles(ALL, 'unread', false, null))).toEqual(['Dawn', 'Ash', 'Cedar', 'Birch']);
});

it('sorts by total chapters', () => {
  expect(names(sortTitles(ALL, 'chapters', true, null))).toEqual(['Birch', 'Ash', 'Cedar', 'Dawn']);
  expect(names(sortTitles(ALL, 'chapters', false, null))).toEqual(['Dawn', 'Cedar', 'Ash', 'Birch']);
});

it('sorts by dates from the server, putting titles without one last', () => {
  const info: SortInfo = new Map([
    [1, { addedAt: 10, lastReadAt: 500, latestAt: 30 }],
    [2, { addedAt: 40, lastReadAt: 0, latestAt: 90 }],
    [3, { addedAt: 20, lastReadAt: 900, latestAt: 60 }],
  ]);
  expect(names(sortTitles(ALL, 'lastRead', true, info))).toEqual(['Cedar', 'Ash', 'Birch', 'Dawn']);
  expect(names(sortTitles(ALL, 'latest', true, info))).toEqual(['Birch', 'Cedar', 'Ash', 'Dawn']);
  expect(names(sortTitles(ALL, 'added', false, info))).toEqual(['Ash', 'Cedar', 'Birch', 'Dawn']);
});

it('falls back to title order while the dates are not known', () => {
  expect(names(sortTitles(ALL, 'lastRead', true, null))).toEqual(['Ash', 'Birch', 'Cedar', 'Dawn']);
});

it('knows which way each sort starts', () => {
  expect(naturalDescending('title')).toBe(false);
  expect(naturalDescending('unread')).toBe(true);
  expect(naturalDescending('lastRead')).toBe(true);
});
