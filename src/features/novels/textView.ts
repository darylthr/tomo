import type { NovelSettings } from '../../shared/settings/schema';
import { ROOT_CLASS, type Section } from './render';

export type TextColors = { ink: string; accent: string };

export type Position = {
  /** How far into the chapter the top of the screen is, 0 to 1. */
  fraction: number;
  page: number;
  pages: number;
  /** The last page (or the bottom) of the chapter is on screen. */
  atEnd: boolean;
};

export type Start = { fraction: number } | { fragment: string } | 'end';

export type TextCallbacks = {
  onPosition: (p: Position) => void;
  /** Past the last page going forward, or before the first going back. */
  onEdge: (direction: 'next' | 'prev') => void;
  /** A link inside the book was followed. */
  onLink: (path: string, fragment: string) => void;
  /** A tap that is not a page turn: shows or hides the controls. */
  onTap: () => void;
};

const FONTS: Record<NovelSettings['font'], string> = {
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Charter, 'Bitstream Charter', Georgia, 'Noto Serif', serif",
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
};

/** In paged flow a page is at most this wide; wider screens keep a readable line. */
const MAX_PAGE_WIDTH = 760;
const TAP_ZONE = 0.3;
const SWIPE = 50;

const BASE_CSS = `
:host { display: block; position: absolute; inset: 0; overflow: hidden; }
.viewport { position: absolute; top: 0; bottom: 0; overflow: hidden; -webkit-text-size-adjust: none; }
.${ROOT_CLASS} { margin: 0; box-sizing: border-box; }
.${ROOT_CLASS} *, .${ROOT_CLASS} *::before, .${ROOT_CLASS} *::after { box-sizing: border-box; }
.footer { display: flex; justify-content: center; padding: 8px 0 calc(72px + env(safe-area-inset-bottom)); }
.footer[hidden] { display: none; }
.footer button { font: inherit; font-size: 15px; padding: 12px 22px; border-radius: 999px; border: 0; cursor: pointer;
  color: var(--tomo-ink); background: color-mix(in oklch, var(--tomo-ink) 12%, transparent); transition: scale 150ms ease-out; }
.footer button:active { scale: 0.96; }
`;

/** The reader's own typography; it wins over the book's with !important, because the reader's settings are the point. */
function userCss(o: NovelSettings, c: TextColors): string {
  const text = ':where(p, div, span, section, article, aside, blockquote, li, ul, ol, dl, dt, dd, td, th, h1, h2, h3, h4, h5, h6, em, strong, i, b, small, sup, sub, a, figure, figcaption)';
  return `
.viewport { --tomo-ink: ${c.ink}; color: ${c.ink}; }
.${ROOT_CLASS} { font-family: ${FONTS[o.font]}; font-size: ${o.size}px; line-height: ${o.lineHeight}; color: ${c.ink};
  overflow-wrap: break-word; hyphens: auto; -webkit-hyphens: auto; }
.${ROOT_CLASS} ${text} { font-family: inherit !important; color: inherit !important; background-color: transparent !important;
  line-height: ${o.lineHeight} !important; }
.${ROOT_CLASS} :where(p, li, dd, blockquote) { text-align: ${o.justify ? 'justify' : 'start'} !important; }
.${ROOT_CLASS} :where(h1, h2, h3, h4, h5, h6) { line-height: 1.25 !important; text-align: start; break-after: avoid; }
.${ROOT_CLASS} a[data-path], .${ROOT_CLASS} a[href] { color: ${c.accent} !important; text-decoration: underline; cursor: pointer; }
.${ROOT_CLASS} img, .${ROOT_CLASS} svg { max-width: 100% !important; height: auto; object-fit: contain; break-inside: avoid; }
.${ROOT_CLASS} img { display: block; margin: 1em auto; }
.${ROOT_CLASS} pre { white-space: pre-wrap; }
.${ROOT_CLASS} table { max-width: 100%; }
::selection { background: color-mix(in oklch, ${c.accent} 45%, transparent); }
${
  o.flow === 'paged'
    ? `
.viewport { left: 50%; width: min(100%, ${MAX_PAGE_WIDTH}px); transform: translateX(-50%); touch-action: pan-y; }
.${ROOT_CLASS} { height: var(--h); padding: calc(var(--m) + 14px) var(--m); column-width: calc(var(--w) - 2 * var(--m));
  column-gap: calc(2 * var(--m)); column-fill: auto; }
.${ROOT_CLASS} img, .${ROOT_CLASS} svg { max-height: calc(var(--h) - 2 * var(--m) - 28px); }
`
    : `
.viewport { left: 0; right: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; }
.${ROOT_CLASS} { max-width: ${Math.round(o.size * 36)}px; margin: 0 auto; padding: calc(var(--m) + 56px) var(--m) var(--m); }
`
}`;
}

