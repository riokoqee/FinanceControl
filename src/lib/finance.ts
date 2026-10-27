export type Currency = 'USD' | 'EUR' | 'KZT';
export type Language = 'ru' | 'en';
export type CategoryId =
  | 'food'
  | 'shopping'
  | 'transport'
  | 'home'
  | 'entertainment'
  | 'health'
  | 'other';

/** An item inherits its currency from its parent transaction. */
export interface TransactionItem {
  id: string;
  title: string;
  amount: number;
}

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  currency: Currency;
  category: CategoryId;
  /** Calendar date in the user's timezone, without a UTC conversion. */
  date: string;
  note?: string;
  items?: TransactionItem[];
  /** Local calendar day when this record was created, independent of purchase date. */
  createdAt?: string;
}

export interface Profile {
  name: string;
  email: string;
  currency: Currency;
  /** Monthly budget expressed in the profile currency; zero means unset. */
  monthlyBudget: number;
  theme: 'light' | 'dark' | 'system';
  language: Language;
  /** A resized raster image saved with the profile, never a remote URL or SVG. */
  avatar?: string;
}

export interface AppData {
  version: 1;
  profile: Profile;
  transactions: Transaction[];
}

export const STORAGE_KEY = 'finance-control:data:v1';

export const CURRENCIES: ReadonlyArray<{
  code: Currency;
  symbol: string;
  label: string;
}> = [
  { code: 'USD', symbol: '$', label: 'Доллар США' },
  { code: 'EUR', symbol: '€', label: 'Евро' },
  { code: 'KZT', symbol: '₸', label: 'Казахстанский тенге' },
];

export const CATEGORIES: ReadonlyArray<{
  id: CategoryId;
  label: string;
  color: string;
  icon: string;
}> = [
  { id: 'food', label: 'Еда и продукты', color: '#9bb49b', icon: 'UtensilsCrossed' },
  { id: 'shopping', label: 'Покупки', color: '#b6a0cc', icon: 'ShoppingBag' },
  { id: 'transport', label: 'Транспорт', color: '#91aeca', icon: 'TramFront' },
  { id: 'home', label: 'Дом', color: '#d9b88f', icon: 'House' },
  { id: 'entertainment', label: 'Развлечения', color: '#d29d9d', icon: 'Clapperboard' },
  { id: 'health', label: 'Здоровье', color: '#8fbbb4', icon: 'HeartPulse' },
  { id: 'other', label: 'Другое', color: '#a6a6ae', icon: 'Ellipsis' },
];

/** Illustrative fixed conversion rates, expressed as units per one US dollar. */
export const REFERENCE_RATES: Readonly<Record<Currency, number>> = {
  USD: 1,
  EUR: 0.92,
  KZT: 480,
};
export const RATE_LABEL = 'Условный курс: 1 USD = 0,92 EUR = 480 KZT';

export const DEFAULT_PROFILE: Readonly<Profile> = {
  name: 'Пользователь',
  email: '',
  currency: 'USD',
  monthlyBudget: 0,
  theme: 'system',
  language: 'ru',
};

const MAX_AMOUNT = 1_000_000_000_000;
const MAX_TRANSACTIONS = 50_000;
const MAX_BACKUP_LENGTH = 30_000_000;
const MAX_ITEMS = 200;
const MAX_AVATAR_LENGTH = 500_000;

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem'>;

export function createEmptyData(): AppData {
  return { version: 1, profile: { ...DEFAULT_PROFILE }, transactions: [] };
}

/** Format a local date explicitly so a UTC offset cannot move it to yesterday. */
export function todayString(date = new Date()): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function monthKey(date: string | Date = new Date()): string {
  return (date instanceof Date ? todayString(date) : date).slice(0, 7);
}

export function getMonthTransactions(transactions: Transaction[], month: string): Transaction[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  return transactions.filter((transaction) => transaction.date.startsWith(`${month}-`));
}

export function convertAmount(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount;
  return (amount / REFERENCE_RATES[from]) * REFERENCE_RATES[to];
}

export function getMonthTotal(
  transactions: Transaction[],
  month: string,
  currency: Currency,
): number {
  return getMonthTransactions(transactions, month).reduce(
    (total, transaction) => total + convertAmount(transaction.amount, transaction.currency, currency),
    0,
  );
}

export function formatMoney(amount: number, currency: Currency, language: Language = 'ru'): string {
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ru-RU', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string, language: Language = 'ru'): string {
  if (!isValidDate(date)) return date;
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short' }).format(
    new Date(`${date}T12:00:00`),
  );
}

