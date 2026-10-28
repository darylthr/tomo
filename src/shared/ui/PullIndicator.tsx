import { PULL_TRIGGER } from './usePullToRefresh';
import styles from './PullIndicator.module.css';

/** A spinner that follows the finger from the top edge while pulling to refresh, then holds while refreshing. */
export function PullIndicator({ pull, refreshing, top = 0 }: { pull: number; refreshing: boolean; top?: number }) {
  const shown = refreshing ? PULL_TRIGGER * 0.7 : pull;
  return (
    <div
      className={styles.indicator}
      style={{ top, translate: `-50% ${shown - 28}px`, opacity: refreshing ? 1 : Math.min(1, pull / PULL_TRIGGER) }}
      data-armed={pull >= PULL_TRIGGER || undefined}
      aria-hidden="true"
    >
      <span className={styles.spinner} data-spinning={refreshing || undefined} />
    </div>
  );
}
