import { useSettings } from '../../shared/settings/store';
import { gql, ServerError } from './client';

const respond = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

beforeEach(() => useSettings.getState().update({ server: { url: 'https://tomo.home' } }));
afterEach(() => vi.unstubAllGlobals());

async function errorOf(p: Promise<unknown>): Promise<ServerError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ServerError) return e;
    throw e;
  }
  throw new Error('expected a ServerError');
}

it('posts the query to the server with credentials', async () => {
  const fetch = respond({ data: { ok: true } });
  vi.stubGlobal('fetch', fetch);
  await expect(gql('{ ok }', { a: 1 })).resolves.toEqual({ ok: true });
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://tomo.home/api/graphql');
  expect(init.method).toBe('POST');
  expect(init.credentials).toBe('include');
  expect(JSON.parse(init.body as string)).toEqual({ query: '{ ok }', variables: { a: 1 } });
});

it('reports an unreachable server', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
  const e = await errorOf(gql('{ ok }'));
  expect(e.kind).toBe('unreachable');
  expect(e.message).toBe("Can't reach your server");
});

it('treats a proxy error page as unreachable', async () => {
  vi.stubGlobal('fetch', respond('<html>502 Bad Gateway</html>', 502));
  expect((await errorOf(gql('{ ok }'))).kind).toBe('unreachable');
});

it('reports a server that needs a login', async () => {
  vi.stubGlobal('fetch', respond('Unauthorized', 401));
  const e = await errorOf(gql('{ ok }'));
  expect(e.kind).toBe('auth');
  expect(e.message).toBe('Your server needs a login');
});

it('recognises a schema the app does not match', async () => {
  vi.stubGlobal(
    'fetch',
    respond({ errors: [{ message: "Validation error (FieldUndefined@[mangas/nodes/unreadCount]) : Field 'unreadCount' in type 'MangaType' is undefined" }] }),
  );
  const e = await errorOf(gql('{ ok }'));
  expect(e.kind).toBe('version');
  expect(e.message).toBe("This Suwayomi version isn't supported");
  expect(e.details).toContain('unreadCount');
});

it('passes other GraphQL errors through as details', async () => {
  vi.stubGlobal('fetch', respond({ errors: [{ message: 'boom' }] }));
  const e = await errorOf(gql('{ ok }'));
  expect(e.kind).toBe('server');
  expect(e.message).toBe('The server returned an error');
  expect(e.details).toBe('boom');
});

it('keeps partial data when only some fields failed', async () => {
  vi.stubGlobal('fetch', respond({ data: { mangas: { nodes: [] } }, errors: [{ message: 'Source not found' }] }));
  await expect(gql('{ mangas { nodes { id } } }')).resolves.toEqual({ mangas: { nodes: [] } });
});

it('still fails when a top-level field came back empty', async () => {
  vi.stubGlobal('fetch', respond({ data: { updateChapter: null }, errors: [{ message: 'Chapter not found' }] }));
  expect((await errorOf(gql('mutation { updateChapter }'))).kind).toBe('server');
});

it('can keep a request alive while the page unloads', async () => {
  const fetch = respond({ data: { ok: true } });
  vi.stubGlobal('fetch', fetch);
  await gql('{ ok }', undefined, { keepalive: true });
  expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].keepalive).toBe(true);
});