/** Work in whole cents to avoid rounding errors such as 0.1 + 0.2 > 0.3. */
export function getItemTotal(transaction: Pick<Transaction, 'items'>): number {
  return (transaction.items ?? []).reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
}

/** Legacy records use their purchase date because their creation day was not stored. */
export function getActivityCounts(transactions: Transaction[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const transaction of transactions) {
    const date = transaction.createdAt ?? transaction.date;
    counts[date] = (counts[date] ?? 0) + 1;
  }
  return counts;
}

export function getActivityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count < 1) return 0;
  if (count < 2) return 1;
  if (count < 4) return 2;
  if (count < 7) return 3;
  return 4;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.some((currency) => currency.code === value);
}

function isCategory(value: unknown): value is CategoryId {
  return CATEGORIES.some((category) => category.id === value);
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && todayString(date) === value;
}

function validAmount(value: unknown, allowZero = false): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (allowZero ? value >= 0 : value > 0) &&
    value <= MAX_AMOUNT
  );
}

function validAvatar(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_AVATAR_LENGTH) return false;
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  return match !== null && match[1].length % 4 === 0;
}

function readText(value: unknown, label: string, limit: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > limit) {
    throw new Error(`Некорректное поле «${label}» в резервной копии.`);
  }
  const text = value.trim();
  if (!allowEmpty && text.length === 0) {
    throw new Error(`Поле «${label}» не может быть пустым.`);
  }
  return text;
}

/**
 * Validate and reconstruct imported data. Unknown properties are deliberately
 * discarded; no imported object is used as application state directly.
 */
export function validateBackup(input: unknown): AppData {
  let data = input;
  if (typeof input === 'string') {
    if (input.length > MAX_BACKUP_LENGTH) throw new Error('Файл резервной копии слишком большой.');
    try {
      data = JSON.parse(input) as unknown;
    } catch {
      throw new Error('Не удалось прочитать JSON. Выберите резервную копию BeliLog.');
    }
  }

  if (!isRecord(data) || data.version !== 1 || !isRecord(data.profile)) {
    throw new Error('Неподдерживаемый формат резервной копии.');
  }
  const profile = data.profile;
  if (
    !isCurrency(profile.currency) ||
    !validAmount(profile.monthlyBudget, true) ||
    !['light', 'dark', 'system'].includes(profile.theme as string) ||
    (profile.language !== undefined && profile.language !== 'ru' && profile.language !== 'en') ||
    (profile.avatar !== undefined && !validAvatar(profile.avatar))
  ) {
    throw new Error('Настройки профиля в резервной копии некорректны.');
  }
  if (!Array.isArray(data.transactions) || data.transactions.length > MAX_TRANSACTIONS) {
    throw new Error('Некорректный список расходов в резервной копии.');
  }

  const ids = new Set<string>();
  const transactions = data.transactions.map((item: unknown): Transaction => {
    if (
      !isRecord(item) ||
      !validAmount(item.amount) ||
      !isCurrency(item.currency) ||
      !isCategory(item.category) ||
      !isValidDate(item.date)
    ) {
      throw new Error('Один из расходов содержит некорректную сумму, валюту, категорию или дату.');
    }
    const id = readText(item.id, 'ID расхода', 128);
    if (ids.has(id)) throw new Error('В резервной копии найдены повторяющиеся ID расходов.');
    ids.add(id);
    const transaction: Transaction = {
      id,
      title: readText(item.title, 'Название расхода', 160),
      amount: item.amount,
      currency: item.currency,
      category: item.category,
      date: item.date,
    };
    if (item.note !== undefined) {
      transaction.note = readText(item.note, 'Заметка', 2_000, true);
    }
    if (item.createdAt !== undefined) {
      if (!isValidDate(item.createdAt)) throw new Error('Некорректная дата создания расхода.');
      transaction.createdAt = item.createdAt;
    }
    if (item.items !== undefined) {
      if (!Array.isArray(item.items) || item.items.length > MAX_ITEMS) {
        throw new Error('В одном расходе может быть не больше 200 покупок.');
      }
      const itemIds = new Set<string>();
      transaction.items = item.items.map((entry: unknown): TransactionItem => {
        if (!isRecord(entry) || !validAmount(entry.amount) || Math.round(entry.amount * 100) < 1) {
          throw new Error('Одна из покупок содержит некорректную сумму.');
        }
        const itemId = readText(entry.id, 'ID покупки', 128);
        if (itemIds.has(itemId)) throw new Error('В расходе найдены повторяющиеся ID покупок.');
        itemIds.add(itemId);
        return {
          id: itemId,
          title: readText(entry.title, 'Название покупки', 160),
          amount: entry.amount,
        };
      });
      if (Math.round(getItemTotal(transaction) * 100) > Math.round(transaction.amount * 100)) {
        throw new Error('Сумма покупок превышает общую сумму расхода.');
      }
    }
    return transaction;
  });

  return {
    version: 1,
    profile: {
      name: readText(profile.name, 'Имя', 80),
      email: readText(profile.email, 'Электронная почта', 254, true),
      currency: profile.currency,
      monthlyBudget: profile.monthlyBudget,
      theme: profile.theme as Profile['theme'],
      language: (profile.language ?? 'ru') as Language,
      ...(profile.avatar !== undefined ? { avatar: profile.avatar as string } : {}),
    },
    transactions,
  };
}

