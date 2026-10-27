import * as api from '../server/api';
import { prefetchChapter, takePrefetched } from './nextChapterCache';

vi.mock('../server/api', () => ({ getPages: vi.fn(async () => ['/n/0', '/n/1', '/n/2']) }));

it('hands over prefetched pages once', async () => {
  prefetchChapter(12);
  prefetchChapter(12);
  await vi.waitFor(() => expect(api.getPages).toHaveBeenCalledTimes(1));
  await Promise.resolve();
  expect(await takePrefetched(12)).toEqual(['/n/0', '/n/1', '/n/2']);
  expect(takePrefetched(12)).toBeUndefined();
});

it('keeps only the latest chapter', async () => {
  prefetchChapter(20);
  prefetchChapter(21);
  expect(takePrefetched(20)).toBeUndefined();
  expect(await takePrefetched(21)).toEqual(['/n/0', '/n/1', '/n/2']);
});

it('fetches again when the prefetch failed but was taken before it settled', async () => {
  vi.mocked(api.getPages).mockRejectedValueOnce(new Error('offline'));
  prefetchChapter(30);
  const taken = takePrefetched(30);
  expect(await taken).toEqual(['/n/0', '/n/1', '/n/2']);
});
