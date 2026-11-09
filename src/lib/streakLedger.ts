import type { Transaction } from './finance';
import { BERRIES_PER_DAY } from './streak';
import type { StreakStats } from './streak';
import { isTrackingDate } from './streakTypes';
import type { ConfirmedDayStatus, StreakLedger, TrackingDayStatus } from './streakTypes';

export const DAYS_PER_FREEZE = 7;
export const MAX_FREEZES = 2;
const DAY_MILLISECONDS = 86_400_000;
const BACKFILL_MILLISECONDS = 48 * 60 * 60 * 1_000;

export interface TrackingStats extends StreakStats {
  freezes: number;
  /** Confirmed days toward the next freeze; frozen days never advance it. */
  freezeProgress: number;
  confirmedDays: number;
  todayStatus: ConfirmedDayStatus | 'PENDING';
}

export interface TrackingDay {
  date: string;
  status: TrackingDayStatus;
  canConfirm: boolean;
}

function localDay(now: Date): string {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** UTC is only an ordinal for immutable calendar labels, never an event date. */
function dayOrdinal(day: string): number {
  const date = new Date(0);
  date.setUTCFullYear(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime() / DAY_MILLISECONDS;
}

function ordinalDay(ordinal: number): string {
  return new Date(ordinal * DAY_MILLISECONDS).toISOString().slice(0, 10);
}

/** Same-date facts survive expense deletion, reloads, clock rollback and tab merges. */
export function reconcileStreak(
  transactions: readonly Transaction[],
  ledger?: StreakLedger,
  now = new Date(),
): StreakLedger {
  const today = localDay(now);
  const confirmed = new Map<string, ConfirmedDayStatus>(
    ledger?.confirmedDays.map((entry) => [entry.date, entry.status]),
  );
  let changed = !ledger;
  for (const transaction of transactions) {
    // A later-entered purchase corrects an existing no-spend label, without
    // inventing a second credited day from its backdated purchase date.
    if (transaction.date <= today && confirmed.get(transaction.date) === 'NO_SPEND'
      && isTrackingDate(transaction.date)) {
      confirmed.set(transaction.date, 'LOGGED');
      changed = true;
    }
    const date = transaction.createdAt ?? transaction.date;
    // A future imported expense cannot award tomorrow's tracking today.
    if (date > today || !isTrackingDate(date) || confirmed.get(date) === 'LOGGED') continue;
    confirmed.set(date, 'LOGGED');
    changed = true;
  }
  if (ledger && !changed) return ledger;
  return {
    version: 1,
    startedOn: ledger?.startedOn ?? today,
    confirmedDays: [...confirmed].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, status]) => ({ date, status })),
  };
}

