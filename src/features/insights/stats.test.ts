import { chaptersByDay, dayKey, heatLevel, streaks, weekStart, weeklyTotals } from './stats';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const TODAY = at(2026, 10, 29); // a Thursday

it('keys days by local date', () => {
  expect(dayKey(at(2026, 10, 5, 0))).toBe('2026-10-05');
  expect(dayKey(at(2026, 10, 5, 23))).toBe('2026-10-05');
});

it('counts chapters per day', () => {
  const days = chaptersByDay([at(2026, 10, 28, 9), at(2026, 10, 28, 22), at(2026, 10, 27)]);
  expect(days.get('2026-10-28')).toBe(2);
  expect(days.get('2026-10-27')).toBe(1);
});

it('starts weeks on Monday', () => {
  expect(dayKey(weekStart(TODAY))).toBe('2026-10-26');
  expect(dayKey(weekStart(at(2026, 10, 26)))).toBe('2026-10-26');
  expect(dayKey(weekStart(at(2026, 11, 1)))).toBe('2026-10-26');
});

describe('streaks', () => {
  const days = (keys: string[]) => new Map(keys.map((k) => [k, 1]));

  it('counts the run of days up to today', () => {
    expect(streaks(days(['2026-10-27', '2026-10-28', '2026-10-29']), TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it('keeps the streak alive until today is over', () => {
    expect(streaks(days(['2026-10-27', '2026-10-28']), TODAY).current).toBe(2);
  });

  it('ends a streak after a missed day, and remembers the longest', () => {
    const d = days(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-27']);
    expect(streaks(d, TODAY)).toEqual({ current: 0, longest: 4 });
  });
});

it('totals each of the last weeks, oldest first, this week last', () => {
  const days = new Map([
    ['2026-10-26', 3],
    ['2026-10-29', 2],
    ['2026-10-25', 4],
    ['2026-10-19', 1],
  ]);
  const weeks = weeklyTotals(days, TODAY, 3);
  expect(weeks.map((w) => [dayKey(w.start), w.count])).toEqual([
    ['2026-10-12', 0],
    ['2026-10-19', 5],
    ['2026-10-26', 5],
  ]);
});

it('shades days in five steps', () => {
  expect([0, 1, 2, 3, 5, 8, 20].map(heatLevel)).toEqual([0, 1, 1, 2, 3, 4, 4]);
});
