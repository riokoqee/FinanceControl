import { describe, expect, it } from 'vitest';
import { MAX_AMOUNT, MAX_TRANSACTIONS, STORAGE_KEY, createEmptyData, type AppData, type Transaction } from './finance';
import {
  CORRUPT_KEY,
  LAST_GOOD_KEY,
  DataConflictError,
  StorageRecoveryError,
  mergeAppData,
  mergeTransactionDraft,
  parseMoney,
  readStoredData,
  writeStoredData,
} from './storage';

const expense = (patch: Partial<Transaction> = {}): Transaction => ({
  id: 'expense', title: 'Groceries', amount: 25, currency: 'EUR', category: 'food', date: '2026-11-03', ...patch,
});
const data = (): AppData => ({ ...createEmptyData(), transactions: [expense()] });
const copy = <T,>(value: T): T => structuredClone(value);
function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: Array<[string, string]> = [];
  return {
    values,
    writes,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { writes.push([key, value]); values.set(key, value); },
  };
}

describe('recoverable local persistence', () => {
  it('reads an empty or valid store without writing anything', () => {
    const storage = memoryStorage();
    expect(readStoredData(storage)).toEqual({ status: 'empty', data: createEmptyData() });
    storage.values.set(STORAGE_KEY, JSON.stringify(data()));
    expect(readStoredData(storage)).toEqual({ status: 'ready', data: data() });
    expect(storage.writes).toEqual([]);
  });

  it.each(['{broken', '', JSON.stringify({ ...data(), transactions: [expense({ amount: 0 })] })])(
    'preserves invalid primary data verbatim without allowing an automatic overwrite', (raw) => {
      const storage = memoryStorage({ [STORAGE_KEY]: raw });
      expect(readStoredData(storage)).toEqual({ status: 'corrupt', data: createEmptyData(), raw });
      expect(() => writeStoredData(createEmptyData(), storage)).toThrow(StorageRecoveryError);
      expect(storage.values.get(STORAGE_KEY)).toBe(raw);
      expect(storage.writes).toEqual([]);
    },
  );

  it('returns the last good snapshot while retaining the damaged original', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: 'damaged', [LAST_GOOD_KEY]: JSON.stringify(data()) });
    expect(readStoredData(storage)).toEqual({ status: 'recovered', data: data(), raw: 'damaged' });
    expect(storage.values.get(STORAGE_KEY)).toBe('damaged');
    expect(storage.writes).toEqual([]);
    expect(() => writeStoredData(data(), storage)).toThrow(StorageRecoveryError);
  });

  it('ignores a damaged last-good copy and leaves both originals intact', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{primary', [LAST_GOOD_KEY]: '{secondary' });
    expect(readStoredData(storage).status).toBe('corrupt');
    expect(storage.writes).toEqual([]);
  });

  it('archives a damaged primary before an explicitly requested replacement', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: 'original damaged data' });
    writeStoredData(data(), storage, { replaceCorrupt: true });
    expect(storage.writes.map(([key]) => key)).toEqual([CORRUPT_KEY, STORAGE_KEY, LAST_GOOD_KEY]);
    expect(storage.values.get(CORRUPT_KEY)).toBe('original damaged data');
    expect(readStoredData(storage)).toEqual({ status: 'ready', data: data() });
  });

  it('does not overwrite the primary when archiving fails', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: 'original' });
    const failArchive = { ...storage, setItem: (key: string, value: string) => {
      if (key === CORRUPT_KEY) throw new Error('QuotaExceededError');
      storage.setItem(key, value);
    } };
    expect(() => writeStoredData(data(), failArchive, { replaceCorrupt: true })).toThrow('QuotaExceededError');
    expect(storage.values.get(STORAGE_KEY)).toBe('original');
    expect(storage.writes).toEqual([]);
  });

  it('rejects invalid state before any storage access or write', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(data()) });
    expect(() => writeStoredData({ ...data(), transactions: [expense({ amount: NaN })] }, storage)).toThrow();
    expect(storage.writes).toEqual([]);
    expect(readStoredData(storage).data).toEqual(data());
  });

  it('propagates primary write failure and retains the last persisted state', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(data()) });
    const blocked = { getItem: storage.getItem, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(() => writeStoredData(createEmptyData(), blocked)).toThrow('QuotaExceededError');
    expect(readStoredData(storage).data).toEqual(data());
  });

  it('counts a successful primary commit as saved even when the secondary copy is full', () => {
    const storage = memoryStorage();
    const secondaryFull = { ...storage, setItem: (key: string, value: string) => {
      if (key === LAST_GOOD_KEY) throw new Error('QuotaExceededError');
      storage.setItem(key, value);
    } };
    expect(() => writeStoredData(data(), secondaryFull)).not.toThrow();
    expect(readStoredData(storage)).toEqual({ status: 'ready', data: data() });
  });

  it('reports a blocked store and never pretends that a write succeeded', () => {
    const blocked = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('SecurityError'); },
    };
    expect(readStoredData(blocked)).toEqual({ status: 'unavailable', data: createEmptyData() });
    expect(() => writeStoredData(data(), blocked)).toThrow('SecurityError');
  });
});

