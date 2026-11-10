/** A confirmed tracking day is independent of financial transactions. */
export type ConfirmedDayStatus = 'LOGGED' | 'NO_SPEND';
export type TrackingDayStatus = ConfirmedDayStatus | 'FROZEN' | 'MISSED' | 'PENDING' | 'NONE';
export const STREAK_LEDGER_VERSION = 1;

export interface ConfirmedTrackingDay {
  /** An immutable local calendar label; never converted through UTC. */
  date: string;
  status: ConfirmedDayStatus;
}

/** Only authoritative facts are persisted; freeze balances are always replayed. */
export interface StreakLedger {
  version: typeof STREAK_LEDGER_VERSION;
  /** Automatic protection begins here, without rewriting pre-migration gaps. */
  startedOn: string;
  confirmedDays: ConfirmedTrackingDay[];
}

export function isTrackingDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Backup validation is deliberately independent from the finance module. */
export function isStreakLedger(value: unknown): value is StreakLedger {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ledger = value as Partial<StreakLedger>;
  if (ledger.version !== STREAK_LEDGER_VERSION || !isTrackingDate(ledger.startedOn)
    || !Array.isArray(ledger.confirmedDays) || ledger.confirmedDays.length > 100_000) return false;
  const seen = new Set<string>();
  for (const entry of ledger.confirmedDays) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || !isTrackingDate(entry.date) || seen.has(entry.date)
      || (entry.status !== 'LOGGED' && entry.status !== 'NO_SPEND')) return false;
    seen.add(entry.date);
  }
  return true;
}

/** Union daily facts, so concurrent tabs cannot multiply a day's reward. */
export function mergeStreakLedgers(
  left?: StreakLedger,
  right?: StreakLedger,
): StreakLedger | undefined {
  if (!left) return right;
  if (!right || left === right) return left;
  const days = new Map(left.confirmedDays.map((entry) => [entry.date, entry.status]));
  for (const entry of right.confirmedDays) {
    if (!days.has(entry.date) || entry.status === 'LOGGED') days.set(entry.date, entry.status);
  }
  const startedOn = left.startedOn < right.startedOn ? left.startedOn : right.startedOn;
  const confirmedDays = [...days].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, status]) => ({ date, status }));
  if (startedOn === left.startedOn && confirmedDays.length === left.confirmedDays.length
    && confirmedDays.every((entry, index) => entry.date === left.confirmedDays[index].date
      && entry.status === left.confirmedDays[index].status)) return left;
  return { version: left.version ?? STREAK_LEDGER_VERSION, startedOn, confirmedDays };
}
