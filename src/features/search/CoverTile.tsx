import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BrowseItem } from '../../shared/model/types';
import { useLibrary } from '../library/libraryStore';
import styles from './Search.module.css';

/** A flat cover and its name, opening the title page. Titles already owned get a badge. */
export function CoverTile({ item }: { item: BrowseItem }) {
  const [failed, setFailed] = useState(false);
  // The loaded library is fresher than the browse result (a title added, then Back).
  const owned = useLibrary((s) => (s.status === 'ready' ? s.titles.some((t) => t.id === item.id) : item.inLibrary));
  return (
    <Link to={`/title/${item.id}`} className={styles.tile}>
      <span className={styles.cover}>
        {item.coverUrl && !failed ? (
          <img src={item.coverUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        ) : (
          <span className={styles.coverText}>{item.title}</span>
        )}
        {owned && <span className={styles.inLibrary}>In library</span>}
      </span>
      <span className={styles.tileName}>{item.title}</span>
    </Link>
  );
}
