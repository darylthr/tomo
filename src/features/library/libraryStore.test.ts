import libraryFixture from '../server/__fixtures__/library.json';
import { useLibrary } from './libraryStore';

function serve(response: () => Promise<Response>) {
  const fetch = vi.fn(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

beforeEach(() => useLibrary.setState({ status: 'idle', titles: [], categories: [], error: null }));
afterEach(() => vi.unstubAllGlobals());

it('loads the server library', async () => {
  serve(async () => new Response(JSON.stringify(libraryFixture)));
  await useLibrary.getState().load();
  const s = useLibrary.getState();
  expect(s.status).toBe('ready');
  expect(s.titles).toHaveLength(3);
  expect(s.categories).toHaveLength(3);
});

it('fetches once when asked to load twice at the same time', async () => {
  const fetch = serve(async () => new Response(JSON.stringify(libraryFixture)));
  await Promise.all([useLibrary.getState().load(), useLibrary.getState().load()]);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('keeps the error when the server is unreachable', async () => {
  serve(async () => Promise.reject(new TypeError('Failed to fetch')));
  await useLibrary.getState().load();
  const s = useLibrary.getState();
  expect(s.status).toBe('error');
  expect(s.error?.kind).toBe('unreachable');
});

it('refreshes even when already loaded', async () => {
  const fetch = serve(async () => new Response(JSON.stringify(libraryFixture)));
  await useLibrary.getState().load();
  await useLibrary.getState().refresh();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('patches one title in place', async () => {
  serve(async () => new Response(JSON.stringify(libraryFixture)));
  await useLibrary.getState().load();
  useLibrary.getState().patchTitle(1, { unread: 3 });
  expect(useLibrary.getState().titles.find((t) => t.id === 1)?.unread).toBe(3);
});

it('a refresh replaces a request that is still hanging, and the stale answer is ignored', async () => {
  let releaseFirst: (r: Response) => void = () => {};
  const empty = { data: { mangas: { nodes: [] }, categories: { nodes: [] } } };
  const fetch = vi
    .fn()
    .mockImplementationOnce(() => new Promise<Response>((r) => (releaseFirst = r)))
    .mockImplementationOnce(async () => new Response(JSON.stringify(libraryFixture)));
  vi.stubGlobal('fetch', fetch);
  const first = useLibrary.getState().load();
  await useLibrary.getState().refresh();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(useLibrary.getState().titles).toHaveLength(3);
  releaseFirst(new Response(JSON.stringify(empty)));
  await first;
  expect(useLibrary.getState().titles).toHaveLength(3);
  expect(useLibrary.getState().status).toBe('ready');
});
