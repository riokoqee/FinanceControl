import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  createEmptyData,
  getActivityCounts,
  getMonthTotal,
  loadData,
  saveData,
  validateBackup,
  type AppData,
  type Currency,
  type ShoppingItem,
} from './finance';
import {
  addShoppingItem,
  parseShoppingPrice,
  removeShoppingItem,
  saveShoppingPrice,
  updateShoppingItem,
} from './shopping';

const plannedItem = (patch: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id: 'bread', title: 'Батон', currency: 'EUR', createdAt: '2026-10-26', ...patch,
});
const plannedData = (): AppData => addShoppingItem(createEmptyData(), plannedItem());
const purchasedData = (): AppData => saveShoppingPrice(
  plannedData(), 'bread', 2.5, 'EUR', 'expense-bread', new Date(2026, 9, 27, 0, 15),
);

describe('shopping price input', () => {
  it.each([
    ['2', 2], ['2,5', 2.5], ['2.50', 2.5], ['0,01', 0.01], ['0.29', 0.29],
    [' 1 234,56 ', 1234.56], ['12\u00a0345.67', 12345.67], ['1\u202f234\u202f567', 1234567],
    ['999999999999.99', 999999999999.99], ['1 000 000 000 000', 1e12],
  ])('parses %s into whole cents', (text, expected) => {
    expect(parseShoppingPrice(text)).toBe(expected);
  });

  it.each([
    '', ' ', '0', '0.00', '-1', '+2', '1e3', 'NaN', 'Infinity', '.50', '2.', '2,',
    '1.001', '1,001', '1.2.3', '1,234.56', '1 23', '1234 567', '1  234', '1\t234',
    '12 USD', '1/2', '1000000000000.01', '9'.repeat(400),
  ])('rejects an incomplete or invalid price %s', (text) => {
    expect(parseShoppingPrice(text)).toBeNull();
  });
});

