import { clockTime, dayLabel, groupByDay, relativeTime } from './days';

const now = new Date(2026, 9, 26, 12, 0).getTime();
const at = (...args: [number, number, number, number?, number?]) => new Date(...args).getTime();

it('labels days in local time', () => {
  expect(dayLabel(at(2026, 9, 26, 0, 1), now)).toBe('Today');
  expect(dayLabel(at(2026, 9, 25, 23, 59), now)).toBe('Yesterday');
  expect(dayLabel(at(2026, 9, 20, 9), now)).toBe('Tuesday, Oct 20');
  expect(dayLabel(at(2025, 11, 31), now)).toBe('Wednesday, Dec 31, 2025');
});

it('gives a short relative time', () => {
  expect(relativeTime(now - 30_000, now)).toBe('now');
  expect(relativeTime(now - 5 * 60_000, now)).toBe('5m');
  expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3h');
  expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2d');
  expect(relativeTime(now - 9 * 86_400_000, now)).toBe('Oct 17');
});

it('gives a clock time', () => {
  expect(clockTime(at(2026, 9, 26, 14, 5))).toMatch(/^(14:05|2:05\s?PM)$/);
});

it('groups items by day, keeping their order', () => {
  const items = [at(2026, 9, 26, 10), at(2026, 9, 26, 8), at(2026, 9, 25, 22), at(2026, 9, 25, 7)];
  expect(groupByDay(items, (t) => t, now)).toEqual([
    { label: 'Today', items: items.slice(0, 2) },
    { label: 'Yesterday', items: items.slice(2) },
  ]);
});
