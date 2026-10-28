import { useEffect, useLayoutEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import type { Title } from '../../shared/model/types';
import styles from './LibraryGrid.module.css';
import { prefersReducedMotion } from '../../shared/ui/useReducedMotion';
import { IconCheck } from '../../shared/ui/icons';
import { Book } from './shelf/Book';
import { useHold } from './useHold';

const SLIDE_PX = 70;

type Props = {
  titles: Title[];
  display: 'books' | 'covers';
  lite: boolean;
  size: 's' | 'm' | 'l';
  showTitles: boolean;
  showProgress: boolean;
  onOpen: (title: Title, coverEl: HTMLElement) => void;
  /** The title to bring into view when the grid appears (the one just left). */
  focusId: number | null;
  /** Changes with the category tab; the grid fades in again and starts from the top. */
  filterKey: string;
  /** A sideways swipe: 1 to the next tab, -1 to the previous. Left out while selecting. */
  onSlide?: (step: 1 | -1) => void;
  /** Selecting several titles: taps choose instead of open. A long press or right-click starts it. */
  selecting: boolean;
  selected: ReadonlySet<number>;
  onSelect: (title: Title) => void;
};

/** Vertical scrolling: a grid of small turned books, or of flat covers (spec §6.4). */
export function LibraryGrid({ titles, display, lite, size, showTitles, showProgress, onOpen, focusId, filterKey, onSlide, selecting, selected, onSelect }: Props) {
  const gridRef = useRef<HTMLUListElement>(null);
  const slide = useRef<{ x: number; y: number; t: number } | null>(null);
  const swiped = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const direction = useRef(0);

  // Coming back from a title: it's the one on screen.
  useLayoutEffect(() => {
    if (focusId === null) return;
    gridRef.current?.querySelector(`[data-title-id="${focusId}"]`)?.scrollIntoView({ block: 'center' });
    // only the first appearance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: PointerEvent) => {
    // Fingers and pens swipe; a mouse drag isn't a gesture.
    slide.current = onSlide && e.pointerType !== 'mouse' ? { x: e.clientX, y: e.clientY, t: e.timeStamp } : null;
    swiped.current = false;
  };
  const onPointerUp = (e: PointerEvent) => {
    const s = slide.current;
    slide.current = null;
    if (!s || !onSlide) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const fast = Math.abs(dx) / Math.max(1, e.timeStamp - s.t) > 0.4;
    if (Math.abs(dx) < Math.abs(dy) * 1.5 || (Math.abs(dx) < SLIDE_PX && !(fast && Math.abs(dx) > 30))) return;
    swiped.current = true;
    direction.current = dx < 0 ? 1 : -1;
    onSlide(dx < 0 ? 1 : -1);
  };

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
  }, [display, titles.length, size, filterKey]);

  // A tab reached by swiping: its titles come in from the side the swipe came from (a tap on a tab just swaps them).
  useEffect(() => {
    const dir = direction.current;
    direction.current = 0;
    if (!dir || prefersReducedMotion()) return;
    scrollerRef.current?.animate?.(
      [
        { opacity: 0, filter: 'blur(4px)', translate: `${dir * 12}px 0` },
        { opacity: 1, filter: 'blur(0)', translate: '0 0' },
      ],
      { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    );
  }, [filterKey]);

  return (
    <div
      key={filterKey}
      className={styles.scroller}
      ref={scrollerRef}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (slide.current = null)}
      // A swipe that ends on the tile it began on would otherwise count as a tap.
      onClickCapture={(e) => {
        if (!swiped.current) return;
        swiped.current = false;
        e.stopPropagation();
      }}
    >
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
