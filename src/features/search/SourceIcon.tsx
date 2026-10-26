import { useState } from 'react';
import type { Source } from '../../shared/model/types';
import styles from './Search.module.css';

// Muted hues for the letter avatar when a source has no icon (or it fails to load).
const HUES = [20, 60, 150, 190, 230, 280, 330];

function hue(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return HUES[Math.abs(h) % HUES.length]!;
}

/** The extension's icon, or the source's first letter on a colored tile. */
export function SourceIcon({ source, size = 'md' }: { source: Source; size?: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false);
  const className = `${styles.icon} ${size === 'sm' ? styles.iconSm : ''}`;
  if (source.iconUrl && !failed) {
    return <img className={className} src={source.iconUrl} alt="" loading="lazy" onError={() => setFailed(true)} />;
  }
  return (
    <span className={`${className} ${styles.letter}`} style={{ background: `oklch(0.45 0.09 ${hue(source.id)})` }} aria-hidden="true">
      {source.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Language tag: "EN", "ALL", "PT-BR". */
export function LangTag({ lang }: { lang: string }) {
  if (!lang) return null;
  return <span className={styles.lang}>{lang.toUpperCase()}</span>;
}
