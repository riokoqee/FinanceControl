import { bench, describe } from 'vitest';
import { STORAGE_KEY, createEmptyData, type AppData } from '../finance';
import { commitStoredData } from './storage';

// Run separately from correctness tests: npx vitest bench src/lib/storage.bench.ts --run
// This isolates validation/merge/serialization; browser localStorage adds disk costs.
function fixture(count: number) {
  let current: AppData = {
    ...createEmptyData(),
    transactions: Array.from({ length: count }, (_, index) => ({
      id: `expense-${index}`, title: 'Groceries', amount: 25,
      currency: 'EUR', category: 'food', date: '2026-11-03',
    })),
  };
  const values = new Map([[STORAGE_KEY, JSON.stringify(current)]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  return {
    profile: () => {
      current = commitStoredData(current, {
        ...current, profile: { ...current.profile, theme: current.profile.theme === 'dark' ? 'light' : 'dark' },
      }, storage);
    },
    expense: () => {
      current = commitStoredData(current, {
        ...current,
        transactions: [{ ...current.transactions[0], amount: current.transactions[0].amount === 25 ? 30 : 25 }, ...current.transactions.slice(1)],
      }, storage);
    },
  };
}

for (const count of [500, 5_000, 50_000]) {
  describe(`${count.toLocaleString('en-US')} expenses`, () => {
    const profile = fixture(count);
    const expense = fixture(count);
    bench('save profile with unchanged ledger', profile.profile);
    bench('save one changed expense', expense.expense);
  });
}
