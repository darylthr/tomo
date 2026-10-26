import { useEffect, useMemo, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FeedEntry } from '../../shared/model/types';
import { dayLabel, groupByDay, relativeTime } from '../../shared/time/days';
import { useNow } from '../../shared/time/useNow';
import { IconRefresh } from '../../shared/ui/icons';
import list from '../../shared/ui/List.module.css';
import { chapterLabel, rowThumb, Thumb } from '../../shared/ui/ListRow';
import { Page } from '../../shared/ui/Page';
import { openBook } from '../reader/opening';
import { collapseBatches, type UpdateItem } from './batches';
import styles from './UpdatesPage.module.css';
import { useUpdates } from './updatesStore';

/** Spec §10: new chapters for library titles, grouped by day. */
export function UpdatesPage() {
  const { status, entries, checking, load, check } = useUpdates();
  const navigate = useNavigate();
  const now = useNow();
  const items = useMemo(() => collapseBatches(entries), [entries]);

  useEffect(() => {
    void useUpdates.getState().load();
  }, []);

  const refresh = () => check({ force: true });

  return (
    <Page
      title="Updates"
      onRefresh={refresh}
      action={
        <button
          type="button"
          className={`${list.refreshButton} ${checking ? styles.spinning : ''}`}
          aria-label="Check for updates"
          onClick={() => void refresh()}
        >
          <IconRefresh />
        </button>
      }
    >
      {checking && (
        <div className={`${list.state} ${styles.checking}`} role="status">
          <span className={list.spinner} aria-hidden="true" />
          Checking sources for new chapters…
        </div>
      )}
      {status === 'error' && entries.length === 0 ? (
        <div className={`${list.state} ${list.stateError}`} role="alert">
          <span>Couldn't load updates</span>
          <button type="button" className={list.ghost} onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : status !== 'ready' && entries.length === 0 ? (
        <div className={list.group} aria-busy="true" aria-label="Loading updates">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${list.skeletonRow} ${styles.skeleton}`} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className={list.state}>No new chapters in the last 90 days.</div>
      ) : (
        <div className={list.enter}>
          {groupByDay(items, itemAt, now).map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className={list.groupLabel}>{group.label}</h2>
              <ul className={`${list.group} ${list.groupThumbs}`}>
                {group.items.map((item) =>
                  item.kind === 'batch' ? (
                    <BatchRow key={`batch-${item.title.id}-${item.at}`} batch={item} now={now} />
                  ) : (
                    <UpdateRow
                      key={item.entry.chapter.id}
                      entry={item.entry}
                      now={now}
                      onOpen={(ev) => openBook(navigate, item.entry.title, item.entry.chapter.id, rowThumb(ev))}
                    />
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className={list.note}>Checked when you open Tomo or pull to refresh. No background checks.</p>
    </Page>
  );
}

const itemAt = (item: UpdateItem) => (item.kind === 'chapter' ? item.entry.at : item.at);

function UpdateRow({ entry, now, onOpen }: { entry: FeedEntry; now: number; onOpen: (e: MouseEvent<HTMLButtonElement>) => void }) {
  const { chapter, title } = entry;
  const label = chapterLabel(chapter);
  const when = relativeTime(entry.at, now);
  // The label replaces the button's content for screen readers, so it carries the read state too.
  const spoken = `${title.title}, ${label}, ${chapter.read ? 'read' : 'unread'}, ${when}`;
  return (
    <li>
      <div className={`${list.feedRow} ${chapter.read ? list.dim : ''}`}>
        <Link to={`/title/${title.id}`} className={list.feedThumbLink} aria-label={`Open ${title.title}`}>
          <Thumb src={title.coverUrl} title={title.title} />
        </Link>
        <button type="button" className={list.feedMain} aria-label={spoken} onClick={onOpen}>
          <span className={list.rowText}>
            <span className={list.rowTitle}>{title.title}</span>
            <span className={`${list.rowSub} ${chapter.read ? list.rowSubRead : ''}`}>
              {chapter.read ? `${label} · Read` : label}
            </span>
          </span>
          <span className={list.feedSide}>
            <time dateTime={new Date(entry.at).toISOString()} title={dayLabel(entry.at, now)}>
              {when}
            </time>
            {!chapter.read && <span className={list.unreadDot} role="img" aria-label="Unread" />}
          </span>
        </button>
      </div>
    </li>
  );
}

/** A title's back catalogue fetched in one go: one row that opens the title rather than 100 chapter rows. */
function BatchRow({ batch, now }: { batch: Extract<UpdateItem, { kind: 'batch' }>; now: number }) {
  const { title, entries, at } = batch;
  const unread = entries.filter((e) => !e.chapter.read).length;
  const label = `${entries.length} chapters added`;
  const when = relativeTime(at, now);
  const spoken = `${title.title}, ${label}, ${unread > 0 ? `${unread} unread` : 'read'}, ${when}`;
  return (
    <li>
      <div className={`${list.feedRow} ${unread === 0 ? list.dim : ''}`}>
        <Link to={`/title/${title.id}`} className={list.feedThumbLink} tabIndex={-1} aria-hidden="true">
          <Thumb src={title.coverUrl} title={title.title} />
        </Link>
        <Link to={`/title/${title.id}`} className={list.feedMain} aria-label={spoken}>
          <span className={list.rowText}>
            <span className={list.rowTitle}>{title.title}</span>
            <span className={`${list.rowSub} ${unread === 0 ? list.rowSubRead : ''}`}>{label}</span>
          </span>
          <span className={list.feedSide}>
            <time dateTime={new Date(at).toISOString()} title={dayLabel(at, now)}>
              {when}
            </time>
            {unread > 0 && <span className={list.unreadDot} role="img" aria-label="Unread" />}
          </span>
        </Link>
      </div>
    </li>
  );
}
