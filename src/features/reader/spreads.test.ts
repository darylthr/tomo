import { layoutFor, pairPages, wantsSpreads } from './spreads';

const narrow = { w: 800, h: 1200 };
const wide = { w: 1600, h: 1200 };
const six = Array.from({ length: 6 }, () => narrow);

it('pairs pages after a lone cover', () => {
  expect(pairPages(six, true)).toEqual([[0], [1, 2], [3, 4], [5]]);
});

it('pairs from the first page without a cover', () => {
  expect(pairPages(six, false)).toEqual([[0, 1], [2, 3], [4, 5]]);
});

it('keeps a wide page alone and restarts pairing after it', () => {
  const sizes = [narrow, narrow, narrow, wide, narrow, narrow];
  expect(pairPages(sizes, true)).toEqual([[0], [1, 2], [3], [4, 5]]);
  // a wide page in the middle of what would be a pair
  expect(pairPages([narrow, narrow, wide, narrow, narrow], false)).toEqual([[0, 1], [2], [3, 4]]);
});

it('treats unknown sizes as narrow', () => {
  expect(pairPages([undefined, undefined, undefined, undefined], false)).toEqual([
    [0, 1],
    [2, 3],
  ]);
  expect(pairPages([], true)).toEqual([]);
});

it('wants spreads only in landscape at 900px or wider, never in vertical or webtoon', () => {
  expect(wantsSpreads('auto', { w: 1280, h: 800 }, 'rtl')).toBe(true);
  expect(wantsSpreads('auto', { w: 1138, h: 712 }, 'ltr')).toBe(true);
  expect(wantsSpreads('auto', { w: 800, h: 600 }, 'rtl')).toBe(false);
  expect(wantsSpreads('auto', { w: 390, h: 844 }, 'rtl')).toBe(false);
  expect(wantsSpreads('on', { w: 390, h: 844 }, 'rtl')).toBe(true);
  expect(wantsSpreads('off', { w: 1280, h: 800 }, 'rtl')).toBe(false);
  expect(wantsSpreads('on', { w: 1280, h: 800 }, 'vertical')).toBe(false);
  expect(wantsSpreads('on', { w: 1280, h: 800 }, 'webtoon')).toBe(false);
});

it('pairs the whole chapter even while only some page sizes are known', () => {
  const sizes = [narrow];
  sizes.length = 1; // sizes arrive one by one; the rest are still unknown
  expect(layoutFor(8, sizes, true)).toEqual([[0], [1, 2], [3, 4], [5, 6], [7]]);
  expect(layoutFor(3, [], false)).toEqual([[0, 1], [2]]);
});