describe('three-way concurrent data changes', () => {
  it('keeps remote changes when the local snapshot is untouched', () => {
    const base = data();
    const remote = copy(base);
    remote.transactions[0].amount = 40;
    expect(mergeAppData(base, remote, base)).toEqual(remote);
    expect(base.transactions[0].amount).toBe(25);
  });

  it('combines disjoint profile fields and disjoint transaction fields', () => {
    const base = data();
    const remote = copy(base);
    const desired = copy(base);
    remote.profile.language = 'en';
    remote.transactions[0].amount = 40;
    remote.transactions[0].items = [{ id: 'bread', title: 'Bread', amount: 2 }];
    desired.profile.name = 'Captain';
    desired.transactions[0].title = 'Market';
    const merged = mergeAppData(base, remote, desired);
    expect(merged.profile).toMatchObject({ name: 'Captain', language: 'en' });
    expect(merged.transactions[0]).toMatchObject({ title: 'Market', amount: 40, items: remote.transactions[0].items });
  });

  it('preserves independent additions from two tabs, maintaining current order', () => {
    const base = data();
    const remote = { ...copy(base), transactions: [expense({ id: 'remote' }), ...base.transactions] };
    const desired = { ...copy(base), transactions: [expense({ id: 'local' }), ...base.transactions] };
    expect(mergeAppData(base, remote, desired).transactions.map(({ id }) => id)).toEqual(['remote', 'expense', 'local']);
  });

  it('accepts identical concurrent edits and additions only once', () => {
    const base = data();
    const desired = copy(base);
    desired.transactions[0].amount = 30;
    desired.transactions.push(expense({ id: 'new' }));
    expect(mergeAppData(base, copy(desired), desired)).toEqual(desired);
  });

  it('rejects different edits to the same field or the same newly added ID', () => {
    const base = data();
    const remote = copy(base);
    const desired = copy(base);
    remote.transactions[0].amount = 30;
    desired.transactions[0].amount = 40;
    expect(() => mergeAppData(base, remote, desired)).toThrow(DataConflictError);
    remote.transactions = [expense({ id: 'new', amount: 30 })];
    desired.transactions = [expense({ id: 'new', amount: 40 })];
    expect(() => mergeAppData(base, remote, desired)).toThrow(DataConflictError);
  });

  it('rejects conflicting profile fields', () => {
    const base = data();
    const remote = copy(base);
    const desired = copy(base);
    remote.profile.name = 'First';
    desired.profile.name = 'Second';
    expect(() => mergeAppData(base, remote, desired)).toThrow(DataConflictError);
  });

  it('merges optional field deletion and preserves unrelated fields', () => {
    const base = data();
    base.transactions[0].note = 'Old note';
    const remote = copy(base);
    const desired = copy(base);
    remote.transactions[0].amount = 30;
    delete desired.transactions[0].note;
    const merged = mergeAppData(base, remote, desired);
    expect(merged.transactions[0].note).toBeUndefined();
    expect(merged.transactions[0].amount).toBe(30);
  });

  it('keeps remote deletions when local records are unchanged', () => {
    const base = data();
    const remote = { ...copy(base), transactions: [] };
    const desired = copy(base);
    desired.profile.name = 'New name';
    expect(mergeAppData(base, remote, desired).transactions).toEqual([]);
  });

  it('rejects dirty updates to remotely deleted records and deletion of remotely edited records', () => {
    const base = data();
    const remote = { ...copy(base), transactions: [] };
    const desired = copy(base);
    desired.transactions[0].title = 'New title';
    expect(() => mergeAppData(base, remote, desired)).toThrow(DataConflictError);
    expect(() => mergeAppData(base, desired, remote)).toThrow(DataConflictError);
  });

  it('applies a local deletion without removing a remote addition', () => {
    const base = data();
    const remote = { ...copy(base), transactions: [...base.transactions, expense({ id: 'remote' })] };
    const desired = { ...copy(base), transactions: [] };
    expect(mergeAppData(base, remote, desired).transactions.map(({ id }) => id)).toEqual(['remote']);
  });

  it('treats purchase details as an atomic field and rejects simultaneous different detail edits', () => {
    const base = data();
    const remote = copy(base);
    const desired = copy(base);
    remote.transactions[0].items = [{ id: 'bread', title: 'Bread', amount: 2 }];
    desired.transactions[0].items = [{ id: 'milk', title: 'Milk', amount: 3 }];
    expect(() => mergeAppData(base, remote, desired)).toThrow(DataConflictError);
  });

  it('preserves absent legacy shopping lists and handles explicit empty lists', () => {
    const base = data();
    expect(mergeAppData(base, base, base).shoppingList).toBeUndefined();
    expect(mergeAppData(base, base, { ...base, shoppingList: [] }).shoppingList).toEqual([]);
  });

  it('normalizes imported linked shopping metadata against the surviving expense', () => {
    const base = data();
    const desired = { ...copy(base), shoppingList: [{
      id: 'product', title: 'Stale title', currency: 'USD' as const, createdAt: '2026-11-03', transactionId: 'expense',
    }] };
    const merged = mergeAppData(base, base, desired);
    expect(merged.shoppingList![0]).toMatchObject({ title: 'Groceries', currency: 'EUR', transactionId: 'expense' });
  });

  it('validates the merged transaction limit before exposing state', () => {
    const base = createEmptyData();
    const half = MAX_TRANSACTIONS / 2;
    const remote = { ...base, transactions: Array.from({ length: half + 1 }, (_, index) => expense({ id: `r${index}` })) };
    const desired = { ...base, transactions: Array.from({ length: half }, (_, index) => expense({ id: `l${index}` })) };
    expect(() => mergeAppData(base, remote, desired)).toThrow();
  });

  it('rejects an invalid converted budget before persisting a merge', () => {
    const base = data();
    const desired = { ...base, profile: { ...base.profile, monthlyBudget: MAX_AMOUNT + 1 } };
    expect(() => mergeAppData(base, base, desired)).toThrow();
  });
});

