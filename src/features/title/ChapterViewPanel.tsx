import { Segmented } from '../../shared/ui/Segmented';
import { Switch } from '../../shared/ui/Switch';
import { DEFAULT_VIEW, isDefaultView, type ChapterView } from './chapterList';
import styles from './TitlePage.module.css';

type Props = {
  id: string;
  view: ChapterView;
  onChange: (view: ChapterView) => void;
  closing: boolean;
};

const SORTS = [
  { value: 'chapter', label: 'Chapter' },
  { value: 'uploaded', label: 'Upload date' },
] as const;

const ORDERS = [
  { value: 'desc', label: 'Newest first' },
  { value: 'asc', label: 'Oldest first' },
] as const;

/** Sort and filter controls for a title's chapter list. */
export function ChapterViewPanel({ id, view, onChange, closing }: Props) {
  const set = (patch: Partial<ChapterView>) => onChange({ ...view, ...patch });
  const toggles = [
    { key: 'unreadOnly', label: 'Unread only' },
    { key: 'bookmarkedOnly', label: 'Bookmarked only' },
    { key: 'dedupe', label: 'Hide duplicates' },
  ] as const;
  return (
    <div id={id} className={`${styles.viewPanel} ${closing ? styles.viewPanelClosing : ''}`}>
      <div className={styles.viewStack}>
        <span className={styles.viewLabel}>Sort by</span>
        <Segmented label="Sort by" options={[...SORTS]} value={view.sort} onChange={(sort) => set({ sort })} />
      </div>
      <div className={styles.viewStack}>
        <span className={styles.viewLabel}>Order</span>
        <Segmented
          label="Order"
          options={[...ORDERS]}
          value={view.descending ? 'desc' : 'asc'}
          onChange={(o) => set({ descending: o === 'desc' })}
        />
      </div>
      {toggles.map((t) => (
        <div key={t.key} className={styles.viewRow}>
          <span>{t.label}</span>
          <Switch label={t.label} checked={view[t.key]} onChange={(on) => set({ [t.key]: on })} />
        </div>
      ))}
      {!isDefaultView(view) && (
        <button type="button" className={styles.viewReset} onClick={() => onChange(DEFAULT_VIEW)}>
          Reset
        </button>
      )}
    </div>
  );
}
