import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Chapter, ReaderMode, Title } from '../../shared/model/types';
import { useSettings } from '../../shared/settings/store';
import { useUi, type OpeningFrom } from '../../shared/ui/uiStore';
import { loadChapters } from '../library/continueReading';
import { getChapter, getPages, getTitle } from '../server/api';
import { ServerError } from '../server/client';
import { playOpening } from './opening';
import { PagedView } from './PagedView';
import { ReaderChrome } from './ReaderChrome';
import styles from './ReaderPage.module.css';
import { useReader } from './readerStore';
import { WebtoonView } from './WebtoonView';

type Loaded = { title: Title; chapter: Chapter; chapters: Chapter[] };
type Load = { state: 'loading' } | { state: 'error'; message: string } | ({ state: 'ready' } & Loaded);

/** Where to start: the saved page for an unfinished chapter, otherwise the first page. */
export function startPage(chapter: Chapter, pageCount: number): number {
  return !chapter.read && chapter.lastPage > 0 && chapter.lastPage < pageCount ? chapter.lastPage : 0;
}

function neighbours(chapters: Chapter[], current: Chapter) {
  const byOrder = [...chapters].sort((a, b) => a.order - b.order);
  return {
    prev: [...byOrder].reverse().find((c) => c.order < current.order) ?? null,
    next: byOrder.find((c) => c.order > current.order) ?? null,
  };
}

export function ReaderPage() {
  const chapterId = Number(useParams().chapterId);
  const navigate = useNavigate();
  const reader = useSettings((s) => s.settings.reader);
  const update = useSettings((s) => s.update);
  const mode = useReader((s) => s.mode);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [caughtUp, setCaughtUp] = useState(false);
  const [opening, setOpening] = useState<OpeningFrom | null>(() => useUi.getState().openingFrom);
  const firstPage = useReader((s) => s.pages[0]);

  useEffect(() => {
    useUi.setState({ openingFrom: null });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const chapter = await getChapter(chapterId);
      const [title, chapters, pages] = await Promise.all([getTitle(chapter.titleId), loadChapters(chapter.titleId), getPages(chapterId)]);
      if (cancelled) return;
      const settings = useSettings.getState().settings.reader;
      const chosen = settings.modes[String(title.id)] ?? settings.defaultMode;
      useReader.getState().open(chapter, pages, startPage(chapter, pages.length), chosen);
      setCaughtUp(false);
      setLoad({ state: 'ready', title, chapter, chapters });
    })().catch((e) => {
      if (!cancelled) setLoad({ state: 'error', message: e instanceof ServerError ? e.message : "Couldn't open this chapter" });
    });
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  const back = useCallback(() => (window.history.length > 1 ? navigate(-1) : navigate('/')), [navigate]);
  const ready = load.state === 'ready' ? load : null;
  const near = ready ? neighbours(ready.chapters, ready.chapter) : { prev: null, next: null };
  const goChapter = useCallback((c: Chapter) => navigate(`/read/${c.id}`, { replace: true }), [navigate]);

  useEffect(() => {
    useReader.setState({
      onChapterEnd: () => (near.next ? goChapter(near.next) : setCaughtUp(true)),
      onChapterStart: near.prev ? () => goChapter(near.prev!) : null,
    });
  }, [near.next, near.prev, goChapter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back]);

  const changeMode = (m: ReaderMode) => {
    useReader.getState().setMode(m);
    if (ready) update({ reader: { modes: { ...reader.modes, [String(ready.title.id)]: m } } });
  };

  return (
    <div className={styles.reader}>
      {load.state === 'error' && (
        <div className={styles.message}>
          <p>{load.message}</p>
          <button type="button" className={styles.endButton} onClick={back}>
            Back
          </button>
        </div>
      )}
      {ready && (mode === 'webtoon' ? <WebtoonView nextChapter={near.next ? () => goChapter(near.next!) : null} /> : <PagedView />)}

      <div className={styles.dim} style={{ opacity: 1 - reader.brightness }} aria-hidden="true" />
      <div className={styles.warm} style={{ opacity: 0.35 * reader.warm }} aria-hidden="true" />

      {ready && (
        <ReaderChrome
          titleName={ready.title.title}
          chapterName={ready.chapter.name || `Chapter ${ready.chapter.number}`}
          onBack={back}
          onPrevChapter={near.prev ? () => goChapter(near.prev!) : null}
          onNextChapter={near.next ? () => goChapter(near.next!) : null}
          onModeChange={changeMode}
        />
      )}

      {caughtUp && (
        <div className={styles.message} role="status">
          <p>You're all caught up.</p>
          <button type="button" className={styles.endButton} onClick={back}>
            Back to library
          </button>
        </div>
      )}

      {opening && <Opening from={opening} pageSrc={firstPage} onDone={() => setOpening(null)} />}
    </div>
  );
}

/** The book-opening overlay: the cover flies in and swings open onto the first page. */
function Opening({ from, pageSrc, onDone }: { from: OpeningFrom; pageSrc: string | undefined; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const book = useRef<HTMLDivElement>(null);
  const cover = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!root.current || !book.current || !cover.current || !backdrop.current) return;
    let alive = true;
    playOpening({ root: root.current, book: book.current, cover: cover.current, backdrop: backdrop.current }, from)
      .catch(() => {})
      .finally(() => alive && onDone());
    return () => {
      alive = false;
    };
    // play once per opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} className={styles.opening} aria-hidden="true">
      <div ref={backdrop} className={styles.openingBackdrop} />
      <div ref={book} className={styles.openingBook}>
        <div className={styles.openingPage} style={pageSrc ? { backgroundImage: `url("${pageSrc}")` } : undefined} />
        <div ref={cover} className={styles.openingCover}>
          <div className={styles.coverOut} style={{ backgroundImage: `url("${from.coverUrl}")` }} />
          <div className={styles.coverIn} />
        </div>
      </div>
    </div>
  );
}
