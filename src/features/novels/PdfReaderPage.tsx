import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../shared/settings/store';
import { IconSettings } from '../../shared/ui/icons';
import { Segmented } from '../../shared/ui/Segmented';
import { TickSlider } from '../../shared/ui/TickSlider';
import { startReadingClock } from '../insights/readingTime';
import styles from '../reader/ReaderPage.module.css';
import { ServerError } from '../server/client';
import novel from './Novel.module.css';
import { loadBook, overallProgress, useNovels } from './novelsStore';
import { fitSize, openPdf, pageSize, PdfError, renderPage, type PdfBook } from './pdf';
import type { NovelRow } from '../../shared/db/db';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; id: number; book: PdfBook; title: string; start: number };

const SAVE_DELAY_MS = 800;
const SWIPE_PX = 50;
const TAP_PX = 10;
const CACHE_PAGES = 5;

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** The PDF reader (`/novel/:id` for a row whose file is a PDF): one page at a time, drawn by pdf.js. */
export function PdfReaderPage({ row }: { row: NovelRow }) {
  const navigate = useNavigate();
  // The row changes as progress is saved; the book is opened once per row id.
  const file = useRef(row);
  useEffect(() => {
    file.current = row;
  });
  const rowId = row.id;
  const fit = useSettings((s) => s.settings.novel.pdfFit);
  const reader = useSettings((s) => s.settings.reader);
  const update = useSettings((s) => s.update);

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [index, setIndex] = useState(0);
  const [chrome, setChrome] = useState(false);
  const [optionsWanted, setOptions] = useState(false);
  const optionsOpen = optionsWanted && chrome;
  const optionsId = useId();

  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const loaded = load.state === 'ready' ? load : null;
  const count = loaded?.book.pages ?? 1;

  useEffect(() => startReadingClock(), []);

  // Open the book: from the kept copy, or from the share.
  useEffect(() => {
    const abort = new AbortController();
    let opened: PdfBook | null = null;
    (async () => {
      opened = await openPdf(await loadBook(file.current, abort.signal));
      if (abort.signal.aborted) return;
      const fresh = await useNovels.getState().describePdf(rowId, opened);
      // A finished book starts over; otherwise pick up where reading stopped.
      const start = fresh.finished ? 0 : Math.min(fresh.spine, opened.pages - 1);
      setIndex(start);
      setLoad({ state: 'ready', id: rowId, book: opened, title: fresh.title, start });
    })().catch((e) => {
      if (abort.signal.aborted) return;
      setLoad({ state: 'error', message: e instanceof ServerError || e instanceof PdfError ? e.message : "Couldn't open this PDF" });
    });
    return () => {
      abort.abort();
      void opened?.destroy();
    };
  }, [rowId]);

  // The room the page has.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded]);

  // Progress is saved shortly after the last move, and when the page is left.
  const pending = useRef<{ id: number; spine: number; finished: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const p = pending.current;
    pending.current = null;
    if (p) void useNovels.getState().saveProgress(p.id, { spine: p.spine, fraction: 0, finished: p.finished });
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
  const loadedId = loaded?.id;
  useEffect(() => {
    if (loadedId === undefined) return;
    pending.current = { id: loadedId, spine: index, finished: index === count - 1 };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [index, count, loadedId, flush]);

  // Pages drawn off screen, kept for a few turns so they appear at once.
  const cache = useRef(new Map<string, HTMLCanvasElement>());
  const book = loaded?.book ?? null;
  useEffect(() => {
    cache.current.clear();
  }, [book, box.width, box.height, fit]);

  const draw = useCallback(
    async (n: number, width: number): Promise<HTMLCanvasElement | null> => {
      if (!book) return null;
      const key = `${n}:${width}`;
      const hit = cache.current.get(key);
      if (hit) return hit;
      const off = document.createElement('canvas');
      if (!(await renderPage(book, n + 1, off, width).done)) return null;
      cache.current.set(key, off);
      while (cache.current.size > CACHE_PAGES) cache.current.delete(cache.current.keys().next().value!);
      return off;
    },
    [book],
  );

  // The page on screen: drawn off screen, then copied over, so a turn never flashes blank.
  useEffect(() => {
    if (!book || !box.width || !box.height) return;
    let stale = false;
    (async () => {
      const natural = await pageSize(book, index + 1);
      if (stale) return;
      const size = fitSize(natural, box, fit);
      const off = await draw(index, size.width);
      const target = canvas.current;
      if (stale || !off || !target) return;
      target.width = off.width;
      target.height = off.height;
      target.style.width = `${size.width}px`;
      target.style.height = `${size.height}px`;
      target.getContext('2d')?.drawImage(off, 0, 0);
      stage.current?.scrollTo({ top: 0 });
      // Then the neighbours, one after the other.
      for (const n of [index + 1, index - 1]) {
        if (stale || n < 0 || n >= book.pages) continue;
        const next = fitSize(await pageSize(book, n + 1), box, fit);
        await draw(n, next.width).catch(() => null);
      }
    })().catch(() => {});
    return () => {
      stale = true;
    };
  }, [book, index, box, fit, draw]);

  const go = useCallback((n: number) => setIndex((i) => Math.max(0, Math.min(count - 1, Number.isFinite(n) ? n : i))), [count]);

  const back = useCallback(() => {
    flush();
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }, [flush, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest('[role="slider"]'))) return;
      if (e.key === 'Escape') {
        if (optionsOpen) setOptions(false);
        else back();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        setIndex((i) => Math.min(count - 1, i + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(count - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back, count, go, optionsOpen]);

  // A tap in the outer thirds turns the page, in the middle shows the controls; a sideways swipe turns it.
  const down = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = down.current;
    down.current = null;
    if (!start || chrome) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(index + (dx < 0 ? 1 : -1));
    } else if (Math.abs(dx) < TAP_PX && Math.abs(dy) < TAP_PX) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      if (x < 0.3) go(index - 1);
      else if (x > 0.7) go(index + 1);
      else setChrome(true);
    }
  };

  const overall = loaded ? overallProgress({ spine: index + 1, fraction: 0, spineCount: count, finished: false }) : 0;

  return (
    <div className={`${styles.reader} ${reader.grayscale ? styles.grayscale : ''}`}>
      <div
        ref={stage}
        className={novel.pdfStage}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (down.current = null)}
        onClick={() => chrome && setChrome(false)}
      >
        {loaded && <canvas ref={canvas} className={novel.pdfPage} role="img" aria-label={`Page ${index + 1} of ${count}`} />}
      </div>

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
              <span>
                Page {index + 1} of {count}
              </span>
            </div>
            <div className={styles.topActions}>
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
              <span className={styles.optionLabel}>Fit</span>
              <Segmented
                label="Fit"
                value={fit}
                onChange={(pdfFit) => update({ novel: { pdfFit } })}
                options={[
                  { value: 'screen', label: 'Screen' },
                  { value: 'width', label: 'Width' },
                ]}
              />
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
              <button type="button" className={styles.round} aria-label="Previous page" disabled={index <= 0} onClick={() => go(index - 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 6-6 6 6 6" />
                </svg>
              </button>
              <TickSlider
                className={styles.scrubber}
                label="Page"
                min={1}
                max={Math.max(2, count)}
                value={index + 1}
                valueText={(v) => `Page ${v} of ${count}`}
                onChange={(v) => go(v - 1)}
              />
              <span className={styles.counter}>{percent(overall)}</span>
              <button type="button" className={styles.round} aria-label="Next page" disabled={index >= count - 1} onClick={() => go(index + 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
