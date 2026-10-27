import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReaderMode } from '../../shared/model/types';
import type { ReaderSettings as ReaderPrefs } from '../../shared/settings/schema';
import { Page } from '../../shared/ui/Page';
import styles from './Settings.module.css';

export function Row({ label, stack, children }: { label: string; stack?: boolean; children: ReactNode }) {
  return (
    <div className={stack ? styles.stack : styles.row}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  );
}

/** A glass card of settings. `heading` is shown only when a page holds more than one card. */
export function Card({ label, heading, children }: { label: string; heading?: boolean; children: ReactNode }) {
  return (
    <section className={styles.section} aria-label={label}>
      {heading && <h3 className={styles.heading}>{label}</h3>}
      {children}
    </section>
  );
}

/** One section of Settings, with a Back button to the list. */
export function SettingsSubpage({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <Page title={title} onBack={() => navigate('/settings')}>
      <div className={styles.sections}>{children}</div>
    </Page>
  );
}

export const MODES: { value: ReaderMode; label: string }[] = [
  { value: 'rtl', label: 'Manga' },
  { value: 'ltr', label: 'Comic' },
  { value: 'webtoon', label: 'Webtoon' },
  { value: 'vertical', label: 'Vertical' },
];

export const FITS: { value: ReaderPrefs['fit']; label: string }[] = [
  { value: 'screen', label: 'Screen' },
  { value: 'width', label: 'Width' },
  { value: 'height', label: 'Height' },
];
