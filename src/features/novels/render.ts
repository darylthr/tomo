import { fragmentOf, resolvePath, type EpubBook } from './epub';

export type Section = {
  /** The chapter's content, cleaned: no scripts, no remote loads. Import it into the page. */
  body: Element;
  /** The chapter's stylesheets, with their images pointing into the book and `body` mapped to the reading root. */
  css: string;
  /** Object URLs made for this chapter; free them with `releaseSection`. */
  urls: string[];
};

const IMAGE_TYPES: [RegExp, string][] = [
  [/\.png$/i, 'image/png'],
  [/\.jpe?g$/i, 'image/jpeg'],
  [/\.gif$/i, 'image/gif'],
  [/\.webp$/i, 'image/webp'],
  [/\.avif$/i, 'image/avif'],
  [/\.svg$/i, 'image/svg+xml'],
];

/** The class the reading root carries; book CSS written for `html` and `body` lands on it. */
export const ROOT_CLASS = 'tomo-root';

const REMOVE = 'script, iframe, object, embed, audio, video, form, base, link, meta, noscript, template, frame, frameset';
const SCHEME = /^[a-z][a-z\d+.-]*:/i;

/**
 * Cleans a stylesheet: drops @import and @font-face (nothing is fetched), turns url() into a
 * book image or nothing, and moves `html`/`body` selectors onto the reading root.
 */
export function prepareCss(css: string, cssPath: string, imageUrl: (path: string) => string | null): string {
  return css
    .replace(/@import[^;]*;/gi, '')
    .replace(/@font-face\s*\{[^}]*\}/gi, '')
    .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_, _q: string, ref: string) => {
      if (ref.startsWith('#') || ref.startsWith('data:image/')) return `url(${ref})`;
      if (!ref || SCHEME.test(ref) || ref.startsWith('//')) return 'none';
      const url = imageUrl(resolvePath(cssPath, ref));
      return url ? `url("${url}")` : 'none';
    })
    .replace(/(^|[{}\s,>+~])(?:html|body)(?![\w-])/gi, `$1.${ROOT_CLASS}`);
}

/** Cleans a style attribute the same way (inline backgrounds can't reach outside the book either). */
function cleanInlineStyle(value: string): string {
  return value.replace(/url\([^)]*\)/gi, 'none');
}

const parse = (source: string): Document => {
  const xhtml = new DOMParser().parseFromString(source, 'application/xhtml+xml');
  return xhtml.getElementsByTagName('parsererror').length ? new DOMParser().parseFromString(source, 'text/html') : xhtml;
};

/** Prepares a chapter (a spine item) for display. */
export function renderSection(book: EpubBook, index: number): Section {
  const item = book.spine[index];
  if (!item) throw new Error('No such chapter');
  const source = book.text(item.path) ?? '';
  const doc = parse(source);
  const urls: string[] = [];
  const made = new Map<string, string | null>();

  /** An object URL for an image inside the book; null when the book doesn't have it. */
  const imageUrl = (path: string): string | null => {
    if (made.has(path)) return made.get(path)!;
    const bytes = book.bytes(path);
    const type = IMAGE_TYPES.find(([re]) => re.test(path))?.[1];
    let url: string | null = null;
    if (bytes && type) {
      url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type }));
      urls.push(url);
    }
    made.set(path, url);
    return url;
  };

  // Stylesheets first: linked ones sit in the book, inline ones travel with the chapter.
  const css: string[] = [];
  for (const el of doc.querySelectorAll('link[rel~="stylesheet" i], style')) {
    if (el.localName === 'style') css.push(prepareCss(el.textContent ?? '', item.path, imageUrl));
    else {
      const href = el.getAttribute('href');
      const path = href && !SCHEME.test(href) ? resolvePath(item.path, href) : null;
      const sheet = path ? book.text(path) : undefined;
      if (sheet && path) css.push(prepareCss(sheet, path, imageUrl));
    }
  }

  const body = (doc.body ?? doc.documentElement).cloneNode(true) as Element;
  for (const el of body.querySelectorAll(REMOVE)) el.remove();

  for (const el of [body, ...body.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    }
    const style = el.getAttribute('style');
    if (style) el.setAttribute('style', cleanInlineStyle(style));
  }

  // Images: only ones inside the book (these also cover SVG <image> and its xlink:href).
  for (const el of body.querySelectorAll('img, image')) {
    const attr = el.hasAttribute('src') ? 'src' : el.hasAttribute('href') ? 'href' : 'xlink:href';
    const ref = el.getAttribute(attr);
    const url = ref && !SCHEME.test(ref) ? imageUrl(resolvePath(item.path, ref)) : null;
    if (!url) {
      el.remove();
      continue;
    }
    el.setAttribute(attr, url);
    el.removeAttribute('srcset');
    if (el.localName === 'img') el.setAttribute('loading', 'eager');
  }

  // Links: web links open a new tab; links inside the book are followed by the reader.
  for (const el of body.querySelectorAll('a[href], area[href]')) {
    const href = el.getAttribute('href') ?? '';
    if (/^https?:|^mailto:/i.test(href)) {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    } else {
      el.removeAttribute('href');
      if (!SCHEME.test(href)) {
        el.setAttribute('data-path', href.startsWith('#') ? item.path : resolvePath(item.path, href));
        el.setAttribute('data-fragment', fragmentOf(href));
        el.setAttribute('role', 'link');
        el.setAttribute('tabindex', '0');
      }
    }
  }

  // The chapter's own <body> attributes (class, id) would mean nothing out of context.
  body.removeAttribute('id');
  body.removeAttribute('style');
  return { body, css: css.join('\n'), urls };
}

export function releaseSection(section: Section | null) {
  if (section) for (const url of section.urls) URL.revokeObjectURL(url);
}

/** The first heading or title text of a chapter, for the header when the contents list has no entry. */
export function sectionHeading(section: Section): string {
  return (section.body.querySelector('h1, h2, h3')?.textContent ?? '').replace(/\s+/g, ' ').trim();
}