/** Backfill stays open for 48 elapsed hours after the target local day ends. */
export function canConfirmTrackingDay(date: string, now = new Date()): boolean {
  if (!isTrackingDate(date) || !Number.isFinite(now.getTime()) || date > localDay(now)) return false;
  if (date === localDay(now)) return true;
  const end = new Date(`${date}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const age = now.getTime() - end.getTime();
  return age >= 0 && age <= BACKFILL_MILLISECONDS;
}

/** Invalid, expired or already confirmed requests are harmless no-ops. */
export function confirmTrackingDay(
  transactions: readonly Transaction[],
  ledger: StreakLedger | undefined,
  date: string,
  status: ConfirmedDayStatus,
  now = new Date(),
): StreakLedger {
  const reconciled = reconcileStreak(transactions, ledger, now);
  if (!canConfirmTrackingDay(date, now)) return reconciled;
  if (status === 'LOGGED' && !transactions.some((transaction) => transaction.date === date
    || transaction.createdAt === date)) return reconciled;
  const previous = reconciled.confirmedDays.find((entry) => entry.date === date);
  if (previous?.status === 'LOGGED' || previous?.status === status) return reconciled;
  return {
    ...reconciled,
    confirmedDays: [...reconciled.confirmedDays.filter((entry) => entry.date !== date), { date, status }]
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function confirmNoSpend(
  transactions: readonly Transaction[],
  ledger: StreakLedger | undefined,
  date: string,
  now = new Date(),
): StreakLedger {
  return confirmTrackingDay(transactions, ledger, date, 'NO_SPEND', now);
}

interface ReplayResult {
  stats: TrackingStats;
  statuses: Map<string, TrackingDayStatus>;
}

/**
 * Replay only confirmed events and at most two protected days per gap. A decade
 * away therefore costs no more than an ordinary gap and cannot fill storage.
 */
function replay(ledger: StreakLedger, now: Date): ReplayResult {
  const today = localDay(now);
  const todayOrdinal = dayOrdinal(today);
  const protectionStart = dayOrdinal(ledger.startedOn);
  const statuses = new Map<string, TrackingDayStatus>();
  const events = ledger.confirmedDays.filter((entry) => entry.date <= today)
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  let current = 0;
  let longest = 0;
  let freezes = 0;
  let confirmedDays = 0;
  let previousOrdinal: number | undefined;
  let lastActiveDate: string | null = null;

  function closeGap(first: number, last: number) {
    if (first > last || current === 0) return;
    // Migration keeps historical runs intact and never retroactively protects gaps.
    if (first < protectionStart) {
      current = 0;
      return;
    }
    const gap = last - first + 1;
    const protectedDays = Math.min(freezes, gap);
    for (let offset = 0; offset < protectedDays; offset += 1) {
      statuses.set(ordinalDay(first + offset), 'FROZEN');
    }
    freezes -= protectedDays;
    if (protectedDays < gap) current = 0;
  }

  for (const event of events) {
    const ordinal = dayOrdinal(event.date);
    if (previousOrdinal !== undefined) closeGap(previousOrdinal + 1, ordinal - 1);
    statuses.set(event.date, event.status);
    current += 1;
    confirmedDays += 1;
    if (confirmedDays % DAYS_PER_FREEZE === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
    longest = Math.max(longest, current);
    previousOrdinal = ordinal;
    lastActiveDate = event.date;
  }
  if (previousOrdinal !== undefined) closeGap(previousOrdinal + 1, todayOrdinal - 1);
  const status = statuses.get(today);
  const todayStatus = status === 'LOGGED' || status === 'NO_SPEND' ? status : 'PENDING';
  return {
    statuses,
    stats: {
      current,
      longest,
      activeToday: todayStatus !== 'PENDING',
      lastActiveDate,
      bounty: current * BERRIES_PER_DAY,
      nextBounty: (current + 1) * BERRIES_PER_DAY,
      freezes,
      freezeProgress: confirmedDays % DAYS_PER_FREEZE,
      confirmedDays,
      todayStatus,
    },
  };
}

export function getTrackingStats(
  transactions: readonly Transaction[],
  ledger?: StreakLedger,
  now = new Date(),
): TrackingStats {
  return replay(reconcileStreak(transactions, ledger, now), now).stats;
}

/** A bounded recent-day view; missing history is inferred rather than persisted. */
export function getTrackingDays(
  transactions: readonly Transaction[],
  ledger?: StreakLedger,
  now = new Date(),
  count = 7,
): TrackingDay[] {
  const { statuses } = replay(reconcileStreak(transactions, ledger, now), now);
  const today = localDay(now);
  const end = dayOrdinal(today);
  const length = Math.max(0, Math.min(366, Number.isFinite(count) ? Math.floor(count) : 7));
  return Array.from({ length }, (_, index) => {
    const date = ordinalDay(end - length + 1 + index);
    const status = statuses.get(date) ?? (date === today ? 'PENDING' : 'MISSED');
    return { date, status, canConfirm: status !== 'LOGGED' && status !== 'NO_SPEND'
      && canConfirmTrackingDay(date, now) };
  });
}
