import type { MessageKey } from "./messages";
import { LocalizedError } from "./localizedError";
import { isStreakLedger } from "./streak/streakTypes";
import type { StreakLedger } from "./streak/streakTypes";
import {
  isExchangeRates,
  isExchangeRateSync,
  REFERENCE_RATES,
} from "./currency";
import type { ExchangeRates, ExchangeRateSync } from "./currency";
import {
  APP_DATA_VERSIONS,
  isSupportedAppDataVersion,
  withCanonicalVersion,
} from "./appDataVersion";
import type { AppDataVersion } from "./appDataVersion";
export type { ExchangeRates, ExchangeRateSync } from "./currency";
export { REFERENCE_RATES } from "./currency";

export type Currency = "USD" | "EUR" | "KZT";
export type Language = "ru" | "en";
export type CategoryId =
  | "food"
  | "shopping"
  | "transport"
  | "home"
  | "entertainment"
  | "health"
  | "other";

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

/** A planned product becomes a real expense only after its price is entered. */
export interface ShoppingItem {
  id: string;
  title: string;
  currency: Currency;
  createdAt: string;
  transactionId?: string;
}

/** A monthly category limit keeps its own currency when the profile changes. */
export interface CategoryBudget {
  id: CategoryId;
  amount: number;
  currency: Currency;
}

export interface ShoppingTemplateItem {
  title: string;
  currency: Currency;
}

export interface ShoppingTemplate {
  id: string;
  name: string;
  items: ShoppingTemplateItem[];
}

export interface Profile {
  name: string;
  email: string;
  currency: Currency;
  /** Monthly budget expressed in the profile currency; zero means unset. */
  monthlyBudget: number;
  theme: "light" | "dark" | "system";
  language: Language;
  /** A resized raster image saved with the profile, never a remote URL or SVG. */
  avatar?: string;
  /** Optional manual units per USD; original transaction amounts stay untouched. */
  exchangeRates?: ExchangeRates;
  /** Manual by default; automatic mode is enabled only by an explicit choice. */
  exchangeRateSync?: ExchangeRateSync;
}

export interface AppData {
  /** New feature versions stop older open tabs from discarding optional records. */
  version: AppDataVersion;
  profile: Profile;
  transactions: Transaction[];
  /** Optional so existing version-one backups retain their original shape. */
  shoppingList?: ShoppingItem[];
  categoryBudgets?: CategoryBudget[];
  shoppingTemplates?: ShoppingTemplate[];
  /** Daily confirmations, independent of expenses, with all rewards derived. */
  streak?: StreakLedger;
}

export const STORAGE_KEY = "finance-control:data:v1";

export const CURRENCIES: ReadonlyArray<{
  code: Currency;
  symbol: string;
  label: string;
  labelKey: MessageKey;
}> = [
  { code: "USD", symbol: "$", label: "Доллар США", labelKey: "currency.usd" },
  { code: "EUR", symbol: "€", label: "Евро", labelKey: "currency.eur" },
  {
    code: "KZT",
    symbol: "₸",
    label: "Казахстанский тенге",
    labelKey: "currency.kzt",
  },
];

export const CATEGORIES: ReadonlyArray<{
  id: CategoryId;
  label: string;
  labelKey: MessageKey;
  color: string;
  icon: string;
}> = [
  {
    id: "food",
    label: "Еда и продукты",
    labelKey: "category.food",
    color: "#9bb49b",
    icon: "UtensilsCrossed",
  },
  {
    id: "shopping",
    label: "Покупки",
    labelKey: "category.shopping",
    color: "#b6a0cc",
    icon: "ShoppingBag",
  },
  {
    id: "transport",
    label: "Транспорт",
    labelKey: "category.transport",
    color: "#91aeca",
    icon: "TramFront",
  },
  {
    id: "home",
    label: "Дом",
    labelKey: "category.home",
    color: "#d9b88f",
    icon: "House",
  },
  {
    id: "entertainment",
    label: "Развлечения",
    labelKey: "category.entertainment",
    color: "#d29d9d",
    icon: "Clapperboard",
  },
  {
    id: "health",
    label: "Здоровье",
    labelKey: "category.health",
    color: "#8fbbb4",
    icon: "HeartPulse",
  },
  {
    id: "other",
    label: "Другое",
    labelKey: "category.other",
    color: "#a6a6ae",
    icon: "Ellipsis",
  },
];

