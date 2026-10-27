import { addDays, chaptersByDay, dayKey, streaks, weekStart, weeklyTotals } from './stats';

export type Summary = ReturnType<typeof summarize>;

/** Everything the Insights page and History's card show, from finished chapters and seconds per day. */
export function summarize(reads: { at: number; titleId: number }[], seconds: Map<string, number>, now: number) {
  const days = chaptersByDay(reads.map((r) => r.at));
  const weeks = weeklyTotals(days, now, 12);
  const sumSeconds = (from: number, to: number) => {
    let total = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) total += seconds.get(dayKey(d)) ?? 0;
    return total;
  };
  const thisWeek = weekStart(now);
  const yearAgo = addDays(now, -364);
  const yearReads = reads.filter((r) => r.at >= yearAgo);
  let yearSeconds = 0;
  const oldest = dayKey(yearAgo);
  for (const [k, s] of seconds) if (k >= oldest) yearSeconds += s;
  return {
    days,
    weeks,
    weekChapters: weeks.at(-1)?.count ?? 0,
    lastWeekChapters: weeks.at(-2)?.count ?? 0,
    weekSeconds: sumSeconds(thisWeek, now),
    yearSeconds,
    streak: streaks(days, now),
    yearChapters: yearReads.length,
    yearTitles: new Set(yearReads.map((r) => r.titleId)).size,
  };
}

/** "45 min", "1h 15m", "96h". */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 100 || m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
