import { useEffect, useState } from 'react';
import type { ReaderMode } from '../../shared/model/types';
import { useSettings } from '../../shared/settings/store';
import styles from './ReaderPage.module.css';

const TEXT: Record<ReaderMode, string> = {
  rtl: 'Swipe → to read',
  ltr: 'Swipe ← to read',
  vertical: 'Swipe ↑ to read',
  webtoon: 'Scroll down to read',
};
const SHOW_MS = 2000;

/** The first time a title opens in a mode on this device: which way to read. Gone after 2s or a touch. */
export function DirectionHint({ titleId, mode }: { titleId: number; mode: ReaderMode }) {
  const key = `${titleId}:${mode}`;
  const seen = useSettings((s) => !!s.settings.reader.hintsSeen[key]);
  const [shownFor, setShownFor] = useState<string | null>(() => (seen ? null : key));
  const visible = shownFor === key;

  useEffect(() => {
    if (!visible) return;
    const done = () => {
      setShownFor(null);
      const { hintsSeen } = useSettings.getState().settings.reader;
      useSettings.getState().update({ reader: { hintsSeen: { ...hintsSeen, [key]: true } } });
    };
    const t = setTimeout(done, SHOW_MS);
    window.addEventListener('pointerdown', done, { once: true });
    window.addEventListener('keydown', done, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', done);
      window.removeEventListener('keydown', done);
    };
  }, [visible, key]);

  if (!visible) return null;
  return (
    <div className={styles.hint} role="status">
      {TEXT[mode]}
    </div>
  );
}