export const DEFAULT_PROFILE: Readonly<Profile> = {
  name: "Пользователь",
  email: "",
  currency: "USD",
  monthlyBudget: 0,
  theme: "system",
  language: "ru",
};

export const MAX_AMOUNT = 1_000_000_000_000;
export const MAX_TRANSACTIONS = 50_000;
export const MAX_BACKUP_LENGTH = 30_000_000;
export const MAX_SHOPPING_TEMPLATES = 20;
export const MAX_TEMPLATE_ITEMS = 200;
export const MAX_SHOPPING_ITEMS = 1_000;
const MAX_ITEMS = 200;
const MAX_AVATAR_LENGTH = 500_000;

type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

/** Parse entered money without accepting exponents, hexadecimal or silent rounding. */
export function parseMoney(input: string, allowZero = false): number | null {
  const text = input.trim();
  if (!/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[.,]\d{1,2})?$/.test(text))
    return null;
  const [whole, fraction = ""] = text
    .replace(/[ \u00a0\u202f]/g, "")
    .replace(",", ".")
    .split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (
    !Number.isSafeInteger(cents) ||
    cents < (allowZero ? 0 : 1) ||
    cents > MAX_AMOUNT * 100
  )
    return null;
  return cents / 100;
}

export function createEmptyData(): AppData {
  return {
    version: APP_DATA_VERSIONS.legacy,
    profile: { ...DEFAULT_PROFILE },
    transactions: [],
  };
}

/** Format a local date explicitly so a UTC offset cannot move it to yesterday. */
export function todayString(date = new Date()): string {
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthKey(date: string | Date = new Date()): string {
  return (date instanceof Date ? todayString(date) : date).slice(0, 7);
}

export function getMonthTransactions(
  transactions: Transaction[],
  month: string,
): Transaction[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  return transactions.filter((transaction) =>
    transaction.date.startsWith(`${month}-`),
  );
}

export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  rates: Readonly<ExchangeRates> = REFERENCE_RATES,
): number {
  if (from === to) return amount;
  return (amount / rates[from]) * rates[to];
}

