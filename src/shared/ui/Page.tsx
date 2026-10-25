import type { ReactNode } from 'react';
import styles from './Page.module.css';

/** A scrollable screen inside the frame panel with a large title. */
export function Page({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className={styles.page} aria-label={title}>
      <div className={styles.inner}>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </div>
    </section>
  );
}

export function PageNote({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}
