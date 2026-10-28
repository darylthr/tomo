import { useSettings } from '../../shared/settings/store';
import { davUrl, fetchFile, isBook, isEpub, isPdf, listFolder, parseListing, sortEntries, uniqueName, uploadFile } from './webdav';

const multistatus = (rows: string) => `<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:">${rows}</D:multistatus>`;
const dir = (href: string) =>
  `<D:response><D:href>${href}</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat></D:response>`;
const file = (href: string, size = 10) =>
  `<D:response><D:href>${href}</D:href><D:propstat><D:prop><D:resourcetype/><D:getcontentlength>${size}</D:getcontentlength><D:getlastmodified>Tue, 20 Oct 2026 10:00:00 GMT</D:getlastmodified></D:prop></D:propstat></D:response>`;

beforeEach(() => {
  useSettings.getState().reset();
  useSettings.getState().update({ server: { webdavUrl: '/dav/' } });
});

describe('parseListing', () => {
  it('lists the children of the root, whatever the hrefs are prefixed with', () => {
    const xml = multistatus(dir('/') + dir('/Light%20Novels/') + file('/Dune.epub', 1234));
    expect(parseListing(xml, '')).toEqual([
      { name: 'Light Novels', path: 'Light Novels/', isDir: true, size: 0, modified: 0 },
      { name: 'Dune.epub', path: 'Dune.epub', isDir: false, size: 1234, modified: Date.parse('Tue, 20 Oct 2026 10:00:00 GMT') },
    ]);
  });

  it('works when the server keeps the /dav prefix in its hrefs', () => {
    const xml = multistatus(dir('/dav/Light%20Novels/') + file('/dav/Light%20Novels/Vol%201.epub') + dir('/dav/Light%20Novels/Extras/'));
    expect(parseListing(xml, 'Light Novels/').map((e) => e.path)).toEqual(['Light Novels/Vol 1.epub', 'Light Novels/Extras/']);
  });

  it('accepts full URLs and other namespace prefixes', () => {
    const xml = `<multistatus xmlns="DAV:"><response><href>https://nas/dav/</href></response><response><href>https://nas/dav/a.epub</href><propstat><prop><getcontentlength>5</getcontentlength></prop></propstat></response></multistatus>`;
    expect(parseListing(xml, '').map((e) => e.name)).toEqual(['a.epub']);
  });

  it('returns nothing for an empty folder and rejects a page that is not a listing', () => {
    expect(parseListing(multistatus(dir('/dav/Empty/')), 'Empty/')).toEqual([]);
    expect(() => parseListing('<html><body>nope', '')).toThrow();
  });
});

describe('sortEntries', () => {
  it('puts folders first and sorts names naturally', () => {
    const e = (name: string, isDir = false) => ({ name, path: name, isDir, size: 0, modified: 0 });
    expect(sortEntries([e('Vol 10.epub'), e('Vol 2.epub'), e('Zed', true), e('Alpha', true)]).map((x) => x.name)).toEqual([
      'Alpha',
      'Zed',
      'Vol 2.epub',
      'Vol 10.epub',
    ]);
  });
});

describe('davUrl', () => {
  it('encodes each segment and keeps the slashes', () => {
    expect(davUrl('Light Novels/Vol #1.epub')).toBe('/dav/Light%20Novels/Vol%20%231.epub');
    expect(davUrl('')).toBe('/dav/');
  });

  it('joins a full address', () => {
    expect(davUrl('a.epub', 'https://nas/dav')).toBe('https://nas/dav/a.epub');
  });
});

describe('isEpub', () => {
  it('matches the extension in any case', () => {
    expect(isEpub('Dune.EPUB')).toBe(true);
    expect(isEpub('Dune.pdf')).toBe(false);
  });
});

describe('requests', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists a folder with PROPFIND at depth 1', async () => {
    const fetchMock = vi.fn(async () => new Response(multistatus(dir('/dav/') + file('/dav/a.epub')), { status: 207 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await listFolder('')).map((e) => e.name)).toEqual(['a.epub']);
    expect(fetchMock).toHaveBeenCalledWith('/dav/', expect.objectContaining({ method: 'PROPFIND', headers: { Depth: '1' }, credentials: 'include' }));
  });

  it('maps a login wall and an unreachable share to server errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    await expect(listFolder('')).rejects.toMatchObject({ kind: 'auth' });
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fail'))));
    await expect(fetchFile('a.epub')).rejects.toMatchObject({ kind: 'unreachable' });
  });

  it('downloads a file', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));
    expect(new Uint8Array(await fetchFile('a.epub'))).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe('book names', () => {
  it('knows EPUBs and PDFs by extension, in any case', () => {
    expect(isPdf('Paper.PDF')).toBe(true);
    expect(isBook('a.epub')).toBe(true);
    expect(isBook('a.txt')).toBe(false);
  });

  it('keeps a free name and numbers a taken one', () => {
    expect(uniqueName('Dune.epub', ['Other.epub'])).toBe('Dune.epub');
    expect(uniqueName('Dune.epub', ['dune.epub'])).toBe('Dune (2).epub');
    expect(uniqueName('Dune.epub', ['Dune.epub', 'Dune (2).epub'])).toBe('Dune (3).epub');
  });
});

describe('uploadFile', () => {
  class FakeXhr {
    static last: FakeXhr;
    status = 201;
    method = '';
    url = '';
    withCredentials = false;
    body: unknown;
    upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
    onload?: () => void;
    onerror?: () => void;
    onabort?: () => void;
    constructor() {
      FakeXhr.last = this;
    }
    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }
    send(body: unknown) {
      this.body = body;
    }
    abort() {
      this.onabort?.();
    }
  }
  beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeXhr));
  afterEach(() => vi.unstubAllGlobals());

  it('PUTs the file to its path on the share and reports progress', async () => {
    const file = new Blob(['x']);
    const progress: number[] = [];
    const done = uploadFile('Light Novels/Dune.epub', file, (f) => progress.push(f));
    const xhr = FakeXhr.last;
    expect(xhr.method).toBe('PUT');
    expect(xhr.url).toBe('/dav/Light%20Novels/Dune.epub');
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.body).toBe(file);
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
    xhr.onload?.();
    await done;
    expect(progress).toEqual([0.25]);
  });

  it('says so when the share is read-only, or the file is too large', async () => {
    const run = async (status: number) => {
      const p = uploadFile('a.epub', new Blob(['x']));
      FakeXhr.last.status = status;
      FakeXhr.last.onload?.();
      return p.catch((e) => e);
    };
    expect((await run(405)).details).toMatch(/does not accept uploads/);
    expect((await run(413)).details).toMatch(/too large|that large/);
    expect((await run(500)).details).toBe('HTTP 500');
    expect((await run(401)).kind).toBe('auth');
  });

  it('rejects with an abort error when cancelled', async () => {
    const abort = new AbortController();
    const p = uploadFile('a.epub', new Blob(['x']), undefined, abort.signal);
    abort.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});
