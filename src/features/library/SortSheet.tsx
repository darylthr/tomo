import { Segmented } from '../../shared/ui/Segmented';
import { Sheet } from '../../shared/ui/Sheet';
import { naturalDescending, needsInfo, SORTS, type LibrarySort } from './librarySort';
import styles from './SortSheet.module.css';

type Props = {
  open: boolean;
  sortBy: LibrarySort;
  descending: boolean;
  /** The server can't give the dates this sort needs. */
  unsupported: boolean;
  onChange: (sortBy: LibrarySort, descending: boolean) => void;
  onClose: () => void;
};

/** How the shelf is ordered: one sort, and which way it runs. */
export function SortSheet({ open, sortBy, descending, unsupported, onChange, onClose }: Props) {
  const current = SORTS.find((s) => s.value === sortBy) ?? SORTS[0]!;
  const [descLabel, ascLabel] = current.directions;
  return (
    <Sheet open={open} label="Sort library" title="Sort" onClose={onClose} closeLabel="Close sort">
      <div className={styles.options} role="radiogroup" aria-label="Sort by">
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={s.value === sortBy}
            className={styles.option}
            onClick={() => s.value !== sortBy && onChange(s.value, naturalDescending(s.value))}
          >
            <span className={styles.mark} aria-hidden="true" />
            {s.label}
          </button>
        ))}
      </div>
      {unsupported && needsInfo(sortBy) && <p className={styles.note}>Your Suwayomi version can't sort by this. Showing titles A–Z.</p>}
      <div className={styles.direction}>
        <span className={styles.label}>Order</span>
        <Segmented
          label="Order"
          value={descending ? 'desc' : 'asc'}
          onChange={(v) => onChange(sortBy, v === 'desc')}
          options={
            sortBy === 'title'
              ? [
                  { value: 'asc', label: ascLabel },
                  { value: 'desc', label: descLabel },
                ]
              : [
                  { value: 'desc', label: descLabel },
                  { value: 'asc', label: ascLabel },
                ]
          }
        />
      </div>
    </Sheet>
  );
}
