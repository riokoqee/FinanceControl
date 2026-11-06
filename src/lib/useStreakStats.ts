import { useSyncExternalStore } from "react";
import type { Transaction } from "./finance";
import { todayString } from "./finance";
import { getStreakStats } from "./streak";
import type { StreakStats } from "./streak";

const subscribers = new Set<() => void>();
let timeout: ReturnType<typeof setTimeout> | undefined;

function refreshDay() {
  for (const notify of subscribers) notify();
  clearTimeout(timeout);
  const nextMidnight = new Date();
  nextMidnight.setHours(24, 0, 0, 50);
  timeout = setTimeout(refreshDay, Math.max(1, nextMidnight.getTime() - Date.now()));
}

function subscribe(notify: () => void) {
  subscribers.add(notify);
  if (subscribers.size === 1) {
    refreshDay();
    window.addEventListener("focus", refreshDay);
    document.addEventListener("visibilitychange", refreshDay);
  }
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0) {
      clearTimeout(timeout);
      window.removeEventListener("focus", refreshDay);
      document.removeEventListener("visibilitychange", refreshDay);
    }
  };
}

/** One midnight timer serves the badge, poster and activity calendar together. */
export function useLocalCalendarDay(): string {
  return useSyncExternalStore(subscribe, todayString, todayString);
}

const cache = new WeakMap<readonly Transaction[], { day: string; stats: StreakStats }>();

/** Transaction arrays are immutable in app state; all streak widgets reuse their result. */
export function getCachedStreakStats(transactions: readonly Transaction[], day: string): StreakStats {
  const previous = cache.get(transactions);
  if (previous?.day === day) return previous.stats;
  const stats = getStreakStats(transactions, new Date(`${day}T12:00:00`));
  cache.set(transactions, { day, stats });
  return stats;
}

export function useStreakStats(transactions: readonly Transaction[]) {
  return getCachedStreakStats(transactions, useLocalCalendarDay());
}
