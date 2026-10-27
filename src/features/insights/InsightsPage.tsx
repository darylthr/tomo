import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNow } from '../../shared/time/useNow';
import list from '../../shared/ui/List.module.css';
import { Page } from '../../shared/ui/Page';
import { useInsights } from './insightsStore';
import styles from './InsightsPage.module.css';
import { addDays, dayKey, heatLevel, weekStart } from './stats';
import { formatDuration, summarize, type Summary } from './summary';

const WEEKS = 53;
const longDay = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const shortDay = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const monthName = new Intl.DateTimeFormat(undefined, { month: 'short' });
const weekOf = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const chapters = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'chapter' : 'chapters'}`;

/** Reading Insights: chapters per day and week, time spent, and streaks. */
export function InsightsPage() {
  const navigate = useNavigate();
  const { status, reads, seconds, load } = useInsights();
  useEffect(() => {
    void useInsights.getState().load();
  }, []);
  const now = useNow();
  const summary = useMemo(() => summarize(reads, seconds, now), [reads, seconds, now]);

  return (
    <Page title="Insights" onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/history'))}>
      {status === 'error' ? (
        <div className={`${list.state} ${list.stateError}`} role="alert">
          <span>Couldn't load your reading history</span>
          <button type="button" className={list.ghost} onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : status !== 'ready' ? (
        <div className={styles.skeleton} aria-busy="true" aria-label="Loading insights" />
      ) : (
        <div className={list.enter}>
          <Tiles summary={summary} />
          <Heatmap summary={summary} seconds={seconds} now={now} />
          <WeekBars summary={summary} />
          <p className={list.note}>
            Chapters count on the day you finish them, from every device. Time spent counts while a chapter is open and you're
            reading, pausing after 2 minutes without a page turn.
          </p>
        </div>
      )}
    </Page>
  );
}

function Tiles({ summary: s }: { summary: Summary }) {
  const diff = s.weekChapters - s.lastWeekChapters;
  const tiles = [
    {
      key: 'This week',
      value: s.weekChapters.toLocaleString(),
      detail: diff === 0 ? 'same as last week' : `${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than last week`,
    },
    { key: 'Time spent', value: formatDuration(s.weekSeconds), detail: `this week · ${formatDuration(s.yearSeconds)} this year` },
    {
      key: 'Streak',
      value: `${s.streak.current} ${s.streak.current === 1 ? 'day' : 'days'}`,
      detail: `longest: ${s.streak.longest} ${s.streak.longest === 1 ? 'day' : 'days'}`,
    },
    {
      key: 'This year',
      value: s.yearChapters.toLocaleString(),
      detail: `chapters · ${s.yearTitles} ${s.yearTitles === 1 ? 'title' : 'titles'}`,
    },
  ];
  return (
    <ul className={styles.tiles} aria-label="Reading at a glance">
      {tiles.map((t) => (
        <li key={t.key} className={styles.tile}>
          <span className={styles.tileKey}>{t.key}</span>
          <span className={styles.tileValue}>{t.value}</span>
          <span className={styles.tileDetail}>{t.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function Heatmap({ summary, seconds, now }: { summary: Summary; seconds: Map<string, number>; now: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const today = dayKey(now);
  const first = addDays(weekStart(now), -7 * (WEEKS - 1));
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState(today);

  // The newest weeks are on the right; start scrolled there.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const ts = addDays(first, w * 7 + d);
      return { ts, key: dayKey(ts) };
    }),
  );
  const describe = (key: string) => {
    const n = summary.days.get(key) ?? 0;
    const s = seconds.get(key) ?? 0;
    return { n, time: s > 0 ? formatDuration(s) : null };
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, ts: number) => {
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = addDays(ts, step);
    if (next < first || dayKey(next) > today) return;
    const key = dayKey(next);
    setFocused(key);
    scroller.current?.querySelector<HTMLButtonElement>(`[data-day="${key}"]`)?.focus();
  };

  const pick = selected ? describe(selected) : null;
  const [y, m, d] = (selected ?? today).split('-').map(Number) as [number, number, number];
  const pickedDate = new Date(y, m - 1, d);

  return (
    <section className={styles.card} aria-label="Chapters per day">
      <h2 className={styles.cardHead}>
        Chapters per day <span>Last 12 months</span>
      </h2>
      <div ref={scroller} className={styles.heatScroll}>
        <div className={styles.months} aria-hidden="true">
          {weeks.map((week, w) => {
            const firstOfMonth = week.find(({ ts }) => new Date(ts).getDate() === 1);
            return (
              <span key={w} className={styles.month}>
                {firstOfMonth || w === 0 ? monthName.format(firstOfMonth?.ts ?? week[0]!.ts) : ''}
              </span>
            );
          })}
        </div>
        <div className={styles.heat} role="group" aria-label="Days, oldest first">
          {weeks.map((week, w) => (
            <div key={w} className={styles.week}>
              {week.map(({ ts, key }) => {
                if (key > today) return <span key={key} className={styles.future} />;
                const { n, time } = describe(key);
                return (
                  <button
                    key={key}
                    type="button"
                    data-day={key}
                    data-level={heatLevel(n)}
                    className={`${styles.day} ${selected === key ? styles.picked : ''}`}
                    tabIndex={key === focused ? 0 : -1}
                    aria-label={`${longDay.format(ts)}: ${chapters(n)}${time ? `, ${time}` : ''}`}
                    aria-pressed={selected === key}
                    onClick={() => {
                      setSelected((s) => (s === key ? null : key));
                      setFocused(key);
                    }}
                    onKeyDown={(e) => onKeyDown(e, ts)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.heatFoot}>
        <p className={styles.pickedText} role="status">
          {pick ? `${shortDay.format(pickedDate)} · ${chapters(pick.n)}${pick.time ? ` · ${pick.time}` : ''}` : 'Tap a day to see it.'}
        </p>
        <span className={styles.legend} aria-hidden="true">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} data-level={l} className={styles.legendCell} />
          ))}
          More
        </span>
      </div>
    </section>
  );
}

function WeekBars({ summary }: { summary: Summary }) {
  const max = Math.max(1, ...summary.weeks.map((w) => w.count));
  const last = summary.weeks.length - 1;
  const peak = summary.weeks.findIndex((w) => w.count === max);
  return (
    <section className={styles.card} aria-label="Chapters per week">
      <h2 className={styles.cardHead}>
        Chapters per week <span>Last 12 weeks</span>
      </h2>
      <div className={styles.bars} aria-hidden="true">
        {summary.weeks.map((w, i) => (
          <div key={w.start} className={styles.barSlot} title={`Week of ${weekOf.format(w.start)}: ${chapters(w.count)}`}>
            {(i === last || i === peak) && w.count > 0 && (
              <span className={styles.barLabel} style={{ bottom: `calc(${(w.count / max) * 100}% + 3px)` }}>
                {w.count}
              </span>
            )}
            <span className={`${styles.bar} ${i === last ? styles.barNow : ''}`} style={{ height: `${(w.count / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className={styles.axis} aria-hidden="true">
        <span>{weekOf.format(summary.weeks[0]!.start)}</span>
        <span>This week</span>
      </div>
      <table className="sr-only" aria-label="Chapters per week">
        <thead>
          <tr>
            <th>Week of</th>
            <th>Chapters</th>
          </tr>
        </thead>
        <tbody>
          {summary.weeks.map((w) => (
            <tr key={w.start}>
              <td>{weekOf.format(w.start)}</td>
              <td>{w.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