describe('stale transaction editors', () => {
  it('changes a title without reverting a newer price, currency or purchase details', () => {
    const base = expense();
    const current = expense({ amount: 40, currency: 'USD', items: [{ id: 'bread', title: 'Bread', amount: 2 }] });
    expect(mergeTransactionDraft(base, current, { ...base, title: 'Market' })).toEqual({ ...current, title: 'Market' });
  });

  it('rejects a same-field conflict and editing a deleted transaction', () => {
    const base = expense();
    expect(() => mergeTransactionDraft(base, expense({ amount: 30 }), { ...base, amount: 40 })).toThrow(DataConflictError);
    expect(() => mergeTransactionDraft(base, undefined, base)).toThrow(DataConflictError);
  });

  it('rejects an amount edit that would invalidate newly added purchase details', () => {
    const base = expense();
    const current = expense({ items: [{ id: 'bread', title: 'Bread', amount: 20 }] });
    expect(() => mergeTransactionDraft(base, current, { ...base, amount: 10 })).toThrow();
  });
});

describe('shared strict money input', () => {
  it.each([
    ['12.50', 12.5], ['12,50', 12.5], [' 1 234,56 ', 1234.56], ['1\u00a0234.50', 1234.5],
    ['1\u202f234', 1234], ['0.01', 0.01], ['1000000000000', MAX_AMOUNT],
  ])('parses %s as %s', (input, amount) => expect(parseMoney(input)).toBe(amount));

  it.each(['', '0', '-1', '+1', '.1', '1.', '1.234', '1e2', '0x10', 'Infinity', 'NaN', '1,234.56', '12 34', '1000000000000.01']) (
    'rejects ambiguous or invalid input %s', (input) => expect(parseMoney(input)).toBeNull(),
  );

  it('permits zero only for explicitly optional budgets', () => {
    expect(parseMoney('0', true)).toBe(0);
    expect(parseMoney('0.00', true)).toBe(0);
    expect(parseMoney('-0', true)).toBeNull();
  });
});
