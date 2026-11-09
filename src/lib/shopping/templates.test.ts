import { describe, expect, it, vi } from 'vitest';
import {
  MAX_SHOPPING_TEMPLATES,
  MAX_TEMPLATE_ITEMS,
  createEmptyData,
  getActivityCounts,
  todayString,
  validateBackup,
  type AppData,
  type ShoppingItem,
  type ShoppingTemplate,
} from '../finance';
import { applyShoppingTemplate, makeShoppingTemplate } from './templates';

const item = (id: string, title: string, patch: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id, title, currency: 'EUR', createdAt: '2026-10-27', ...patch,
});
const template = (patch: Partial<ShoppingTemplate> = {}): ShoppingTemplate => ({
  id: 'weekly', name: 'На неделю', items: [{ title: 'Молоко', currency: 'EUR' }], ...patch,
});
const withTemplate = (patch: Partial<AppData> = {}): AppData => ({
  ...createEmptyData(), version: 2, shoppingTemplates: [template()], ...patch,
});

describe('saving shopping templates', () => {
  it('uses the complete pending list, without purchased rows, prices or transaction links', () => {
    const transactions: AppData['transactions'] = [{
      id: 'paid', title: 'Хлеб', amount: 2, currency: 'EUR', category: 'food',
      date: '2026-10-27', createdAt: '2026-10-27',
    }];
    const data = createEmptyData();
    data.transactions = transactions;
    data.shoppingList = Array.from({ length: 60 }, (_, index) => item(`pending-${index}`, `Товар ${index}`));
    data.shoppingList.push(item('purchased', 'Хлеб', { transactionId: 'paid' }));
    data.shoppingList.push(item('deleted-expense', 'Сыр', { transactionId: 'missing' }));
    const saved = makeShoppingTemplate('  На неделю  ', data);
    expect(saved.id).toBeTruthy();
    expect(saved.name).toBe('На неделю');
    expect(saved.items).toHaveLength(61);
    expect(saved.items.at(-1)).toEqual({ title: 'Сыр', currency: 'EUR' });
    expect(saved.items.every((entry) => Object.keys(entry).length === 2)).toBe(true);
    expect(data.shoppingTemplates).toBeUndefined();
    expect(data.shoppingList).toHaveLength(62);
    expect(data.transactions).toBe(transactions);
  });

  it('validates a nonempty name up to 60 characters and a nonempty plan', () => {
    const data = { ...createEmptyData(), shoppingList: [item('milk', 'Молоко')] };
    expect(() => makeShoppingTemplate(' ', data)).toThrow();
    expect(() => makeShoppingTemplate('x'.repeat(61), data)).toThrow();
    expect(() => makeShoppingTemplate('На неделю', createEmptyData())).toThrow();
    expect(makeShoppingTemplate('x'.repeat(60), data).name).toHaveLength(60);
  });

  it('rejects the 201st item instead of silently truncating the plan', () => {
    const data = { ...createEmptyData(), shoppingList: Array.from({ length: MAX_TEMPLATE_ITEMS }, (_, index) => item(`id-${index}`, `Товар ${index}`)) };
    expect(makeShoppingTemplate('Большой список', data).items).toHaveLength(MAX_TEMPLATE_ITEMS);
    data.shoppingList.push(item('overflow', 'Лишнее'));
    expect(() => makeShoppingTemplate('Большой список', data)).toThrow();
    expect(data.shoppingList).toHaveLength(MAX_TEMPLATE_ITEMS + 1);
  });

  it('rejects a full template collection and generates different IDs for separate saves', () => {
    const data = { ...createEmptyData(), shoppingList: [item('milk', 'Молоко')] };
    expect(makeShoppingTemplate('Первый', data).id).not.toBe(makeShoppingTemplate('Второй', data).id);
    expect(() => makeShoppingTemplate('Новый', {
      ...data, shoppingTemplates: Array.from({ length: MAX_SHOPPING_TEMPLATES }, (_, index) => template({ id: `template-${index}` })),
    })).toThrow();
  });
});

