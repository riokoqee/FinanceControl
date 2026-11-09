import {
  STORAGE_KEY,
  MAX_BACKUP_LENGTH,
  createEmptyData,
  validateBackup,
  type AppData,
  type CategoryBudget,
  type Profile,
  type Transaction,
} from '../finance';
import { isStreakLedger, mergeStreakLedgers } from '../streak/streakTypes';
import { streakCopy } from '../streak/streakCopy';

export { parseMoney } from '../finance';

export const LAST_GOOD_KEY = `${STORAGE_KEY}:last-good`;
export const CORRUPT_KEY = `${STORAGE_KEY}:recovery`;

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem'>;
type WriteOptions = { replaceCorrupt?: boolean };

// Strings are immutable: unlike an AppData identity, this cannot become stale when
// a caller edits its input. Keep only one value per adapter to bound retained data.
const checkedPrimary = new WeakMap<StorageAdapter, { raw: string; valid: boolean }>();

class StorageChangedError extends Error {}
export type StorageStatus = 'ready' | 'empty' | 'recovered' | 'corrupt' | 'unavailable';
export interface StoredData {
  data: AppData;
  status: StorageStatus;
  /** Retained verbatim until an explicit recovery or reset archives it. */
  raw?: string;
}

export class StorageRecoveryError extends Error {
  constructor() {
    super('Сохранённые данные повреждены. Исходная копия сохранена. Восстановите резервную копию или подтвердите сброс.');
    this.name = 'StorageRecoveryError';
  }
}

export class DataConflictError extends Error {
  constructor() {
    super('Данные изменились в другой вкладке. Обновите запись и повторите изменение.');
    this.name = 'DataConflictError';
  }
}

function browserStorage(storage?: StorageAdapter): StorageAdapter {
  const destination = storage ?? globalThis.localStorage;
  if (!destination) throw new Error('Хранилище браузера недоступно.');
  return destination;
}

function checkPrimary(source: StorageAdapter, raw: string): boolean {
  const previous = checkedPrimary.get(source);
  if (previous?.raw === raw) return previous.valid;
  let valid = true;
  try { validateBackup(raw); } catch { valid = false; }
  checkedPrimary.set(source, { raw, valid });
  return valid;
}

function readSnapshot(source: StorageAdapter, raw: string | null): StoredData {
  if (raw === null) return { data: createEmptyData(), status: 'empty' };
  try {
    const data = validateBackup(raw);
    checkedPrimary.set(source, { raw, valid: true });
    return { data, status: 'ready' };
  } catch {
    checkedPrimary.set(source, { raw, valid: false });
    try {
      const previous = source.getItem(LAST_GOOD_KEY);
      if (previous !== null) return { data: validateBackup(previous), status: 'recovered', raw };
    } catch {
      // Keep the original primary value intact even if the secondary copy is unusable.
    }
    return { data: createEmptyData(), status: 'corrupt', raw };
  }
}

/** Reading is deliberately side-effect free, even when a backup can be recovered. */
export function readStoredData(storage?: StorageAdapter, previous?: AppData): StoredData {
  let source: StorageAdapter;
  let raw: string | null;
  try {
    source = browserStorage(storage);
    raw = source.getItem(STORAGE_KEY);
  } catch {
    return { data: createEmptyData(), status: 'unavailable' };
  }
  const stored = readSnapshot(source, raw);
  return previous && (stored.status === 'ready' || stored.status === 'empty')
    ? { ...stored, data: shareUnchanged(previous, stored.data) }
    : stored;
}

/** Only called with a canonical, freshly validated payload. */
function writePrepared(
  serialized: string,
  destination: StorageAdapter,
  options: WriteOptions,
  expected?: { raw: string | null },
): void {
  // Object validation does not apply the string import limit. A saved payload
  // must also remain readable by the same validator after a browser restart.
  if (serialized.length > MAX_BACKUP_LENGTH) throw new Error('Файл резервной копии слишком большой.');
  const raw = destination.getItem(STORAGE_KEY);
  if (expected && raw !== expected.raw) throw new StorageChangedError();
  const corrupt = raw !== null && !checkPrimary(destination, raw);
  if (corrupt) {
    if (!options.replaceCorrupt) throw new StorageRecoveryError();
    // A failed archive write must leave the original untouched.
    destination.setItem(CORRUPT_KEY, raw!);
  }
  destination.setItem(STORAGE_KEY, serialized);
  checkedPrimary.set(destination, { raw: serialized, valid: true });
  try {
    destination.setItem(LAST_GOOD_KEY, serialized);
  } catch {
    // The primary commit succeeded. A quota-limited secondary copy cannot undo it.
  }
}

