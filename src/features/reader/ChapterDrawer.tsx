import { useEffect, useRef } from 'react';
import type { Chapter } from '../../shared/model/types';
import { Sheet } from '../../shared/ui/Sheet';
import { arrangeChapters } from '../title/chapterList';
import { useChapterView } from '../title/chapterViewStore';
import styles from './ChapterDrawer.module.css';

type Props = {
  open: boolean;
  titleId: number;
  chapters: Chapter[];
  currentId: number;
  onPick: (c: Chapter) => void;
  onClose: () => void;
};

/** Every chapter of the title, in its title-page order (but never filtered), to jump to from the reader. */
export function ChapterDrawer({ open, titleId, chapters, currentId, onPick, onClose }: Props) {
  const view = useChapterView(titleId);
  const list = arrangeChapters(chapters, { ...view, unreadOnly: false, bookmarkedOnly: false, dedupe: false });
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'center' });
  }, [open]);

  return (
    <Sheet open={open} label="Chapters" title="Chapters" closeLabel="Close chapters" onClose={onClose}>
      <ul ref={listRef} className={styles.list}>
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={`${styles.row} ${c.read ? styles.read : ''}`}
              aria-current={c.id === currentId ? 'true' : undefined}
              onClick={() => onPick(c)}
            >
              {c.name || `Chapter ${c.number}`}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