/** Corrupt or unavailable browser storage must never prevent opening the app. */
export function loadData(storage?: StorageAdapter): AppData {
  try {
    const source = storage ?? globalThis.localStorage;
    const saved = source?.getItem(STORAGE_KEY);
    return saved ? validateBackup(saved) : createEmptyData();
  } catch {
    return createEmptyData();
  }
}

/** Return false for full or restricted storage so the UI can explain the issue. */
export function saveData(data: AppData, storage?: StorageAdapter): boolean {
  try {
    const destination = storage ?? globalThis.localStorage;
    if (!destination) return false;
    destination.setItem(STORAGE_KEY, JSON.stringify(validateBackup(data)));
    return true;
  } catch {
    return false;
  }
}

/** Sample data is created only after the user explicitly chooses to load it. */
export function createDemoData(now = new Date()): AppData {
  const day = now.getDate();
  const currentDate = (daysAgo: number) =>
    todayString(new Date(now.getFullYear(), now.getMonth(), Math.max(1, day - daysAgo), 12));
  const previousDate = (date: number) =>
    todayString(new Date(now.getFullYear(), now.getMonth() - 1, date, 12));
  const prefix = monthKey(now);
  const entries: Array<Omit<Transaction, 'id'>> = [
    { title: 'Продукты на неделю', amount: 84.5, currency: 'USD', category: 'food', date: currentDate(0), note: 'Овощи, фрукты и всё для домашних ужинов', items: [{ id: 'bread', title: 'Батон', amount: 2 }, { id: 'chicken', title: 'Куриное филе', amount: 9 }, { id: 'vegetables', title: 'Овощи', amount: 12.5 }] },
    { title: 'Кофе и круассан', amount: 8.5, currency: 'EUR', category: 'food', date: currentDate(1), items: [{ id: 'coffee', title: 'Капучино', amount: 4.5 }, { id: 'croissant', title: 'Круассан', amount: 4 }] },
    { title: 'Такси домой', amount: 3200, currency: 'KZT', category: 'transport', date: currentDate(2) },
    { title: 'Новые кроссовки', amount: 119, currency: 'USD', category: 'shopping', date: currentDate(3), note: 'Для утренних пробежек' },
    { title: 'Домашний интернет', amount: 28, currency: 'USD', category: 'home', date: currentDate(5) },
    { title: 'Ужин с друзьями', amount: 42, currency: 'EUR', category: 'food', date: currentDate(6) },
    { title: 'Аптека', amount: 6500, currency: 'KZT', category: 'health', date: currentDate(8) },
    { title: 'Билеты в кино', amount: 24, currency: 'USD', category: 'entertainment', date: currentDate(10) },
    { title: 'Подписка на музыку', amount: 10.99, currency: 'USD', category: 'entertainment', date: currentDate(12) },
    { title: 'Проездной', amount: 18, currency: 'EUR', category: 'transport', date: currentDate(15) },
    { title: 'Лампа для рабочего стола', amount: 36, currency: 'USD', category: 'home', date: currentDate(18) },
    { title: 'Подарок другу', amount: 16500, currency: 'KZT', category: 'other', date: currentDate(21) },
    { title: 'Продукты', amount: 132.4, currency: 'USD', category: 'food', date: previousDate(25) },
    { title: 'Поездка на выходные', amount: 85, currency: 'EUR', category: 'entertainment', date: previousDate(18) },
    { title: 'Книги', amount: 42, currency: 'USD', category: 'shopping', date: previousDate(12) },
    { title: 'Коммунальные услуги', amount: 26000, currency: 'KZT', category: 'home', date: previousDate(5) },
  ];

  return {
    version: 1,
    profile: { ...DEFAULT_PROFILE, name: 'Александр', monthlyBudget: 1200 },
    transactions: entries.map((entry, index) => ({ ...entry, createdAt: entry.date, id: `demo-${prefix}-${index + 1}` })),
  };
}
