/** Reading Insights maths: everything works on local calendar days ("YYYY-MM-DD"). */

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local midnight of `ts`'s day. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** The day `n` days after `ts` (calendar days, so daylight-saving changes don't drift). */
export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

/** Monday of `ts`'s week. */
export function weekStart(ts: number): number {
  const day = startOfDay(ts);
  const offset = (new Date(day).getDay() + 6) % 7;
  return addDays(day, -offset);
}

/** How many chapters were finished on each day, from their read times. */
export function chaptersByDay(readAt: number[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const ts of readAt) {
    const k = dayKey(ts);
    days.set(k, (days.get(k) ?? 0) + 1);
  }
  return days;
}

/**
 * The current run of reading days (today counts once read; until then, a run up to yesterday
 * is still alive) and the longest run.
 */
export function streaks(days: Map<string, number>, now: number): { current: number; longest: number } {
  const read = (ts: number) => (days.get(dayKey(ts)) ?? 0) > 0;
  let current = 0;
  let cursor = read(now) ? startOfDay(now) : addDays(now, -1);
  while (read(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  const sorted = [...days.keys()].filter((k) => (days.get(k) ?? 0) > 0).sort();
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    const [y, m, d] = k.split('-').map(Number) as [number, number, number];
    const next = prev && dayKey(addDays(new Date(y, m - 1, d).getTime(), -1)) === prev;
    run = next ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = k;
  }
  return { current, longest: Math.max(longest, current) };
}

/** Chapters in each of the last `weeks` weeks, oldest first; the last entry is this week. */
export function weeklyTotals(days: Map<string, number>, now: number, weeks: number): { start: number; count: number }[] {
  const thisWeek = weekStart(now);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    let count = 0;
    for (let d = 0; d < 7; d++) count += days.get(dayKey(addDays(start, d))) ?? 0;
    return { start, count };
  });
}

/** Heatmap shade, 0 (none) to 4 (most). */
export function heatLevel(chapters: number): 0 | 1 | 2 | 3 | 4 {
  if (chapters <= 0) return 0;
  if (chapters <= 2) return 1;
  if (chapters <= 4) return 2;
  if (chapters <= 7) return 3;
  return 4;
}
