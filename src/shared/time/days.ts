// Dates for the Updates and History lists, in local time.

const DAY_MS = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole local days between two times (DST-safe). */
function daysBetween(ts: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS);
}

/** "Today", "Yesterday", or "Thursday, Oct 23" (with the year when it isn't this year). */
export function dayLabel(ts: number, now: number): string {
  const days = daysBetween(ts, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  return new Date(ts).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "now", "5m", "3h", "2d", then the date ("Oct 17"). */
export function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)}d`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** The time of day in the device's own format ("14:05" or "2:05 PM"). */
export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Consecutive items on the same day share a group; the input order is kept. */
export function groupByDay<T>(items: T[], at: (item: T) => number, now: number): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const item of items) {
    const label = dayLabel(at(item), now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
