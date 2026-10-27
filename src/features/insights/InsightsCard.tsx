import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useNow } from '../../shared/time/useNow';
import { IconChevron } from '../../shared/ui/icons';
import { useInsights } from './insightsStore';
import styles from './InsightsPage.module.css';
import { addDays, dayKey, heatLevel, weekStart } from './stats';
import { formatDuration, summarize } from './summary';

/** History's summary of this week, opening Insights. */
export function InsightsCard() {
  const { status, reads, seconds } = useInsights();
  const now = useNow();
  useEffect(() => {
    void useInsights.getState().load();
  }, []);
  const s = useMemo(() => summarize(reads, seconds, now), [reads, seconds, now]);
  if (status !== 'ready') return null;

  const monday = weekStart(now);
  const today = dayKey(now);
  const streak = s.streak.current;
  const sub = [formatDuration(s.weekSeconds), streak > 0 && `${streak}-day streak`].filter(Boolean).join(' · ');
  return (
    <Link to="/insights" className={styles.summary}>
      <span className={styles.mini} aria-hidden="true">
        {Array.from({ length: 7 }, (_, d) => {
          const key = dayKey(addDays(monday, d));
          return key > today ? <i key={key} data-future="" /> : <i key={key} data-level={heatLevel(s.days.get(key) ?? 0)} />;
        })}
      </span>
      <span className={styles.summaryText}>
        <span className={styles.summaryTitle}>
          {s.weekChapters.toLocaleString()} {s.weekChapters === 1 ? 'chapter' : 'chapters'} this week
        </span>
        <span className={styles.summarySub}>{sub}</span>
      </span>
      <IconChevron className={styles.chevron} />
    </Link>
  );
}
