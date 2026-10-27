import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Chapter } from '../../shared/model/types';
import { Sheet } from '../../shared/ui/Sheet';
import sheet from '../../shared/ui/Sheet.module.css';
import { NOTE_MAX, type PageBookmark } from '../reader/bookmarks';
import { usePageBookmarks } from '../reader/usePageBookmarks';
import styles from './BookmarksSection.module.css';

/** The title's page bookmarks, newest first; each opens its chapter at the page. */
export function BookmarksSection({ titleId, chapters }: { titleId: number; chapters: Chapter[] }) {
  const bookmarks = usePageBookmarks(titleId);
  const [editing, setEditing] = useState<PageBookmark | null>(null);
  const [note, setNote] = useState('');

  if (bookmarks.status === 'unreadable') {
    return (
      <section className={styles.section} aria-label="Bookmarks">
        <h2 className={styles.heading}>Bookmarks</h2>
        <p className={styles.problem}>Couldn't read this title's bookmarks</p>
      </section>
    );
  }
  if (bookmarks.list.length === 0) return null;

  const chapterName = (id: number) => {
    const c = chapters.find((x) => x.id === id);
    return c ? c.name || `Chapter ${c.number}` : 'Chapter';
  };
  const list = [...bookmarks.list].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section className={styles.section} aria-label="Bookmarks">
      <h2 className={styles.heading}>Bookmarks</h2>
      <ul className={styles.list}>
        {list.map((b) => (
          <li key={b.id} className={styles.row}>
            <Link to={`/read/${b.chapterId}?page=${b.page}`} className={styles.open}>
              <span className={styles.name}>
                {chapterName(b.chapterId)} · Page {b.page + 1}
              </span>
              {b.note && <span className={styles.note}>{b.note}</span>}
            </Link>
            <button
              type="button"
              className={styles.more}
              aria-label={`Options for ${chapterName(b.chapterId)}, page ${b.page + 1}`}
              onClick={() => {
                setNote(b.note);
                setEditing(b);
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                {[6, 12, 18].map((x) => (
                  <circle key={x} cx={x} cy={12} r={1.8} />
                ))}
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {bookmarks.error && (
        <p className={styles.problem} role="alert">
          {bookmarks.error}
        </p>
      )}
      <Sheet open={editing !== null} label="Bookmark" title="Bookmark" closeLabel="Close bookmark" onClose={() => setEditing(null)}>
        {editing && (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void bookmarks.setNote(editing.id, note.trim()).then(() => setEditing(null));
            }}
          >
            <label className={styles.fieldLabel} htmlFor="bookmark-note">
              Note
            </label>
            <input id="bookmark-note" className={styles.field} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
            <button type="submit" className={sheet.apply}>
              Save note
            </button>
            <button
              type="button"
              className={styles.remove}
              onClick={() => void bookmarks.remove(editing.id).then(() => setEditing(null))}
            >
              Remove bookmark
            </button>
          </form>
        )}
      </Sheet>
    </section>
  );
}
