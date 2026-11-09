import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  MAX_AMOUNT,
  MAX_SHOPPING_TEMPLATES,
  MAX_TEMPLATE_ITEMS,
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
import type { StreakLedger } from './streak/streakTypes';
import { REFERENCE_RATES } from './currency';
import type { ExchangeRates } from './currency';

describe('version-four manual currency settings', () => {
  const rates: ExchangeRates = { USD: 1, EUR: 0.96, KZT: 510.123456 };
  const withRates = () => {
    const data = createEmptyData();
    return { ...data, profile: { ...data.profile, exchangeRates: { ...rates } } };
  };

  it('upgrades only profiles with explicit rates and copies the validated values', () => {
    const source = withRates();
    const restored = validateBackup(source);
    expect(restored.version).toBe(4);
    expect(restored.profile.exchangeRates).toEqual(rates);
    expect(restored.profile.exchangeRates).not.toBe(source.profile.exchangeRates);
    expect(source.version).toBe(1);
    expect(validateBackup(JSON.stringify(restored))).toEqual(restored);
  });

  it('accepts version four with optional tracking history, while version three still requires it', () => {
    expect(validateBackup({ ...withRates(), version: 4 }).streak).toBeUndefined();
    const streak: StreakLedger = { version: 1, startedOn: '2026-11-09', confirmedDays: [] };
    expect(validateBackup({ ...withRates(), version: 4, streak })).toMatchObject({ version: 4, streak });
    expect(() => validateBackup({ ...createEmptyData(), version: 4 })).toThrow(/формат/);
    expect(() => validateBackup({ ...withRates(), version: 3 })).toThrow(/формат/);
    expect(() => validateBackup({ ...withRates(), version: 5, streak })).toThrow(/формат/);
  });

  it('keeps legacy versions and field absence intact until manual rates are saved', () => {
    for (const version of [1, 2] as const) {
      const legacy = { ...createEmptyData(), version };
      expect(validateBackup(legacy)).toEqual(legacy);
      expect(Object.hasOwn(validateBackup(legacy).profile, 'exchangeRates')).toBe(false);
    }
    const legacy = { ...createEmptyData(), version: 3 as const,
      streak: { version: 1 as const, startedOn: '2026-11-09', confirmedDays: [] } };
    expect(validateBackup(legacy)).toEqual(legacy);
    expect(validateBackup({ ...legacy, profile: { ...legacy.profile, exchangeRates: rates } }).version).toBe(4);
  });

  it.each([
    undefined, null, [], {}, { USD: 1, EUR: 0.96 },
    { USD: 2, EUR: 0.96, KZT: 510 }, { USD: 1, EUR: 0, KZT: 510 },
    { USD: 1, EUR: -1, KZT: 510 }, { USD: 1, EUR: '0.96', KZT: 510 },
    { USD: 1, EUR: 0.96, KZT: NaN }, { USD: 1, EUR: Infinity, KZT: 510 },
    { USD: 1, EUR: 0.0000001, KZT: 510 }, { USD: 1, EUR: 0.9600001, KZT: 510 },
    { USD: 1, EUR: 0.96, KZT: 1_000_001 }, { USD: 1, EUR: 0.96, KZT: 510, RUB: 90 },
    Object.create({ USD: 1, EUR: 0.96, KZT: 510 }),
    JSON.parse('{"USD":1,"EUR":0.96,"KZT":510,"__proto__":{"polluted":true}}'),
  ].map((value) => [value]))('rejects explicitly damaged rates rather than replacing them silently', (exchangeRates) => {
    const data = createEmptyData();
    expect(() => validateBackup({ ...data, profile: { ...data.profile, exchangeRates } })).toThrow(/Курс/);
  });

  it('uses the same USD base for every cross-currency pair, preserving full precision', () => {
    const manual: ExchangeRates = { USD: 1, EUR: 0.96, KZT: 510 };
    expect(convertAmount(100, 'USD', 'EUR', manual)).toBeCloseTo(96);
    expect(convertAmount(100, 'USD', 'KZT', manual)).toBeCloseTo(51_000);
    expect(convertAmount(96, 'EUR', 'USD', manual)).toBeCloseTo(100);
    expect(convertAmount(96, 'EUR', 'KZT', manual)).toBeCloseTo(51_000);
    expect(convertAmount(51_000, 'KZT', 'USD', manual)).toBeCloseTo(100);
    expect(convertAmount(51_000, 'KZT', 'EUR', manual)).toBeCloseTo(96);
    expect(convertAmount(1.234567, 'EUR', 'EUR', manual)).toBe(1.234567);
    expect(convertAmount(1, 'USD', 'KZT', rates)).toBe(510.123456);
    expect(convertAmount(1, 'USD', 'EUR')).toBe(REFERENCE_RATES.EUR);
    expect(convertAmount(convertAmount(123.45, 'EUR', 'KZT', rates), 'KZT', 'EUR', rates)).toBeCloseTo(123.45, 10);
  });

  it('converts only the selected monthly view without rewriting historical original amounts', () => {
    const source = { ...withRates(), transactions: [
      { id: 'usd', title: 'USD', amount: 100, currency: 'USD' as const, category: 'food' as const, date: '2026-11-01' },
      { id: 'eur', title: 'EUR', amount: 96, currency: 'EUR' as const, category: 'food' as const, date: '2026-11-02' },
      { id: 'kzt', title: 'KZT', amount: 51_000, currency: 'KZT' as const, category: 'food' as const, date: '2026-11-03' },
      { id: 'old', title: 'Old', amount: 10, currency: 'USD' as const, category: 'food' as const, date: '2026-10-31' },
    ] };
    const before = JSON.stringify(source);
    const manual: ExchangeRates = { USD: 1, EUR: 0.96, KZT: 510 };
    expect(getMonthTotal(source.transactions, '2026-11', 'USD', manual)).toBeCloseTo(300);
    expect(getMonthTotal(source.transactions, '2026-11', 'EUR', manual)).toBeCloseTo(288);
    expect(getMonthTotal(source.transactions, '2026-11', 'KZT', manual)).toBeCloseTo(153_000);
    expect(validateBackup(source).transactions).toEqual(source.transactions);
    expect(JSON.stringify(source)).toBe(before);
  });
});

