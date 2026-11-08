import { describe, expect, it } from 'vitest';
import type { CategoryBudget, Transaction } from './finance';
import { summarizeCategoryBudgets } from './budgets';

const record = (amount: number, values: Partial<Transaction> = {}): Transaction => ({
  id: 'expense', title: 'Purchase', amount, currency: 'USD', category: 'food', date: '2026-11-08', ...values,
});
const limit: CategoryBudget = { id: 'food', amount: 100, currency: 'USD' };

describe('category budget progress', () => {
  it('uses each limit currency and excludes other categories and months', () => {
    const records = [
      record(10), record(9.2, { currency: 'EUR' }), record(4800, { currency: 'KZT' }),
      record(90, { category: 'home' }), record(90, { date: '2026-10-31' }), record(90, { date: '2026-12-01' }),
    ];
    const result = summarizeCategoryBudgets(records, [{ ...limit, amount: 92, currency: 'EUR' }], '2026-11');
    expect(result).toEqual([{
      id: 'food', amount: 92, currency: 'EUR', spent: 27.6, remaining: 64.4, percent: 30, progress: 30, state: 'normal',
    }]);
  });

  it.each([
    [79.99, 'normal'], [80, 'warning'], [100, 'warning'], [100.01, 'over'],
  ] as const)('marks the exact threshold at %s without treating a full budget as exceeded', (spent, state) => {
    const [result] = summarizeCategoryBudgets([record(spent)], [limit], '2026-11');
    expect(result.state).toBe(state);
    expect(result.remaining).toBe(Math.round((100 - spent) * 100) / 100);
    expect(result.progress).toBeCloseTo(Math.min(spent, 100), 10);
  });

  it('retains configured limits without expenses and ignores unset limits', () => {
    expect(summarizeCategoryBudgets([], [limit, { id: 'home', amount: 0, currency: 'KZT' }], '2026-11')).toEqual([
      { ...limit, spent: 0, remaining: 100, percent: 0, progress: 0, state: 'normal' },
    ]);
    expect(summarizeCategoryBudgets([record(10)], [], '2026-11')).toEqual([]);
    expect(summarizeCategoryBudgets([], [limit], '2026-13')).toEqual([]);
  });

  it('rounds the aggregate instead of rounding each converted purchase', () => {
    const records = [record(1, { currency: 'KZT' }), record(1, { currency: 'KZT' }), record(1, { currency: 'KZT' })];
    expect(summarizeCategoryBudgets(records, [limit], '2026-11')[0].spent).toBe(0.01);
    const [exact] = summarizeCategoryBudgets([record(0.1), record(0.2)], [{ ...limit, amount: 0.3 }], '2026-11');
    expect(exact).toMatchObject({ spent: 0.3, remaining: 0, percent: 100, state: 'warning' });
  });

  it('bounds the visual progress while preserving the real overrun and source data', () => {
    const records = [record(500)];
    const budgets = [{ ...limit, amount: 10 }];
    const before = JSON.stringify({ records, budgets });
    expect(summarizeCategoryBudgets(records, budgets, '2026-11')[0]).toMatchObject({
      spent: 500, remaining: -490, percent: 5000, progress: 100, state: 'over',
    });
    expect(JSON.stringify({ records, budgets })).toBe(before);
  });
});