/**
 * One chapter on screen, either in pages (CSS columns scrolled sideways) or as a scrolling column.
 * It lives in a shadow root, so the book's styles can't touch the app and the app's can't touch the book.
 */
export class TextView {
  private shadow: ShadowRoot;
  private viewport = document.createElement('div');
  private root = document.createElement('div');
  private bookStyle = document.createElement('style');
  private userStyle = document.createElement('style');
  private footer = document.createElement('div');
  private footerButton = document.createElement('button');
  private observer: ResizeObserver;
  private options: NovelSettings | null = null;
  private path = '';
  private page = 0;
  private pages = 1;
  private frame = 0;
  private pointer: { x: number; y: number } | null = null;
  private swiped = false;
  private quiet = false;

  constructor(
    host: HTMLElement,
    private cb: TextCallbacks,
  ) {
    this.shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    this.shadow.replaceChildren();
    const base = document.createElement('style');
    base.textContent = BASE_CSS;
    this.viewport.className = 'viewport';
    this.root.className = ROOT_CLASS;
    this.footer.className = 'footer';
    this.footer.hidden = true;
    this.footer.append(this.footerButton);
    this.footerButton.type = 'button';
    this.footerButton.addEventListener('click', () => this.cb.onEdge('next'));
    this.viewport.append(this.root, this.footer);
    this.shadow.append(base, this.bookStyle, this.userStyle, this.viewport);

    this.viewport.addEventListener('click', this.onClick);
    this.viewport.addEventListener('keydown', this.onLinkKey);
    this.viewport.addEventListener('pointerdown', this.onPointerDown);
    this.viewport.addEventListener('pointerup', this.onPointerUp);
    this.viewport.addEventListener('scroll', this.onScroll, { passive: true });
    this.root.addEventListener('load', this.onImage, true);
    this.observer = new ResizeObserver(() => this.relayout());
    this.observer.observe(host);
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.shadow.replaceChildren();
  }

  /** Shows a chapter, then moves to `start`. */
  setSection(section: Section, path: string, start: Start) {
    this.path = path;
    this.root.replaceChildren();
    this.root.className = `${ROOT_CLASS} ${section.body.getAttribute('class') ?? ''}`.trim();
    for (const child of [...section.body.childNodes]) this.root.append(document.importNode(child, true));
    this.bookStyle.textContent = section.css;
    this.page = 0;
    this.measure();
    this.quiet = true;
    if (start === 'end') this.scrollToEnd();
    else if ('fragment' in start) this.goToFragment(start.fragment);
    else this.goToFraction(start.fraction);
    this.quiet = false;
    this.report();
  }

  setOptions(options: NovelSettings, colors: TextColors) {
    const before = this.options ? this.fraction() : null;
    this.options = options;
    this.userStyle.textContent = userCss(options, colors);
    this.measure();
    this.updateFooter();
    if (before !== null) {
      this.quiet = true;
      this.goToFraction(before);
      this.quiet = false;
    }
    this.report();
  }

  /** Text under the footer button for the following chapter; null hides it. Only used in scrolling flow. */
  setNextLabel(label: string | null) {
    this.nextLabel = label;
    this.footerButton.textContent = label ?? '';
    this.updateFooter();
  }
  private nextLabel: string | null = null;

  private updateFooter() {
    this.footer.hidden = this.nextLabel === null || this.options?.flow !== 'scroll';
  }

  next() {
    if (!this.options) return;
    if (this.options.flow === 'paged') {
      if (this.page < this.pages - 1) this.goToPage(this.page + 1, true);
      else this.cb.onEdge('next');
    } else {
      const max = this.viewport.scrollHeight - this.viewport.clientHeight;
      if (this.viewport.scrollTop >= max - 4) this.cb.onEdge('next');
      else this.viewport.scrollBy({ top: this.viewport.clientHeight * 0.88, behavior: this.behavior() });
    }
  }

  prev() {
    if (!this.options) return;
    if (this.options.flow === 'paged') {
      if (this.page > 0) this.goToPage(this.page - 1, true);
      else this.cb.onEdge('prev');
    } else if (this.viewport.scrollTop <= 4) {
      this.cb.onEdge('prev');
    } else {
      this.viewport.scrollBy({ top: -this.viewport.clientHeight * 0.88, behavior: this.behavior() });
    }
  }

  /** Moves to a place in the chapter (0 to 1). */
  goToFraction(f: number) {
    const fraction = Math.min(1, Math.max(0, f));
    if (this.options?.flow === 'paged') this.goToPage(Math.min(this.pages - 1, Math.floor(fraction * this.pages + 1e-6)), false);
    else {
      const max = this.viewport.scrollHeight - this.viewport.clientHeight;
      this.viewport.scrollTo({ top: max * fraction, behavior: 'instant' });
    }
  }

