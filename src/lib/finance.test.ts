import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  convertAmount,
  createDemoData,
  createEmptyData,
  formatDate,
  formatMoney,
  getActivityCounts,
  getActivityLevel,
  getItemTotal,
  getMonthTotal,
  getMonthTransactions,
  loadData,
  monthKey,
  saveData,
  todayString,
  validateBackup,
} from './finance';

describe('finance data and backups', () => {
  it('starts empty and gives each instance its own profile and transactions', () => {
    const data = createEmptyData();
    data.profile.name = 'Изменённое имя';
    expect(createEmptyData().transactions).toEqual([]);
    expect(createEmptyData().profile.name).toBe('Пользователь');
    expect(createEmptyData().profile.monthlyBudget).toBe(0);
  });

  it('round-trips an exported backup and discards unknown properties', () => {
    const data = createDemoData(new Date(2026, 9, 27, 12));
    const imported = validateBackup({ ...data, arbitrary: '<script>alert(1)</script>' });
    expect(imported).toEqual(data);
    expect(validateBackup(JSON.stringify(data))).toEqual(data);
    expect(imported).not.toBe(data);
    expect(imported.profile).not.toBe(data.profile);
    expect(imported.transactions[0]).not.toBe(data.transactions[0]);
  });

  it.each([
    ['negative amount', { amount: -1 }],
    ['zero amount', { amount: 0 }],
    ['infinite amount', { amount: Infinity }],
    ['oversized amount', { amount: 1e15 }],
    ['numeric string', { amount: '12.5' }],
    ['unknown currency', { currency: 'GBP' }],
    ['unknown category', { category: 'travel' }],
    ['impossible day', { date: '2026-02-30' }],
    ['non-leap day', { date: '2025-02-29' }],
    ['timestamp', { date: '2026-10-27T12:00:00Z' }],
    ['missing title', { title: '   ' }],
    ['long note', { note: 'x'.repeat(2_001) }],
  ])('rejects a transaction with %s', (_label, patch) => {
    const data = createDemoData();
    data.transactions[0] = { ...data.transactions[0], ...patch } as typeof data.transactions[number];
    expect(() => validateBackup(data)).toThrow();
  });

  it('rejects duplicate IDs, unsupported versions and damaged JSON', () => {
    const data = createDemoData();
    data.transactions[1].id = data.transactions[0].id;
    expect(() => validateBackup(data)).toThrow(/ID/);
    expect(() => validateBackup({ ...createEmptyData(), version: 2 })).toThrow();
    expect(() => validateBackup('{broken')).toThrow(/JSON/);
    expect(() => validateBackup(null)).toThrow();
  });

  it('rejects invalid profile settings and accepts an unset budget', () => {
    const data = createEmptyData();
    expect(validateBackup(data).profile.monthlyBudget).toBe(0);
    expect(() => validateBackup({ ...data, profile: { ...data.profile, monthlyBudget: -1 } })).toThrow();
    expect(() => validateBackup({ ...data, profile: { ...data.profile, theme: 'neon' } })).toThrow();
    expect(() => validateBackup({ ...data, profile: { ...data.profile, currency: 'GBP' } })).toThrow();
  });

  it('migrates older version-one backups without changing their expenses or storage key', () => {
    const legacy = {
      version: 1,
      profile: { name: 'Пользователь', email: '', currency: 'EUR', monthlyBudget: 500, theme: 'dark' },
      transactions: [{ id: 'old', title: 'Продукты', amount: 50, currency: 'EUR', category: 'food', date: '2026-10-26' }],
    };
    const migrated = validateBackup(JSON.stringify(legacy));
    expect(migrated.profile.language).toBe('ru');
    expect(migrated.profile.avatar).toBeUndefined();
    expect(migrated.transactions).toEqual(legacy.transactions);
    expect(getActivityCounts(migrated.transactions)).toEqual({ '2026-10-26': 1 });
    expect(STORAGE_KEY).toBe('finance-control:data:v1');
  });

  it.each(['de', '', null, 1])('rejects unsupported language %s', (language) => {
    const data = createEmptyData();
    expect(() => validateBackup({ ...data, profile: { ...data.profile, language } })).toThrow();
  });

  it.each([
    'https://example.com/avatar.png',
    'data:image/svg+xml;base64,PHN2Zy8+',
    'data:text/html;base64,PHN2Zy8+',
    'data:image/png;base64,invalid<payload>',
    'data:image/png;base64,a',
    `data:image/png;base64,${'a'.repeat(500_000)}`,
  ])('rejects an unsafe or oversized avatar', (avatar) => {
    const data = createEmptyData();
    expect(() => validateBackup({ ...data, profile: { ...data.profile, avatar } })).toThrow();
  });

  it('accepts supported raster avatar types and an empty avatar setting', () => {
    const data = createEmptyData();
    for (const mime of ['jpeg', 'png', 'webp']) {
      const avatar = `data:image/${mime};base64,YWJjZA==`;
      expect(validateBackup({ ...data, profile: { ...data.profile, avatar } }).profile.avatar).toBe(avatar);
    }
    expect(validateBackup(data).profile.avatar).toBeUndefined();
  });

  it('supports a leap day and local calendar dates without UTC shifts', () => {
    const data = createDemoData(new Date(2024, 1, 29, 23, 30));
    expect(data.transactions[0].date).toBe('2024-02-29');
    expect(todayString(new Date(2026, 9, 27, 0, 15))).toBe('2026-10-27');
    expect(monthKey(new Date(2026, 9, 27))).toBe('2026-10');
    expect(() => validateBackup(data)).not.toThrow();
  });

  it('keeps demo current-month expenses on or before today, including January 1', () => {
    const data = createDemoData(new Date(2026, 0, 1, 12));
    expect(getMonthTransactions(data.transactions, '2026-01')).toHaveLength(12);
    expect(getMonthTransactions(data.transactions, '2025-12')).toHaveLength(4);
    expect(data.transactions.every((entry) => entry.date <= '2026-01-01')).toBe(true);
  });
});

