import type { SortValue, SourceFilter, TriState } from '../../shared/model/types';
import type { FilterChange } from '../server/api';

/** The value of one filter; groups hold their children's values. Headers and separators are null. */
export type FilterValue = boolean | TriState | number | string | SortValue | null | FilterValue[];

/** Values parallel to a source's filter list. */
export type FilterState = FilterValue[];

export function defaultFilterState(filters: SourceFilter[]): FilterState {
  return filters.map((f) => {
    switch (f.type) {
      case 'header':
      case 'separator':
        return null;
      case 'group':
        return defaultFilterState(f.filters);
      default:
        return f.default;
    }
  });
}

/** Returns a copy of `state` with the value at `path` (indexes through groups) replaced. */
export function setFilterValue(state: FilterState, path: number[], value: FilterValue): FilterState {
  const [index, ...rest] = path;
  if (index === undefined) return state;
  const next = [...state];
  next[index] = rest.length ? setFilterValue((state[index] as FilterState) ?? [], rest, value) : value;
  return next;
}

const TRI = { ignore: 'IGNORE', include: 'INCLUDE', exclude: 'EXCLUDE' } as const;

function change(filter: SourceFilter, value: FilterValue, position: number): FilterChange[] {
  switch (filter.type) {
    case 'checkbox':
      return value !== filter.default ? [{ position, checkBoxState: value as boolean }] : [];
    case 'tristate':
      return value !== filter.default ? [{ position, triState: TRI[value as TriState] }] : [];
    case 'select':
      return value !== filter.default ? [{ position, selectState: value as number }] : [];
    case 'text': {
      const text = (value as string).trim();
      return text !== filter.default.trim() ? [{ position, textState: text }] : [];
    }
    case 'sort': {
      const sort = value as SortValue | null;
      const same = sort?.index === filter.default?.index && sort?.ascending === filter.default?.ascending;
      return sort && !same ? [{ position, sortState: sort }] : [];
    }
    case 'group':
      return filterChanges(filter.filters, value as FilterState).map((groupChange) => ({ position, groupChange }));
    default:
      return [];
  }
}

/** Suwayomi's filter input: only the filters that differ from their defaults. */
export function filterChanges(filters: SourceFilter[], state: FilterState): FilterChange[] {
  return filters.flatMap((f, i) => change(f, state[i] ?? null, i));
}
