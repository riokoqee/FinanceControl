import type { Transaction } from '../finance';
import { BERRIES_PER_DAY } from './streak';
import type { StreakStats } from './streak';
import { isTrackingDate, STREAK_LEDGER_VERSION } from './streakTypes';
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
  confirmationStatus?: ConfirmedDayStatus;
}

export interface ConfirmDayResult {
  status: 'saved' | 'already' | 'expired' | 'unavailable';
  ledger: StreakLedger;
  dayStatus?: ConfirmedDayStatus;
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

interface ReconciledSnapshot {
  ledger: StreakLedger;
  expenseDays: ReadonlySet<string>;
}

/** One latest snapshot per immutable array, never a growing date/ledger history. */
const reconciliationCache = new WeakMap<readonly Transaction[], {
  inputLedger?: StreakLedger;
  day: string;
  snapshot: ReconciledSnapshot;
}>();

function reconciledSnapshot(
  transactions: readonly Transaction[],
  ledger?: StreakLedger,
  now = new Date(),
): ReconciledSnapshot {
  const today = localDay(now);
  const cached = reconciliationCache.get(transactions);
  if (cached?.day === today && (cached.inputLedger === ledger || cached.snapshot.ledger === ledger)) {
    return cached.snapshot;
  }
  const confirmed = new Map<string, ConfirmedDayStatus>(
    ledger?.confirmedDays.map((entry) => [entry.date, entry.status]),
  );
  const expenseDays = new Set<string>();
  let changed = !ledger;
  for (const transaction of transactions) {
    const purchaseDay = transaction.date;
    if (purchaseDay <= today && !expenseDays.has(purchaseDay) && isTrackingDate(purchaseDay)) {
      expenseDays.add(purchaseDay);
    }
    // A later-entered purchase corrects an existing no-spend label, without
    // inventing a second credited day from its backdated purchase date.
    if (expenseDays.has(purchaseDay) && confirmed.get(purchaseDay) === 'NO_SPEND') {
      confirmed.set(purchaseDay, 'LOGGED');
      changed = true;
    }
    const date = transaction.createdAt ?? purchaseDay;
    // A future imported expense cannot award tomorrow's tracking today.
    if (date > today) continue;
    if (!expenseDays.has(date) && isTrackingDate(date)) expenseDays.add(date);
    if (confirmed.get(date) === 'LOGGED' || !expenseDays.has(date)) continue;
    confirmed.set(date, 'LOGGED');
    changed = true;
  }
  const result: StreakLedger = ledger && !changed ? ledger : {
    version: ledger?.version ?? STREAK_LEDGER_VERSION,
    startedOn: ledger?.startedOn ?? today,
    confirmedDays: [...confirmed].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, status]) => ({ date, status })),
  };
  const snapshot = { ledger: result, expenseDays };
  reconciliationCache.set(transactions, { inputLedger: ledger, day: today, snapshot });
  return snapshot;
}

/** Inputs and returned snapshots are immutable in app state. Same-day reads reuse the scan. */
export function reconcileStreak(
  transactions: readonly Transaction[],
  ledger?: StreakLedger,
  now = new Date(),
): StreakLedger {
  return reconciledSnapshot(transactions, ledger, now).ledger;
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

function trackingStart(ledger: StreakLedger): string {
  return ledger.confirmedDays.reduce((first, entry) => entry.date < first ? entry.date : first, ledger.startedOn);
}

function confirmationStatus(snapshot: ReconciledSnapshot, date: string): ConfirmedDayStatus {
  return snapshot.expenseDays.has(date) ? 'LOGGED' : 'NO_SPEND';
}

function confirmReconciledDay(
  snapshot: ReconciledSnapshot,
  date: string,
  now: Date,
  requestedStatus?: ConfirmedDayStatus,
): ConfirmDayResult {
  const reconciled = snapshot.ledger;
  if (!isTrackingDate(date) || !Number.isFinite(now.getTime()) || date > localDay(now)) {
    return { status: 'unavailable', ledger: reconciled };
  }
  const previous = reconciled.confirmedDays.find((entry) => entry.date === date);
  if (previous) return { status: 'already', ledger: reconciled, dayStatus: previous.status };
  if (date !== localDay(now) && date < trackingStart(reconciled)) {
    return { status: 'unavailable', ledger: reconciled };
  }
  if (!canConfirmTrackingDay(date, now)) return { status: 'expired', ledger: reconciled };
  const status = confirmationStatus(snapshot, date);
  // Retain the legacy explicit-LOGGED guard; a caller cannot invent an expense.
  if (requestedStatus === 'LOGGED' && status !== 'LOGGED') return { status: 'unavailable', ledger: reconciled };
  return {
    status: 'saved',
    dayStatus: status,
    ledger: {
      ...reconciled,
      confirmedDays: [...reconciled.confirmedDays, { date, status }]
        .sort((a, b) => a.date.localeCompare(b.date)),
    },
  };
}

/** A single domain action owns date eligibility and the real-expense/no-spend distinction. */
export function confirmDay(
  transactions: readonly Transaction[],
  ledger: StreakLedger | undefined,
  date: string,
  now = new Date(),
): ConfirmDayResult {
  return confirmReconciledDay(reconciledSnapshot(transactions, ledger, now), date, now);
}

/** Compatibility wrapper; new callers should use the typed confirmDay outcome. */
export function confirmTrackingDay(
  transactions: readonly Transaction[],
  ledger: StreakLedger | undefined,
  date: string,
  status: ConfirmedDayStatus,
  now = new Date(),
): StreakLedger {
  return confirmReconciledDay(reconciledSnapshot(transactions, ledger, now), date, now, status).ledger;
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
  trackingStart: string;
}

/** Replay is date-based; precise backfill eligibility is evaluated outside this cache. */
const replayCache = new WeakMap<StreakLedger, { day: string; result: ReplayResult }>();

/**
 * Replay only confirmed events and at most two protected days per gap. A decade
 * away therefore costs no more than an ordinary gap and cannot fill storage.
 */
function replay(ledger: StreakLedger, now: Date): ReplayResult {
  const today = localDay(now);
  const cached = replayCache.get(ledger);
  if (cached?.day === today) return cached.result;
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
    if (freezes < gap) {
      current = 0;
      return;
    }
    for (let offset = 0; offset < gap; offset += 1) {
      statuses.set(ordinalDay(first + offset), 'FROZEN');
    }
    freezes -= gap;
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
  const result: ReplayResult = {
    statuses,
    trackingStart: trackingStart(ledger),
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
  replayCache.set(ledger, { day: today, result });
  return result;
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
  const snapshot = reconciledSnapshot(transactions, ledger, now);
  const { statuses, trackingStart: started } = replay(snapshot.ledger, now);
  const today = localDay(now);
  const end = dayOrdinal(today);
  const length = Math.max(0, Math.min(366, Number.isFinite(count) ? Math.floor(count) : 7));
  return Array.from({ length }, (_, index) => {
    const date = ordinalDay(end - length + 1 + index);
    const status = statuses.get(date) ?? (date === today ? 'PENDING' : date < started ? 'NONE' : 'MISSED');
    const canConfirm = status !== 'LOGGED' && status !== 'NO_SPEND' && status !== 'NONE'
      && canConfirmTrackingDay(date, now);
    return { date, status, canConfirm,
      ...(canConfirm ? { confirmationStatus: confirmationStatus(snapshot, date) } : {}) };
  });
}