describe('planned products and recorded expenses', () => {
  it('keeps plans outside totals and activity, without mutating the original data', () => {
    const empty = createEmptyData();
    const data = addShoppingItem(empty, plannedItem({ title: '  Батон  ' }));
    expect(data.shoppingList).toEqual([plannedItem()]);
    expect(empty.shoppingList).toBeUndefined();
    expect(data.transactions).toBe(empty.transactions);
    expect(getMonthTotal(data.transactions, '2026-10', 'EUR')).toBe(0);
    expect(getActivityCounts(data.transactions)).toEqual({});
    expect(validateBackup(data)).toEqual(data);
  });

  it.each<Currency>(['USD', 'EUR', 'KZT'])('creates one food expense in %s on the local price entry day', (currency) => {
    const before = plannedData();
    const data = saveShoppingPrice(before, 'bread', 0.29, currency, 'expense-bread', new Date(2026, 9, 27, 0, 15));
    expect(data.transactions).toEqual([{
      id: 'expense-bread', title: 'Батон', amount: 0.29, currency,
      category: 'food', date: '2026-10-27', createdAt: '2026-10-27',
    }]);
    expect(data.shoppingList).toEqual([plannedItem({ currency, transactionId: 'expense-bread' })]);
    expect(getActivityCounts(data.transactions)).toEqual({ '2026-10-27': 1 });
    expect(getMonthTotal(data.transactions, '2026-10', currency)).toBe(0.29);
    expect(before.transactions).toEqual([]);
    expect(before.shoppingList?.[0].transactionId).toBeUndefined();
  });

  it('updates the same expense on later price edits and preserves purchase details and dates', () => {
    const before = purchasedData();
    before.transactions[0] = {
      ...before.transactions[0], date: '2026-09-01', note: 'Важная заметка',
      items: [{ id: 'detail', title: 'Батон', amount: 0.3 }],
    };
    const once = saveShoppingPrice(before, 'bread', 3.5, 'USD', 'unused-new-id', new Date(2026, 10, 3));
    const twice = saveShoppingPrice(once, 'bread', 4, 'KZT', 'another-unused-id', new Date(2026, 11, 1));
    expect(twice.transactions).toHaveLength(1);
    expect(twice.transactions[0]).toEqual({ ...before.transactions[0], amount: 4, currency: 'KZT' });
    expect(twice.transactions[0].items).toBe(before.transactions[0].items);
    expect(twice.shoppingList?.[0]).toEqual(plannedItem({ currency: 'KZT', transactionId: 'expense-bread' }));
    expect(getActivityCounts(twice.transactions)).toEqual({ '2026-10-27': 1 });
    expect(before.transactions[0].amount).toBe(2.5);
  });

  it('does not change an older expense creation date that was absent in legacy data', () => {
    const data = purchasedData();
    delete data.transactions[0].createdAt;
    const updated = saveShoppingPrice(data, 'bread', 3, 'EUR', 'ignored', new Date(2026, 10, 3));
    expect(updated.transactions[0].createdAt).toBeUndefined();
    expect(updated.transactions[0].date).toBe('2026-10-27');
  });

  it('rejects a price below itemized details using cents and leaves the original expense intact', () => {
    const data = purchasedData();
    data.transactions[0].items = [
      { id: 'a', title: 'Часть 1', amount: 0.1 },
      { id: 'b', title: 'Часть 2', amount: 0.2 },
    ];
    expect(() => saveShoppingPrice(data, 'bread', 0.29, 'USD', 'ignored', new Date())).toThrow(/суммы покупок/);
    expect(data.transactions[0].amount).toBe(2.5);
    const updated = saveShoppingPrice(data, 'bread', 0.3, 'EUR', 'ignored', new Date());
    expect(updated.transactions[0].amount).toBe(0.3);
    expect(() => validateBackup(updated)).not.toThrow();
  });

  it('updates a paid product title and currency on its linked expense without altering the amount', () => {
    const before = purchasedData();
    const updated = updateShoppingItem(before, 'bread', { title: '  Цельнозерновой батон  ', currency: 'USD' });
    expect(updated.shoppingList?.[0].title).toBe('Цельнозерновой батон');
    expect(updated.transactions[0]).toEqual({
      ...before.transactions[0], title: 'Цельнозерновой батон', currency: 'USD',
    });
    expect(before.transactions[0].title).toBe('Батон');
    expect(updateShoppingItem(plannedData(), 'bread', { currency: 'KZT' }).transactions).toEqual([]);
  });

  it('removes pending or paid rows while keeping every recorded expense', () => {
    expect(removeShoppingItem(plannedData(), 'bread').shoppingList).toEqual([]);
    const before = purchasedData();
    const updated = removeShoppingItem(before, 'bread');
    expect(updated.shoppingList).toEqual([]);
    expect(updated.transactions).toBe(before.transactions);
    expect(getMonthTotal(updated.transactions, '2026-10', 'EUR')).toBe(2.5);
    expect(before.shoppingList).toHaveLength(1);
  });

  it('treats a deleted linked expense as pending before recording a new price', () => {
    const data = purchasedData();
    data.transactions = [];
    const updated = saveShoppingPrice(data, 'bread', 3, 'EUR', 'replacement', new Date(2026, 10, 3));
    expect(updated.transactions).toHaveLength(1);
    expect(updated.transactions[0].id).toBe('replacement');
    expect(updated.transactions[0].date).toBe('2026-11-03');
    expect(updated.shoppingList?.[0].transactionId).toBe('replacement');
  });

  it.each([0, -1, NaN, Infinity, 0.001, 1.005, 1e12 + 0.01])('rejects invalid numeric price %s atomically', (amount) => {
    const data = plannedData();
    expect(() => saveShoppingPrice(data, 'bread', amount, 'EUR', 'new', new Date())).toThrow(/цену/);
    expect(data.transactions).toEqual([]);
    expect(data.shoppingList?.[0].transactionId).toBeUndefined();
  });

  it('accepts the maximum price and validates currencies, dates and expense IDs on creation', () => {
    const data = plannedData();
    expect(saveShoppingPrice(data, 'bread', 1e12, 'EUR', 'new', new Date()).transactions[0].amount).toBe(1e12);
    expect(() => saveShoppingPrice(data, 'bread', 2, 'GBP' as Currency, 'new', new Date())).toThrow(/валюту/);
    expect(() => saveShoppingPrice(data, 'bread', 2, 'EUR', '', new Date())).toThrow(/ID/);
    expect(() => saveShoppingPrice(data, 'bread', 2, 'EUR', 'new', new Date('invalid'))).toThrow(/дат/);
    const paid = addShoppingItem(purchasedData(), plannedItem({ id: 'milk', title: 'Молоко' }));
    expect(() => saveShoppingPrice(paid, 'milk', 2, 'EUR', 'expense-bread', new Date())).toThrow(/ID/);
  });

  it('rejects missing rows, duplicate IDs, blank titles and invalid planned products', () => {
    const data = plannedData();
    expect(() => updateShoppingItem(data, 'missing', { title: 'X' })).toThrow(/не найден/);
    expect(() => removeShoppingItem(data, 'missing')).toThrow(/не найден/);
    expect(() => saveShoppingPrice(data, 'missing', 2, 'EUR', 'new', new Date())).toThrow(/не найден/);
    expect(() => addShoppingItem(data, plannedItem())).toThrow(/ID/);
    expect(() => updateShoppingItem(data, 'bread', { title: ' ' })).toThrow(/Название/);
    expect(() => updateShoppingItem(data, 'bread', { currency: 'GBP' as Currency })).toThrow(/валюту/);
    expect(() => addShoppingItem(data, plannedItem({ id: 'new', title: 'x'.repeat(161) }))).toThrow(/Название/);
    expect(() => addShoppingItem(data, plannedItem({ id: 'new', createdAt: '2026-02-30' }))).toThrow(/дат/);
    const paid = purchasedData();
    expect(() => addShoppingItem(paid, plannedItem({ id: 'other', transactionId: 'expense-bread' }))).toThrow(/другим товаром/);
  });
});