describe('version-three accounting-day backups', () => {
  const streak = (): StreakLedger => ({
    version: 1,
    startedOn: '2026-11-09',
    confirmedDays: [
      { date: '2026-11-07', status: 'LOGGED' },
      { date: '2026-11-09', status: 'NO_SPEND' },
    ],
  });

  it('upgrades only feature-bearing copies and preserves legacy payloads', () => {
    const legacy = createEmptyData();
    expect(validateBackup(legacy)).toEqual(legacy);
    expect(validateBackup({ ...legacy, version: 2 })).toEqual({ ...legacy, version: 2 });
    expect(validateBackup({ ...legacy, streak: streak() })).toEqual({ ...legacy, version: 3, streak: streak() });
    expect(validateBackup({ ...legacy, version: 3, streak: streak() }).version).toBe(3);
    expect(() => validateBackup({ ...legacy, version: 4, streak: streak() })).toThrow(/формат/);
  });

  it('round-trips daily facts and discards imported reward and freeze counters', () => {
    const source = {
      ...createEmptyData(), version: 3,
      streak: { ...streak(), freezes: 2, bounty: 9e15, current: 9999,
        confirmedDays: [
          { date: '2026-11-09', status: 'NO_SPEND', reward: 9e15 },
          { date: '2026-11-07', status: 'LOGGED', reward: 9e15 },
        ],
      },
    };
    const restored = validateBackup(JSON.stringify(source));
    expect(restored.streak).toEqual(streak());
    expect(restored.streak).not.toBe(source.streak);
    expect(restored.streak!.confirmedDays[0]).not.toBe(source.streak.confirmedDays[1]);
    expect(source.streak.confirmedDays[0].date).toBe('2026-11-09');
  });

  it.each([
    undefined, null, [], {},
    { version: 2, startedOn: '2026-11-09', confirmedDays: [] },
    { version: 1, startedOn: '2026-02-30', confirmedDays: [] },
    { version: 1, startedOn: '2026-11-09T00:00:00Z', confirmedDays: [] },
    { version: 1, startedOn: '2026-11-09', confirmedDays: null },
    { version: 1, startedOn: '2026-11-09', confirmedDays: [{ date: '2026-11-08', status: 'FROZEN' }] },
    { version: 1, startedOn: '2026-11-09', confirmedDays: [{ date: '2026-11-08', status: 'MISSED' }] },
    { version: 1, startedOn: '2026-11-09', confirmedDays: [{ date: '2026-11-08', status: 'no_spend' }] },
    { version: 1, startedOn: '2026-11-09', confirmedDays: [{ date: '2026-11-09', status: 'LOGGED' }, { date: '2026-11-09', status: 'NO_SPEND' }] },
    { version: 1, startedOn: '2026-11-09', confirmedDays: [{ date: '2026-02-30', status: 'LOGGED' }] },
    { version: 1, startedOn: '2026-11-09', confirmedDays: [null] },
  ].map((value) => [value]))('rejects a damaged or forged accounting-day ledger', (ledger) => {
    expect(() => validateBackup({ ...createEmptyData(), version: 3, streak: ledger })).toThrow();
  });

  it('limits retained history and keeps future local days for a timezone rollback', () => {
    const future = { ...streak(), confirmedDays: [{ date: '2026-11-10', status: 'NO_SPEND' as const }] };
    expect(validateBackup({ ...createEmptyData(), streak: future }).streak).toEqual(future);
    const tooMany = { ...streak(), confirmedDays: Array.from({ length: 100_001 }, () => ({ date: '2026-11-09', status: 'LOGGED' })) };
    expect(() => validateBackup({ ...createEmptyData(), streak: tooMany })).toThrow();
  });
});