  goToFragment(id: string) {
    const el = id ? this.root.querySelector<HTMLElement>(`[id="${id.replace(/["\\]/g, '\\$&')}"]`) : null;
    if (!el) return this.goToFraction(0);
    const rect = el.getBoundingClientRect();
    const view = this.viewport.getBoundingClientRect();
    if (this.options?.flow === 'paged') {
      this.goToPage(Math.min(this.pages - 1, Math.max(0, Math.floor((rect.left - view.left + this.viewport.scrollLeft) / this.width()))), false);
    } else {
      this.viewport.scrollTo({ top: this.viewport.scrollTop + rect.top - view.top - 56, behavior: 'instant' });
    }
  }

  // --- internals ---

  private width() {
    return this.viewport.clientWidth || 1;
  }

  private behavior(): ScrollBehavior {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  }

  private fraction(): number {
    if (this.options?.flow === 'paged') return this.page / this.pages;
    const max = this.viewport.scrollHeight - this.viewport.clientHeight;
    return max > 0 ? this.viewport.scrollTop / max : 0;
  }

  /** Reads the screen size into the stylesheet, and counts the pages. */
  private measure() {
    if (!this.options) return;
    const { clientWidth: w, clientHeight: h } = this.viewport;
    this.viewport.style.setProperty('--w', `${w}px`);
    this.viewport.style.setProperty('--h', `${h}px`);
    this.viewport.style.setProperty('--m', `${this.options.margin}px`);
    if (this.options.flow === 'paged') {
      this.pages = Math.max(1, Math.round(this.viewport.scrollWidth / this.width()));
      this.page = Math.min(this.page, this.pages - 1);
    } else {
      this.pages = 1;
      this.page = 0;
    }
  }

  private relayout() {
    if (!this.options) return;
    const before = this.fraction();
    this.measure();
    this.quiet = true;
    this.goToFraction(before);
    this.quiet = false;
    this.report();
  }

  private goToPage(page: number, animate: boolean) {
    this.page = Math.min(this.pages - 1, Math.max(0, page));
    this.viewport.scrollTo({ left: this.page * this.width(), behavior: animate ? this.behavior() : 'instant' });
    this.report();
  }

  private scrollToEnd() {
    if (this.options?.flow === 'paged') this.goToPage(this.pages - 1, false);
    else this.viewport.scrollTo({ top: this.viewport.scrollHeight, behavior: 'instant' });
  }

  private report() {
    if (this.quiet || !this.options) return;
    const paged = this.options.flow === 'paged';
    const max = this.viewport.scrollHeight - this.viewport.clientHeight;
    this.cb.onPosition({
      fraction: this.fraction(),
      page: this.page,
      pages: this.pages,
      atEnd: paged ? this.page >= this.pages - 1 : max <= 4 || this.viewport.scrollTop >= max - 4,
    });
  }

  private onScroll = () => {
    if (this.options?.flow !== 'scroll') return;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.report());
  };

  /** A late image changes how many pages there are; keep the reader where they were. */
  private onImage = () => {
    if (this.options?.flow === 'paged') this.relayout();
  };

  private onPointerDown = (e: PointerEvent) => {
    this.pointer = { x: e.clientX, y: e.clientY };
    this.swiped = false;
  };

  private onPointerUp = (e: PointerEvent) => {
    const start = this.pointer;
    this.pointer = null;
    if (!start || this.options?.flow !== 'paged') return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      this.swiped = true;
      if (dx < 0) this.next();
      else this.prev();
    }
  };

  private linkAt(e: Event): HTMLElement | null {
    const target = e.composedPath()[0];
    return target instanceof Element ? target.closest<HTMLElement>('a[data-path]') : null;
  }

  private onLinkKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const link = this.linkAt(e);
    if (link) this.cb.onLink(link.dataset.path ?? this.path, link.dataset.fragment ?? '');
  };

  private onClick = (e: MouseEvent) => {
    if (this.swiped) {
      this.swiped = false;
      return;
    }
    const link = this.linkAt(e);
    if (link) {
      this.cb.onLink(link.dataset.path ?? this.path, link.dataset.fragment ?? '');
      return;
    }
    const target = e.composedPath()[0];
    if (target instanceof Element && target.closest('a[href], button')) return;
    // Finishing a text selection is not a tap.
    const shadow = this.shadow as ShadowRoot & { getSelection?: () => Selection | null };
    if (shadow.getSelection?.()?.toString() || window.getSelection()?.toString()) return;
    if (this.options?.flow === 'paged') {
      const rect = this.viewport.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      if (x < TAP_ZONE) return this.prev();
      if (x > 1 - TAP_ZONE) return this.next();
    }
    this.cb.onTap();
  };
}
