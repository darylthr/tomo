import type { FeedEntry } from '../../shared/model/types';
import { BATCH_MIN, collapseBatches, unreadCount } from './batches';

const NOW = Date.UTC(2026, 9, 26, 12);

function entry(id: number, titleId: number, at: number, read = false): FeedEntry {
  return {
    chapter: { id, titleId, name: `Chapter ${id}`, number: id, order: id, read, bookmarked: false, lastPage: 0, pageCount: 0, uploadedAt: 0, scanlator: null },
    title: { id: titleId, title: `Title ${titleId}`, coverUrl: null, inLibrary: true },
    at,
  };
}

/** `n` chapters of one title fetched together, a few ms apart, newest first. */
function fetch(titleId: number, n: number, at: number, firstId = titleId * 1000): FeedEntry[] {
  return Array.from({ length: n }, (_, i) => entry(firstId + n - i, titleId, at - i * 5));
}

it('keeps small fetches as single chapters', () => {
  const entries = [...fetch(1, BATCH_MIN, NOW), entry(7, 2, NOW - 60_000)];
  const items = collapseBatches(entries);
  expect(items).toHaveLength(BATCH_MIN + 1);
  expect(items.every((i) => i.kind === 'chapter')).toBe(true);
});

it('collapses one fetch of more than BATCH_MIN chapters into one item', () => {
  const big = fetch(1, 142, NOW - 3_600_000);
  const items = collapseBatches([entry(7, 2, NOW), ...big]);
  expect(items.map((i) => i.kind)).toEqual(['chapter', 'batch']);
  const batch = items[1];
  if (batch?.kind !== 'batch') throw new Error('expected a batch');
  expect(batch.entries).toHaveLength(142);
  expect(batch.title.id).toBe(1);
  expect(batch.at).toBe(NOW - 3_600_000);
});

it('keeps separate fetches of the same title apart', () => {
  const items = collapseBatches([...fetch(1, 3, NOW), ...fetch(1, 20, NOW - 86_400_000, 1)]);
  expect(items.map((i) => i.kind)).toEqual(['chapter', 'chapter', 'chapter', 'batch']);
});

it('collapses a fetch even when another title lands in the middle of it', () => {
  const big = fetch(1, 30, NOW);
  const items = collapseBatches([...big.slice(0, 10), entry(7, 2, NOW - 52), ...big.slice(10)]);
  expect(items.map((i) => i.kind)).toEqual(['batch', 'chapter']);
});

it('counts a batch with unread chapters as one for the badge', () => {
  const items = collapseBatches([entry(7, 2, NOW), entry(8, 2, NOW - 1, true), ...fetch(1, 50, NOW - 10_000)]);
  expect(unreadCount(items)).toBe(2);
  const allRead = collapseBatches(fetch(1, 50, NOW).map((e) => ({ ...e, chapter: { ...e.chapter, read: true } })));
  expect(unreadCount(allRead)).toBe(0);
});
