import { unzipSync, strFromU8 } from 'fflate';

export type SpineItem = { id: string; path: string; mediaType: string; linear: boolean };

export type TocEntry = { label: string; /** Path inside the book. */ path: string; fragment: string; depth: number };

export type EpubBook = {
  title: string;
  author: string;
  language: string;
  spine: SpineItem[];
  toc: TocEntry[];
  /** Path of the cover image inside the book. */
  coverPath: string | null;
  has: (path: string) => boolean;
  bytes: (path: string) => Uint8Array | undefined;
  text: (path: string) => string | undefined;
};

export class EpubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EpubError';
  }
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Resolves a reference from a file in the book to a path in the zip: "../img/a.png" from "OEBPS/text/c1.xhtml". */
export function resolvePath(from: string, ref: string): string {
  const clean = decode(ref.split('#')[0]!.split('?')[0]!);
  const parts = clean.startsWith('/') ? [] : from.split('/').slice(0, -1);
  for (const seg of clean.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

export const fragmentOf = (ref: string) => {
  const i = ref.indexOf('#');
  return i < 0 ? '' : decode(ref.slice(i + 1));
};

const xml = (source: string) => {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new EpubError('This book has a damaged package file');
  return doc;
};

/** Elements by local name, whatever the namespace prefix. */
const all = (root: Document | Element, name: string) => [...root.getElementsByTagNameNS('*', name)];
const first = (root: Document | Element, name: string) => all(root, name)[0];

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Opens an EPUB: reads the zip, the package file (metadata, manifest, spine) and the table of contents. */
export function openEpub(data: ArrayBuffer | Uint8Array): EpubBook {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data instanceof Uint8Array ? data : new Uint8Array(data));
  } catch {
    throw new EpubError('This file is not a valid EPUB');
  }
  // Some archives name entries with a different case than the package refers to.
  const lower = new Map(Object.keys(files).map((k) => [k.toLowerCase(), k]));
  const find = (path: string) => (path in files ? path : lower.get(path.toLowerCase()));
  const bytes = (path: string) => {
    const key = find(path);
    return key === undefined ? undefined : files[key];
  };
  const text = (path: string) => {
    const b = bytes(path);
    return b && strFromU8(b);
  };

  const container = text('META-INF/container.xml');
  if (!container) throw new EpubError('This file is not an EPUB (no container)');
  const rootPath = first(xml(container), 'rootfile')?.getAttribute('full-path');
  const opfSource = rootPath ? text(rootPath) : undefined;
  if (!rootPath || !opfSource) throw new EpubError('This book has no package file');
  const opf = xml(opfSource);

  const meta = (name: string) => clean(first(opf, name)?.textContent);
  const manifest = new Map(
    all(opf, 'item').map((el) => [
      el.getAttribute('id') ?? '',
      {
        path: resolvePath(rootPath, el.getAttribute('href') ?? ''),
        mediaType: el.getAttribute('media-type') ?? '',
        properties: (el.getAttribute('properties') ?? '').split(/\s+/),
      },
    ]),
  );

  const spine: SpineItem[] = all(opf, 'itemref').flatMap((el) => {
    const id = el.getAttribute('idref') ?? '';
    const item = manifest.get(id);
    return item && /x?html|xml/i.test(item.mediaType) ? [{ id, path: item.path, mediaType: item.mediaType, linear: el.getAttribute('linear') !== 'no' }] : [];
  });
  if (!spine.length) throw new EpubError('This book has no readable pages');

  const coverId = all(opf, 'meta').find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content');
  const cover = [...manifest.values()].find((i) => i.properties.includes('cover-image')) ?? (coverId ? manifest.get(coverId) : undefined);

  return {
    title: meta('title'),
    author: meta('creator'),
    language: meta('language'),
    spine,
    toc: readToc(opf, manifest, text),
    coverPath: cover && /^image\//.test(cover.mediaType) && find(cover.path) ? cover.path : null,
    has: (path) => find(path) !== undefined,
    bytes,
    text,
  };
}

type ManifestItem = { path: string; mediaType: string; properties: string[] };

function readToc(opf: Document, manifest: Map<string, ManifestItem>, text: (p: string) => string | undefined): TocEntry[] {
  const items = [...manifest.values()];
  const nav = items.find((i) => i.properties.includes('nav'));
  const navSource = nav && text(nav.path);
  if (nav && navSource) {
    const entries = readNav(navSource, nav.path);
    if (entries.length) return entries;
  }
  const ncxId = first(opf, 'spine')?.getAttribute('toc');
  const ncx = (ncxId ? manifest.get(ncxId) : undefined) ?? items.find((i) => i.mediaType === 'application/x-dtbncx+xml');
  const ncxSource = ncx && text(ncx.path);
  return ncx && ncxSource ? readNcx(ncxSource, ncx.path) : [];
}

function readNav(source: string, navPath: string): TocEntry[] {
  // The nav document is XHTML; the HTML parser is forgiving about its namespaces.
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const navs = [...doc.querySelectorAll('nav')];
  const toc = navs.find((n) => (n.getAttribute('epub:type') ?? n.getAttribute('type') ?? '').split(/\s+/).includes('toc')) ?? navs[0];
  const out: TocEntry[] = [];
  const walk = (list: Element, depth: number) => {
    for (const li of list.children) {
      if (li.tagName.toLowerCase() !== 'li') continue;
      const link = [...li.children].find((c) => /^(a|span)$/i.test(c.tagName));
      const href = link?.getAttribute('href');
      if (link && href) out.push({ label: clean(link.textContent), path: resolvePath(navPath, href), fragment: fragmentOf(href), depth });
      const sub = [...li.children].find((c) => /^(ol|ul)$/i.test(c.tagName));
      if (sub) walk(sub, depth + 1);
    }
  };
  const root = toc?.querySelector('ol, ul');
  if (root) walk(root, 0);
  return out;
}

function readNcx(source: string, ncxPath: string): TocEntry[] {
  const out: TocEntry[] = [];
  const walk = (parent: Element, depth: number) => {
    for (const point of [...parent.children].filter((c) => c.localName === 'navPoint')) {
      const label = clean(first(point, 'text')?.textContent);
      const src = [...point.children].find((c) => c.localName === 'content')?.getAttribute('src');
      if (src) out.push({ label, path: resolvePath(ncxPath, src), fragment: fragmentOf(src), depth });
      walk(point, depth + 1);
    }
  };
  const map = first(xml(source), 'navMap');
  if (map) walk(map, 0);
  return out;
}

/** The spine index a table-of-contents path points at, or -1. */
export const spineIndexOf = (book: EpubBook, path: string) => book.spine.findIndex((s) => s.path === path);
