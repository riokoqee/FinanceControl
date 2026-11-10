import { afterEach, describe, expect, it } from 'vitest';
import type { Transaction } from '../finance';
import { getStreakStats } from './streak';
import {
  canConfirmTrackingDay, confirmDay, confirmNoSpend, confirmTrackingDay,
  getTrackingDays, getTrackingStats, reconcileStreak,
} from './streakLedger';
import { isStreakLedger, isTrackingDate, mergeStreakLedgers, STREAK_LEDGER_VERSION } from './streakTypes';
import type { ConfirmedDayStatus, StreakLedger } from './streakTypes';

function at(day: string, time = '12:00:00'): Date {
  return new Date(`${day}T${time}`);
}

function expense(date: string, createdAt = date): Transaction {
  return { id: `${date}-${createdAt}`, title: 'Bread', amount: 2, currency: 'EUR', category: 'food', date, createdAt };
}

function days(count: number, start = '2026-11-01'): string[] {
  const date = at(start);
  return Array.from({ length: count }, (_, index) => {
    const cursor = new Date(date);
    cursor.setDate(cursor.getDate() + index);
    return `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
  });
}

function ledger(count = 7, status: ConfirmedDayStatus = 'LOGGED'): StreakLedger {
  return { version: 1, startedOn: '2026-11-01', confirmedDays: days(count).map((date) => ({ date, status })) };
}

const originalTimezone = process.env.TZ;
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

describe('tracking-day ledger and automatic freezes', () => {
  it('starts empty, with no freezes, reward or persisted missed-day rows', () => {
    const state = reconcileStreak([], undefined, at('2026-11-05'));
    expect(state).toEqual({ version: 1, startedOn: '2026-11-05', confirmedDays: [] });
    expect(getTrackingStats([], state, at('2026-11-05'))).toMatchObject({
      current: 0, longest: 0, freezes: 0, freezeProgress: 0, bounty: 0, todayStatus: 'PENDING',
    });
  });

  it('counts one recording day once, using creation dates rather than purchase dates', () => {
    const records = [expense('2020-01-01', '2026-11-05'), expense('2026-11-05')];
    const state = reconcileStreak(records, undefined, at('2026-11-05'));
    expect(state.confirmedDays).toEqual([{ date: '2026-11-05', status: 'LOGGED' }]);
    expect(getTrackingStats(records, state, at('2026-11-05'))).toMatchObject({
      current: 1, activeToday: true, todayStatus: 'LOGGED', bounty: 500_000, freezeProgress: 1,
    });
  });

  it('uses purchase dates only for legacy records without createdAt', () => {
    const transaction = expense('2026-11-04');
    delete transaction.createdAt;
    expect(reconcileStreak([transaction], undefined, at('2026-11-05')).confirmedDays)
      .toEqual([{ date: '2026-11-04', status: 'LOGGED' }]);
  });

  it('confirms a no-spend day without adding or mutating a financial transaction', () => {
    const records: Transaction[] = [];
    const state = confirmNoSpend(records, undefined, '2026-11-05', at('2026-11-05'));
    expect(records).toEqual([]);
    expect(state.confirmedDays).toEqual([{ date: '2026-11-05', status: 'NO_SPEND' }]);
    expect(getTrackingStats(records, state, at('2026-11-05'))).toMatchObject({
      current: 1, activeToday: true, todayStatus: 'NO_SPEND', bounty: 500_000,
    });
  });

  it('upgrades no-spend to logged without rewarding the same day twice', () => {
    const state = confirmNoSpend([], undefined, '2026-11-05', at('2026-11-05'));
    const recorded = reconcileStreak([expense('2026-11-05')], state, at('2026-11-05'));
    expect(recorded.confirmedDays).toEqual([{ date: '2026-11-05', status: 'LOGGED' }]);
    expect(getTrackingStats([], recorded, at('2026-11-05')).bounty).toBe(500_000);
    expect(confirmNoSpend([], recorded, '2026-11-05', at('2026-11-05'))).toBe(recorded);
  });

  it('corrects a previous no-spend label when a real purchase is entered later, without a second reward', () => {
    const now = at('2026-11-06');
    const state: StreakLedger = { version: 1, startedOn: '2026-11-05', confirmedDays: [
      { date: '2026-11-05', status: 'NO_SPEND' },
      { date: '2026-11-06', status: 'LOGGED' },
    ] };
    const records = [expense('2026-11-05', '2026-11-06')];
    const recorded = reconcileStreak(records, state, now);
    expect(recorded.confirmedDays).toEqual([
      { date: '2026-11-05', status: 'LOGGED' },
      { date: '2026-11-06', status: 'LOGGED' },
    ]);
    expect(getTrackingStats(records, recorded, now)).toMatchObject({
      current: 2, confirmedDays: 2, bounty: 1_000_000, freezes: 0, freezeProgress: 2,
    });
    expect(getTrackingStats([], recorded, now).bounty).toBe(getTrackingStats([], state, now).bounty);
    expect(reconcileStreak(records, recorded, now)).toBe(recorded);
    expect(state.confirmedDays[0].status).toBe('NO_SPEND');
  });

  it('does not automatically backfill an unconfirmed purchase date when recording a backdated expense', () => {
    const now = at('2026-11-06');
    const recorded = reconcileStreak([expense('2026-11-05', '2026-11-06')], undefined, now);
    expect(recorded.confirmedDays).toEqual([{ date: '2026-11-06', status: 'LOGGED' }]);
    expect(getTrackingStats([], recorded, now)).toMatchObject({ current: 1, confirmedDays: 1, bounty: 500_000 });
  });

  it('keeps an earned day if the user later deletes its last expense', () => {
    const state = reconcileStreak([expense('2026-11-05')], undefined, at('2026-11-05'));
    expect(reconcileStreak([], state, at('2026-11-05'))).toBe(state);
    expect(getTrackingStats([], state, at('2026-11-05')).bounty).toBe(500_000);
  });

  it('awards the first freeze on the seventh confirmed day', () => {
    expect(getTrackingStats([], ledger(6), at('2026-11-06'))).toMatchObject({ freezes: 0, freezeProgress: 6 });
    expect(getTrackingStats([], ledger(), at('2026-11-07'))).toMatchObject({ freezes: 1, freezeProgress: 0 });
  });

  it('counts no-spend days toward freezes exactly like recording days', () => {
    expect(getTrackingStats([], ledger(7, 'NO_SPEND'), at('2026-11-07'))).toMatchObject({
      freezes: 1, current: 7, bounty: 3_500_000,
    });
  });

  it.each([14, 21, 28])('caps freeze inventory at two after %i confirmed days', (count) => {
    expect(getTrackingStats([], ledger(count), at(days(count).at(-1)!)).freezes).toBe(2);
  });

  it('protects a closed missed day without increasing the streak, bounty or freeze progress', () => {
    const state = ledger();
    expect(getTrackingStats([], state, at('2026-11-09'))).toMatchObject({
      current: 7, longest: 7, freezes: 0, bounty: 3_500_000, freezeProgress: 0,
      activeToday: false, todayStatus: 'PENDING',
    });
    expect(getTrackingDays([], state, at('2026-11-09')).find((day) => day.date === '2026-11-08'))
      .toMatchObject({ status: 'FROZEN', canConfirm: true });
  });

  it('leaves today open until local midnight and only then spends a freeze', () => {
    const state = ledger();
    expect(getTrackingStats([], state, at('2026-11-08', '23:59:59'))).toMatchObject({ current: 7, freezes: 1 });
    expect(getTrackingStats([], state, at('2026-11-09', '00:00:00'))).toMatchObject({ current: 7, freezes: 0 });
  });

  it('resets the current run after a missed day with no freeze, preserving the best', () => {
    const state = ledger(3);
    expect(getTrackingStats([], state, at('2026-11-05'))).toMatchObject({ current: 0, longest: 3, bounty: 0 });
    expect(getTrackingDays([], state, at('2026-11-05')).find((day) => day.date === '2026-11-04')?.status).toBe('MISSED');
  });

  it('keeps its freeze when it cannot protect the entire closed two-day gap', () => {
    const state = ledger();
    expect(getTrackingDays([], state, at('2026-11-10')).filter((day) => day.date >= '2026-11-08'))
      .toEqual([
        { date: '2026-11-08', status: 'MISSED', canConfirm: true, confirmationStatus: 'NO_SPEND' },
        { date: '2026-11-09', status: 'MISSED', canConfirm: true, confirmationStatus: 'NO_SPEND' },
        { date: '2026-11-10', status: 'PENDING', canConfirm: true, confirmationStatus: 'NO_SPEND' },
      ]);
    expect(getTrackingStats([], state, at('2026-11-10'))).toMatchObject({ current: 0, longest: 7, freezes: 1, bounty: 0 });
    expect(getTrackingDays([], state, at('2026-11-10')).some((day) => day.status === 'FROZEN')).toBe(false);
  });

  it('protects a whole two-day gap when both freezes are available, without awarding days', () => {
    const state = ledger(14);
    expect(getTrackingStats([], state, at('2026-11-17'))).toMatchObject({
      current: 14, longest: 14, freezes: 0, bounty: 7_000_000, confirmedDays: 14, freezeProgress: 0,
    });
    expect(getTrackingDays([], state, at('2026-11-17')).filter((day) => day.status === 'FROZEN').map((day) => day.date))
      .toEqual(['2026-11-15', '2026-11-16']);
  });

  it('does not waste remaining inventory once a run has already ended', () => {
    const state = { ...ledger(14), confirmedDays: [
      ...ledger(14).confirmedDays,
      { date: '2026-12-01', status: 'LOGGED' as const },
    ] };
    const stats = getTrackingStats([], state, at('2026-12-02'));
    expect(stats).toMatchObject({ current: 1, longest: 14, freezes: 2, confirmedDays: 15 });
    expect(getTrackingDays([], state, at('2026-12-02'), 30).filter((day) => day.status === 'FROZEN')).toHaveLength(0);
  });

  it('backfills yesterday from frozen and refunds protection through replay', () => {
    const original = ledger();
    const restored = confirmNoSpend([], original, '2026-11-08', at('2026-11-09'));
    expect(getTrackingStats([], restored, at('2026-11-09'))).toMatchObject({
      current: 8, freezes: 1, bounty: 4_000_000, freezeProgress: 1,
    });
    expect(getTrackingDays([], restored, at('2026-11-09')).find((day) => day.date === '2026-11-08')?.status).toBe('NO_SPEND');
    expect(original.confirmedDays).toHaveLength(7);
  });

  it('backfills yesterday from missed and bridges the earlier frozen day', () => {
    const restored = confirmNoSpend([], ledger(), '2026-11-09', at('2026-11-10'));
    expect(getTrackingStats([], restored, at('2026-11-10'))).toMatchObject({ current: 8, longest: 8, freezes: 0, bounty: 4_000_000 });
    expect(getTrackingDays([], restored, at('2026-11-10')).find((day) => day.date === '2026-11-08')?.status).toBe('FROZEN');
  });

  it('backfills a real earlier purchase as logged without creating a duplicate expense', () => {
    const record = expense('2026-11-08', '2026-11-09');
    const records = [record];
    const state = confirmTrackingDay(records, ledger(), '2026-11-08', 'LOGGED', at('2026-11-09'));
    expect(state.confirmedDays.find((day) => day.date === '2026-11-08')?.status).toBe('LOGGED');
    expect(records).toEqual([record]);
    expect(getTrackingStats(records, state, at('2026-11-09')).bounty).toBe(4_500_000);
  });

  it('refuses a logged confirmation without a real expense on that day', () => {
    const state = ledger();
    expect(confirmTrackingDay([], state, '2026-11-08', 'LOGGED', at('2026-11-09'))).toBe(state);
  });

  it('rejects expired, malformed and future confirmations without changing the ledger', () => {
    const state = ledger();
    for (const date of ['2026-11-07', '2026-02-30', 'bad', '2026-11-11']) {
      expect(confirmNoSpend([], state, date, at('2026-11-10', '00:00:01'))).toBe(state);
    }
  });

  it('measures the 48-hour boundary after the target local day ends', () => {
    expect(canConfirmTrackingDay('2026-11-07', at('2026-11-10', '00:00:00'))).toBe(true);
    expect(canConfirmTrackingDay('2026-11-07', at('2026-11-10', '00:00:01'))).toBe(false);
  });

  it('reconciliation and confirmations are idempotent, including repeated rewards', () => {
    const now = at('2026-11-07');
    const first = reconcileStreak(days(7).map((day) => expense(day)), undefined, now);
    expect(reconcileStreak([], first, now)).toBe(first);
    expect(confirmNoSpend([], first, '2026-11-07', now)).toBe(first);
    const before = JSON.stringify(first);
    const stats = getTrackingStats([], first, now);
    for (let index = 0; index < 10; index += 1) expect(getTrackingStats([], first, now)).toEqual(stats);
    expect(JSON.stringify(first)).toBe(before);
    expect(stats).toMatchObject({ freezes: 1, bounty: 3_500_000 });
  });

  it('migrates old histories without retroactive freezes or changed legacy current/best/bounty', () => {
    const records = [...days(14, '2026-09-01'), ...days(3, '2026-11-03')].map((day) => expense(day));
    const now = at('2026-11-05');
    const state = reconcileStreak(records, undefined, now);
    expect(state.startedOn).toBe('2026-11-05');
    expect(state.confirmedDays).toHaveLength(17);
    expect(getTrackingStats(records, state, now)).toMatchObject(getStreakStats(records, now));
    expect(getTrackingStats(records, state, now).freezes).toBe(2);
  });

  it('preserves an already broken legacy run rather than silently restoring it', () => {
    const records = days(14).map((day) => expense(day));
    const now = at('2026-11-20');
    expect(getTrackingStats(records, undefined, now)).toMatchObject({ current: 0, longest: 14, freezes: 2, bounty: 0 });
  });

  it('handles a long absence without storing every missing day or mutating facts', () => {
    const state = ledger(14);
    const before = JSON.stringify(state);
    expect(getTrackingStats([], state, at('2076-11-05'))).toMatchObject({ current: 0, longest: 14, freezes: 2 });
    expect(getTrackingDays([], state, at('2076-11-05'))).toHaveLength(7);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('does not award future imports until their local creation day arrives', () => {
    const records = [expense('2026-11-08')];
    const state = reconcileStreak(records, undefined, at('2026-11-07'));
    expect(state.confirmedDays).toEqual([]);
    expect(getTrackingStats(records, state, at('2026-11-08'))).toMatchObject({ current: 1, bounty: 500_000 });
  });

  it('retains future confirmations across clock rollback without a second award on returning', () => {
    const state = ledger();
    expect(reconcileStreak([], state, at('2026-11-06'))).toBe(state);
    expect(getTrackingStats([], state, at('2026-11-06'))).toMatchObject({ current: 6, freezes: 0, confirmedDays: 6 });
    expect(getTrackingStats([], state, at('2026-11-07'))).toMatchObject({ current: 7, freezes: 1, confirmedDays: 7 });
  });

  it.each([
    ['2026-03-28', '2026-03-29', '2026-03-30'],
    ['2026-10-24', '2026-10-25', '2026-10-26'],
    ['2024-02-28', '2024-02-29', '2024-03-01'],
    ['2026-12-30', '2026-12-31', '2027-01-01'],
  ])('uses calendar adjacency across DST, leap and year boundaries: %s', (...dates) => {
    process.env.TZ = 'Europe/Berlin';
    const state: StreakLedger = { version: 1, startedOn: dates[0], confirmedDays: dates.map((date) => ({ date, status: 'NO_SPEND' })) };
    expect(getTrackingStats([], state, at(dates[2]))).toMatchObject({ current: 3, longest: 3, bounty: 1_500_000 });
  });

  it('uses elapsed hours across spring and autumn DST changes for backfill expiry', () => {
    process.env.TZ = 'Europe/Berlin';
    expect(canConfirmTrackingDay('2026-03-28', at('2026-03-31', '00:30:00'))).toBe(true);
    expect(canConfirmTrackingDay('2026-03-28', at('2026-03-31', '01:00:01'))).toBe(false);
    expect(canConfirmTrackingDay('2026-10-24', at('2026-10-26', '23:00:00'))).toBe(true);
    expect(canConfirmTrackingDay('2026-10-24', at('2026-10-26', '23:00:01'))).toBe(false);
  });

  it('changes the current local day across timezones without rebucketing saved labels', () => {
    const state = ledger();
    const instant = new Date('2026-11-07T23:30:00Z');
    process.env.TZ = 'America/Los_Angeles';
    expect(getTrackingStats([], state, instant)).toMatchObject({ todayStatus: 'LOGGED', confirmedDays: 7 });
    process.env.TZ = 'Asia/Tokyo';
    expect(getTrackingStats([], state, instant)).toMatchObject({ todayStatus: 'PENDING', confirmedDays: 7, current: 7 });
    expect(state.confirmedDays.at(-1)?.date).toBe('2026-11-07');
  });

  it('bounds the recent calendar while preserving all day statuses', () => {
    expect(getTrackingDays([], ledger(), at('2026-11-09'), 0)).toEqual([]);
    expect(getTrackingDays([], ledger(), at('2026-11-09'), 100_000)).toHaveLength(366);
    expect(getTrackingDays([], ledger(), at('2026-11-09'), Number.NaN)).toHaveLength(7);
  });
});

describe('tracking start and domain-owned confirmations', () => {
  it('shows neutral NONE before onboarding and leaves today pending', () => {
    const records: Transaction[] = [];
    const now = at('2026-11-09');
    const view = getTrackingDays(records, undefined, now);
    expect(view.slice(0, -1).every((day) => day.status === 'NONE' && !day.canConfirm)).toBe(true);
    expect(view.at(-1)).toEqual({ date: '2026-11-09', status: 'PENDING', canConfirm: true, confirmationStatus: 'NO_SPEND' });
    const result = confirmDay(records, undefined, '2026-11-08', now);
    expect(result.status).toBe('unavailable');
    expect(result.ledger.confirmedDays).toEqual([]);
  });

  it('uses the earliest historical confirmation as the start, preserving migrated history', () => {
    const state: StreakLedger = { version: STREAK_LEDGER_VERSION, startedOn: '2026-11-09',
      confirmedDays: [{ date: '2026-11-07', status: 'LOGGED' }] };
    const view = getTrackingDays([], state, at('2026-11-09'));
    expect(view.filter((day) => day.date < '2026-11-07').every((day) => day.status === 'NONE' && !day.canConfirm)).toBe(true);
    expect(view.find((day) => day.date === '2026-11-07')?.status).toBe('LOGGED');
    expect(view.find((day) => day.date === '2026-11-08')).toMatchObject({ status: 'MISSED', canConfirm: true });
    expect(getTrackingStats([], state, at('2026-11-09'))).toMatchObject({ current: 0, longest: 1, confirmedDays: 1 });
  });

  it('uses startedOn without historical confirmations and keeps today open after a clock rollback', () => {
    const state: StreakLedger = { version: STREAK_LEDGER_VERSION, startedOn: '2026-11-07', confirmedDays: [] };
    const view = getTrackingDays([], state, at('2026-11-09'));
    expect(view.find((day) => day.date === '2026-11-06')?.status).toBe('NONE');
    expect(view.find((day) => day.date === '2026-11-07')?.status).toBe('MISSED');
    const rollback = getTrackingDays([], { ...state, startedOn: '2026-11-10' }, at('2026-11-09'));
    expect(rollback.at(-1)).toMatchObject({ status: 'PENDING', canConfirm: true });
  });

  it('returns saved then already without duplicating a no-spend reward', () => {
    const records: Transaction[] = [];
    const now = at('2026-11-09');
    const first = confirmDay(records, undefined, '2026-11-09', now);
    expect(first).toMatchObject({ status: 'saved', dayStatus: 'NO_SPEND' });
    expect(first.ledger.version).toBe(STREAK_LEDGER_VERSION);
    const repeated = confirmDay(records, first.ledger, '2026-11-09', now);
    expect(repeated).toEqual({ status: 'already', dayStatus: 'NO_SPEND', ledger: first.ledger });
    expect(repeated.ledger).toBe(first.ledger);
    expect(getTrackingStats(records, repeated.ledger, now)).toMatchObject({ confirmedDays: 1, bounty: 500_000 });
    expect(records).toEqual([]);
  });

  it('distinguishes expired and unavailable days without inventing confirmations', () => {
    const records: Transaction[] = [];
    const state = ledger(1);
    const now = at('2026-11-09');
    expect(confirmDay(records, state, '2026-11-05', now)).toEqual({ status: 'expired', ledger: state });
    for (const date of ['2026-10-31', '2026-11-10', '2026-02-30', 'bad']) {
      expect(confirmDay(records, state, date, now)).toEqual({ status: 'unavailable', ledger: state });
    }
    expect(confirmDay(records, state, '2026-11-01', now)).toEqual({ status: 'already', dayStatus: 'LOGGED', ledger: state });
    expect(state.confirmedDays).toHaveLength(1);
  });

  it('derives LOGGED from an earlier purchase whose creation date is different', () => {
    const now = at('2026-11-09');
    const transaction = expense('2026-11-08', '2026-11-09');
    const records = [transaction];
    const state: StreakLedger = { version: STREAK_LEDGER_VERSION, startedOn: '2026-11-07', confirmedDays: [] };
    const result = confirmDay(records, state, '2026-11-08', now);
    expect(result).toMatchObject({ status: 'saved', dayStatus: 'LOGGED' });
    expect(result.ledger.confirmedDays).toEqual([
      { date: '2026-11-08', status: 'LOGGED' }, { date: '2026-11-09', status: 'LOGGED' },
    ]);
    expect(getTrackingDays(records, state, now).find((day) => day.date === '2026-11-08'))
      .toMatchObject({ canConfirm: true, confirmationStatus: 'LOGGED' });
    expect(getTrackingStats(records, result.ledger, now)).toMatchObject({ confirmedDays: 2, bounty: 1_000_000 });
    expect(records).toEqual([transaction]);
  });

  it('never labels an actual earlier purchase NO_SPEND through the compatibility wrapper', () => {
    const now = at('2026-11-09');
    const records = [expense('2026-11-08', '2026-11-09')];
    const state: StreakLedger = { version: STREAK_LEDGER_VERSION, startedOn: '2026-11-07', confirmedDays: [] };
    const result = confirmNoSpend(records, state, '2026-11-08', now);
    expect(result.confirmedDays.find((entry) => entry.date === '2026-11-08')?.status).toBe('LOGGED');
  });

  it('upgrades a previously counted no-spend purchase day without awarding it again', () => {
    const now = at('2026-11-09');
    const state: StreakLedger = { version: STREAK_LEDGER_VERSION, startedOn: '2026-11-08',
      confirmedDays: [{ date: '2026-11-08', status: 'NO_SPEND' }] };
    const records = [expense('2026-11-08', '2026-11-09')];
    const result = confirmDay(records, state, '2026-11-08', now);
    expect(result).toMatchObject({ status: 'already', dayStatus: 'LOGGED' });
    expect(result.ledger.confirmedDays).toHaveLength(2);
    expect(getTrackingStats(records, result.ledger, now)).toMatchObject({ confirmedDays: 2, bounty: 1_000_000 });
    expect(state.confirmedDays).toEqual([{ date: '2026-11-08', status: 'NO_SPEND' }]);
  });

  it('does not invent past tracking credit from a backdated purchase before onboarding', () => {
    const records = [expense('2026-11-08', '2026-11-09')];
    const result = confirmDay(records, undefined, '2026-11-08', at('2026-11-09'));
    expect(result.status).toBe('unavailable');
    expect(result.ledger.confirmedDays).toEqual([{ date: '2026-11-09', status: 'LOGGED' }]);
    expect(getTrackingStats(records, result.ledger, at('2026-11-09')).bounty).toBe(500_000);
  });
});

describe('bounded immutable reconciliation and replay caches', () => {
  it('scans 50,000 records once across repeated stats, calendar and reconciliation reads', () => {
    let dateReads = 0, createdReads = 0;
    const records = Array.from({ length: 50_000 }, (_, index) => new Proxy({ ...expense('2026-11-09'), id: String(index) }, {
      get(target, key, receiver) {
        if (key === 'date') dateReads++;
        if (key === 'createdAt') createdReads++;
        return Reflect.get(target, key, receiver);
      },
    }));
    const state = ledger();
    const now = at('2026-11-09');
    const first = getTrackingStats(records, state, now);
    const normalized = reconcileStreak(records, state, now);
    expect(dateReads).toBe(50_000);
    expect(createdReads).toBe(50_000);
    for (let index = 0; index < 10; index++) {
      expect(getTrackingStats(records, state, now)).toBe(first);
      expect(getTrackingStats(records, normalized, now)).toBe(first);
      expect(reconcileStreak(records, normalized, now)).toBe(normalized);
      expect(getTrackingDays(records, normalized, now)).toHaveLength(7);
    }
    expect(dateReads).toBe(50_000);
    expect(createdReads).toBe(50_000);
    expect(first).toMatchObject({ current: 8, confirmedDays: 8, bounty: 4_000_000 });
  });

  it('invalidates for transaction references, ledger references and the local calendar day', () => {
    let reads = 0;
    const transaction = new Proxy(expense('2026-11-09'), {
      get(target, key, receiver) { if (key === 'createdAt') reads++; return Reflect.get(target, key, receiver); },
    });
    const records = [transaction];
    const state: StreakLedger = { version: STREAK_LEDGER_VERSION, startedOn: '2026-11-09', confirmedDays: [] };
    const now = at('2026-11-09');
    getTrackingStats(records, state, now);
    getTrackingStats(records, state, at('2026-11-09', '23:59:59'));
    expect(reads).toBe(1);
    getTrackingStats([...records], state, now);
    expect(reads).toBe(2);
    getTrackingStats(records, { ...state }, now);
    expect(reads).toBe(3);
    getTrackingStats(records, state, at('2026-11-10', '00:00:00'));
    expect(reads).toBe(4);
    const updated = getTrackingStats([...records, expense('2026-11-10')], state, at('2026-11-10'));
    expect(reads).toBe(5);
    expect(updated).toMatchObject({ current: 2, confirmedDays: 2 });
  });

  it('keeps only the latest ledger variant per transaction array without sharing stale stats', () => {
    let reads = 0;
    const records = [new Proxy(expense('2026-11-09'), {
      get(target, key, receiver) { if (key === 'createdAt') reads++; return Reflect.get(target, key, receiver); },
    })];
    const first: StreakLedger = { version: STREAK_LEDGER_VERSION, startedOn: '2026-11-08',
      confirmedDays: [{ date: '2026-11-09', status: 'LOGGED' }] };
    const second: StreakLedger = { ...first, confirmedDays: [
      { date: '2026-11-08', status: 'NO_SPEND' }, ...first.confirmedDays,
    ] };
    expect(getTrackingStats(records, first, at('2026-11-09')).current).toBe(1);
    expect(getTrackingStats(records, second, at('2026-11-09')).current).toBe(2);
    expect(getTrackingStats(records, first, at('2026-11-09')).current).toBe(1);
    expect(reads).toBe(3);
  });

  it('invalidates on timezone day changes but never moves saved date labels', () => {
    let reads = 0;
    const records = [new Proxy(expense('2026-11-09'), {
      get(target, key, receiver) { if (key === 'createdAt') reads++; return Reflect.get(target, key, receiver); },
    })];
    const state: StreakLedger = { version: STREAK_LEDGER_VERSION, startedOn: '2026-11-09',
      confirmedDays: [{ date: '2026-11-09', status: 'LOGGED' }] };
    const instant = new Date('2026-11-09T23:30:00Z');
    process.env.TZ = 'America/Los_Angeles';
    expect(getTrackingStats(records, state, instant).activeToday).toBe(true);
    process.env.TZ = 'Asia/Tokyo';
    expect(getTrackingStats(records, state, instant).activeToday).toBe(false);
    process.env.TZ = 'America/Los_Angeles';
    expect(getTrackingStats(records, state, instant).activeToday).toBe(true);
    expect(reads).toBe(3);
    expect(state.confirmedDays[0].date).toBe('2026-11-09');
  });

  it('rechecks precise backfill expiry even when the cached local day has not changed', () => {
    const records: Transaction[] = [];
    const state = ledger();
    const before = getTrackingDays(records, state, at('2026-11-11', '00:00:00'));
    const after = getTrackingDays(records, state, at('2026-11-11', '00:00:01'));
    expect(before.find((day) => day.date === '2026-11-08')?.canConfirm).toBe(true);
    expect(after.find((day) => day.date === '2026-11-08')?.canConfirm).toBe(false);
    expect(confirmDay(records, state, '2026-11-08', at('2026-11-11', '00:00:01')).status).toBe('expired');
  });
});

describe('streak ledger validation and concurrent merge', () => {
  it('accepts valid leap days and rejects impossible calendar labels', () => {
    expect(isTrackingDate('2024-02-29')).toBe(true);
    for (const value of ['2026-02-29', '0000-01-01', '2026-13-01', '2026-04-31', '2026-1-01']) {
      expect(isTrackingDate(value)).toBe(false);
    }
  });

  it('rejects unknown statuses, duplicate days and malformed persisted ledgers', () => {
    expect(isStreakLedger(ledger())).toBe(true);
    for (const value of [null, [], {}, { ...ledger(), version: 2 }, { ...ledger(), startedOn: 'bad' },
      { ...ledger(), confirmedDays: [{ date: '2026-11-01', status: 'FROZEN' }] },
      { ...ledger(), confirmedDays: [ledger().confirmedDays[0], ledger().confirmedDays[0]] },
      { ...ledger(), confirmedDays: [{ date: '2026-02-30', status: 'LOGGED' }] },
    ]) expect(isStreakLedger(value)).toBe(false);
  });

  it('unions competing daily confirmations without multiplying freeze credits', () => {
    const left = ledger(6);
    const right = confirmNoSpend([], left, '2026-11-07', at('2026-11-07'));
    const recorded = reconcileStreak([expense('2026-11-07')], left, at('2026-11-07'));
    const merged = mergeStreakLedgers(right, recorded)!;
    expect(merged.confirmedDays).toHaveLength(7);
    expect(merged.confirmedDays.at(-1)?.status).toBe('LOGGED');
    expect(getTrackingStats([], merged, at('2026-11-07'))).toMatchObject({ freezes: 1, bounty: 3_500_000 });
    expect(mergeStreakLedgers(recorded, right)).toEqual(merged);
    expect(mergeStreakLedgers(merged, merged)).toBe(merged);
  });

  it('preserves the earliest protection start and identity for unchanged merges', () => {
    const left = ledger();
    const right = { ...left, startedOn: '2026-11-05' };
    expect(mergeStreakLedgers(left, right)).toBe(left);
    expect(mergeStreakLedgers(undefined, left)).toBe(left);
    expect(mergeStreakLedgers(left, undefined)).toBe(left);
    expect(mergeStreakLedgers()).toBeUndefined();
  });
});
