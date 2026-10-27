import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Chapter, Title, TitleStatus } from '../../shared/model/types';
import { createCategory, fetchTitle, getTitle, setChapterBookmark, setInLibrary, setProgress, setTitleCategories } from '../server/api';
import { ServerError } from '../server/client';
import { loadChapters, pickContinueChapter } from '../library/continueReading';
import { useLibrary } from '../library/libraryStore';
import styles from './TitlePage.module.css';
import { IconBookmark, IconFilter } from '../../shared/ui/icons';
import { Sheet } from '../../shared/ui/Sheet';
import sheet from '../../shared/ui/Sheet.module.css';
import { useLongPress } from '../reader/useLongPress';
import { TitleName } from '../../shared/ui/TitleName';
import { prefersReducedMotion } from '../../shared/ui/useReducedMotion';
import { arrangeChapters, isDefaultView } from './chapterList';
import { CategorySheet } from './CategorySheet';
import { ChapterViewPanel } from './ChapterViewPanel';
import { useChapterView, useChapterViews } from './chapterViewStore';

const STATUS: Record<TitleStatus, string> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  hiatus: 'Hiatus',
  cancelled: 'Cancelled',
  unknown: 'Unknown status',
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; title: Title; chapters: Chapter[] };

export function TitlePage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [expanded, setExpanded] = useState(false);
  const view = useChapterView(id);
  const setView = useChapterViews((s) => s.setView);
  const [picking, setPicking] = useState(false);
  // Long-press a chapter row for its actions (rows carry the chapter id in data-page).
  const [actionsFor, setActionsFor] = useState<number | null>(null);
  const press = useLongPress(setActionsFor, () => -1);
  const allCategories = useLibrary((s) => s.categories);
  const libraryTitles = useLibrary((s) => s.titles);
  useEffect(() => {
    void useLibrary.getState().load();
  }, []);
  const [panel, setPanel] = useState<'closed' | 'open' | 'closing'>('closed');
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const togglePanel = () => {
    clearTimeout(closeTimer.current);
    if (panel === 'open') {
      setPanel('closing');
      closeTimer.current = setTimeout(() => setPanel('closed'), prefersReducedMotion() ? 0 : 150);
    } else setPanel('open');
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTitle(id), loadChapters(id)])
      .then(([title, chapters]) => {
        if (cancelled) return;
        setLoad({ state: 'ready', title, chapters });
        // Titles found while browsing have only a name and cover until Suwayomi asks the source.
        if (!title.initialized) {
          fetchTitle(id)
            .then((full) => !cancelled && setLoad((s) => (s.state === 'ready' ? { ...s, title: { ...full, inLibrary: s.title.inLibrary } } : s)))
            .catch(() => {});
        }
      })
      .catch((e) => !cancelled && setLoad({ state: 'error', message: e instanceof ServerError ? e.message : 'Something went wrong' }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  if (load.state === 'loading') {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Title">
        <div className={styles.skeleton} />
      </section>
    );
  }
  if (load.state === 'error') {
    return (
      <section className={styles.page} aria-label="Title">
        <button type="button" className={styles.back} aria-label="Back" onClick={back}>
          <BackIcon />
        </button>
        <p className={styles.error}>{load.message}</p>
      </section>
    );
  }

  const { title, chapters } = load;
  const next = pickContinueChapter(chapters);
  const allRead = chapters.length > 0 && chapters.every((c) => c.read);
  const noneRead = chapters.every((c) => !c.read && c.lastPage === 0);
  const shown = arrangeChapters(chapters, view);
  const action = !next ? 'No chapters yet' : allRead ? 'Read again' : noneRead ? 'Start reading' : `Continue · Ch. ${next.number}`;

  const update = (patch: (s: { title: Title; chapters: Chapter[] }) => { title: Title; chapters: Chapter[] }) =>
    setLoad((s) => (s.state === 'ready' ? { state: 'ready', ...patch(s) } : s));

  const toggleRead = (c: Chapter) => {
    const read = !c.read;
    void setProgress(c.id, { read });
    update((s) => ({ title: s.title, chapters: s.chapters.map((x) => (x.id === c.id ? { ...x, read } : x)) }));
    const unread = Math.max(0, title.unread + (read ? -1 : 1));
    useLibrary.getState().patchTitle(title.id, { unread });
  };

  const categories = allCategories.filter((c) => c.id > 0);
  const counts = new Map<number, number>();
  for (const t of libraryTitles) for (const c of t.categoryIds) counts.set(c, (counts.get(c) ?? 0) + 1);
  const ownCategories = categories.filter((c) => title.categoryIds.includes(c.id));

  const setLibrary = (inLibrary: boolean, categoryIds = title.categoryIds) => {
    void (async () => {
      if (inLibrary !== title.inLibrary) await setInLibrary(title.id, inLibrary);
      if (inLibrary && categories.length > 0) await setTitleCategories(title.id, categoryIds);
    })()
      .catch(() => {})
      .finally(() => useLibrary.getState().refresh());
    update((s) => ({ title: { ...s.title, inLibrary, categoryIds: inLibrary ? categoryIds : [] }, chapters: s.chapters }));
  };

  // With categories set up, adding asks where the title goes (as in Mihon); without, it just adds.
  const toggleBookmark = (c: Chapter) => {
    const bookmarked = !c.bookmarked;
    void setChapterBookmark(c.id, bookmarked);
    update((s) => ({ title: s.title, chapters: s.chapters.map((x) => (x.id === c.id ? { ...x, bookmarked } : x)) }));
  };

  const toggleLibrary = () => {
    if (title.inLibrary) setLibrary(false);
    else if (categories.length > 0) setPicking(true);
    else setLibrary(true);
  };

  const saveCategories = (ids: number[]) => {
    setPicking(false);
    if (title.inLibrary && ids.length === 0) setLibrary(false);
    else setLibrary(true, ids);
  };

  const newCategory = async (name: string) => {
    const category = await createCategory(name);
    useLibrary.setState((s) => ({ categories: [...s.categories, category] }));
    return category;
  };

  return (
    <section className={styles.page} aria-label={title.title}>
      <div className={styles.inner}>
        <button type="button" className={styles.back} aria-label="Back" onClick={back}>
          <BackIcon />
        </button>
        <header className={styles.header}>
          <div className={styles.cover}>
            {title.coverUrl ? <img src={title.coverUrl} alt="" /> : <span>{title.title}</span>}
          </div>
          <div className={styles.facts}>
            <h1 className={styles.name}>
              <TitleName title={title} size="lg" />
            </h1>
            {title.author && <p className={styles.author}>{title.author}</p>}
            <p className={styles.meta}>
              <span className={`${styles.status} ${styles[title.status]}`}>
                <i aria-hidden="true" />
                {STATUS[title.status]}
              </span>
              {title.sourceName && <span>{title.sourceName}</span>}
            </p>
          </div>
        </header>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            disabled={!next}
            onClick={() => next && navigate(`/read/${next.id}`)}
          >
            {action}
          </button>
          <button type="button" className={styles.secondary} aria-pressed={title.inLibrary} onClick={toggleLibrary}>
            {title.inLibrary ? 'In library' : 'Add to library'}
          </button>
        </div>
        {title.inLibrary && (
          <div className={styles.categories}>
            {ownCategories.length > 0 && (
              <ul className={styles.categoryChips} aria-label="Categories">
                {ownCategories.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            )}
            <button type="button" className={styles.categoryEdit} aria-label="Edit categories" onClick={() => setPicking(true)}>
              {ownCategories.length > 0 ? 'Edit' : 'Add to a category'}
            </button>
          </div>
        )}
        <CategorySheet
          open={picking}
          mode={title.inLibrary ? 'edit' : 'add'}
          titleName={title.title}
          categories={categories}
          counts={counts}
          selected={title.categoryIds.filter((id) => id > 0)}
          onCreate={newCategory}
          onSave={saveCategories}
          onClose={() => setPicking(false)}
        />

        {title.description && (
          <div className={styles.description}>
            <p className={expanded ? '' : styles.clamped}>{title.description}</p>
            {title.description.length > 180 && (
              <button type="button" className={styles.more} onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Less' : 'More'}
              </button>
            )}
          </div>
        )}
        {title.genres.length > 0 && (
          <ul className={styles.genres} aria-label="Genres">
            {title.genres.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        )}

        <div className={styles.listHead}>
          <h2 className={styles.heading}>
            {shown.length < chapters.length && `${shown.length} of `}
            {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
          </h2>
          {chapters.length > 1 && (
            <button
              type="button"
              className={styles.sortButton}
              aria-label="Sort and filter chapters"
              aria-expanded={panel === 'open'}
              aria-controls="chapter-view"
              onClick={togglePanel}
            >
              <IconFilter />
              {view.sort === 'uploaded' ? 'Upload date' : 'Chapter'} · {view.descending ? 'Newest' : 'Oldest'}
              {!isDefaultView(view) && <span className={styles.sortDot} aria-hidden="true" />}
            </button>
          )}
        </div>
        {panel !== 'closed' && <ChapterViewPanel id="chapter-view" view={view} onChange={(v) => setView(id, v)} closing={panel === 'closing'} />}
        {shown.length === 0 && chapters.length > 0 ? (
          <div className={styles.noMatch}>
            <p>No chapters match these filters.</p>
            <button type="button" className={styles.viewReset} onClick={() => setView(id, { ...view, unreadOnly: false, bookmarkedOnly: false })}>
              Show all
            </button>
          </div>
        ) : (
          <ul className={styles.chapters} aria-label="Chapters">
            {shown.map((c) => {
              const name = c.name || `Chapter ${c.number}`;
              return (
                <li key={c.id} className={`${styles.chapter} ${c.read ? styles.read : ''}`}>
                  <button
                    type="button"
                    className={styles.open}
                    data-page={c.id}
                    onClick={() => !press.consumeClick() && navigate(`/read/${c.id}`)}
                    onPointerDown={press.onPointerDown}
                    onPointerMove={press.onPointerMove}
                    onPointerUp={press.onPointerUp}
                    onPointerCancel={press.onPointerCancel}
                    onContextMenu={press.onContextMenu}
                  >
                    <span className={styles.chapterTitleRow}>
                      <span className={styles.chapterName} data-chapter-name="">
                        {name}
                      </span>
                      {c.bookmarked && <IconBookmark filled className={styles.ribbon} role="img" aria-hidden={false} aria-label="Bookmarked" />}
                    </span>
                    <span className={styles.chapterMeta}>
                      {c.uploadedAt > 0 && <span>{dateFormat.format(c.uploadedAt)}</span>}
                      {c.scanlator && <span>{c.scanlator}</span>}
                      {!c.read && c.lastPage > 0 && <span className={styles.resume}>Page {c.lastPage + 1}</span>}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.toggle}
                    aria-label={`Mark ${name} as ${c.read ? 'unread' : 'read'}`}
                    aria-pressed={c.read}
                    onClick={() => toggleRead(c)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <ChapterActions
          chapter={chapters.find((c) => c.id === actionsFor) ?? null}
          onBookmark={toggleBookmark}
          onRead={toggleRead}
          onClose={() => setActionsFor(null)}
        />
      </div>
    </section>
  );
}

/** A long-pressed chapter's actions: bookmark it, or mark it read. */
function ChapterActions({
  chapter,
  onBookmark,
  onRead,
  onClose,
}: {
  chapter: Chapter | null;
  onBookmark: (c: Chapter) => void;
  onRead: (c: Chapter) => void;
  onClose: () => void;
}) {
  const name = chapter ? chapter.name || `Chapter ${chapter.number}` : 'Chapter';
  return (
    <Sheet open={chapter !== null} label={name} title={name} closeLabel="Close chapter actions" onClose={onClose}>
      {chapter && (
        <div className={styles.chapterActions}>
          <button
            type="button"
            className={sheet.apply}
            onClick={() => {
              onBookmark(chapter);
              onClose();
            }}
          >
            {chapter.bookmarked ? 'Remove bookmark' : 'Bookmark chapter'}
          </button>
          <button
            type="button"
            className={`${sheet.ghost} ${styles.wideGhost}`}
            onClick={() => {
              onRead(chapter);
              onClose();
            }}
          >
            {chapter.read ? 'Mark as unread' : 'Mark as read'}
          </button>
        </div>
      )}
    </Sheet>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}
