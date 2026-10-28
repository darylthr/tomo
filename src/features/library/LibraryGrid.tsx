import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { Title } from '../../shared/model/types';
import styles from './LibraryGrid.module.css';
import { IconCheck, IconInfo } from '../../shared/ui/icons';
import { Book } from './shelf/Book';
import { useHold } from './useHold';

type Props = {
  titles: Title[];
  display: 'books' | 'covers';
  lite: boolean;
  size: 's' | 'm' | 'l';
  showTitles: boolean;
  showProgress: boolean;
  onOpen: (title: Title, coverEl: HTMLElement) => void;
  /** Opens the title's page: its details and chapters. */
  onDetails: (title: Title) => void;
  /** Selecting several titles: taps choose instead of open. A long press or right-click starts it. */
  selecting: boolean;
  selected: ReadonlySet<number>;
  onSelect: (title: Title) => void;
};

/** Vertical scrolling: a grid of small turned books, or of flat covers (spec §6.4). */
export function LibraryGrid({ titles, display, lite, size, showTitles, showProgress, onOpen, onDetails, selecting, selected, onSelect }: Props) {
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
  }, [display, titles.length, size]);

  return (
    <div className={styles.scroller}>
      <ul ref={gridRef} className={styles.grid} aria-label="Library" data-size={size}>
        {titles.map((t) => (
          <li key={t.id} className={styles.item}>
            <Tile
              title={t}
              display={display}
              lite={lite}
              showTitles={showTitles}
              showProgress={showProgress}
              selecting={selecting}
              selected={selected.has(t.id)}
              onOpen={onOpen}
              onSelect={onSelect}
            />
            {!selecting && t.kind !== 'novel' && (
              <button type="button" className={styles.details} aria-label={`Details and chapters of ${t.title}`} onClick={() => onDetails(t)}>
                <IconInfo />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

type TileProps = Pick<Props, 'display' | 'lite' | 'showTitles' | 'showProgress' | 'selecting' | 'onOpen' | 'onSelect'> & {
  title: Title;
  selected: boolean;
};

function Tile({ title: t, display, lite, showTitles, showProgress, selecting, selected, onOpen, onSelect }: TileProps) {
  const hold = useHold(() => onSelect(t));
  return (
    <button
      type="button"
      className={styles.tile}
      aria-label={t.title}
      aria-pressed={selecting ? selected : undefined}
      data-selected={selected || undefined}
      onPointerDown={hold.onPointerDown}
      onPointerMove={hold.onPointerMove}
      onPointerUp={hold.onPointerUp}
      onPointerCancel={hold.onPointerCancel}
      onContextMenu={hold.onContextMenu}
      onClick={(e) => {
        if (hold.consumeClick()) return;
        if (selecting) return onSelect(t);
        const cover = e.currentTarget.querySelector<HTMLElement>('[data-cover]');
        if (cover) onOpen(t, cover);
      }}
    >
      <span className={display === 'books' ? styles.book : styles.cover} data-tile="" style={{ '--dim': 0 } as CSSProperties}>
        <Book title={t} lite={lite} flat={display === 'covers'} fit="fill" />
        {display === 'covers' && t.unread > 0 && t.kind !== 'novel' && !selecting && <span className={styles.badge}>{t.unread}</span>}
        {selecting && (
          <span className={styles.check} aria-hidden="true">
            <IconCheck />
          </span>
        )}
      </span>
      {showTitles && <span className={styles.name}>{t.title}</span>}
      {showProgress && (
        <span className={styles.sub}>
          {t.kind === 'novel' ? (t.unread ? `${t.unread}% left` : 'Finished') : t.unread ? `${t.unread} left` : 'Caught up'}
        </span>
      )}
    </button>
  );
}
