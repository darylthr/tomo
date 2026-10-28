import { IconClose, IconTrash } from '../../shared/ui/icons';
import bar from './CategoryBar.module.css';
import styles from './SelectionBar.module.css';

type Props = {
  count: number;
  total: number;
  onCancel: () => void;
  onToggleAll: () => void;
  onRemove: () => void;
};

/** Replaces the category bar while choosing several titles: cancel, how many, select all, remove. */
export function SelectionBar({ count, total, onCancel, onToggleAll, onRemove }: Props) {
  return (
    <nav className={bar.bar} aria-label="Selection">
      <button type="button" className={bar.action} aria-label="Cancel selection" onClick={onCancel}>
        <IconClose />
      </button>
      <span className={styles.count} role="status">
        {count === 0 ? 'Select titles' : `${count} selected`}
      </span>
      <button type="button" className={styles.text} onClick={onToggleAll}>
        {count === total && total > 0 ? 'None' : 'All'}
      </button>
      <button type="button" className={`${bar.action} ${styles.danger}`} aria-label="Remove selected from library" disabled={count === 0} onClick={onRemove}>
        <IconTrash />
      </button>
    </nav>
  );
}
