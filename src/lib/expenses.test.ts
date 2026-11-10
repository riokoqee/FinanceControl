import { describe, expect, it } from 'vitest';
import { MAX_TRANSACTIONS, createDemoData, createEmptyData, getMonthTransactions, getMonthTotal, validateBackup } from './finance';
import type { AppData, Transaction } from './finance';
import { filterExpenses, indexExpenseText, newestFirst, orderExpenses, removeExpense, summarizeExpenses, undoExpense } from './expenses';

const records = createDemoData(new Date(2026, 10, 6, 12)).transactions;

describe('fresh expense deletion and conflict-safe undo', () => {
  function fixture(): AppData {
    return { ...createEmptyData(), transactions: [
      { id: 'bread', title: 'Bread', amount: 3, currency: 'EUR', category: 'food', date: '2026-11-09',
        createdAt: '2026-11-09', note: 'Fresh values', items: [{ id: 'loaf', title: 'Loaf', amount: 2 }] },
      { id: 'other', title: 'Other', amount: 10, currency: 'USD', category: 'home', date: '2026-11-09' },
    ], shoppingList: [
      { id: 'linked', title: 'Bread', currency: 'EUR', createdAt: '2026-11-08', transactionId: 'bread' },
      { id: 'unrelated', title: 'Tea', currency: 'USD', createdAt: '2026-11-09' },
    ] };
  }

  it('captures the actual fresh deleted expense and preserves input identity for unrelated records', () => {
    const original = fixture();
    const fresh = { ...original, transactions: [{ ...original.transactions[0], amount: 5, note: 'Changed in another tab' }, original.transactions[1]] };
    const before = structuredClone(fresh);
    const removed = removeExpense(fresh, 'bread');
    expect(removed.result.transaction).toBe(fresh.transactions[0]);
    expect(removed.result.transaction?.amount).toBe(5);
    expect(removed.data.transactions).toEqual([fresh.transactions[1]]);
    expect(removed.data.transactions[0]).toBe(fresh.transactions[1]);
    expect(removed.result.pendingSnapshots).toEqual([{ id: 'linked', title: 'Bread', currency: 'EUR', createdAt: '2026-11-08' }]);
    expect(removed.data.shoppingList?.[1]).toBe(fresh.shoppingList?.[1]);
    expect(fresh).toEqual(before);
  });

  it('restores the full actual expense and reconnects an untouched planned row once', () => {
    const original = fixture();
    const removed = removeExpense(original, 'bread');
    const restored = undoExpense(removed.data, removed.result);
    expect(restored.transactions.find((record) => record.id === 'bread')).toBe(original.transactions[0]);
    expect(restored.shoppingList).toEqual(original.shoppingList);
    expect(validateBackup(restored).shoppingList).toEqual(original.shoppingList);
    expect(undoExpense(restored, removed.result)).toBe(restored);
  });

  it.each([
    { title: 'Milk' }, { currency: 'KZT' as const }, { createdAt: '2026-11-10' },
    { title: 'Milk', currency: 'KZT' as const },
  ])('keeps a planned row edited after deletion without silently restoring its old fields: %j', (patch) => {
    const removed = removeExpense(fixture(), 'bread');
    const changed = { ...removed.data, shoppingList: removed.data.shoppingList!.map((item) => item.id === 'linked' ? { ...item, ...patch } : item) };
    const expected = structuredClone(changed.shoppingList);
    const restored = undoExpense(changed, removed.result);
    expect(restored.transactions.some((record) => record.id === 'bread')).toBe(true);
    expect(restored.shoppingList).toEqual(expected);
    expect(restored.shoppingList?.[0].transactionId).toBeUndefined();
    expect(validateBackup(restored).shoppingList).toEqual(expected);
  });

  it('does not adopt a foreign purchase link or any new unrelated pending plan', () => {
    const removed = removeExpense(fixture(), 'bread');
    const changed: AppData = { ...removed.data, shoppingList: [
      { ...removed.data.shoppingList![0], transactionId: 'other', title: 'Other', currency: 'USD' },
      ...removed.data.shoppingList!.slice(1),
      { id: 'new-plan', title: 'Milk', currency: 'KZT', createdAt: '2026-11-09' },
    ] };
    const expected = structuredClone(changed.shoppingList);
    expect(undoExpense(changed, removed.result).shoppingList).toEqual(expected);
  });

  it('keeps concurrent deletions and never recreates a removed shopping row', () => {
    const removed = removeExpense(fixture(), 'bread');
    const changed = { ...removed.data, transactions: [], shoppingList: removed.data.shoppingList!.filter((item) => item.id !== 'linked') };
    const restored = undoExpense(changed, removed.result);
    expect(restored.transactions.map((record) => record.id)).toEqual(['bread']);
    expect(restored.shoppingList).toEqual(changed.shoppingList);
    expect(removeExpense(changed, 'bread')).toEqual({ data: changed, result: { pendingSnapshots: [] } });
    expect(removeExpense(changed, 'bread').data).toBe(changed);
  });

  it('preserves an expense recreated under the same ID and leaves its old plan unlinked', () => {
    const removed = removeExpense(fixture(), 'bread');
    const recreated: Transaction = { ...removed.result.transaction!, title: 'New expense', amount: 100, currency: 'USD' };
    const changed = { ...removed.data, transactions: [...removed.data.transactions, recreated] };
    expect(undoExpense(changed, removed.result)).toBe(changed);
    expect(changed.transactions.at(-1)).toBe(recreated);
    expect(changed.shoppingList?.[0].transactionId).toBeUndefined();
  });

  it('handles ledgers without shopping fields without adding optional records', () => {
    const { shoppingList: _plans, ...original } = fixture();
    const removed = removeExpense(original, 'bread');
    expect(Object.hasOwn(removed.data, 'shoppingList')).toBe(false);
    expect(Object.hasOwn(undoExpense(removed.data, removed.result), 'shoppingList')).toBe(false);
    expect(undoExpense(original, { pendingSnapshots: [] })).toBe(original);
  });

  it('rejects undo at the transaction capacity atomically', () => {
    const removed = removeExpense(fixture(), 'bread');
    const full = { ...removed.data, transactions: Array.from({ length: MAX_TRANSACTIONS }, (_, index) => ({ ...removed.data.transactions[0], id: `full-${index}` })) };
    const before = structuredClone(full.shoppingList);
    expect(() => undoExpense(full, removed.result)).toThrow(/50/);
    expect(full.transactions).toHaveLength(MAX_TRANSACTIONS);
    expect(full.shoppingList).toEqual(before);
  });
});