describe('purchase details and activity calendar', () => {
  it('sums item amounts in cents and permits a partially itemized expense', () => {
    const data = createDemoData();
    data.transactions[0].amount = 0.3;
    data.transactions[0].items = [
      { id: 'a', title: 'First', amount: 0.1 },
      { id: 'b', title: 'Second', amount: 0.2 },
    ];
    expect(getItemTotal(data.transactions[0])).toBe(0.3);
    expect(() => validateBackup(data)).not.toThrow();
    data.transactions[0].amount = 1;
    expect(() => validateBackup(data)).not.toThrow();
    expect(getItemTotal({})).toBe(0);
  });

  it.each([
    ['negative amount', [{ id: 'a', title: 'Bread', amount: -1 }]],
    ['zero amount', [{ id: 'a', title: 'Bread', amount: 0 }]],
    ['sub-cent amount', [{ id: 'a', title: 'Bread', amount: 0.001 }]],
    ['infinite amount', [{ id: 'a', title: 'Bread', amount: Infinity }]],
    ['numeric string', [{ id: 'a', title: 'Bread', amount: '2' }]],
    ['empty title', [{ id: 'a', title: ' ', amount: 2 }]],
    ['long title', [{ id: 'a', title: 'x'.repeat(161), amount: 2 }]],
    ['duplicate IDs', [{ id: 'a', title: 'Bread', amount: 2 }, { id: 'a', title: 'Fillet', amount: 9 }]],
    ['overshoot', [{ id: 'a', title: 'Bread', amount: 84.51 }]],
    ['too many items', Array.from({ length: 201 }, (_, index) => ({ id: `${index}`, title: 'Bread', amount: 0.01 }))],
    ['non-array list', {}],
  ])('rejects item details with %s', (_label, items) => {
    const data = createDemoData();
    data.transactions[0] = { ...data.transactions[0], items } as typeof data.transactions[number];
    expect(() => validateBackup(data)).toThrow();
  });

  it('reconstructs purchase details and discards unknown properties', () => {
    const data = createDemoData();
    const first = data.transactions[0];
    first.items = [{ id: 'a', title: 'Bread', amount: 2, currency: 'EUR' } as NonNullable<typeof first.items>[number]];
    const imported = validateBackup(data);
    expect(imported.transactions[0].items).toEqual([{ id: 'a', title: 'Bread', amount: 2 }]);
    expect(imported.transactions[0].items).not.toBe(first.items);
    expect(imported.transactions[0].items![0]).not.toBe(first.items[0]);
  });

  it('counts record creation days independently of purchase dates and falls back for legacy data', () => {
    const [first, second, third] = createDemoData().transactions;
    const transactions = [
      { ...first, date: '2026-10-01', createdAt: '2026-10-27' },
      { ...second, date: '2026-09-15', createdAt: '2026-10-27' },
      { ...third, date: '2026-10-26', createdAt: undefined },
    ];
    expect(getActivityCounts(transactions)).toEqual({ '2026-10-27': 2, '2026-10-26': 1 });
    expect(getActivityCounts([])).toEqual({});
    expect([0, 1, 2, 3, 4, 6, 7, 99].map(getActivityLevel)).toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('rejects invalid creation dates while preserving valid historical purchase dates', () => {
    const data = createDemoData();
    data.transactions[0].createdAt = '2026-02-30';
    expect(() => validateBackup(data)).toThrow();
    data.transactions[0].createdAt = '2026-10-27';
    data.transactions[0].date = '2025-06-01';
    expect(validateBackup(data).transactions[0].createdAt).toBe('2026-10-27');
  });
});

describe('currencies and month totals', () => {
  it('formats money and dates in the selected language and keeps Russian as the default', () => {
    expect(formatMoney(12.5, 'USD', 'en')).toBe('$12.5');
    expect(formatMoney(12.5, 'USD')).toBe(formatMoney(12.5, 'USD', 'ru'));
    expect(formatMoney(12.5, 'EUR', 'en')).toContain('€');
    expect(formatMoney(12.5, 'KZT', 'en')).toContain('₸');
    expect(formatDate('2026-10-27', 'en')).toBe('Oct 27');
    expect(formatDate('2026-10-27')).toBe(formatDate('2026-10-27', 'ru'));
    expect(formatDate('invalid', 'en')).toBe('invalid');
  });
  it('converts every supported currency through the same explicit reference rate', () => {
    expect(convertAmount(100, 'USD', 'EUR')).toBeCloseTo(92);
    expect(convertAmount(100, 'USD', 'KZT')).toBeCloseTo(48000);
    expect(convertAmount(48000, 'KZT', 'EUR')).toBeCloseTo(92);
    expect(convertAmount(92, 'EUR', 'USD')).toBeCloseTo(100);
    expect(convertAmount(23.5, 'USD', 'USD')).toBe(23.5);
  });

  it('filters the selected month and converts totals into the requested currency', () => {
    const data = createDemoData(new Date(2026, 9, 27, 12));
    const october = getMonthTransactions(data.transactions, '2026-10');
    const total = october.reduce((sum, item) => sum + convertAmount(item.amount, item.currency, 'USD'), 0);
    expect(october).toHaveLength(12);
    expect(getMonthTotal(data.transactions, '2026-10', 'USD')).toBeCloseTo(total);
    expect(getMonthTotal(data.transactions, '2026-10', 'EUR')).toBeCloseTo(total * 0.92);
    expect(getMonthTransactions(data.transactions, '2026-1')).toEqual([]);
  });
});

describe('local persistence', () => {
  const memoryStorage = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
  };

  it('persists and restores valid data', () => {
    const storage = memoryStorage();
    const data = createDemoData();
    expect(saveData(data, storage)).toBe(true);
    expect(loadData(storage)).toEqual(data);
  });

  it('keeps the avatar, language, purchase details and activity dates after closing and reopening', () => {
    const storage = memoryStorage();
    const data = createDemoData(new Date(2026, 9, 27, 12));
    data.profile.language = 'en';
    data.profile.avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ9sAAAAASUVORK5CYII=';
    data.transactions[0].createdAt = '2026-10-27';
    data.transactions[0].date = '2026-10-01';
    expect(saveData(data, storage)).toBe(true);
    const reloaded = loadData(storage);
    expect(reloaded).toEqual(data);
    expect(reloaded.profile.language).toBe('en');
    expect(reloaded.profile.avatar).toBe(data.profile.avatar);
    expect(reloaded.transactions[0].items).toHaveLength(3);
    expect(getActivityCounts(reloaded.transactions)['2026-10-27']).toBe(1);
  });

  it('opens with empty data when storage is absent, corrupted or blocked', () => {
    const storage = memoryStorage();
    expect(loadData(storage)).toEqual(createEmptyData());
    storage.setItem(STORAGE_KEY, '{broken');
    expect(loadData(storage)).toEqual(createEmptyData());
    const blocked = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
    };
    expect(loadData(blocked)).toEqual(createEmptyData());
    expect(saveData(createEmptyData(), blocked)).toBe(false);
  });

  it('does not overwrite valid storage with invalid state', () => {
    const storage = memoryStorage();
    const valid = createDemoData();
    saveData(valid, storage);
    const invalid = createEmptyData();
    invalid.profile.monthlyBudget = NaN;
    expect(saveData(invalid, storage)).toBe(false);
    expect(loadData(storage)).toEqual(valid);
  });
});
