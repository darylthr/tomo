import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Chapter, ReaderMode, Title } from '../../shared/model/types';
import { useSettings } from '../../shared/settings/store';
import { useUi, type OpeningFrom } from '../../shared/ui/uiStore';
import { loadChapters } from '../library/continueReading';
import { useLibrary } from '../library/libraryStore';
import { getChapter, getPages, getTitle, setChapterBookmark, setProgress } from '../server/api';
import { ServerError } from '../server/client';
import { playOpening } from './opening';
import { preferredMode } from './mode';
import { PagedView } from './PagedView';
import { startReadingClock } from '../insights/readingTime';
import { useUpdates } from '../updates/updatesStore';
import { createProgressSync, savesSettled, startPage } from './progress';
import { ChapterDrawer } from './ChapterDrawer';
import { DirectionHint } from './DirectionHint';
import { EndCard } from './EndCard';
import { prefetchChapter, takePrefetched } from './nextChapterCache';
import { PageActions } from './PageActions';
import { PageBookmark } from './PageBookmark';
import { usePageBookmarks } from './usePageBookmarks';
import { ReaderChrome } from './ReaderChrome';
import styles from './ReaderPage.module.css';
import { useReader } from './readerStore';
import { WebtoonView } from './WebtoonView';
import { layoutFor, wantsSpreads } from './spreads';
import { usePageSizes } from './usePageSizes';
import { useViewport } from './useViewport';

type Loaded = { title: Title; chapter: Chapter; chapters: Chapter[] };
type Load = { state: 'loading' } | { state: 'error'; message: string } | ({ state: 'ready' } & Loaded);

function neighbours(chapters: Chapter[], current: Chapter) {
  const byOrder = [...chapters].sort((a, b) => a.order - b.order);
  return {
    prev: [...byOrder].reverse().find((c) => c.order < current.order) ?? null,
    next: byOrder.find((c) => c.order > current.order) ?? null,
  };
}

