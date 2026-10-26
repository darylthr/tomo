import { useRef, type ReactNode } from 'react';
import styles from './Page.module.css';
import { PULL_TRIGGER, usePullToRefresh } from './usePullToRefresh';

/**
 * A scrollable screen inside the frame panel with a large title, an optional action beside it,
 * and pull-to-refresh when `onRefresh` is given (pair it with a refresh button in `action`).
 */
export function Page({
  title,
  action,
  onRefresh,
  children,
}: {
  title: string;
  action?: ReactNode;
  onRefresh?: () => Promise<void>;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const { pull, refreshing } = usePullToRefresh(ref, onRefresh);
  const shown = refreshing ? PULL_TRIGGER * 0.7 : pull;

  return (
    <section className={styles.page} aria-label={title} ref={ref}>
      {onRefresh && (
        <div
          className={styles.pull}
          style={{ height: shown, opacity: refreshing ? 1 : Math.min(1, pull / PULL_TRIGGER) }}
          data-armed={pull >= PULL_TRIGGER || undefined}
          aria-hidden="true"
        >
          <span className={styles.pullSpinner} data-spinning={refreshing || undefined} />
        </div>
      )}
      <div className={styles.inner}>
        <div className={styles.head}>
          <h1 className={styles.title}>{title}</h1>
          {action && <div className={styles.action}>{action}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function PageNote({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}
