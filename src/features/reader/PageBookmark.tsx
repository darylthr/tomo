import { useState } from 'react';
import sheet from '../../shared/ui/Sheet.module.css';
import type { PageBookmark as Bookmark } from './bookmarks';
import { NOTE_MAX } from './bookmarks';
import styles from './PageActions.module.css';

type Props = {
  bookmark: Bookmark | undefined;
  onAdd: () => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onNote: (id: string, note: string) => Promise<void>;
  error: string | null;
};

/** In the page sheet: bookmark this page, add an optional note, or remove the bookmark. */
export function PageBookmark({ bookmark, onAdd, onRemove, onNote, error }: Props) {
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  return (
    <>
      {bookmark ? (
        <>
          <button type="button" className={`${sheet.ghost} ${styles.wide}`} onClick={() => void onRemove(bookmark.id)}>
            Remove bookmark
          </button>
          {noting ? (
            <form
              className={styles.noteForm}
              onSubmit={(e) => {
                e.preventDefault();
                void onNote(bookmark.id, note.trim()).then(() => setNoting(false));
              }}
            >
              <input className={styles.field} aria-label="Note" value={note} maxLength={NOTE_MAX} autoFocus onChange={(e) => setNote(e.target.value)} />
              <button type="submit" className={sheet.ghost}>
                Save note
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={styles.noteLink}
              onClick={() => {
                setNote(bookmark.note);
                setNoting(true);
              }}
            >
              {bookmark.note ? `Note: ${bookmark.note}` : 'Add a note'}
            </button>
          )}
        </>
      ) : (
        <button type="button" className={`${sheet.ghost} ${styles.wide}`} onClick={() => void onAdd()}>
          Bookmark page
        </button>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