describe('shopping backup and local persistence compatibility', () => {
  it('keeps legacy version-one backup shape and the existing storage key', () => {
    const legacy = createEmptyData();
    expect(validateBackup(JSON.stringify(legacy))).toEqual(legacy);
    expect(Object.hasOwn(validateBackup(legacy), 'shoppingList')).toBe(false);
    expect(STORAGE_KEY).toBe('finance-control:data:v1');
    expect(validateBackup({ ...legacy, shoppingList: [] }).shoppingList).toEqual([]);
  });

  it('reconstructs shopping rows, removes unknown properties and drops dangling expense links', () => {
    const paid = purchasedData();
    const source = {
      ...paid,
      shoppingList: [
        { ...paid.shoppingList![0], extra: '<script>' },
        plannedItem({ id: 'milk', title: '  Молоко  ', transactionId: 'deleted' }),
      ],
    };
    const restored = validateBackup(source);
    expect(restored.shoppingList).toEqual([
      paid.shoppingList![0], plannedItem({ id: 'milk', title: 'Молоко' }),
    ]);
    expect(restored.shoppingList).not.toBe(source.shoppingList);
    expect(restored.shoppingList![0]).not.toBe(source.shoppingList[0]);
    expect(restored.transactions).toEqual(paid.transactions);
  });

  it.each([
    { id: '' }, { id: 'x'.repeat(129) }, { title: ' ' }, { title: 'x'.repeat(161) },
    { currency: 'GBP' }, { createdAt: '2025-02-29' }, { createdAt: '2026-10-27T10:00:00Z' },
    { transactionId: 1 }, { transactionId: '' }, { transactionId: 'x'.repeat(129) },
  ])('rejects an invalid imported row %j', (patch) => {
    expect(() => validateBackup({ ...createEmptyData(), shoppingList: [{ ...plannedItem(), ...patch }] })).toThrow();
  });

  it('rejects invalid list containers, duplicate row IDs and duplicate expense links', () => {
    for (const shoppingList of [undefined, null, {}, [null], [plannedItem(), plannedItem()]]) {
      expect(() => validateBackup({ ...createEmptyData(), shoppingList })).toThrow();
    }
    const data = purchasedData();
    data.shoppingList!.push(plannedItem({ id: 'duplicate-link', transactionId: 'expense-bread' }));
    expect(() => validateBackup(data)).toThrow(/несколькими товарами/);
  });

  it('enforces the 1000-product limit in imports and mutations', () => {
    const data: AppData = {
      ...createEmptyData(),
      shoppingList: Array.from({ length: 1_000 }, (_, index) => plannedItem({ id: `item-${index}` })),
    };
    expect(validateBackup(data).shoppingList).toHaveLength(1_000);
    expect(() => addShoppingItem(data, plannedItem())).toThrow(/1000/);
    expect(() => validateBackup({ ...data, shoppingList: [...data.shoppingList!, plannedItem()] })).toThrow(/1000/);
  });

  it('round-trips pending and paid rows through JSON and storage without duplicate expenses', () => {
    const data = addShoppingItem(purchasedData(), plannedItem({ id: 'milk', title: 'Молоко' }));
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(validateBackup(JSON.stringify(data))).toEqual(data);
    expect(saveData(data, storage)).toBe(true);
    const reopened = loadData(storage);
    expect(reopened).toEqual(data);
    expect(saveShoppingPrice(reopened, 'bread', 3, 'EUR', 'ignored', new Date()).transactions).toHaveLength(1);
    expect(reopened.shoppingList![1].transactionId).toBeUndefined();
  });
});
