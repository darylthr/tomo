import { ServerError } from '../server/client';
import { useSettings } from '../../shared/settings/store';

export type DavEntry = {
  name: string;
  /** Path below the share's root, without a leading slash; folders end with a slash. */
  path: string;
  isDir: boolean;
  size: number;
  modified: number;
};

const DAV = 'DAV:';
const text = (parent: Element, tag: string) => parent.getElementsByTagNameNS(DAV, tag)[0]?.textContent ?? '';

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** The path part of an href, which a server may give as a full URL. */
function hrefPath(href: string): string {
  try {
    return new URL(href, 'http://x').pathname;
  } catch {
    return href;
  }
}

const segments = (path: string) => path.split('/').filter(Boolean);

/**
 * Reads a PROPFIND multistatus (Depth: 1) into the folder's children.
 * The proxy strips its `/dav` prefix, so hrefs may or may not carry it; the folder itself is the
 * response with the fewest segments, and a child is named by its last segment.
 */
export function parseListing(xml: string, dir: string): DavEntry[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new ServerError('server', 'The share did not answer with a listing');
  const rows = [...doc.getElementsByTagNameNS(DAV, 'response')].map((r) => {
    const path = decode(hrefPath(text(r, 'href')));
    const isDir = r.getElementsByTagNameNS(DAV, 'collection').length > 0 || path.endsWith('/');
    return {
      segs: segments(path),
      isDir,
      size: Number(text(r, 'getcontentlength')) || 0,
      modified: Date.parse(text(r, 'getlastmodified')) || 0,
    };
  });
  if (!rows.length) return [];
  const depth = Math.min(...rows.map((r) => r.segs.length));
  return rows
    .filter((r) => r.segs.length === depth + 1)
    .map((r) => {
      const name = r.segs[r.segs.length - 1]!;
      return { name, path: `${dir}${name}${r.isDir ? '/' : ''}`, isDir: r.isDir, size: r.size, modified: r.modified };
    });
}

/** Folders first, then names in natural order ("Vol 2" before "Vol 10"). */
export function sortEntries(entries: DavEntry[]): DavEntry[] {
  return [...entries].sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

export const isEpub = (name: string) => /\.epub$/i.test(name);

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** Where a file or folder of the share lives. Empty path is the share's root. */
export function davUrl(path: string, base: string = useSettings.getState().settings.server.webdavUrl): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}${encodePath(path.replace(/^\/+/, ''))}`;
}

async function request(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'include', ...init });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ServerError('unreachable', e instanceof Error ? e.message : undefined);
  }
  if (res.status === 401 || res.status === 403) throw new ServerError('auth');
  return res;
}

/** Lists a folder of the share (path "" is the root). */
export async function listFolder(path: string, signal?: AbortSignal): Promise<DavEntry[]> {
  const res = await request(davUrl(path), { method: 'PROPFIND', headers: { Depth: '1' }, signal });
  if (res.status === 404) throw new ServerError('server', 'That folder is not on the share');
  if (res.status !== 207 && !res.ok) throw new ServerError('server', `HTTP ${res.status}`);
  return sortEntries(parseListing(await res.text(), path));
}

/** Downloads a file of the share. */
export async function fetchFile(path: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await request(davUrl(path), { method: 'GET', signal });
  if (!res.ok) throw new ServerError('server', `HTTP ${res.status}`);
  return res.arrayBuffer();
}