/** Archive corrupt input before replacing it; never report a failed primary write as success. */
export function writeStoredData(
  next: AppData,
  storage?: StorageAdapter,
  options: WriteOptions = {},
): void {
  const serialized = JSON.stringify(validateBackup(next));
  writePrepared(serialized, browserStorage(storage), options);
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => same(value, b[index]));
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const left = Object.keys(a);
    const right = Object.keys(b);
    return left.length === right.length && left.every((key) => (
      Object.prototype.hasOwnProperty.call(b, key) &&
      same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    ));
  }
  return false;
}

/** Fields containing arrays (purchase details) are atomic, never merged by position. */
function mergeFields<T extends object>(base: T, current: T, desired: T): T {
  const result = { ...current } as Record<string, unknown>;
  const original = base as Record<string, unknown>;
  const local = desired as Record<string, unknown>;
  const remote = current as Record<string, unknown>;
  const keys = new Set([...Object.keys(original), ...Object.keys(local)]);
  for (const key of keys) {
    if (same(local[key], original[key])) continue;
    if (!same(remote[key], original[key]) && !same(remote[key], local[key])) throw new DataConflictError();
    if (local[key] === undefined) delete result[key];
    else result[key] = local[key];
  }
  return result as T;
}

function mergeRecords<T extends { id: string }>(
  base: T[], current: T[], desired: T[], options: { atomic?: boolean } = {},
): T[] {
  const originals = new Map(base.map((record) => [record.id, record]));
  const locals = new Map(desired.map((record) => [record.id, record]));
  const remotes = new Map(current.map((record) => [record.id, record]));
  const result: T[] = [];
  for (const remote of current) {
    const original = originals.get(remote.id);
    const local = locals.get(remote.id);
    if (!original) {
      if (local && !same(remote, local)) throw new DataConflictError();
      result.push(remote);
    } else if (!local) {
      if (!same(remote, original)) throw new DataConflictError();
    } else {
      // Amount and currency are one value: independently merging these fields
      // could silently turn an intended EUR limit into the same number in USD.
      if (options.atomic && !same(local, original) && !same(remote, original) && !same(remote, local)) {
        throw new DataConflictError();
      }
      result.push(mergeFields(original, remote, local));
    }
  }
  for (const local of desired) {
    if (remotes.has(local.id)) continue;
    const original = originals.get(local.id);
    if (!original) result.push(local);
    else if (!same(local, original)) throw new DataConflictError();
    // An unchanged local record must respect a deletion from another tab.
  }
  return result;
}

/** Ordinary edits only add/upgrade facts; their removal identifies a replacement. */
function streakWasReplaced(original: AppData, current: AppData): boolean {
  if (original.streak === undefined) return false;
  if (current.streak === undefined || current.streak.startedOn > original.streak.startedOn) return true;
  const days = new Map(current.streak.confirmedDays.map((entry) => [entry.date, entry.status]));
  return original.streak.confirmedDays.some((entry) => {
    const status = days.get(entry.date);
    return status === undefined || (entry.status === 'LOGGED' && status !== 'LOGGED');
  });
}

/** Merge against the latest persisted snapshot instead of overwriting another tab. */
export function mergeAppData(base: AppData, current: AppData, desired: AppData): AppData {
  const original = validateBackup(base);
  const remote = current === base ? original : validateBackup(current);
  const local = desired === base ? original : desired === current ? remote : validateBackup(desired);
  // Identity is used only within this synchronous call, after validation. It is
  // never cached or trusted by a later call with a potentially edited object.
  if (desired === base || desired === current) return remote;
  if (streakWasReplaced(original, remote)) {
    // Accept a read-only/no-op refresh, but never restore pre-reset days as a
    // side effect of saving an old profile or expense editor from another tab.
    if (same(original, local)) return remote;
    throw new DataConflictError();
  }
  const shoppingList = mergeRecords(original.shoppingList ?? [], remote.shoppingList ?? [], local.shoppingList ?? []);
  const categoryBudgets = mergeRecords(original.categoryBudgets ?? [], remote.categoryBudgets ?? [], local.categoryBudgets ?? [], { atomic: true });
  const shoppingTemplates = mergeRecords(original.shoppingTemplates ?? [], remote.shoppingTemplates ?? [], local.shoppingTemplates ?? []);
  // A confirmation is an immutable daily fact, so a stale tab may add facts but
  // cannot erase another tab's day or duplicate derived freeze/reward credits.
  const streak = mergeStreakLedgers(
    mergeStreakLedgers(original.streak, remote.streak), local.streak,
  );
  return validateBackup({
    version: Math.max(original.version, remote.version, local.version),
    profile: mergeFields(original.profile, remote.profile, local.profile),
    transactions: mergeRecords(original.transactions, remote.transactions, local.transactions),
    ...([original, remote, local].some((data) => data.shoppingList !== undefined) ? { shoppingList } : {}),
    ...([original, remote, local].some((data) => data.categoryBudgets !== undefined) ? { categoryBudgets } : {}),
    ...([original, remote, local].some((data) => data.shoppingTemplates !== undefined) ? { shoppingTemplates } : {}),
    ...(streak !== undefined ? { streak } : {}),
  });
}