export function getMonthTotal(
  transactions: Transaction[],
  month: string,
  currency: Currency,
  rates: Readonly<ExchangeRates> = REFERENCE_RATES,
): number {
  return getMonthTransactions(transactions, month).reduce(
    (total, transaction) =>
      total +
      convertAmount(transaction.amount, transaction.currency, currency, rates),
    0,
  );
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<Language, Intl.DateTimeFormat>();

export function formatMoney(
  amount: number,
  currency: Currency,
  language: Language = "ru",
): string {
  const key = `${language}:${currency}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(language === "en" ? "en-US" : "ru-RU", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(amount);
}

export function formatDate(date: string, language: Language = "ru"): string {
  if (!isValidDate(date)) return date;
  let formatter = dateFormatters.get(language);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(language === "en" ? "en-US" : "ru-RU", {
      day: "numeric",
      month: "short",
    });
    dateFormatters.set(language, formatter);
  }
  return formatter.format(new Date(`${date}T12:00:00`));
}

/** Work in whole cents to avoid rounding errors such as 0.1 + 0.2 > 0.3. */
export function getItemTotal(transaction: Pick<Transaction, "items">): number {
  return (
    (transaction.items ?? []).reduce(
      (sum, item) => sum + Math.round(item.amount * 100),
      0,
    ) / 100
  );
}

/** Legacy records use their purchase date because their creation day was not stored. */
export function getActivityCounts(
  transactions: Transaction[],
): Record<string, number> {
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
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.some((currency) => currency.code === value);
}

function isCategory(value: unknown): value is CategoryId {
  return CATEGORIES.some((category) => category.id === value);
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && todayString(date) === value;
}

function validAmount(value: unknown, allowZero = false): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    (allowZero ? value >= 0 : value > 0) &&
    value <= MAX_AMOUNT
  );
}

function validAvatar(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_AVATAR_LENGTH)
    return false;
  const match =
    /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  return match !== null && match[1].length % 4 === 0;
}

function readText(
  value: unknown,
  label: MessageKey,
  limit: number,
  allowEmpty = false,
): string {
  if (typeof value !== "string" || value.length > limit) {
    throw new LocalizedError("ui.invalidFieldFieldInTheBackup", {
      field: { key: label },
    });
  }
  const text = value.trim();
  if (!allowEmpty && text.length === 0) {
    throw new LocalizedError("ui.fieldFieldCannotBeEmpty", {
      field: { key: label },
    });
  }
  return text;
}

/**
 * Validate and reconstruct imported data. Unknown properties are deliberately
 * discarded; no imported object is used as application state directly.
 */
export function validateBackup(input: unknown): AppData {
  let data = input;
  if (typeof input === "string") {
    if (input.length > MAX_BACKUP_LENGTH)
      throw new LocalizedError("ui.theBackupFileIsTooLarge");
    try {
      data = JSON.parse(input) as unknown;
    } catch {
      throw new LocalizedError("ui.couldNotReadJsonChooseABelilogBackup");
    }
  }

  if (
    !isRecord(data) ||
    !isSupportedAppDataVersion(data.version) ||
    !isRecord(data.profile) ||
    (data.version === APP_DATA_VERSIONS.streak &&
      !Object.prototype.hasOwnProperty.call(data, "streak")) ||
    (data.version === APP_DATA_VERSIONS.manualRates &&
      !Object.prototype.hasOwnProperty.call(data.profile, "exchangeRates")) ||
    (data.version === APP_DATA_VERSIONS.automaticRates &&
      !Object.prototype.hasOwnProperty.call(data.profile, "exchangeRateSync"))
  ) {
    throw new LocalizedError("ui.unsupportedBackupFormat");
  }
  const profile = data.profile;
  if (
    !isCurrency(profile.currency) ||
    !validAmount(profile.monthlyBudget, true) ||
    !["light", "dark", "system"].includes(profile.theme as string) ||
    (profile.language !== undefined &&
      profile.language !== "ru" &&
      profile.language !== "en") ||
    (profile.avatar !== undefined && !validAvatar(profile.avatar))
  ) {
    throw new LocalizedError("ui.theBackupContainsInvalidProfileSettings");
  }
  let exchangeRates: ExchangeRates | undefined;
  if (Object.prototype.hasOwnProperty.call(profile, "exchangeRates")) {
    if (!isExchangeRates(profile.exchangeRates))
      throw new LocalizedError(
        "ui.exchangeRatesAreInvalidEnterPositiveValuesFrom0000001To1000000WithAtMost6DecimalPlacesTheUsdBaseRateMustBe1",
      );
    exchangeRates = {
      USD: 1,
      EUR: profile.exchangeRates.EUR,
      KZT: profile.exchangeRates.KZT,
    };
  }
  let exchangeRateSync: ExchangeRateSync | undefined;
  if (Object.prototype.hasOwnProperty.call(profile, "exchangeRateSync")) {
    if (!isExchangeRateSync(profile.exchangeRateSync, exchangeRates))
      throw new LocalizedError("ui.theBackupContainsInvalidProfileSettings");
    const sync = profile.exchangeRateSync;
    exchangeRateSync = {
      mode: sync.mode,
      ...(sync.source
        ? {
            source: sync.source,
            checkedAt: sync.checkedAt,
            dates: { ...sync.dates! },
          }
        : {}),
    };
  }
  if (
    !Array.isArray(data.transactions) ||
    data.transactions.length > MAX_TRANSACTIONS
  ) {
    throw new LocalizedError("ui.theBackupContainsAnInvalidExpenseList");
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
      throw new LocalizedError(
        "ui.anExpenseContainsAnInvalidAmountCurrencyCategoryOrDate",
      );
    }
    const id = readText(item.id, "field.expenseId", 128);
    if (ids.has(id))
      throw new LocalizedError("ui.theBackupContainsDuplicateExpenseIds");
    ids.add(id);
    const transaction: Transaction = {
      id,
      title: readText(item.title, "field.expenseTitle", 160),
      amount: item.amount,
      currency: item.currency,
      category: item.category,
      date: item.date,
    };
    if (item.note !== undefined) {
      transaction.note = readText(item.note, "field.note", 2_000, true);
    }
    if (item.createdAt !== undefined) {
      if (!isValidDate(item.createdAt))
        throw new LocalizedError("ui.invalidExpenseCreationDate");
      transaction.createdAt = item.createdAt;
    }
    if (item.items !== undefined) {
      if (!Array.isArray(item.items) || item.items.length > MAX_ITEMS) {
        throw new LocalizedError("ui.anExpenseCanContainUpTo200Items");
      }
      const itemIds = new Set<string>();
      transaction.items = item.items.map((entry: unknown): TransactionItem => {
        if (
          !isRecord(entry) ||
          !validAmount(entry.amount) ||
          Math.round(entry.amount * 100) < 1
        ) {
          throw new LocalizedError("ui.anItemContainsAnInvalidAmount");
        }
        const itemId = readText(entry.id, "field.purchaseId", 128);
        if (itemIds.has(itemId))
          throw new LocalizedError("ui.theExpenseContainsDuplicateItemIds");
        itemIds.add(itemId);
        return {
          id: itemId,
          title: readText(entry.title, "field.purchaseTitle", 160),
          amount: entry.amount,
        };
      });
      if (
        Math.round(getItemTotal(transaction) * 100) >
        Math.round(transaction.amount * 100)
      ) {
        throw new LocalizedError("ui.theItemTotalExceedsTheExpenseAmount");
      }
    }
    return transaction;
  });

  const transactionsById = new Map(
    transactions.map((transaction) => [transaction.id, transaction]),
  );
  let shoppingList: ShoppingItem[] | undefined;
  if (Object.prototype.hasOwnProperty.call(data, "shoppingList")) {
    if (
      !Array.isArray(data.shoppingList) ||
      data.shoppingList.length > MAX_SHOPPING_ITEMS
    ) {
      throw new LocalizedError("ui.theShoppingListCanContainUpTo1000Products");
    }
    const shoppingIds = new Set<string>();
    const linkedTransactions = new Set<string>();
    shoppingList = data.shoppingList.map((item: unknown): ShoppingItem => {
      if (
        !isRecord(item) ||
        !isCurrency(item.currency) ||
        !isValidDate(item.createdAt)
      ) {
        throw new LocalizedError(
          "ui.anItemContainsAnInvalidCurrencyOrCreationDate",
        );
      }
      const id = readText(item.id, "field.shoppingItemId", 128);
      if (shoppingIds.has(id))
        throw new LocalizedError("ui.theShoppingListContainsDuplicateItemIds");
      shoppingIds.add(id);
      const shoppingItem: ShoppingItem = {
        id,
        title: readText(item.title, "field.shoppingItemTitle", 160),
        currency: item.currency,
        createdAt: item.createdAt,
      };
      if (item.transactionId !== undefined) {
        const transactionId = readText(
          item.transactionId,
          "field.linkedExpenseId",
          128,
        );
        // An expense can be deleted independently; the product then becomes pending.
        if (ids.has(transactionId)) {
          if (linkedTransactions.has(transactionId)) {
            throw new LocalizedError(
              "ui.anExpenseCannotBeLinkedToMultipleShoppingItems",
            );
          }
          linkedTransactions.add(transactionId);
          shoppingItem.transactionId = transactionId;
          // Linked rows are a view of the surviving expense, including after a merge.
          const linked = transactionsById.get(transactionId)!;
          shoppingItem.title = linked.title;
          shoppingItem.currency = linked.currency;
        }
      }
      return shoppingItem;
    });
  }

  let categoryBudgets: CategoryBudget[] | undefined;
  if (Object.prototype.hasOwnProperty.call(data, "categoryBudgets")) {
    if (
      !Array.isArray(data.categoryBudgets) ||
      data.categoryBudgets.length > CATEGORIES.length
    ) {
      throw new LocalizedError("ui.invalidCategoryBudgetList");
    }
    const categories = new Set<CategoryId>();
    categoryBudgets = data.categoryBudgets.map(
      (entry: unknown): CategoryBudget => {
        if (
          !isRecord(entry) ||
          !isCategory(entry.id) ||
          !isCurrency(entry.currency) ||
          !validAmount(entry.amount) ||
          parseMoney(String(entry.amount)) !== entry.amount
        ) {
          throw new LocalizedError(
            "ui.aBudgetContainsAnInvalidCategoryCurrencyOrAmount",
          );
        }
        if (categories.has(entry.id))
          throw new LocalizedError(
            "ui.theBackupContainsDuplicateCategoryBudgets",
          );
        categories.add(entry.id);
        return { id: entry.id, amount: entry.amount, currency: entry.currency };
      },
    );
  }

  let shoppingTemplates: ShoppingTemplate[] | undefined;
  if (Object.prototype.hasOwnProperty.call(data, "shoppingTemplates")) {
    if (
      !Array.isArray(data.shoppingTemplates) ||
      data.shoppingTemplates.length > MAX_SHOPPING_TEMPLATES
    ) {
      throw new LocalizedError("ui.youCanSaveUpTo20ShoppingTemplates");
    }
    const templateIds = new Set<string>();
    shoppingTemplates = data.shoppingTemplates.map(
      (entry: unknown): ShoppingTemplate => {
        if (
          !isRecord(entry) ||
          !Array.isArray(entry.items) ||
          entry.items.length < 1 ||
          entry.items.length > MAX_TEMPLATE_ITEMS
        ) {
          throw new LocalizedError("ui.aTemplateMustContain1200Items");
        }
        const id = readText(entry.id, "field.templateId", 128);
        if (templateIds.has(id))
          throw new LocalizedError("ui.theBackupContainsDuplicateTemplateIds");
        templateIds.add(id);
        return {
          id,
          name: readText(entry.name, "field.templateName", 60),
          items: entry.items.map((item: unknown): ShoppingTemplateItem => {
            if (!isRecord(item) || !isCurrency(item.currency))
              throw new LocalizedError("ui.invalidItemCurrencyInTheTemplate");
            return {
              title: readText(item.title, "field.shoppingItemTitle", 160),
              currency: item.currency,
            };
          }),
        };
      },
    );
  }

  let streak: StreakLedger | undefined;
  if (Object.prototype.hasOwnProperty.call(data, "streak")) {
    if (!isStreakLedger(data.streak))
      throw new LocalizedError("ui.theBackupContainsInvalidCheckInHistory");
    streak = {
      version: data.streak.version,
      startedOn: data.streak.startedOn,
      confirmedDays: data.streak.confirmedDays
        .map(({ date, status }) => ({ date, status }))
        .sort((left, right) => left.date.localeCompare(right.date)),
    };
  }

  return withCanonicalVersion({
    version: data.version,
    profile: {
      name: readText(profile.name, "field.name", 80),
      email: readText(profile.email, "field.email", 254, true),
      currency: profile.currency,
      monthlyBudget: profile.monthlyBudget,
      theme: profile.theme as Profile["theme"],
      language: (profile.language ?? "ru") as Language,
      ...(profile.avatar !== undefined
        ? { avatar: profile.avatar as string }
        : {}),
      ...(exchangeRates !== undefined ? { exchangeRates } : {}),
      ...(exchangeRateSync !== undefined ? { exchangeRateSync } : {}),
    },
    transactions,
    ...(shoppingList !== undefined ? { shoppingList } : {}),
    ...(categoryBudgets !== undefined ? { categoryBudgets } : {}),
    ...(shoppingTemplates !== undefined ? { shoppingTemplates } : {}),
    ...(streak !== undefined ? { streak } : {}),
  });
}

/** Corrupt or unavailable browser storage must never prevent opening the app. */
export function loadData(storage?: StorageAdapter): AppData {
  try {
    const source = storage ?? globalThis.localStorage;
    const saved = source?.getItem(STORAGE_KEY);
    if (saved === null || saved === undefined) return createEmptyData();
    try {
      return validateBackup(saved);
    } catch {
      const lastGood = source?.getItem(`${STORAGE_KEY}:last-good`);
      return lastGood ? validateBackup(lastGood) : createEmptyData();
    }
  } catch {
    return createEmptyData();
  }
}

/** Return false for full or restricted storage so the UI can explain the issue. */
export function saveData(data: AppData, storage?: StorageAdapter): boolean {
  try {
    const serialized = JSON.stringify(validateBackup(data));
    const destination = storage ?? globalThis.localStorage;
    if (!destination) return false;
    const saved = destination.getItem(STORAGE_KEY);
    // This compatibility API cannot authorize recovery or discard damaged data.
    if (saved !== null) validateBackup(saved);
    destination.setItem(STORAGE_KEY, serialized);
    try {
      destination.setItem(`${STORAGE_KEY}:last-good`, serialized);
    } catch {
      /* Primary saved. */
    }
    return true;
  } catch {
    return false;
  }
}

/** Sample data is created only after the user explicitly chooses to load it. */
export function createDemoData(now = new Date()): AppData {
  const day = now.getDate();
  const currentDate = (daysAgo: number) =>
    todayString(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        Math.max(1, day - daysAgo),
        12,
      ),
    );
  const previousDate = (date: number) =>
    todayString(new Date(now.getFullYear(), now.getMonth() - 1, date, 12));
  const prefix = monthKey(now);
  const entries: Array<Omit<Transaction, "id">> = [
    {
      title: "Продукты на неделю",
      amount: 84.5,
      currency: "USD",
      category: "food",
      date: currentDate(0),
      note: "Овощи, фрукты и всё для домашних ужинов",
      items: [
        { id: "bread", title: "Батон", amount: 2 },
        { id: "chicken", title: "Куриное филе", amount: 9 },
        { id: "vegetables", title: "Овощи", amount: 12.5 },
      ],
    },
    {
      title: "Кофе и круассан",
      amount: 8.5,
      currency: "EUR",
      category: "food",
      date: currentDate(1),
      items: [
        { id: "coffee", title: "Капучино", amount: 4.5 },
        { id: "croissant", title: "Круассан", amount: 4 },
      ],
    },
    {
      title: "Такси домой",
      amount: 3200,
      currency: "KZT",
      category: "transport",
      date: currentDate(2),
    },
    {
      title: "Новые кроссовки",
      amount: 119,
      currency: "USD",
      category: "shopping",
      date: currentDate(3),
      note: "Для утренних пробежек",
    },
    {
      title: "Домашний интернет",
      amount: 28,
      currency: "USD",
      category: "home",
      date: currentDate(5),
    },
    {
      title: "Ужин с друзьями",
      amount: 42,
      currency: "EUR",
      category: "food",
      date: currentDate(6),
    },
    {
      title: "Аптека",
      amount: 6500,
      currency: "KZT",
      category: "health",
      date: currentDate(8),
    },
    {
      title: "Билеты в кино",
      amount: 24,
      currency: "USD",
      category: "entertainment",
      date: currentDate(10),
    },
    {
      title: "Подписка на музыку",
      amount: 10.99,
      currency: "USD",
      category: "entertainment",
      date: currentDate(12),
    },
    {
      title: "Проездной",
      amount: 18,
      currency: "EUR",
      category: "transport",
      date: currentDate(15),
    },
    {
      title: "Лампа для рабочего стола",
      amount: 36,
      currency: "USD",
      category: "home",
      date: currentDate(18),
    },
    {
      title: "Подарок другу",
      amount: 16500,
      currency: "KZT",
      category: "other",
      date: currentDate(21),
    },
    {
      title: "Продукты",
      amount: 132.4,
      currency: "USD",
      category: "food",
      date: previousDate(25),
    },
    {
      title: "Поездка на выходные",
      amount: 85,
      currency: "EUR",
      category: "entertainment",
      date: previousDate(18),
    },
    {
      title: "Книги",
      amount: 42,
      currency: "USD",
      category: "shopping",
      date: previousDate(12),
    },
    {
      title: "Коммунальные услуги",
      amount: 26000,
      currency: "KZT",
      category: "home",
      date: previousDate(5),
    },
  ];

  return {
    version: APP_DATA_VERSIONS.legacy,
    profile: { ...DEFAULT_PROFILE, name: "Александр", monthlyBudget: 1200 },
    transactions: entries.map((entry, index) => ({
      ...entry,
      createdAt: entry.date,
      id: `demo-${prefix}-${index + 1}`,
    })),
  };
}
