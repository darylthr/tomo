import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setGlobalMeta } from '../server/api';
import { useReader } from '../reader/readerStore';
import { addDays, dayKey } from './stats';

/** A page left open counts for at most this long: past it, the reader has probably put the phone down. */
export const IDLE_CAP_MS = 120_000;
/** Global meta key prefix; each device writes `tomo.time.<deviceId>` and Insights adds them up. */
export const TIME_KEY = 'tomo.time.';
const KEEP_DAYS = 400;
const SYNC_MS = 60_000;

type Days = Record<string, number>;

/** Turns reader activity into reading time: the gap since the last page turn, capped, only while visible. */
export function createClock(add: (ms: number, at: number) => void) {
  let last: number | null = null;
  const count = (now: number) => {
    if (last !== null && now > last) add(Math.min(now - last, IDLE_CAP_MS), now);
  };
  return {
    activity(now: number) {
      count(now);
      last = now;
    },
    pause(now: number) {
      count(now);
      last = null;
    },
    resume(now: number) {
      last = now;
    },
  };
}

export function pruneDays(days: Days, now: number): Days {
  const oldest = dayKey(addDays(now, -KEEP_DAYS));
  return Object.fromEntries(Object.entries(days).filter(([k]) => k >= oldest));
}

/** Seconds read per day across every device. This device counts the larger of its saved and local numbers. */
export function mergeDevices(metas: { key: string; value: string }[], deviceId: string, local: Days): Map<string, number> {
  const total = new Map<string, number>();
  const add = (k: string, s: number) => total.set(k, (total.get(k) ?? 0) + s);
  let ownSaved: Days = {};
  for (const m of metas) {
    if (!m.key.startsWith(TIME_KEY)) continue;
    let days: Days;
    try {
      days = JSON.parse(m.value) as Days;
    } catch {
      continue;
    }
    if (typeof days !== 'object' || days === null) continue;
    if (m.key === TIME_KEY + deviceId) {
      ownSaved = days;
      continue;
    }
    for (const [k, s] of Object.entries(days)) if (typeof s === 'number') add(k, s);
  }
  for (const k of new Set([...Object.keys(ownSaved), ...Object.keys(local)])) {
    add(k, Math.max(Number(ownSaved[k]) || 0, local[k] ?? 0));
  }
  return total;
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

type TimeState = {
  /** Names this device's entry on the server. */
  deviceId: string;
  /** Seconds read per day on this device. */
  days: Days;
  add: (ms: number, at: number) => void;
};

export const useReadingTime = create<TimeState>()(
  persist(
    (set) => ({
      deviceId: newId(),
      days: {},
      add: (ms, at) =>
        set((s) => {
          const k = dayKey(at);
          return { days: pruneDays({ ...s.days, [k]: Math.round((s.days[k] ?? 0) + ms / 1000) }, at) };
        }),
    }),
    { name: 'tomo-reading-time', partialize: ({ deviceId, days }) => ({ deviceId, days }) },
  ),
);

let dirty = false;

/** Saves this device's reading time to Suwayomi. Best effort: the local copy is the source of truth. */
export async function syncReadingTime(keepalive = false): Promise<void> {
  if (!dirty) return;
  dirty = false;
  const { deviceId, days } = useReadingTime.getState();
  try {
    await setGlobalMeta(TIME_KEY + deviceId, JSON.stringify(days), keepalive);
  } catch {
    dirty = true;
  }
}

/** Runs while the reader is open: page turns, scrolling, taps and keys count as reading. Returns a stop function. */
export function startReadingClock(): () => void {
  const clock = createClock((ms, at) => {
    useReadingTime.getState().add(ms, at);
    dirty = true;
  });
  const now = () => Date.now();
  clock.activity(now());

  const onActivity = () => clock.activity(now());
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      clock.pause(now());
      void syncReadingTime(true);
    } else clock.resume(now());
  };
  const unsubscribe = useReader.subscribe((s, prev) => {
    if (s.index !== prev.index) onActivity();
  });
  const events = ['pointerdown', 'keydown', 'wheel'] as const;
  for (const e of events) window.addEventListener(e, onActivity, { passive: true });
  // Webtoon pages are tall: scrolling within one is reading too.
  window.addEventListener('scroll', onActivity, { passive: true, capture: true });
  document.addEventListener('visibilitychange', onVisibility);
  const timer = setInterval(() => void syncReadingTime(), SYNC_MS);

  return () => {
    clock.pause(now());
    unsubscribe();
    for (const e of events) window.removeEventListener(e, onActivity);
    window.removeEventListener('scroll', onActivity, { capture: true });
    document.removeEventListener('visibilitychange', onVisibility);
    clearInterval(timer);
    void syncReadingTime(true);
  };
}
