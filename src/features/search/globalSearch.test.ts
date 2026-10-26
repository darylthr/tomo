import type { BrowsePage, Source } from '../../shared/model/types';
import type { BrowseRequest } from '../server/api';
import { retryGlobalSource, startGlobalSearch, useGlobalSearch } from './globalSearch';

const source = (id: string): Source => ({ id, name: id, lang: 'en', iconUrl: null, supportsLatest: true, version: '1', isLocal: false });
const sources = ['a', 'b', 'c', 'd'].map(source);

type Pending = { req: BrowseRequest; signal?: AbortSignal; resolve: (p: BrowsePage) => void; reject: (e: unknown) => void };
let pending: Pending[] = [];
const search = vi.fn(
  (req: BrowseRequest, signal?: AbortSignal) =>
    new Promise<BrowsePage>((resolve, reject) => pending.push({ req, signal, resolve, reject })),
);
const page = (title: string): BrowsePage => ({ items: [{ id: 1, title, coverUrl: null, inLibrary: false }], hasNextPage: false });
const status = () => Object.fromEntries(Object.entries(useGlobalSearch.getState().results).map(([k, v]) => [k, v.status]));
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  pending = [];
  search.mockClear();
  useGlobalSearch.setState({ query: '', results: {} });
});

it('searches every source, at most `limit` at a time', async () => {
  startGlobalSearch('ferry', sources, 2, search);
  expect(pending.map((p) => p.req.sourceId)).toEqual(['a', 'b']);
  expect(pending[0]!.req).toEqual({ sourceId: 'a', mode: 'search', page: 1, query: 'ferry' });
  expect(status()).toEqual({ a: 'searching', b: 'searching', c: 'waiting', d: 'waiting' });

  pending[1]!.resolve(page('B'));
  await flush();
  expect(status()).toMatchObject({ b: 'done', c: 'searching' });
  expect(useGlobalSearch.getState().results.b!.items[0]!.title).toBe('B');
  expect(pending.map((p) => p.req.sourceId)).toEqual(['a', 'b', 'c']);
});

it('marks a source that failed and carries on with the rest', async () => {
  startGlobalSearch('ferry', sources, 1, search);
  pending[0]!.reject(new Error('timeout'));
  await flush();
  expect(status()).toMatchObject({ a: 'error', b: 'searching' });
});

it('retries one source', async () => {
  startGlobalSearch('ferry', sources.slice(0, 1), 1, search);
  pending[0]!.reject(new Error('timeout'));
  await flush();
  retryGlobalSource('a', search);
  expect(status()).toEqual({ a: 'searching' });
  pending[1]!.resolve(page('A'));
  await flush();
  expect(status()).toEqual({ a: 'done' });
});

it('drops the old search when the query changes', async () => {
  startGlobalSearch('fer', sources, 2, search);
  const old = pending.slice();
  startGlobalSearch('ferry', sources, 2, search);
  expect(old.every((p) => p.signal?.aborted)).toBe(true);
  old[0]!.resolve(page('stale'));
  await flush();
  expect(useGlobalSearch.getState().query).toBe('ferry');
  expect(useGlobalSearch.getState().results.a!.items).toEqual([]);
});

it('keeps the results when the same query comes back', async () => {
  startGlobalSearch('ferry', sources.slice(0, 1), 1, search);
  pending[0]!.resolve(page('A'));
  await flush();
  startGlobalSearch('ferry', sources.slice(0, 1), 1, search);
  expect(search).toHaveBeenCalledTimes(1);
  expect(status()).toEqual({ a: 'done' });
});
