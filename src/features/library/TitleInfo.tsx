import type { Title, TitleStatus } from '../../shared/model/types';
import styles from './TitleInfo.module.css';
import { TitleName } from '../../shared/ui/TitleName';

const STATUS_LABEL: Record<TitleStatus, string> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  hiatus: 'Hiatus',
  cancelled: 'Cancelled',
  unknown: 'Unknown status',
};

type Props = { title: Title; onContinue: () => void; onChapters: () => void };

/** The centred book's name, status line, reading progress and Continue button (spec §6.3). */
export function TitleInfo({ title, onContinue, onChapters }: Props) {
  const total = title.chapterCount;
  const read = Math.max(0, total - title.unread);
  const notStarted = total > 0 && read === 0;
  const caughtUp = total > 0 && title.unread === 0;
  // A novel has one text, not chapters: progress is a percentage of it.
  const novel = title.kind === 'novel';
  const action = notStarted ? 'Start reading' : caughtUp ? 'Read again' : novel ? `Continue · ${read}%` : total ? `Continue · Ch. ${read + 1}` : 'Open';

  return (
    <section className={styles.info} aria-label="Selected title">
      <div className={styles.head}>
        <h2 className={styles.name}>
          <TitleName title={title} />
        </h2>
        <p className={styles.meta}>
          {novel ? (
            title.author && <span>{title.author}</span>
          ) : (
            <span className={`${styles.status} ${styles[title.status]}`}>
              <i aria-hidden="true" />
              {STATUS_LABEL[title.status]}
            </span>
          )}
          {title.sourceName && <span>{title.sourceName}</span>}
        </p>
      </div>
      {total > 0 && (
        <div className={styles.progress}>
          <div className={styles.progressText}>
            <span>{novel ? (notStarted ? 'Not started' : caughtUp ? 'Finished' : `${read}% read`) : notStarted || caughtUp ? `${total} chapters` : `Chapter ${read} of ${total}`}</span>
            <b>{novel ? (notStarted || caughtUp ? '' : `${title.unread}% left`) : notStarted ? 'Not started' : caughtUp ? 'Caught up' : `${title.unread} left`}</b>
          </div>
          <div className={styles.bar} aria-hidden="true">
            <i style={{ transform: `scaleX(${total ? read / total : 0})` }} />
          </div>
        </div>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onContinue}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
          </svg>
          {action}
        </button>
        {!novel && (
          <button type="button" className={styles.secondary} aria-label="Chapters" onClick={onChapters}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
              <path d="M9 6h11M9 12h11M9 18h11" />
              <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth={2.6} />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
