import { useState } from 'react';
import type { SortValue, SourceFilter, TriState } from '../../shared/model/types';
import { Switch } from '../../shared/ui/Switch';
import { Sheet } from '../../shared/ui/Sheet';
import sheet from '../../shared/ui/Sheet.module.css';
import { defaultFilterState, filterChanges, setFilterValue, type FilterState, type FilterValue } from './filters';
import styles from './FilterSheet.module.css';

type Props = {
  open: boolean;
  sourceName: string;
  /** null while the source's filter list loads. */
  filters: SourceFilter[] | null;
  error: string | null;
  applied: FilterState | null;
  onApply: (state: FilterState) => void;
  onRetry: () => void;
  onClose: () => void;
};

/** A source's filter list: a bottom sheet on phones, a side panel on wide screens. */
export function FilterSheet({ open, sourceName, filters, error, applied, onApply, onRetry, onClose }: Props) {
  // Edits since opening; null shows what's applied.
  const [edits, setEdits] = useState<FilterState | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setEdits(null);
  }
  const draft = edits ?? applied ?? (filters ? defaultFilterState(filters) : []);

  const set = (path: number[], value: FilterValue) => setEdits(setFilterValue(draft, path, value));
  const changed = filters ? filterChanges(filters, draft).length : 0;

  return (
    <Sheet
      open={open}
      label={`Filters for ${sourceName}`}
      title="Filters"
      closeLabel="Close filters"
      onClose={onClose}
      action={
        <button
          type="button"
          className={sheet.ghost}
          disabled={!filters || !changed}
          onClick={() => filters && setEdits(defaultFilterState(filters))}
        >
          Reset
        </button>
      }
      footer={
        <button type="button" className={sheet.apply} disabled={!filters} onClick={() => onApply(draft)}>
          {changed ? `Apply ${changed} ${changed === 1 ? 'filter' : 'filters'}` : 'Show all'}
        </button>
      }
    >
      {error ? (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button type="button" className={sheet.ghost} onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : !filters ? (
        <p className={styles.empty} aria-busy="true">
          Loading filters…
        </p>
      ) : filters.length === 0 ? (
        <p className={styles.empty}>{sourceName} has no filters.</p>
      ) : (
        <FilterList filters={filters} state={draft} path={[]} onChange={set} />
      )}
    </Sheet>
  );
}

type ListProps = {
  filters: SourceFilter[];
  state: FilterState;
  path: number[];
  onChange: (path: number[], value: FilterValue) => void;
};

function FilterList({ filters, state, path, onChange }: ListProps) {
  return (
    <div className={styles.list}>
      {filters.map((f, i) => (
        <FilterControl key={i} filter={f} value={state[i] ?? null} path={[...path, i]} onChange={onChange} />
      ))}
    </div>
  );
}

const TRI_NEXT: Record<TriState, TriState> = { ignore: 'include', include: 'exclude', exclude: 'ignore' };
const TRI_LABEL: Record<TriState, string> = { ignore: 'any', include: 'included', exclude: 'excluded' };

function FilterControl({
  filter,
  value,
  path,
  onChange,
}: {
  filter: SourceFilter;
  value: FilterValue;
  path: number[];
  onChange: ListProps['onChange'];
}) {
  const id = `filter-${path.join('-')}`;
  switch (filter.type) {
    case 'header':
      return filter.name ? <p className={styles.header}>{filter.name}</p> : null;
    case 'separator':
      return <hr className={styles.separator} />;
    case 'checkbox':
      return (
        <div className={styles.row}>
          <span className={styles.label}>{filter.name}</span>
          <Switch label={filter.name} checked={value === true} onChange={(v) => onChange(path, v)} />
        </div>
      );
    case 'tristate': {
      const tri = (value as TriState) ?? 'ignore';
      return (
        <button
          type="button"
          className={styles.chip}
          data-state={tri}
          aria-label={`${filter.name}: ${TRI_LABEL[tri]}`}
          onClick={() => onChange(path, TRI_NEXT[tri])}
        >
          <span className={styles.chipMark} aria-hidden="true">
            {tri === 'include' ? '✓' : tri === 'exclude' ? '✕' : ''}
          </span>
          {filter.name}
        </button>
      );
    }
    case 'select':
      return (
        <div className={styles.row}>
          <label className={styles.label} htmlFor={id}>
            {filter.name}
          </label>
          <select id={id} className={styles.select} value={value as number} onChange={(e) => onChange(path, Number(e.target.value))}>
            {filter.values.map((v, i) => (
              <option key={i} value={i}>
                {v}
              </option>
            ))}
          </select>
        </div>
      );
    case 'text':
      return (
        <div className={styles.row}>
          <label className={styles.label} htmlFor={id}>
            {filter.name}
          </label>
          <input
            id={id}
            className={styles.field}
            type="text"
            autoComplete="off"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(path, e.target.value)}
          />
        </div>
      );
    case 'sort': {
      const sort = (value as SortValue | null) ?? { index: 0, ascending: true };
      return (
        <div className={styles.row}>
          <label className={styles.label} htmlFor={id}>
            {filter.name}
          </label>
          <span className={styles.sort}>
            <select
              id={id}
              className={styles.select}
              value={sort.index}
              onChange={(e) => onChange(path, { ...sort, index: Number(e.target.value) })}
            >
              {filter.values.map((v, i) => (
                <option key={i} value={i}>
                  {v}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.direction}
              aria-label={sort.ascending ? 'Ascending' : 'Descending'}
              onClick={() => onChange(path, { ...sort, ascending: !sort.ascending })}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-up={sort.ascending}>
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
            </button>
          </span>
        </div>
      );
    }
    case 'group': {
      const children = (value as FilterState) ?? [];
      const active = filterChanges(filter.filters, children).length;
      const chips = filter.filters.every((f) => f.type === 'tristate' || f.type === 'checkbox');
      return (
        <details className={styles.group}>
          <summary className={styles.summary}>
            <span>{filter.name}</span>
            {active > 0 && <span className={styles.count}>{active}</span>}
          </summary>
          {chips ? (
            <div className={styles.chips}>
              {filter.filters.map((f, i) =>
                f.type === 'checkbox' ? (
                  <button
                    key={i}
                    type="button"
                    className={styles.chip}
                    data-state={children[i] ? 'include' : 'ignore'}
                    aria-pressed={children[i] === true}
                    onClick={() => onChange([...path, i], !children[i])}
                  >
                    <span className={styles.chipMark} aria-hidden="true">
                      {children[i] ? '✓' : ''}
                    </span>
                    {f.name}
                  </button>
                ) : (
                  <FilterControl key={i} filter={f} value={children[i] ?? null} path={[...path, i]} onChange={onChange} />
                ),
              )}
            </div>
          ) : (
            <FilterList filters={filter.filters} state={children} path={path} onChange={onChange} />
          )}
        </details>
      );
    }
  }
}
