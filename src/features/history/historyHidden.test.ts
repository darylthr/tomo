import { useHistoryHidden } from './historyHidden';

beforeEach(() => useHistoryHidden.setState({ clearedAt: 0, titles: {} }));

it('remembers removed titles on this device', () => {
  useHistoryHidden.getState().hide(4, 200);
  expect(useHistoryHidden.getState().titles).toEqual({ 4: 200 });
  expect(JSON.parse(localStorage.getItem('tomo-history-hidden')!).state.titles).toEqual({ 4: 200 });
});

it('clears everything up to now', () => {
  useHistoryHidden.getState().hide(4, 200);
  useHistoryHidden.getState().clearAll(1000);
  expect(useHistoryHidden.getState()).toMatchObject({ clearedAt: 1000, titles: {} });
});