/** Reuse equal canonical records so unrelated profile edits do not redraw a ledger. */
function shareRecords<T extends { id: string }>(previous: T[], next: T[]): T[] {
  if (same(previous, next)) return previous;
  const originals = new Map(previous.map((record) => [record.id, record]));
  return next.map((record) => {
    const original = originals.get(record.id);
    return original && same(original, record) ? original : record;
  });
}

function shareUnchanged(previous: AppData, next: AppData): AppData {
  return {
    ...next,
    profile: same(previous.profile, next.profile) ? previous.profile : next.profile,
    transactions: shareRecords(previous.transactions, next.transactions),
    ...(next.shoppingList !== undefined ? {
      shoppingList: previous.shoppingList === undefined
        ? next.shoppingList
        : shareRecords(previous.shoppingList, next.shoppingList),
    } : {}),
    ...(next.categoryBudgets !== undefined ? {
      categoryBudgets: previous.categoryBudgets === undefined
        ? next.categoryBudgets
        : shareRecords(previous.categoryBudgets, next.categoryBudgets),
    } : {}),
    ...(next.shoppingTemplates !== undefined ? {
      shoppingTemplates: previous.shoppingTemplates === undefined
        ? next.shoppingTemplates
        : shareRecords(previous.shoppingTemplates, next.shoppingTemplates),
    } : {}),
    ...(next.streak !== undefined ? {
      streak: previous.streak !== undefined && same(previous.streak, next.streak)
        ? previous.streak : next.streak,
    } : {}),
  };
}

/** Match mergeRecords ordering: surviving current records, then local additions. */
function retainRecordOrder<T extends { id: string }>(previous: T[], next: T[]): T[] {
  if (previous.length === next.length && previous.every((record, index) => record.id === next[index].id)) return next;
  const remaining = new Map(next.map((record) => [record.id, record]));
  const result: T[] = [];
  for (const record of previous) {
    const surviving = remaining.get(record.id);
    if (surviving) {
      result.push(surviving);
      remaining.delete(record.id);
    }
  }
  for (const record of next) if (remaining.has(record.id)) result.push(record);
  return result;
}

/** Only an explicit full replacement/reset may remove confirmed accounting days. */
function retainConfirmedDays(previous: AppData, candidate: AppData): AppData {
  if (previous.streak === undefined) return candidate;
  const streak = mergeStreakLedgers(previous.streak, candidate.streak);
  if (!isStreakLedger(streak)) throw new Error(streakCopy.ru.invalidHistory);
  return { ...candidate, version: candidate.profile.exchangeRates ? 4 : 3, streak };
}

/**
 * Persist one mutation. An unchanged primary needs no three-way merge or extra
 * whole-ledger copies; a changed primary still takes the full conflict path.
 */
export function commitStoredData(
  base: AppData,
  desired: AppData,
  storage?: StorageAdapter,
  options: WriteOptions = {},
): AppData {
  const destination = browserStorage(storage);
  const serializedBase = JSON.stringify(base);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const raw = destination.getItem(STORAGE_KEY);
    let next: AppData;
    if (options.replaceCorrupt) {
      next = validateBackup(desired);
    } else if (raw === serializedBase) {
      const candidate = retainConfirmedDays(base, validateBackup(desired));
      next = {
        ...candidate,
        transactions: retainRecordOrder(base.transactions, candidate.transactions),
        ...(base.shoppingList !== undefined || candidate.shoppingList !== undefined ? {
          shoppingList: retainRecordOrder(base.shoppingList ?? [], candidate.shoppingList ?? []),
        } : {}),
        ...(base.categoryBudgets !== undefined || candidate.categoryBudgets !== undefined ? {
          categoryBudgets: retainRecordOrder(base.categoryBudgets ?? [], candidate.categoryBudgets ?? []),
        } : {}),
        ...(base.shoppingTemplates !== undefined || candidate.shoppingTemplates !== undefined ? {
          shoppingTemplates: retainRecordOrder(base.shoppingTemplates ?? [], candidate.shoppingTemplates ?? []),
        } : {}),
      };
    } else {
      const stored = readSnapshot(destination, raw);
      if (stored.status === 'corrupt' || stored.status === 'recovered') throw new StorageRecoveryError();
      next = mergeAppData(base, stored.data, desired);
    }
    try {
      // Recheck immediately before the write: another tab may have changed the
      // primary while the candidate was validated. Retry against that snapshot.
      writePrepared(JSON.stringify(next), destination, options, { raw });
      return shareUnchanged(base, next);
    } catch (cause) {
      if (!(cause instanceof StorageChangedError)) throw cause;
    }
  }
  throw new DataConflictError();
}

