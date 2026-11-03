import {
  STORAGE_KEY,
  createEmptyData,
  validateBackup,
  type AppData,
  type Transaction,
} from './finance';

export { parseMoney } from './finance';

export const LAST_GOOD_KEY = `${STORAGE_KEY}:last-good`;
export const CORRUPT_KEY = `${STORAGE_KEY}:recovery`;

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem'>;
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

/** Reading is deliberately side-effect free, even when a backup can be recovered. */
export function readStoredData(storage?: StorageAdapter): StoredData {
  let source: StorageAdapter;
  let raw: string | null;
  try {
    source = browserStorage(storage);
    raw = source.getItem(STORAGE_KEY);
  } catch {
    return { data: createEmptyData(), status: 'unavailable' };
  }
  if (raw === null) return { data: createEmptyData(), status: 'empty' };
  try {
    return { data: validateBackup(raw), status: 'ready' };
  } catch {
    try {
      const previous = source.getItem(LAST_GOOD_KEY);
      if (previous !== null) return { data: validateBackup(previous), status: 'recovered', raw };
    } catch {
      // Keep the original primary value intact even if the secondary copy is unusable.
    }
    return { data: createEmptyData(), status: 'corrupt', raw };
  }
}

/** Archive corrupt input before replacing it; never report a failed primary write as success. */
export function writeStoredData(
  next: AppData,
  storage?: StorageAdapter,
  options: { replaceCorrupt?: boolean } = {},
): void {
  const serialized = JSON.stringify(validateBackup(next));
  const destination = browserStorage(storage);
  const raw = destination.getItem(STORAGE_KEY);
  let corrupt = false;
  if (raw !== null) {
    try { validateBackup(raw); } catch { corrupt = true; }
  }
  if (corrupt) {
    if (!options.replaceCorrupt) throw new StorageRecoveryError();
    // A failed archive write must leave the original untouched.
    destination.setItem(CORRUPT_KEY, raw!);
  }
  destination.setItem(STORAGE_KEY, serialized);
  try {
    destination.setItem(LAST_GOOD_KEY, serialized);
  } catch {
    // The primary commit succeeded. A quota-limited secondary copy cannot undo it.
  }
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

function mergeRecords<T extends { id: string }>(base: T[], current: T[], desired: T[]): T[] {
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

/** Merge against the latest persisted snapshot instead of overwriting another tab. */
export function mergeAppData(base: AppData, current: AppData, desired: AppData): AppData {
  const original = validateBackup(base);
  const remote = validateBackup(current);
  const local = validateBackup(desired);
  const shoppingList = mergeRecords(original.shoppingList ?? [], remote.shoppingList ?? [], local.shoppingList ?? []);
  return validateBackup({
    version: 1,
    profile: mergeFields(original.profile, remote.profile, local.profile),
    transactions: mergeRecords(original.transactions, remote.transactions, local.transactions),
    ...([original, remote, local].some((data) => data.shoppingList !== undefined) ? { shoppingList } : {}),
  });
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