describe('optional category limits and shopping templates', () => {
  const extensions = () => ({
    categoryBudgets: [{ id: 'food', amount: 200.25, currency: 'EUR' }],
    shoppingTemplates: [{
      id: 'weekly', name: 'Weekly groceries',
      items: [{ title: 'Bread', currency: 'EUR' }, { title: 'Milk', currency: 'KZT' }],
    }],
  });

  it('keeps legacy backup shape, and round-trips new optional records without mutating input', () => {
    const legacy = createEmptyData();
    expect(validateBackup(legacy)).toEqual(legacy);
    expect(validateBackup(legacy)).not.toHaveProperty('categoryBudgets');
    expect(validateBackup(legacy)).not.toHaveProperty('shoppingTemplates');
    const data = { ...legacy, version: 2, ...extensions() };
    const restored = validateBackup(JSON.stringify(data));
    expect(restored).toEqual(data);
    expect(restored.categoryBudgets).not.toBe(data.categoryBudgets);
    expect(restored.shoppingTemplates![0].items).not.toBe(data.shoppingTemplates[0].items);
    expect(validateBackup({ ...legacy, categoryBudgets: [], shoppingTemplates: [] })).toEqual({ ...legacy, version: 2, categoryBudgets: [], shoppingTemplates: [] });
  });

  it('upgrades feature-bearing version-one copies and never downgrades version two', () => {
    expect(validateBackup({ ...createEmptyData(), ...extensions() }).version).toBe(2);
    expect(validateBackup({ ...createEmptyData(), categoryBudgets: [] }).version).toBe(2);
    expect(validateBackup({ ...createEmptyData(), shoppingTemplates: [] }).version).toBe(2);
    expect(validateBackup({ ...createEmptyData(), version: 2 }).version).toBe(2);
    expect(() => validateBackup({ ...createEmptyData(), version: 3 })).toThrow(/формат/);
  });

  it('canonicalizes names and strips unsupported nested properties', () => {
    const source = { ...createEmptyData(), ...extensions() };
    const restored = validateBackup({
      ...source,
      categoryBudgets: [{ ...source.categoryBudgets[0], arbitrary: true }],
      shoppingTemplates: [{
        ...source.shoppingTemplates[0], name: '  Weekly groceries  ', arbitrary: true,
        items: [{ title: '  Bread  ', currency: 'EUR', amount: 999 }],
      }],
    });
    expect(restored.categoryBudgets).toEqual(source.categoryBudgets);
    expect(restored.shoppingTemplates).toEqual([{ id: 'weekly', name: 'Weekly groceries', items: [{ title: 'Bread', currency: 'EUR' }] }]);
    expect(source.shoppingTemplates[0].items).toHaveLength(2);
  });

  it.each([
    ['negative', -1], ['zero', 0], ['sub-cent', 0.001], ['excess decimals', 2.345],
    ['NaN', NaN], ['infinite', Infinity], ['oversized', MAX_AMOUNT + 1], ['string', '200'],
  ])('rejects a %s category limit', (_label, amount) => {
    expect(() => validateBackup({ ...createEmptyData(), categoryBudgets: [{ id: 'food', amount, currency: 'EUR' }] })).toThrow();
  });

  it('accepts whole cents at ordinary and maximum amounts', () => {
    for (const amount of [0.01, 0.29, 19.99, MAX_AMOUNT - 0.01, MAX_AMOUNT]) {
      expect(validateBackup({ ...createEmptyData(), categoryBudgets: [{ id: 'food', amount, currency: 'USD' }] }).categoryBudgets![0].amount).toBe(amount);
    }
  });

  it.each([
    null, {}, undefined,
    [{ id: 'unknown', amount: 10, currency: 'EUR' }],
    [{ id: 'food', amount: 10, currency: 'GBP' }],
    [{ id: 'food', amount: 10, currency: 'EUR' }, { id: 'food', amount: 20, currency: 'KZT' }],
    Array.from({ length: 8 }, () => ({ id: 'food', amount: 10, currency: 'EUR' })),
  ].map((value) => [value]))('rejects malformed or duplicate category limits', (categoryBudgets) => {
    expect(() => validateBackup({ ...createEmptyData(), categoryBudgets })).toThrow();
  });

  it.each([
    null, {}, undefined,
    [{ id: '', name: 'Weekly', items: [{ title: 'Bread', currency: 'EUR' }] }],
    [{ id: 'x'.repeat(129), name: 'Weekly', items: [{ title: 'Bread', currency: 'EUR' }] }],
    [{ id: 'weekly', name: '   ', items: [{ title: 'Bread', currency: 'EUR' }] }],
    [{ id: 'weekly', name: 'x'.repeat(61), items: [{ title: 'Bread', currency: 'EUR' }] }],
    [{ id: 'weekly', name: 'Weekly', items: [] }],
    [{ id: 'weekly', name: 'Weekly', items: {} }],
    [{ id: 'weekly', name: 'Weekly', items: [null] }],
    [{ id: 'weekly', name: 'Weekly', items: [{ title: '   ', currency: 'EUR' }] }],
    [{ id: 'weekly', name: 'Weekly', items: [{ title: 'x'.repeat(161), currency: 'EUR' }] }],
    [{ id: 'weekly', name: 'Weekly', items: [{ title: 'Bread', currency: 'GBP' }] }],
  ].map((value) => [value]))('rejects malformed shopping templates', (shoppingTemplates) => {
    expect(() => validateBackup({ ...createEmptyData(), shoppingTemplates })).toThrow();
  });

  it('rejects duplicate normalized template IDs and enforces bounded list sizes', () => {
    const template = extensions().shoppingTemplates[0];
    expect(() => validateBackup({ ...createEmptyData(), shoppingTemplates: [template, { ...template, id: ' weekly ' }] })).toThrow(/ID/);
    expect(() => validateBackup({ ...createEmptyData(), shoppingTemplates: Array.from({ length: MAX_SHOPPING_TEMPLATES + 1 }, (_, index) => ({ ...template, id: String(index) })) })).toThrow();
    expect(() => validateBackup({ ...createEmptyData(), shoppingTemplates: [{ ...template, items: Array.from({ length: MAX_TEMPLATE_ITEMS + 1 }, () => template.items[0]) }] })).toThrow();
    expect(validateBackup({ ...createEmptyData(), shoppingTemplates: Array.from({ length: MAX_SHOPPING_TEMPLATES }, (_, index) => ({ ...template, id: String(index), items: Array.from({ length: MAX_TEMPLATE_ITEMS }, () => template.items[0]) })) }).shoppingTemplates).toHaveLength(MAX_SHOPPING_TEMPLATES);
  });
});

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
    expect(() => validateBackup({ ...createEmptyData(), version: 3 })).toThrow();
    expect(() => validateBackup('{broken')).toThrow(/JSON/);
    expect(() => validateBackup(null)).toThrow();
  });

  it('normalizes stale linked shopping metadata to its surviving transaction', () => {
    const data = createDemoData();
    const linked = data.transactions[0];
    data.shoppingList = [{
      id: 'planned', title: 'Old import title', currency: 'KZT', createdAt: linked.date, transactionId: linked.id,
    }];
    expect(validateBackup(data).shoppingList![0]).toMatchObject({
      title: linked.title, currency: linked.currency, transactionId: linked.id,
    });
    // Validation never mutates the caller's recoverable/imported copy.
    expect(data.shoppingList[0].title).toBe('Old import title');
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

  it('keeps damaged primary data intact through the legacy boolean save API', () => {
    const storage = memoryStorage();
    const original = '{damaged-but-recoverable';
    storage.setItem(STORAGE_KEY, original);
    expect(saveData(createEmptyData(), storage)).toBe(false);
    expect(storage.getItem(STORAGE_KEY)).toBe(original);
  });

  it('loads the last good snapshot without overwriting a damaged primary', () => {
    const storage = memoryStorage();
    const valid = createDemoData();
    expect(saveData(valid, storage)).toBe(true);
    storage.setItem(STORAGE_KEY, '{damaged');
    expect(loadData(storage)).toEqual(valid);
    expect(storage.getItem(STORAGE_KEY)).toBe('{damaged');
    expect(saveData(createEmptyData(), storage)).toBe(false);
  });

  it('does not report a failed secondary snapshot as a failed primary save', () => {
    const storage = memoryStorage();
    const adapter = { getItem: storage.getItem, setItem: (key: string, value: string) => {
      if (key.endsWith(':last-good')) throw new Error('QuotaExceededError');
      storage.setItem(key, value);
    } };
    expect(saveData(createEmptyData(), adapter)).toBe(true);
    expect(loadData(storage)).toEqual(createEmptyData());
  });
});
