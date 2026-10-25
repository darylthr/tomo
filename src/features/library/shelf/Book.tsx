import { forwardRef, useState, type CSSProperties } from 'react';
import type { Title } from '../../../shared/model/types';
import styles from './Book.module.css';
import { dominantColor, spineInk } from './coverColor';

type Props = {
  title: Title;
  /** Fewer faces and a thinner spine for slower devices. */
  lite?: boolean;
  /** A flat cover: no spine, pages or back. */
  flat?: boolean;
  /** 'shelf' centres the book on the shelf floor; 'fill' fills its parent box (grids). */
  fit?: 'shelf' | 'fill';
};

/** A title as a 3D book: matte cover, tinted spine, page edges on the side and top. */
export const Book = forwardRef<HTMLDivElement, Props>(function Book({ title, lite, flat, fit = 'shelf' }, ref) {
  const [spine, setSpine] = useState('#2a2a30');
  const classes = [styles.book, fit === 'fill' ? styles.fill : '', lite ? styles.lite : '', flat ? styles.flat : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      style={{ '--spine': spine, '--spine-ink': spineInk(spine) } as CSSProperties}
      data-title-id={title.id}
    >
      <div className={`${styles.face} ${styles.front}`} data-cover="">
        {title.coverUrl ? (
          <img
            className={styles.cover}
            src={title.coverUrl}
            alt=""
            draggable={false}
            decoding="async"
            onLoad={(e) => setSpine(dominantColor(e.currentTarget))}
          />
        ) : (
          <span className={styles.placeholder}>{title.title}</span>
        )}
      </div>
      {!flat && (
        <>
          <div className={`${styles.face} ${styles.spine}`}>
            <span>{title.title}</span>
          </div>
          {!lite && (
            <>
              <div className={`${styles.face} ${styles.back}`} />
              <div className={`${styles.face} ${styles.pages}`} />
              <div className={`${styles.face} ${styles.top}`} />
            </>
          )}
        </>
      )}
    </div>
  );
});
