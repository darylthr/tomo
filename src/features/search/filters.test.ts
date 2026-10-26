import type { SourceFilter } from '../../shared/model/types';
import { defaultFilterState, filterChanges, setFilterValue } from './filters';

const filters: SourceFilter[] = [
  { type: 'header', name: 'Note' },
  { type: 'checkbox', name: 'Has chapters', default: false },
  { type: 'select', name: 'Language', values: ['All', 'Japanese'], default: 0 },
  { type: 'sort', name: 'Sort', values: ['Relevance', 'Rating'], default: { index: 0, ascending: false } },
  { type: 'separator', name: '' },
  { type: 'text', name: 'Author', default: '' },
  {
    type: 'group',
    name: 'Tags',
    filters: [
      { type: 'tristate', name: 'Action', default: 'ignore' },
      { type: 'tristate', name: 'Romance', default: 'ignore' },
    ],
  },
];

it('starts from each filter default', () => {
  expect(defaultFilterState(filters)).toEqual([null, false, 0, { index: 0, ascending: false }, null, '', ['ignore', 'ignore']]);
});

it('sends nothing while every filter is at its default', () => {
  expect(filterChanges(filters, defaultFilterState(filters))).toEqual([]);
});

it('sends only changed filters, by position', () => {
  let state = defaultFilterState(filters);
  state = setFilterValue(state, [1], true);
  state = setFilterValue(state, [2], 1);
  state = setFilterValue(state, [3], { index: 1, ascending: true });
  state = setFilterValue(state, [5], 'Oda');
  expect(filterChanges(filters, state)).toEqual([
    { position: 1, checkBoxState: true },
    { position: 2, selectState: 1 },
    { position: 3, sortState: { index: 1, ascending: true } },
    { position: 5, textState: 'Oda' },
  ]);
});

it('nests group children under the group position', () => {
  let state = defaultFilterState(filters);
  state = setFilterValue(state, [6, 1], 'include');
  state = setFilterValue(state, [6, 0], 'exclude');
  expect(filterChanges(filters, state)).toEqual([
    { position: 6, groupChange: { position: 0, triState: 'EXCLUDE' } },
    { position: 6, groupChange: { position: 1, triState: 'INCLUDE' } },
  ]);
});

it('does not change the state it was given', () => {
  const state = defaultFilterState(filters);
  setFilterValue(state, [6, 0], 'include');
  expect(state[6]).toEqual(['ignore', 'ignore']);
});

it('treats a text filter with only spaces as unchanged', () => {
  const state = setFilterValue(defaultFilterState(filters), [5], '   ');
  expect(filterChanges(filters, state)).toEqual([]);
});
