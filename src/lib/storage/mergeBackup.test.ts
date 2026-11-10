import { describe, expect, it } from 'vitest';
import { createEmptyData, MAX_SHOPPING_ITEMS, MAX_TRANSACTIONS } from '../finance';
import type { AppData, ShoppingItem, Transaction } from '../finance';
import { STREAK_LEDGER_VERSION } from '../streak/streakTypes';
import { mergeBackupData } from './mergeBackup';

const expense = (id: string, amount = 5): Transaction => ({
  id, title: id, amount, currency: 'EUR', category: 'food', date: '2026-11-10',
});
const item = (id: string, transactionId?: string): ShoppingItem => ({
  id, title: id, currency: 'EUR', createdAt: '2026-11-10', ...(transactionId ? { transactionId } : {}),
});

describe('backup merge', () => {
  it('keeps current duplicate records and links while adding independent purchases once', () => {
    const current: AppData = { ...createEmptyData(), transactions: [expense('existing', 9)],
      shoppingList: [item('same-row', 'existing')] };
    const incoming: AppData = { ...createEmptyData(), transactions: [expense('existing', 99), expense('new')],
      shoppingList: [item('same-row'), item('duplicate-link', 'existing'), item('new-row', 'new'), item('pending')] };
    const before = structuredClone({ current, incoming });
    const merged = mergeBackupData(current, incoming);
    expect(merged.transactions).toEqual([expense('existing', 9), expense('new')]);
    expect(merged.shoppingList).toEqual([item('same-row', 'existing'), item('new-row', 'new'), item('pending')]);
    expect(mergeBackupData(merged, incoming)).toEqual(merged);
    expect({ current, incoming }).toEqual(before);
  });

  it('unions daily facts without replacing current settings, budgets or templates', () => {
    const current: AppData = { ...createEmptyData(),
      profile: { ...createEmptyData().profile, name: 'Captain', exchangeRates: { USD: 1, EUR: 0.95, KZT: 500 } },
      categoryBudgets: [{ id: 'food', amount: 50, currency: 'EUR' }], shoppingTemplates: [{ id: 'routine', name: 'Weekly', items: [] }],
      streak: { version: STREAK_LEDGER_VERSION, startedOn: '2026-11-09', confirmedDays: [{ date: '2026-11-09', status: 'NO_SPEND' }] } };
    const incoming: AppData = { ...createEmptyData(),
      streak: { version: STREAK_LEDGER_VERSION, startedOn: '2026-11-08', confirmedDays: [
        { date: '2026-11-08', status: 'NO_SPEND' }, { date: '2026-11-09', status: 'LOGGED' },
      ] } };
    const merged = mergeBackupData(current, incoming);
    expect(merged.profile).toBe(current.profile);
    expect(merged.categoryBudgets).toBe(current.categoryBudgets);
    expect(merged.shoppingTemplates).toBe(current.shoppingTemplates);
    expect(merged.streak).toEqual(incoming.streak);
    expect(merged).not.toHaveProperty('shoppingList');
  });

  it('counts new expense ids against the limit after deduplication', () => {
    const current: AppData = { ...createEmptyData(),
      transactions: Array.from({ length: MAX_TRANSACTIONS }, (_, index) => expense(`expense-${index}`)) };
    expect(mergeBackupData(current, { ...createEmptyData(), transactions: [expense('expense-0')] }).transactions).toHaveLength(MAX_TRANSACTIONS);
    expect(() => mergeBackupData(current, { ...createEmptyData(), transactions: [expense('overflow')] })).toThrow();
  });

  it('counts only unique shopping rows and links against the shared capacity', () => {
    const current: AppData = { ...createEmptyData(), shoppingList: Array.from({ length: MAX_SHOPPING_ITEMS }, (_, index) => item(`item-${index}`)) };
    expect(mergeBackupData(current, { ...createEmptyData(), shoppingList: [item('item-0')] }).shoppingList).toHaveLength(MAX_SHOPPING_ITEMS);
    expect(() => mergeBackupData(current, { ...createEmptyData(), shoppingList: [item('overflow')] })).toThrow();
  });
});
