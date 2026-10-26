import type { FeedEntry } from '../../shared/model/types';
import * as continueReading from '../library/continueReading';
import { latestPerTitle, resumeChapterId, visible } from './history';

vi.mock('../library/continueReading', () => ({ loadChapters: vi.fn() }));

function entry(id: number, titleId: number, at: number, read = false, order = id): FeedEntry {
  return {
    chapter: { id, titleId, name: `Chapter ${order}`, number: order, order, read, bookmarked: false, lastPage: 0, pageCount: 0, uploadedAt: 0, scanlator: null },
    title: { id: titleId, title: `Title ${titleId}`, coverUrl: null, inLibrary: true },
    at,
  };
}

const ENTRIES = [entry(12, 1, 500), entry(11, 1, 400, true), entry(21, 2, 300, true), entry(40, 4, 200), entry(41, 4, 100, true)];

it('keeps the most recently read chapter of each title, in order', () => {
  expect(latestPerTitle(ENTRIES).map((e) => e.chapter.id)).toEqual([12, 21, 40]);
});

it('hides titles removed on this device until they are read again', () => {
  const latest = latestPerTitle(ENTRIES);
  expect(visible(latest, { clearedAt: 0, titles: { 4: 200 } }).map((e) => e.title.id)).toEqual([1, 2]);
  expect(visible(latest, { clearedAt: 0, titles: { 4: 150 } }).map((e) => e.title.id)).toEqual([1, 2, 4]);
});

it('hides everything read before history was cleared', () => {
  expect(visible(latestPerTitle(ENTRIES), { clearedAt: 300, titles: {} }).map((e) => e.title.id)).toEqual([1]);
});

describe('resume', () => {
  const chapters = [entry(20, 2, 0, true, 11).chapter, entry(21, 2, 0, true, 12).chapter, entry(22, 2, 0, false, 13).chapter];

  it('opens an unfinished chapter again', async () => {
    await expect(resumeChapterId(entry(12, 1, 0))).resolves.toBe(12);
  });

  it('opens the next chapter after a finished one', async () => {
    vi.mocked(continueReading.loadChapters).mockResolvedValue([...chapters].reverse());
    await expect(resumeChapterId(entry(21, 2, 0, true, 12))).resolves.toBe(22);
  });

  it('opens a finished last chapter again', async () => {
    vi.mocked(continueReading.loadChapters).mockResolvedValue(chapters);
    await expect(resumeChapterId(entry(22, 2, 0, true, 13))).resolves.toBe(22);
  });
});