describe('applying shopping templates', () => {
  it('adds fresh plans in the template currencies and does not change expenses, profile or activity', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 8, 0, 15));
      const data = withTemplate({ shoppingTemplates: [template({ items: [
        { title: 'Молоко', currency: 'EUR' }, { title: 'Bread', currency: 'USD' },
      ] })] });
      const after = applyShoppingTemplate(data, 'weekly');
      expect(after.shoppingList).toHaveLength(2);
      expect(after.shoppingList!.map(({ title, currency, createdAt, transactionId }) => ({ title, currency, createdAt, transactionId }))).toEqual([
        { title: 'Молоко', currency: 'EUR', createdAt: todayString(), transactionId: undefined },
        { title: 'Bread', currency: 'USD', createdAt: todayString(), transactionId: undefined },
      ]);
      expect(new Set(after.shoppingList!.map(({ id }) => id)).size).toBe(2);
      expect(after.transactions).toBe(data.transactions);
      expect(after.profile).toBe(data.profile);
      expect(after.shoppingTemplates).toBe(data.shoppingTemplates);
      expect(getActivityCounts(after.transactions)).toEqual({});
      expect(validateBackup(after)).toEqual(after);
      expect(data.shoppingList).toBeUndefined();
    } finally { vi.useRealTimers(); }
  });

  it('deduplicates planned titles by case, whitespace and currency, including duplicates within a template', () => {
    const data = withTemplate({
      shoppingList: [item('planned', '  МОЛОКО\u00a0 и   хлеб  ')],
      shoppingTemplates: [template({ items: [
        { title: 'Молоко и хлеб', currency: 'EUR' },
        { title: ' МОЛОКО  И ХЛЕБ ', currency: 'EUR' },
        { title: 'Молоко и хлеб', currency: 'USD' },
        { title: 'Сыр', currency: 'KZT' },
        { title: 'сыр', currency: 'KZT' },
      ] })],
    });
    const after = applyShoppingTemplate(data, 'weekly');
    expect(after.shoppingList).toHaveLength(3);
    expect(after.shoppingList!.slice(1).map(({ title, currency }) => ({ title, currency }))).toEqual([
      { title: 'Молоко и хлеб', currency: 'USD' }, { title: 'Сыр', currency: 'KZT' },
    ]);
    expect(applyShoppingTemplate(after, 'weekly')).toBe(after);
  });

  it('allows buying a purchased product again while retaining its expense', () => {
    const data = withTemplate({
      shoppingList: [item('paid-row', 'Молоко', { transactionId: 'expense' })],
      transactions: [{ id: 'expense', title: 'Молоко', amount: 3, currency: 'EUR', category: 'food', date: '2026-10-27' }],
    });
    const after = applyShoppingTemplate(data, 'weekly');
    expect(after.shoppingList).toHaveLength(2);
    expect(after.shoppingList![0]).toBe(data.shoppingList![0]);
    expect(after.shoppingList![1].transactionId).toBeUndefined();
    expect(after.shoppingList![1].id).not.toBe('paid-row');
    expect(after.transactions).toBe(data.transactions);
  });

  it('treats an item whose expense was deleted as pending', () => {
    const data = withTemplate({ shoppingList: [item('old', 'Молоко', { transactionId: 'missing' })] });
    expect(applyShoppingTemplate(data, 'weekly')).toBe(data);
  });

  it('rejects a deleted or invalid template', () => {
    const data = withTemplate();
    expect(() => applyShoppingTemplate(data, 'deleted')).toThrow();
    expect(() => applyShoppingTemplate({ ...data, shoppingTemplates: [] }, 'weekly')).toThrow();
    expect(() => applyShoppingTemplate(withTemplate({ shoppingTemplates: [template({ items: [] })] }), 'weekly')).toThrow();
    expect(() => applyShoppingTemplate(withTemplate({ shoppingTemplates: [template({ items: Array.from({ length: MAX_TEMPLATE_ITEMS + 1 }, () => ({ title: 'Milk', currency: 'USD' })) })] }), 'weekly')).toThrow();
    expect(data.shoppingList).toBeUndefined();
  });

  it('checks the entire batch before adding any row and counts purchased rows against the list limit', () => {
    const list = Array.from({ length: 999 }, (_, index) => item(`item-${index}`, `Товар ${index}`));
    const data = withTemplate({ shoppingList: list, shoppingTemplates: [template({ items: [
      { title: 'Молоко', currency: 'EUR' }, { title: 'Сыр', currency: 'EUR' },
    ] })] });
    expect(() => applyShoppingTemplate(data, 'weekly')).toThrow();
    expect(data.shoppingList).toBe(list);
    expect(list).toHaveLength(999);
    const full = applyShoppingTemplate({ ...data, shoppingTemplates: [template()] }, 'weekly');
    expect(full.shoppingList).toHaveLength(1000);
    expect(applyShoppingTemplate(full, 'weekly')).toBe(full);
  });
});