describe('expense view calculations', () => {
  it('uses saved rates consistently for both months, categories and amount sorting', () => {
    const rates = { USD: 1 as const, EUR: 0.5, KZT: 500 };
    const mixed: Transaction[] = [
      { id: 'usd', title: 'USD', amount: 10, currency: 'USD', category: 'food', date: '2026-11-09' },
      { id: 'eur', title: 'EUR', amount: 10, currency: 'EUR', category: 'food', date: '2026-11-09' },
      { id: 'kzt', title: 'KZT', amount: 1000, currency: 'KZT', category: 'home', date: '2026-11-09' },
      { id: 'prior', title: 'Prior', amount: 5, currency: 'EUR', category: 'home', date: '2026-10-09' },
    ];
    const before = structuredClone(mixed);
    const result = summarizeExpenses(mixed, '2026-11', 'USD', rates);
    expect(result.total).toBe(32);
    expect(result.previousTotal).toBe(10);
    expect(result.categories.map(({ id, value }) => [id, value])).toEqual([['food', 30], ['home', 2]]);
    expect(orderExpenses(mixed.slice(0, 3), 'largest', 'USD', rates).map(({ id }) => id)).toEqual(['eur', 'usd', 'kzt']);
    expect(mixed).toEqual(before);
  });
  it.each(['USD', 'EUR', 'KZT'] as const)('keeps totals, category sums and the five newest records in %s', (currency) => {
    const result = summarizeExpenses(records, '2026-11', currency);
    expect(result.transactions).toEqual(getMonthTransactions(records, '2026-11'));
    expect(result.total).toBeCloseTo(getMonthTotal(records, '2026-11', currency), 8);
    expect(result.previousTotal).toBeCloseTo(getMonthTotal(records, '2026-10', currency), 8);
    expect(result.categories.reduce((sum, item) => sum + item.value, 0)).toBeCloseTo(result.total, 8);
    expect(result.recent).toEqual([...result.transactions].sort(newestFirst).slice(0, 5));
  });
  it('handles year boundaries, empty months and fewer than five entries', () => {
    const one = { ...records[0], id: 'one', date: '2026-12-31' };
    expect(summarizeExpenses([one], '2027-01', 'USD').previousTotal).toBe(one.amount);
    expect(summarizeExpenses([one], '2026-12', 'USD').recent).toEqual([one]);
    expect(summarizeExpenses([], '2026-11', 'USD').categories).toEqual([]);
  });
  it('searches notes and purchase details case-insensitively without changing sort order', () => {
    const ordered = orderExpenses(records, 'newest', 'USD');
    const index = indexExpenseText(records);
    const matches = filterExpenses(ordered, 'ФИЛЕ', 'all', 'all', index);
    expect(matches).toEqual(ordered.filter((item) => item.items?.some((part) => part.title.includes('филе'))));
    expect(filterExpenses(ordered, 'овощи', 'food', 'USD', index)).toEqual([records[0]]);
    expect(filterExpenses(ordered, 'овощи', 'transport', 'all', index)).toEqual([]);
    expect(filterExpenses(ordered, '', 'all', 'EUR', index).every((item) => item.currency === 'EUR')).toBe(true);
    expect(filterExpenses(ordered, '', 'all', 'all', index)).toBe(ordered);
  });
  it('keeps stable ties for amount and oldest sorting and never mutates source records', () => {
    const input: Transaction[] = [records[0], { ...records[0], id: 'same' }, records[2]];
    const before = JSON.stringify(input);
    expect(orderExpenses(input, 'largest', 'KZT').filter((item) => item.amount === records[0].amount).map((item) => item.id)).toEqual([records[0].id, 'same']);
    expect(orderExpenses(input, 'oldest', 'USD')).toEqual([...input].sort((a, b) => a.date.localeCompare(b.date)));
    expect(JSON.stringify(input)).toBe(before);
  });
});
