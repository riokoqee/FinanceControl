import { describe, expect, it } from 'vitest';
import { createDemoData, getMonthTransactions, getMonthTotal } from './finance';
import type { Transaction } from './finance';
import { filterExpenses, indexExpenseText, newestFirst, orderExpenses, summarizeExpenses } from './expenses';

const records = createDemoData(new Date(2026, 10, 6, 12)).transactions;
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
