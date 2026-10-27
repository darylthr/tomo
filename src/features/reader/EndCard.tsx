import type { Chapter } from '../../shared/model/types';
import styles from './EndCard.module.css';

type Props = {
  current: Chapter;
  next: Chapter | null;
  onNext: () => void;
  onBack: () => void;
  onLibrary: () => void;
  /** At the foot of a webtoon strip rather than over the page. */
  inline?: boolean;
};

const label = (c: Chapter) => (c.number >= 0 ? `Ch. ${c.number}` : c.name || 'Chapter');

/** The part of a chapter's name after a leading "Chapter 3:" or "Ch. 3 -", if any. */
function titleOf(c: Chapter): string {
  const rest = (c.name ?? '').replace(/^\s*(chapter|ch\.?)\s*[\d.]+\s*[:\-–—.]?\s*/i, '').trim();
  return rest;
}

/** Past a chapter's last page: what was finished, what comes next, and a way on. */
export function EndCard({ current, next, onNext, onBack, onLibrary, inline = false }: Props) {
  const nextTitle = next && next.number >= 0 ? titleOf(next) : '';
  const nextName = nextTitle ? `: ${nextTitle}` : '';
  const missing = next && next.number >= 0 && current.number >= 0 ? Math.ceil(next.number - current.number) - 1 : 0;
  // Only when both groups are known: an unknown group isn't a change of group.
  const otherGroup = next?.scanlator && current.scanlator && next.scanlator !== current.scanlator ? next.scanlator : null;
  return (
    <div className={`${styles.card} ${inline ? styles.inline : ''}`} role="status">
      <p className={styles.finished}>Finished · {label(current)}</p>
      {next ? (
        <>
          <p className={styles.next}>
            Next · {label(next)}
            {nextName}
          </p>
          {otherGroup && <p className={styles.note}>Different group: {otherGroup}</p>}
          {missing > 0 && <p className={styles.note}>{missing === 1 ? '1 chapter missing' : `${missing} chapters missing`}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={onNext}>
              Next chapter
            </button>
            {!inline && (
              <button type="button" className={styles.secondary} onClick={onBack}>
                Back to last page
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className={styles.next}>You're all caught up</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={onLibrary}>
              Back to library
            </button>
          </div>
        </>
      )}
    </div>
  );
}
