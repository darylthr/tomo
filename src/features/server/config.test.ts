import { useSettings } from '../../shared/settings/store';
import { loadServerConfig, normalizeServerUrl, resolveUrl } from './config';

const json = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

beforeEach(() => useSettings.getState().reset());

describe('resolveUrl', () => {
  it('joins a relative path to the server address', () => {
    expect(resolveUrl('/api/v1/manga/1/thumbnail', 'https://tomo.home')).toBe('https://tomo.home/api/v1/manga/1/thumbnail');
  });

  it('does not double the slash when the address ends with one', () => {
    expect(resolveUrl('/api/v1/manga/1/thumbnail', 'https://tomo.home/')).toBe('https://tomo.home/api/v1/manga/1/thumbnail');
  });

  it('keeps same-origin paths when no address is set', () => {
    expect(resolveUrl('/api/graphql', '')).toBe('/api/graphql');
  });

  it('passes absolute URLs through', () => {
    expect(resolveUrl('https://cdn.example/x.jpg', 'https://tomo.home')).toBe('https://cdn.example/x.jpg');
  });

  it('reads the saved address by default', () => {
    useSettings.getState().update({ server: { url: 'https://tomo.home' } });
    expect(resolveUrl('/api/graphql')).toBe('https://tomo.home/api/graphql');
  });
});

describe('loadServerConfig', () => {
  it('prefills the server settings from tomo.config.json on first launch', async () => {
    await loadServerConfig(json({ suwayomiUrl: 'https://tomo.home', suwayomiWebUiUrl: '/suwayomi/', authMode: 'basic_auth' }));
    expect(useSettings.getState().settings.server).toEqual({
      url: 'https://tomo.home',
      webUiUrl: '/suwayomi/',
      authMode: 'basic_auth',
      configured: true,
    });
  });

  it('leaves settings the owner already chose alone', async () => {
    useSettings.getState().update({ server: { url: 'https://mine.home', configured: true } });
    await loadServerConfig(json({ suwayomiUrl: 'https://tomo.home' }));
    expect(useSettings.getState().settings.server.url).toBe('https://mine.home');
  });

  it('ignores a missing or broken config file', async () => {
    await loadServerConfig(json('not found', 404));
    await loadServerConfig(json('{nope'));
    await loadServerConfig(vi.fn(async () => Promise.reject(new TypeError('offline'))));
    expect(useSettings.getState().settings.server.configured).toBe(false);
  });
});

describe('normalizeServerUrl', () => {
  it('adds http:// to a bare address and port', () => {
    expect(normalizeServerUrl('192.168.1.10:4567')).toBe('http://192.168.1.10:4567');
    expect(normalizeServerUrl(' nas.local:4567/ ')).toBe('http://nas.local:4567');
  });

  it('keeps a full address and its path', () => {
    expect(normalizeServerUrl('https://tomo.home/suwayomi/')).toBe('https://tomo.home/suwayomi');
  });

  it('leaves an empty address empty (same address as Tomo)', () => {
    expect(normalizeServerUrl('  ')).toBe('');
  });

  it('rejects what is not a web address', () => {
    expect(normalizeServerUrl('ftp://nas.local')).toBeNull();
    expect(normalizeServerUrl('http://')).toBeNull();
    expect(normalizeServerUrl('not an address')).toBeNull();
  });
});

it('resolves against an address saved without http://', () => {
  expect(resolveUrl('/api/graphql', 'nas.local:4567')).toBe('http://nas.local:4567/api/graphql');
});

it('normalizes the address from the config file', async () => {
  await loadServerConfig(json({ suwayomiUrl: '192.168.1.10:4567' }));
  expect(useSettings.getState().settings.server.url).toBe('http://192.168.1.10:4567');
});
