import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { NovelSettings } from '../../shared/settings/schema';
import { useSettings } from '../../shared/settings/store';
import { IconList, IconSettings } from '../../shared/ui/icons';
import { Segmented } from '../../shared/ui/Segmented';
import { Sheet } from '../../shared/ui/Sheet';
import { Switch } from '../../shared/ui/Switch';
import { TickSlider } from '../../shared/ui/TickSlider';
import { startReadingClock } from '../insights/readingTime';
import drawer from '../reader/ChapterDrawer.module.css';
import styles from '../reader/ReaderPage.module.css';
import { ServerError } from '../server/client';
import { EpubError, openEpub, spineIndexOf, type EpubBook } from './epub';
import novel from './Novel.module.css';
import { loadBook, overallProgress, useNovels } from './novelsStore';
import { TextView, type Position, type Start } from './textView';
import { releaseSection, renderSection, sectionHeading } from './render';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; id: number; book: EpubBook; title: string };
type Nav = { spine: number; start: Start };

const SAVE_DELAY_MS = 800;

/** A chapter's name from the contents list, else its first heading. */
function chapterName(book: EpubBook, spine: number): string {
  const item = book.spine[spine];
  if (!item) return '';
  const entry = book.toc.find((t) => t.path === item.path && !t.fragment) ?? book.toc.find((t) => t.path === item.path);
  if (entry?.label) return entry.label;
  try {
    const section = renderSection(book, spine);
    const heading = sectionHeading(section);
    releaseSection(section);
    return heading || `Section ${spine + 1}`;
  } catch {
    return `Section ${spine + 1}`;
  }
}

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** The novel reader (`/novel/:id`, the row id of a book from the WebDAV share). */
export function NovelReaderPage() {
  const rowId = Number(useParams().id);
  const navigate = useNavigate();
  const settings = useSettings((s) => s.settings.novel);
  const reader = useSettings((s) => s.settings.reader);
  const theme = useSettings((s) => s.settings.theme);
  const update = useSettings((s) => s.update);

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [nav, setNav] = useState<Nav | null>(null);
  const [position, setPosition] = useState<Position>({ fraction: 0, page: 0, pages: 1, atEnd: false });
  const [chrome, setChrome] = useState(false);
  const [optionsWanted, setOptions] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [ended, setEnded] = useState(false);
  const optionsOpen = optionsWanted && chrome;
  const optionsId = useId();

  const host = useRef<HTMLDivElement>(null);
  const view = useRef<TextView | null>(null);
  const loaded = load.state === 'ready' ? load : null;
  const book = loaded?.book ?? null;
  const spine = nav?.spine ?? 0;
  const count = book?.spine.length ?? 1;

  useEffect(() => startReadingClock(), []);

  // Open the book: from the kept copy, or from the share.
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      await useNovels.getState().load();
      // Read the state after loading: a reload of this page starts with no rows.
      const store = useNovels.getState();
      const row = store.rows.find((r) => r.id === rowId);
      if (!row) throw new EpubError("This book isn't on this device");
      const opened = openEpub(await loadBook(row, abort.signal));
      if (abort.signal.aborted) return;
      const fresh = await store.describe(row.id, opened);
      // A finished book starts over; otherwise pick up where reading stopped.
      const again = fresh.finished;
      const at = again ? 0 : Math.min(fresh.spine, opened.spine.length - 1);
      setNav({ spine: at, start: { fraction: again ? 0 : fresh.fraction } });
      setLoad({ state: 'ready', id: row.id, book: opened, title: opened.title || fresh.title });
    })().catch((e) => {
      if (abort.signal.aborted) return;
      setLoad({ state: 'error', message: e instanceof ServerError || e instanceof EpubError ? e.message : "Couldn't open this book" });
    });
    return () => abort.abort();
  }, [rowId]);

  // Progress is saved shortly after the last move, and when the page is left.
  const pending = useRef<{ id: number; spine: number; fraction: number; finished: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const p = pending.current;
    pending.current = null;
    if (p) void useNovels.getState().saveProgress(p.id, { spine: p.spine, fraction: p.fraction, finished: p.finished });
  }, []);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const goSpine = useCallback((index: number, start: Start) => {
    setEnded(false);
    setNav({ spine: index, start });
  }, []);

  // The view reads the latest handlers through this, so it is built once per book.
  const latest = useRef({ spine, count, id: 0, book });
  const loadedId = loaded?.id ?? 0;
  useEffect(() => {
    latest.current = { spine, count, id: loadedId, book };
  });
  const handlers = useRef({
    onPosition: (p: Position) => {
      const l = latest.current;
      setPosition(p);
      pending.current = { id: l.id, spine: l.spine, fraction: p.fraction, finished: l.spine === l.count - 1 && p.atEnd };
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    onEdge: (direction: 'next' | 'prev') => {
      const l = latest.current;
      if (direction === 'next') {
        if (l.spine < l.count - 1) goSpine(l.spine + 1, { fraction: 0 });
        else {
          flush();
          setEnded(true);
        }
      } else if (l.spine > 0) goSpine(l.spine - 1, 'end');
    },
    onLink: (path: string, fragment: string) => {
      const l = latest.current;
      const index = l.book ? spineIndexOf(l.book, path) : -1;
      if (index < 0) return;
      if (index === l.spine) view.current?.goToFragment(fragment);
      else goSpine(index, { fragment });
    },
    onTap: () => setChrome((c) => !c),
  });

  const colors = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    return { ink: css.getPropertyValue('--ink').trim() || '#111', accent: css.getPropertyValue('--accent').trim() || '#55f' };
    // The theme setting is what changes the variables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // One text view per book.
  useEffect(() => {
    if (!book || !host.current) return;
    const v = new TextView(host.current, {
      onPosition: (p) => handlers.current.onPosition(p),
      onEdge: (d) => handlers.current.onEdge(d),
      onLink: (path, fragment) => handlers.current.onLink(path, fragment),
      onTap: () => handlers.current.onTap(),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
  }, [book]);

  useEffect(() => {
    view.current?.setOptions(settings, colors);
  }, [book, settings, colors]);

  // The chapter on screen.
  useEffect(() => {
    if (!book || !nav || !view.current) return;
    const section = renderSection(book, nav.spine);
    view.current.setSection(section, book.spine[nav.spine]!.path, nav.start);
    return () => releaseSection(section);
  }, [book, nav]);

  const nextLabel = book && spine < count - 1 ? `Next: ${chapterName(book, spine + 1)}` : book ? 'Finish' : null;
  useEffect(() => {
    view.current?.setNextLabel(nextLabel);
  }, [nextLabel, book, nav]);

  const back = useCallback(() => {
    flush();
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }, [flush, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (contentsOpen) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest('[role="slider"]'))) return;
      if (e.key === 'Escape') {
        if (optionsOpen) setOptions(false);
        else back();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        view.current?.next();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        view.current?.prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back, contentsOpen, optionsOpen]);

  const overall = overallProgress({ spine, fraction: position.fraction, spineCount: count, finished: false });
  const seek = (p: number) => {
    const at = p * count;
    const index = Math.min(count - 1, Math.floor(at));
    const fraction = at - index;
    if (index === spine) view.current?.goToFraction(fraction);
    else goSpine(index, { fraction });
  };

  const set = (patch: Partial<NovelSettings>) => update({ novel: patch });

  return (
    <div className={`${styles.reader} ${reader.grayscale ? styles.grayscale : ''}`}>
      <div ref={host} className={novel.host} lang={book?.language || undefined} />

      {load.state === 'loading' && (
        <div className={styles.message} role="status">
          <p>Opening…</p>
        </div>
      )}
      {load.state === 'error' && (
        <div className={styles.message}>
          <p>{load.message}</p>
          <button type="button" className={styles.endButton} onClick={back}>
            Back
          </button>
        </div>
      )}
      {ended && loaded && (
        <div className={styles.message} role="status">
          <p>The end of {loaded.title}</p>
          <button type="button" className={styles.endButton} onClick={back}>
            Back to library
          </button>
          <button type="button" className={styles.endButton} onClick={() => goSpine(0, { fraction: 0 })}>
            Read again
          </button>
        </div>
      )}

      <div className={styles.dim} style={{ opacity: 1 - reader.brightness }} aria-hidden="true" />
      <div className={styles.warm} style={{ opacity: 0.35 * reader.warm }} aria-hidden="true" />

      {loaded && (
        <div
          className={`${styles.chrome} ${chrome ? '' : styles.hidden}`}
          ref={(el) => {
            if (el) el.inert = !chrome;
          }}
        >
          <header className={styles.top}>
            <button type="button" className={styles.round} aria-label="Back" onClick={back}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <div className={styles.titles}>
              <b>{loaded.title}</b>
              <span>{chapterName(loaded.book, spine)}</span>
            </div>
            <div className={styles.topActions}>
              <button type="button" className={styles.round} aria-label="Contents" onClick={() => setContentsOpen(true)}>
                <IconList />
              </button>
              <button
                type="button"
                className={styles.round}
                aria-label="Reading options"
                aria-expanded={optionsOpen}
                aria-controls={optionsId}
                data-active={optionsOpen || undefined}
                onClick={() => setOptions((o) => !o)}
              >
                <IconSettings filled={optionsOpen} />
              </button>
            </div>
          </header>

          {optionsOpen && <div className={styles.optionsScrim} aria-hidden="true" onClick={() => setOptions(false)} />}
          <section
            id={optionsId}
            className={`${styles.options} ${novel.options} ${optionsOpen ? styles.optionsOpen : ''}`}
            aria-label="Reading options"
            aria-hidden={!optionsOpen}
            ref={(el) => {
              if (el) el.inert = !optionsOpen;
            }}
          >
            <div className={styles.optionRow}>
              <span className={styles.optionLabel}>Layout</span>
              <Segmented
                label="Layout"
                value={settings.flow}
                onChange={(flow) => set({ flow })}
                options={[
                  { value: 'paged', label: 'Pages' },
                  { value: 'scroll', label: 'Scroll' },
                ]}
              />
            </div>
            <div className={styles.optionRow}>
              <span className={styles.optionLabel}>Font</span>
              <Segmented
                label="Font"
                value={settings.font}
                onChange={(font) => set({ font })}
                options={[
                  { value: 'serif', label: 'Serif' },
                  { value: 'sans', label: 'Sans' },
                ]}
              />
            </div>
            <div className={styles.optionRow}>
              <span className={styles.optionLabel}>
                Text size <b>{settings.size}</b>
              </span>
              <TickSlider label="Text size" min={14} max={32} step={1} value={settings.size} onChange={(size) => set({ size })} />
            </div>
            <div className={styles.optionRow}>
              <span className={styles.optionLabel}>
                Line spacing <b>{settings.lineHeight.toFixed(2)}</b>
              </span>
              <TickSlider
                label="Line spacing"
                min={1.2}
                max={2.2}
                step={0.05}
                value={settings.lineHeight}
                valueText={(v) => v.toFixed(2)}
                onChange={(lineHeight) => set({ lineHeight: Math.round(lineHeight * 100) / 100 })}
              />
            </div>
            <div className={styles.optionRow}>
              <span className={styles.optionLabel}>
                Margins <b>{settings.margin}</b>
              </span>
              <TickSlider label="Margins" min={8} max={72} step={4} value={settings.margin} onChange={(margin) => set({ margin })} />
            </div>
            <div className={styles.optionRow}>
              <span className={styles.optionLabel}>Justify text</span>
              <Switch label="Justify text" checked={settings.justify} onChange={(justify) => set({ justify })} />
            </div>
            <div className={styles.optionRow}>
              <span className={styles.optionLabel}>
                Brightness <b>{percent(reader.brightness)}</b>
              </span>
              <TickSlider
                label="Brightness"
                min={0.2}
                max={1}
                step={0.05}
                value={reader.brightness}
                valueText={percent}
                onChange={(brightness) => update({ reader: { brightness } })}
              />
            </div>
            <div className={styles.optionRow}>
              <span className={styles.optionLabel}>
                Warmth <b>{percent(reader.warm)}</b>
              </span>
              <TickSlider label="Warmth" min={0} max={1} step={0.05} value={reader.warm} valueText={percent} onChange={(warm) => update({ reader: { warm } })} />
            </div>
          </section>

          <footer className={styles.bottom}>
            <div className={styles.scrubRow}>
              <button
                type="button"
                className={styles.round}
                aria-label="Previous chapter"
                disabled={spine <= 0}
                onClick={() => goSpine(spine - 1, { fraction: 0 })}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 11 12l7 6M7 6v12" />
                </svg>
              </button>
              <TickSlider
                className={styles.scrubber}
                label="Place in the book"
                min={0}
                max={100}
                value={Math.round(overall * 100)}
                valueText={(v) => `${v}% through the book`}
                onChange={(v) => seek(v / 100)}
              />
              <span className={styles.counter}>{percent(overall)}</span>
              <button
                type="button"
                className={styles.round}
                aria-label="Next chapter"
                disabled={spine >= count - 1}
                onClick={() => goSpine(spine + 1, { fraction: 0 })}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 6 7 6-7 6M17 6v12" />
                </svg>
              </button>
            </div>
          </footer>
        </div>
      )}

      {loaded && (
        <Sheet open={contentsOpen} label="Contents" title="Contents" closeLabel="Close contents" onClose={() => setContentsOpen(false)}>
          <Contents
            book={loaded.book}
            spine={spine}
            onPick={(index, fragment) => {
              setContentsOpen(false);
              if (index === spine) view.current?.goToFragment(fragment);
              else goSpine(index, fragment ? { fragment } : { fraction: 0 });
            }}
          />
        </Sheet>
      )}
    </div>
  );
}

function Contents({ book, spine, onPick }: { book: EpubBook; spine: number; onPick: (spine: number, fragment: string) => void }) {
  const listRef = useRef<HTMLUListElement>(null);
  const entries = useMemo(() => {
    const fromToc = book.toc.flatMap((t) => {
      const index = spineIndexOf(book, t.path);
      return index < 0 ? [] : [{ label: t.label || `Section ${index + 1}`, index, fragment: t.fragment, depth: t.depth }];
    });
    return fromToc.length ? fromToc : book.spine.map((_, index) => ({ label: `Section ${index + 1}`, index, fragment: '', depth: 0 }));
  }, [book]);
  // The entry for the chapter on screen: the last one at or before it.
  const current = entries.reduce((found, e, i) => (e.index <= spine ? i : found), -1);

  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <ul ref={listRef} className={drawer.list}>
      {entries.map((e, i) => (
        <li key={i}>
          <button
            type="button"
            className={drawer.row}
            style={{ paddingInlineStart: `${14 + e.depth * 16}px` }}
            aria-current={i === current ? 'true' : undefined}
            onClick={() => onPick(e.index, e.fragment)}
          >
            {e.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
