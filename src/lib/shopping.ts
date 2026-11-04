import {
  CURRENCIES,
  MAX_AMOUNT,
  MAX_TRANSACTIONS,
  getItemTotal,
  parseMoney,
  todayString,
  type AppData,
  type Currency,
  type ShoppingItem,
} from './finance';

const MAX_SHOPPING_ITEMS = 1_000;

function readText(value: unknown, label: string, limit: number): string {
  if (typeof value !== 'string' || value.length > limit || !value.trim()) {
    throw new Error(`Некорректное поле «${label}».`);
  }
  return value.trim();
}

function checkCurrency(currency: unknown): asserts currency is Currency {
  if (!CURRENCIES.some((entry) => entry.code === currency)) {
    throw new Error('Выберите валюту USD, EUR или KZT.');
  }
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && todayString(date) === value;
}

function priceInCents(amount: number): number {
  const cents = Math.round(amount * 100);
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > MAX_AMOUNT ||
    cents / 100 !== amount
  ) {
    throw new Error('Введите положительную цену до 1 000 000 000 000 с точностью до двух знаков.');
  }
  return cents;
}

/** Accept decimal prices and optional, correctly grouped ordinary or nonbreaking spaces. */
export function parseShoppingPrice(input: string): number | null {
  return parseMoney(input);
}

function findItem(data: AppData, id: string): ShoppingItem {
  const item = data.shoppingList?.find((entry) => entry.id === id);
  if (!item) throw new Error('Товар не найден в списке покупок.');
  return item;
}

function normalizeItem(data: AppData, item: ShoppingItem): ShoppingItem {
  const id = readText(item.id, 'ID товара', 128);
  const title = readText(item.title, 'Название товара', 160);
  checkCurrency(item.currency);
  if (!isValidDate(item.createdAt)) throw new Error('Некорректная дата создания товара.');
  const result: ShoppingItem = { id, title, currency: item.currency, createdAt: item.createdAt };
  if (item.transactionId !== undefined) {
    const transactionId = readText(item.transactionId, 'ID связанного расхода', 128);
    const transaction = data.transactions.find((entry) => entry.id === transactionId);
    if (transaction) {
      if (data.shoppingList?.some((entry) => entry.id !== id && entry.transactionId === transactionId)) {
        throw new Error('Этот расход уже связан с другим товаром.');
      }
      result.transactionId = transactionId;
      result.title = transaction.title;
      result.currency = transaction.currency;
    }
  }
  return result;
}

export function addShoppingItem(data: AppData, item: ShoppingItem): AppData {
  const list = data.shoppingList ?? [];
  if (list.length >= MAX_SHOPPING_ITEMS) throw new Error('В списке покупок может быть не больше 1000 товаров.');
  const normalized = normalizeItem(data, item);
  if (list.some((entry) => entry.id === normalized.id)) {
    throw new Error('Товар с таким ID уже есть в списке покупок.');
  }
  return { ...data, shoppingList: [...list, normalized] };
}

export function updateShoppingItem(
  data: AppData,
  id: string,
  patch: { title?: string; currency?: Currency },
): AppData {
  const current = normalizeItem(data, findItem(data, id));
  const updated = {
    ...current,
    title: patch.title === undefined ? current.title : readText(patch.title, 'Название товара', 160),
    currency: patch.currency === undefined ? current.currency : patch.currency,
  };
  checkCurrency(updated.currency);
  const transactions = updated.transactionId === undefined ? data.transactions : data.transactions.map((transaction) => (
    transaction.id === updated.transactionId
      ? {
        ...transaction,
        ...(patch.title === undefined ? {} : { title: updated.title }),
        ...(patch.currency === undefined ? {} : { currency: updated.currency }),
      }
      : transaction
  ));
  return {
    ...data,
    shoppingList: data.shoppingList!.map((item) => item.id === id ? updated : item),
    transactions,
  };
}

/** Removing a list row never removes money already recorded as an expense. */
export function removeShoppingItem(data: AppData, id: string): AppData {
  findItem(data, id);
  return { ...data, shoppingList: data.shoppingList!.filter((item) => item.id !== id) };
}

/** Record the first price once; later prices update the same expense atomically. */
export function saveShoppingPrice(
  data: AppData,
  id: string,
  amount: number,
  currency: Currency,
  newTransactionId: string,
  now: Date,
): AppData {
  const current = normalizeItem(data, findItem(data, id));
  const cents = priceInCents(amount);
  checkCurrency(currency);
  const existing = current.transactionId === undefined ? undefined : data.transactions.find(
    (transaction) => transaction.id === current.transactionId,
  );

  let transactions: AppData['transactions'];
  let transactionId: string;
  if (existing) {
    if (cents < Math.round(getItemTotal(existing) * 100)) {
      throw new Error('Цена не может быть меньше суммы покупок внутри расхода.');
    }
    transactionId = existing.id;
    transactions = data.transactions.map((transaction) => transaction.id === existing.id
      ? { ...transaction, amount, currency }
      : transaction);
  } else {
    if (data.transactions.length >= MAX_TRANSACTIONS) {
      throw new Error('Достигнут предел в 50 000 расходов.');
    }
    transactionId = readText(newTransactionId, 'ID расхода', 128);
    if (data.transactions.some((transaction) => transaction.id === transactionId)) {
      throw new Error('Расход с таким ID уже существует.');
    }
    if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || !isValidDate(todayString(now))) {
      throw new Error('Некорректная дата создания расхода.');
    }
    const today = todayString(now);
    transactions = [{
      id: transactionId,
      title: current.title,
      amount,
      currency,
      category: 'food',
      date: today,
      createdAt: today,
    }, ...data.transactions];
  }

  return {
    ...data,
    transactions,
    shoppingList: data.shoppingList!.map((item) => item.id === id
      ? { ...item, title: current.title, currency, transactionId }
      : item),
  };
}

/** Confirm a purchase and remove its plan in one immutable change, keeping the expense. */
export function confirmShoppingPurchase(
  data: AppData,
  id: string,
  amount: number,
  currency: Currency,
  newTransactionId: string,
  now: Date,
  patch?: { title?: string },
): AppData {
  const prepared = patch?.title === undefined ? data : updateShoppingItem(data, id, { title: patch.title });
  const purchased = saveShoppingPrice(prepared, id, amount, currency, newTransactionId, now);
  return removeShoppingItem(purchased, id);
}
