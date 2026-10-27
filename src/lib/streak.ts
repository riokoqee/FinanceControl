import { todayString } from "./finance";
import type { Transaction } from "./finance";

/** Fictional One Piece berries, separate from the user's expense currencies. */
export const BERRIES_PER_DAY = 500_000;

export interface StreakStats {
  current: number;
  longest: number;
  activeToday: boolean;
  lastActiveDate: string | null;
  bounty: number;
  nextBounty: number;
}

function isCalendarDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T12:00:00`);
  return Number.isFinite(date.getTime()) && todayString(date) === day;
}

/** Local noon and calendar arithmetic also work across 23/25-hour DST days. */
function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return todayString(date);
}

/** A day counts once when a record was created, even for a backdated purchase. */
export function getStreakStats(
  transactions: readonly Transaction[],
  now = new Date(),
): StreakStats {
  const today = todayString(now);
  const days = new Set(
    transactions
      .map((transaction) => transaction.createdAt ?? transaction.date)
      .filter((day) => isCalendarDay(day) && day <= today),
  );
  const orderedDays = [...days].sort();
  const activeToday = days.has(today);
  let current = 0;
  let cursor = activeToday ? today : previousDay(today);
  while (days.has(cursor)) {
    current += 1;
    cursor = previousDay(cursor);
  }

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of orderedDays) {
    run = previous === previousDay(day) ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  return {
    current,
    longest,
    activeToday,
    lastActiveDate: orderedDays.at(-1) ?? null,
    bounty: current * BERRIES_PER_DAY,
    nextBounty: (current + 1) * BERRIES_PER_DAY,
  };
}
