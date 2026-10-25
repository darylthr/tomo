import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { Title } from '../../shared/model/types';
import styles from './LibraryGrid.module.css';
import { Book } from './shelf/Book';

type Props = {
  titles: Title[];
  display: 'books' | 'covers';
  lite: boolean;
  onOpen: (title: Title, coverEl: HTMLElement) => void;
};

/** Vertical scrolling: a grid of small turned books, or of flat covers (spec §6.4). */
export function LibraryGrid({ titles, display, lite, onOpen }: Props) {
  const gridRef = useRef<HTMLUListElement>(null);

  // 3D faces need pixel sizes (translateZ can't take percentages): measure one tile.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const tile = grid.querySelector<HTMLElement>('[data-tile]');
      const w = tile?.clientWidth || 110;
      const h = Math.round(w / 0.68);
      grid.style.setProperty('--w', `${w}px`);
      grid.style.setProperty('--h', `${h}px`);
      grid.style.setProperty('--d', `${Math.round(h * 0.15)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [display, titles.length]);

  return (
    <div className={styles.scroller}>
      <ul ref={gridRef} className={styles.grid} aria-label="Library">
        {titles.map((t) => (
          <li key={t.id} className={styles.item}>
            <button
              type="button"
              className={styles.tile}
              aria-label={t.title}
              onClick={(e) => {
                const cover = e.currentTarget.querySelector<HTMLElement>('[data-cover]');
                if (cover) onOpen(t, cover);
              }}
            >
              <span className={display === 'books' ? styles.book : styles.cover} data-tile="" style={{ '--dim': 0 } as CSSProperties}>
                <Book title={t} lite={lite} flat={display === 'covers'} fit="fill" />
                {display === 'covers' && t.unread > 0 && <span className={styles.badge}>{t.unread}</span>}
              </span>
              <span className={styles.name}>{t.title}</span>
              <span className={styles.sub}>{t.unread ? `${t.unread} left` : 'Caught up'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