export function ReaderPage() {
  const chapterId = Number(useParams().chapterId);
  // ?page=<n> (0-based, from a page bookmark) opens there instead of the saved position.
  const [search] = useSearchParams();
  const askedPage = search.get('page');
  const navigate = useNavigate();
  const reader = useSettings((s) => s.settings.reader);
  const update = useSettings((s) => s.update);
  const mode = useReader((s) => s.mode);
  const atEnd = useReader((s) => s.atEnd);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  // The chapter bookmark as toggled here; the loaded chapter's value until then.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bookmark, setBookmark] = useState<{ chapterId: number; on: boolean } | null>(null);
  const [opening, setOpening] = useState<OpeningFrom | null>(() => useUi.getState().openingFrom);
  // Only this chapter's first page; the store may still hold the previous session's pages.
  const firstPage = useReader((s) => (s.chapter?.id === chapterId ? s.pages[0] : undefined));

  // Reading Insights: time spent counts while the reader is open and in use.
  useEffect(() => startReadingClock(), []);

  useEffect(() => {
    useUi.setState({ openingFrom: null });
    // Leaving the reader: once the last save lands, finished chapters drop off the Updates badge.
    return () => {
      void savesSettled().then(() => {
        if (useUpdates.getState().status !== 'idle') void useUpdates.getState().load();
      });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stopSync = () => {};
    (async () => {
      const chapter = await getChapter(chapterId);
      const [title, chapters, pages] = await Promise.all([getTitle(chapter.titleId), loadChapters(chapter.titleId), takePrefetched(chapterId) ?? getPages(chapterId)]);
      if (cancelled) return;
      const settings = useSettings.getState().settings.reader;
      const chosen = settings.modes[String(title.id)] ?? preferredMode(title) ?? settings.defaultMode;
      const asked = askedPage !== null && /^\d+$/.test(askedPage) ? Number(askedPage) : null;
      const start = asked !== null ? Math.min(asked, Math.max(0, pages.length - 1)) : startPage(chapter, pages.length);
      useReader.getState().open(chapter, pages, start, chosen);
      const sync = createProgressSync(
        chapter.id,
        pages.length,
        async (id, patch) => {
          await setProgress(id, patch);
          if (patch.read && !chapter.read) {
            const t = useLibrary.getState().titles.find((x) => x.id === chapter.titleId);
            if (t) useLibrary.getState().patchTitle(t.id, { unread: Math.max(0, t.unread - 1) });
          }
        },
        start,
      );
      // A chapter that opens on its last page (one-pagers, or resumed at the end) is finished already.
      if (start === pages.length - 1) sync.pageChanged(start);
      // In a spread the last page on screen is the one read up to.
      const unsubscribe = useReader.subscribe((s, prev) => {
        if (s.view !== prev.view && s.chapter?.id === chapter.id) sync.pageChanged(Math.max(...s.view));
      });
      stopSync = () => {
        unsubscribe();
        sync.dispose();
      };
      setLoad({ state: 'ready', title, chapter, chapters });
    })().catch((e) => {
      if (!cancelled) setLoad({ state: 'error', message: e instanceof ServerError ? e.message : "Couldn't open this chapter" });
    });
    return () => {
      cancelled = true;
      stopSync();
    };
  }, [chapterId, askedPage]);

  useSpreadLayout(load.state === 'ready' ? load.title.id : null);
  const bookmarks = usePageBookmarks(load.state === 'ready' ? load.title.id : null);
  const readyChapterId = load.state === 'ready' ? load.chapter.id : null;
  const marked = bookmarks.list.filter((b) => b.chapterId === readyChapterId).map((b) => b.page);
  const markedKey = marked.join(',');
  useEffect(() => {
    useReader.setState({ bookmarkedPages: markedKey ? markedKey.split(',').map(Number) : [] });
  }, [markedKey]);

  const back = useCallback(() => (window.history.length > 1 ? navigate(-1) : navigate('/')), [navigate]);
  const ready = load.state === 'ready' ? load : null;
  const near = ready ? neighbours(ready.chapters, ready.chapter) : { prev: null, next: null };
  const goChapter = useCallback((c: Chapter) => navigate(`/read/${c.id}`, { replace: true }), [navigate]);

  // Near the end, fetch the next chapter's pages so it opens at once.
  const nearEnd = useReader((s) => s.pages.length > 0 && (s.mode === 'webtoon' ? s.index >= s.pages.length * 0.8 : s.index >= s.pages.length - 3));
  const nextId = near.next?.id;
  useEffect(() => {
    if (nearEnd && nextId !== undefined) prefetchChapter(nextId);
  }, [nearEnd, nextId]);

  useEffect(() => {
    useReader.setState({
      // Forward from the end card: on to the next chapter (with none, the card stays).
      onChapterEnd: () => near.next && goChapter(near.next),
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
    <div className={`${styles.reader} ${reader.grayscale ? styles.grayscale : ''}`}>
      {load.state === 'error' && (
        <div className={styles.message}>
          <p>{load.message}</p>
          <button type="button" className={styles.endButton} onClick={back}>
            Back
          </button>
        </div>
      )}
      {ready &&
        (mode === 'webtoon' ? (
          <WebtoonView
            end={
              <EndCard
                inline
                current={ready.chapter}
                next={near.next}
                onNext={() => {
                  // Finishing the strip marks it read before moving on.
                  useReader.getState().goTo(useReader.getState().pages.length - 1);
                  goChapter(near.next!);
                }}
                onBack={() => {}}
                onLibrary={back}
              />
            }
          />
        ) : (
          <PagedView />
        ))}
      {ready && atEnd && mode !== 'webtoon' && (
        <EndCard
          current={ready.chapter}
          next={near.next}
          onNext={() => goChapter(near.next!)}
          onBack={() => useReader.getState().prev()}
          onLibrary={back}
        />
      )}

      <div className={styles.dim} style={{ opacity: 1 - reader.brightness }} aria-hidden="true" />
      <div className={styles.warm} style={{ opacity: 0.35 * reader.warm }} aria-hidden="true" />

      {ready && (
        <ReaderChrome
          titleId={ready.title.id}
          titleName={ready.title.title}
          bookmarked={bookmark?.chapterId === ready.chapter.id ? bookmark.on : ready.chapter.bookmarked}
          onChapters={() => setDrawerOpen(true)}
          onBookmark={(on) => {
            setBookmark({ chapterId: ready.chapter.id, on });
            void setChapterBookmark(ready.chapter.id, on).catch(() => setBookmark({ chapterId: ready.chapter.id, on: !on }));
          }}
          chapterName={ready.chapter.name || `Chapter ${ready.chapter.number}`}
          onBack={back}
          onPrevChapter={near.prev ? () => goChapter(near.prev!) : null}
          onNextChapter={near.next ? () => goChapter(near.next!) : null}
          onModeChange={changeMode}
        />
      )}

      {ready && (
        <PageActions
          titleName={ready.title.title}
          bookmark={
            bookmarks.status === 'unreadable'
              ? undefined
              : (page) => {
                  const existing = bookmarks.list.find((b) => b.chapterId === ready.chapter.id && b.page === page);
                  return (
                    <PageBookmark
                      key={`${ready.chapter.id}:${page}`}
                      bookmark={existing}
                      onAdd={() => bookmarks.add(ready.chapter.id, page)}
                      onRemove={bookmarks.remove}
                      onNote={bookmarks.setNote}
                      error={bookmarks.error}
                    />
                  );
                }
          }
        />
      )}

      {ready && (
        <ChapterDrawer
          open={drawerOpen}
          titleId={ready.title.id}
          chapters={ready.chapters}
          currentId={ready.chapter.id}
          onPick={(c) => {
            setDrawerOpen(false);
            if (c.id !== ready.chapter.id) goChapter(c);
          }}
          onClose={() => setDrawerOpen(false)}
        />
      )}
      {ready && !opening && <DirectionHint titleId={ready.title.id} mode={mode} />}

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

/** Pairs pages into spreads when the screen and settings want them, and keeps the store's layout in step. */
function useSpreadLayout(titleId: number | null) {
  const { pages, mode, index } = useReader();
  const reader = useSettings((s) => s.settings.reader);
  const viewport = useViewport();
  const on = titleId !== null && wantsSpreads(reader.spreads, viewport, mode);
  const coverAlone = (titleId !== null ? reader.coverAloneByTitle[String(titleId)] : undefined) ?? reader.coverAlone;
  const sizes = usePageSizes(pages, index, on);
  // Pair only once the pages around this one have known sizes: guessed pairs could show a wide
  // scan split, or put the last page on screen (and mark the chapter read) too early.
  // Latched per chapter, so turning into pages still loading never flips back to singles.
  const [pairedFor, setPairedFor] = useState<string[] | null>(null);
  const around = [index - 1, index, index + 1, index + 2].filter((i) => i >= 0 && i < pages.length);
  if (on && pairedFor !== pages && around.every((i) => sizes[i])) setPairedFor(pages);
  const paired = on && pairedFor === pages;
  const key = paired ? JSON.stringify(layoutFor(pages.length, sizes, coverAlone)) : `singles:${pages.length}`;
  useEffect(() => {
    if (titleId === null) return;
    const layout: number[][] = paired ? JSON.parse(key) : pages.map((_, i) => [i]);
    if (JSON.stringify(layout) !== JSON.stringify(useReader.getState().layout)) useReader.getState().setLayout(layout);
    // `key` captures the layout; pages only matter through it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, titleId]);
}