/**
 * Recompute a pure mutation against the latest primary on every retry. Use for
 * actions whose preconditions depend on the whole current collection, such as
 * template capacity and shopping-list deduplication, rather than stale editors.
 */
export function commitStoredMutation(
  base: AppData,
  update: (current: AppData) => AppData,
  storage?: StorageAdapter,
  options: WriteOptions = {},
): AppData {
  const destination = browserStorage(storage);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const raw = destination.getItem(STORAGE_KEY);
    const stored = readSnapshot(destination, raw);
    if ((stored.status === 'corrupt' || stored.status === 'recovered') && !options.replaceCorrupt) {
      throw new StorageRecoveryError();
    }
    const desired = validateBackup(update(stored.data));
    const candidate = options.replaceCorrupt ? desired : retainConfirmedDays(stored.data, desired);
    const next: AppData = {
      ...candidate,
      transactions: retainRecordOrder(stored.data.transactions, candidate.transactions),
      ...(stored.data.shoppingList !== undefined || candidate.shoppingList !== undefined ? {
        shoppingList: retainRecordOrder(stored.data.shoppingList ?? [], candidate.shoppingList ?? []),
      } : {}),
      ...(stored.data.categoryBudgets !== undefined || candidate.categoryBudgets !== undefined ? {
        categoryBudgets: retainRecordOrder(stored.data.categoryBudgets ?? [], candidate.categoryBudgets ?? []),
      } : {}),
      ...(stored.data.shoppingTemplates !== undefined || candidate.shoppingTemplates !== undefined ? {
        shoppingTemplates: retainRecordOrder(stored.data.shoppingTemplates ?? [], candidate.shoppingTemplates ?? []),
      } : {}),
    };
    try {
      writePrepared(JSON.stringify(next), destination, options, { raw });
      return shareUnchanged(base, next);
    } catch (cause) {
      if (!(cause instanceof StorageChangedError)) throw cause;
    }
  }
  throw new DataConflictError();
}

/** Merge a profile editor without copying or validating the expense history. */
export function mergeProfileDraft(base: Profile, current: Profile, draft: Profile): Profile {
  const profileData = createEmptyData();
  const original = validateBackup({ ...profileData, profile: base }).profile;
  const remote = current === base ? original : validateBackup({ ...profileData, profile: current }).profile;
  const local = draft === base ? original : draft === current ? remote : validateBackup({ ...profileData, profile: draft }).profile;
  return validateBackup({ ...profileData, profile: mergeFields(original, remote, local) }).profile;
}

/** Keep separate categories independent, but amount and currency indivisible. */
export function mergeCategoryBudgetsDraft(
  base: CategoryBudget[],
  current: CategoryBudget[],
  draft: CategoryBudget[],
): CategoryBudget[] {
  const empty = createEmptyData();
  const original = validateBackup({ ...empty, categoryBudgets: base }).categoryBudgets!;
  const remote = current === base ? original : validateBackup({ ...empty, categoryBudgets: current }).categoryBudgets!;
  const local = draft === base ? original : draft === current ? remote : validateBackup({ ...empty, categoryBudgets: draft }).categoryBudgets!;
  return validateBackup({ ...empty, categoryBudgets: mergeRecords(original, remote, local, { atomic: true }) }).categoryBudgets!;
}

/** A dialog changes only its edited fields, retaining newer purchase details and prices. */
export function mergeTransactionDraft(
  base: Transaction,
  current: Transaction | undefined,
  draft: Transaction,
): Transaction {
  if (!current || current.id !== base.id || draft.id !== base.id) throw new DataConflictError();
  const transaction = mergeFields(base, current, draft);
  return validateBackup({ ...createEmptyData(), transactions: [transaction] }).transactions[0];
}
