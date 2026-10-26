import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FeedEntry } from '../../shared/model/types';
import { groupByDay } from '../../shared/time/days';
import { useNow } from '../../shared/time/useNow';
import { IconClose, IconPlay } from '../../shared/ui/icons';
import list from '../../shared/ui/List.module.css';
import { rowThumb, Thumb } from '../../shared/ui/ListRow';
import { Page } from '../../shared/ui/Page';
import { openBook } from '../reader/opening';
import { getHistory } from '../server/api';
import { HISTORY_STEP_MS, historyLine, latestPerTitle, resumeChapterId, visible } from './history';
import styles from './HistoryPage.module.css';
import { useHistoryHidden } from './historyHidden';

type Data = { status: 'loading' | 'ready' | 'error'; entries: FeedEntry[]; steps: number; exhausted: boolean };

const CONFIRM_MS = 4000;

/** Spec §10: what was read, grouped by day, from Suwayomi (so every device shows the same). */
export function HistoryPage() {
  const navigate = useNavigate();
  const now = useNow();
  const [origin] = useState(() => Date.now());
  const [data, setData] = useState<Data>({ status: 'loading', entries: [], steps: 1, exhausted: false });
  const generation = useRef(0);
  const hidden = useHistoryHidden();

  /** Fetches `steps` windows back from when the page opened; a newer request wins. */
  const load = useCallback(
    (steps: number): Promise<void> => {
      const gen = ++generation.current;
      return getHistory(origin - steps * HISTORY_STEP_MS).then(
        (entries) => {
          if (gen !== generation.current) return;
          setData((prev) => ({
            status: 'ready',
            entries,
            steps,
            // Going further back found no other titles: stop offering it.
            exhausted: steps > prev.steps && latestPerTitle(entries).length <= latestPerTitle(prev.entries).length,
          }));
        },
        () => {
          if (gen === generation.current) setData((prev) => ({ ...prev, status: 'error' }));
        },
      );
    },
    [origin],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const shown = visible(latestPerTitle(data.entries), hidden);

  const resume = async (entry: FeedEntry, thumb: HTMLElement | null) => {
    const chapterId = await resumeChapterId(entry);
    openBook(navigate, entry.title, chapterId, thumb);
  };

  return (
    <Page
      title="History"
      onRefresh={() => load(data.steps)}
      action={shown.length > 0 && <ClearAll onClear={() => hidden.clearAll(Date.now())} />}
    >
      {data.status === 'error' && data.entries.length === 0 ? (
        <div className={`${list.state} ${list.stateError}`} role="alert">
          <span>Couldn't load history</span>
          <button
            type="button"
            className={list.ghost}
            onClick={() => {
              setData((prev) => ({ ...prev, status: 'loading' }));
              void load(data.steps);
            }}
          >
            Retry
          </button>
        </div>
      ) : data.status === 'loading' && data.entries.length === 0 ? (
        <div className={list.group} aria-busy="true" aria-label="Loading history">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${list.skeletonRow} ${styles.skeleton}`} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className={list.state}>Chapters you read will show up here.</div>
      ) : (
        <div className={list.enter}>
          {groupByDay(shown, (e) => e.at, now).map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className={list.groupLabel}>{group.label}</h2>
              <ul className={`${list.group} ${list.groupThumbs}`}>
                {group.items.map((e) => (
                  <li key={e.title.id}>
                    <div className={list.feedRow}>
                      <Link to={`/title/${e.title.id}`} className={list.feedThumbLink} aria-label={`Open ${e.title.title}`}>
                        <Thumb src={e.title.coverUrl} title={e.title.title} />
                      </Link>
                      <button
                        type="button"
                        className={list.feedMain}
                        // Tapping the row resumes too; keyboard users get the labelled Resume button.
                        tabIndex={-1}
                        onClick={(ev) => void resume(e, rowThumb(ev))}
                      >
                        <span className={list.rowText}>
                          <span className={list.rowTitle}>{e.title.title}</span>
                          <HistoryLine entry={e} now={now} />
                        </span>
                      </button>
                      <span className={list.feedActions}>
                        <button
                          type="button"
                          className={list.iconButton}
                          aria-label={`Remove ${e.title.title} from history`}
                          onClick={() => hidden.hide(e.title.id, e.at)}
                        >
                          <IconClose />
                        </button>
                        <button
                          type="button"
                          className={list.roundButton}
                          aria-label={`Resume ${e.title.title}`}
                          onClick={(ev) => void resume(e, rowThumb(ev))}
                        >
                          <IconPlay />
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {data.status !== 'error' && !data.exhausted && (data.status === 'ready' || data.entries.length > 0) && (
        <div className={styles.more}>
          <button type="button" className={list.ghost} onClick={() => void load(data.steps + 1)}>
            Show older
          </button>
        </div>
      )}
    </Page>
  );
}

function HistoryLine({ entry, now }: { entry: FeedEntry; now: number }) {
  const [where, when] = historyLine(entry, now);
  return (
    <span className={`${list.rowSub} ${styles.line}`}>
      <span className={styles.where}>{where}</span>
      <span className={styles.when}>&nbsp;· {when}</span>
    </span>
  );
}

/** Two taps: "Clear all", then "Clear history?" within a few seconds. */
function ClearAll({ onClear }: { onClear: () => void }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(id);
  }, [confirming]);

  return (
    <button
      type="button"
      className={`${list.ghost} ${confirming ? styles.danger : ''}`}
      onClick={() => {
        if (!confirming) return setConfirming(true);
        setConfirming(false);
        onClear();
      }}
    >
      {confirming ? 'Clear history?' : 'Clear all'}
    </button>
  );
}
