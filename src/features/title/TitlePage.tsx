import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Chapter, Title, TitleStatus } from '../../shared/model/types';
import { getTitle, setInLibrary, setProgress } from '../server/api';
import { ServerError } from '../server/client';
import { loadChapters, pickContinueChapter } from '../library/continueReading';
import { useLibrary } from '../library/libraryStore';
import styles from './TitlePage.module.css';

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

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTitle(id), loadChapters(id)])
      .then(([title, chapters]) => !cancelled && setLoad({ state: 'ready', title, chapters }))
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

  const toggleLibrary = () => {
    const inLibrary = !title.inLibrary;
    void setInLibrary(title.id, inLibrary).then(() => useLibrary.getState().refresh());
    update((s) => ({ title: { ...s.title, inLibrary }, chapters: s.chapters }));
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
            <h1 className={styles.name}>{title.title}</h1>
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

        <h2 className={styles.heading}>
          {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
        </h2>
        <ul className={styles.chapters} aria-label="Chapters">
          {chapters.map((c) => {
            const name = c.name || `Chapter ${c.number}`;
            return (
              <li key={c.id} className={`${styles.chapter} ${c.read ? styles.read : ''}`}>
                <button type="button" className={styles.open} onClick={() => navigate(`/read/${c.id}`)}>
                  <span className={styles.chapterName} data-chapter-name="">
                    {name}
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
      </div>
    </section>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}
