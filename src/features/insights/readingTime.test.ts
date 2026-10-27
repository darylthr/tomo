import { createClock, IDLE_CAP_MS, mergeDevices, pruneDays } from './readingTime';

describe('the reading clock', () => {
  it('counts the time between page turns', () => {
    const added: [number, number][] = [];
    const clock = createClock((ms, at) => added.push([ms, at]));
    clock.activity(1_000);
    clock.activity(31_000);
    clock.activity(76_000);
    expect(added).toEqual([
      [30_000, 31_000],
      [45_000, 76_000],
    ]);
  });

  it('counts at most two minutes for a page left open', () => {
    const added: number[] = [];
    const clock = createClock((ms) => added.push(ms));
    clock.activity(0);
    clock.activity(10 * 60_000);
    expect(added).toEqual([IDLE_CAP_MS]);
  });

  it('stops while Tomo is hidden, and counts the last page when it hides', () => {
    const added: number[] = [];
    const clock = createClock((ms) => added.push(ms));
    clock.activity(0);
    clock.pause(20_000);
    clock.resume(3_600_000);
    clock.activity(3_610_000);
    expect(added).toEqual([20_000, 10_000]);
  });
});

it('adds up every device, taking the larger of this device’s saved and local numbers', () => {
  const metas = [
    { key: 'tomo.time.phone', value: JSON.stringify({ '2026-10-28': 600, '2026-10-29': 60 }) },
    { key: 'tomo.time.laptop', value: JSON.stringify({ '2026-10-29': 1200 }) },
    { key: 'tomo.time.tablet', value: 'not json' },
    { key: 'webUI_theme', value: 'dark' },
  ];
  const days = mergeDevices(metas, 'phone', { '2026-10-29': 300 });
  expect(Object.fromEntries(days)).toEqual({ '2026-10-28': 600, '2026-10-29': 1500 });
});

it('keeps about a year and a month of days', () => {
  const now = new Date(2026, 9, 29).getTime();
  expect(pruneDays({ '2025-09-01': 5, '2025-10-01': 7, '2026-10-29': 9 }, now)).toEqual({ '2025-10-01': 7, '2026-10-29': 9 });
});
