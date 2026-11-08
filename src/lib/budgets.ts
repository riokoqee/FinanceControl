import { convertAmount } from './finance';
import type { CategoryBudget, CategoryId, Transaction } from './finance';

export interface CategoryBudgetProgress extends CategoryBudget {
  spent: number;
  /** Negative when the category is over its limit. */
  remaining: number;
  percent: number;
  /** A bounded value suitable for a progress bar's width and ARIA value. */
  progress: number;
  state: 'normal' | 'warning' | 'over';
}

/** Aggregate once, keeping each limit in its own currency, independent of the profile. */
export function summarizeCategoryBudgets(
  records: readonly Transaction[],
  budgets: readonly CategoryBudget[],
  month: string,
): CategoryBudgetProgress[] {
  if (!budgets.length || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const configured = budgets.filter((budget) => Number.isFinite(budget.amount) && Math.round(budget.amount * 100) > 0);
  const byCategory = new Map(configured.map((budget) => [budget.id, budget]));
  const totals = new Map<CategoryId, number>();
  for (const record of records) {
    const budget = byCategory.get(record.category);
    if (!budget || !record.date.startsWith(`${month}-`)) continue;
    totals.set(record.category,
      (totals.get(record.category) ?? 0) + convertAmount(record.amount, record.currency, budget.currency));
  }
  return configured.map((budget): CategoryBudgetProgress => {
    // Round after summing so multiple small converted purchases are not lost.
    const spentCents = Math.round((totals.get(budget.id) ?? 0) * 100);
    const limitCents = Math.round(budget.amount * 100);
    const percent = (spentCents / limitCents) * 100;
    return {
      ...budget,
      spent: spentCents / 100,
      remaining: (limitCents - spentCents) / 100,
      percent,
      progress: Math.max(0, Math.min(100, percent)),
      state: spentCents > limitCents ? 'over' : spentCents >= limitCents * 0.8 ? 'warning' : 'normal',
    };
  });
}
