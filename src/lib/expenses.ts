import { LocalizedError } from "./localizedError";
import { CATEGORIES, MAX_TRANSACTIONS, convertAmount } from "./finance";
import type {
  AppData,
  CategoryId,
  Currency,
  ExchangeRates,
  ShoppingItem,
  Transaction,
} from "./finance";

/** Exact facts from the successful deletion attempt, rather than an old table row. */
export interface ExpenseDeletionSnapshot {
  transaction?: Transaction;
  pendingSnapshots: ShoppingItem[];
}

/** Delete against fresh data and capture only the plans that this deletion unlinked. */
export function removeExpense(
  data: AppData,
  id: string,
): { data: AppData; result: ExpenseDeletionSnapshot } {
  const transaction = data.transactions.find((entry) => entry.id === id);
  if (!transaction) return { data, result: { pendingSnapshots: [] } };
  const pendingSnapshots: ShoppingItem[] = [];
  const shoppingList = data.shoppingList?.map((item) => {
    if (item.transactionId !== id) return item;
    const { transactionId: _removed, ...pending } = item;
    pendingSnapshots.push(pending);
    return pending;
  });
  return {
    data: {
      ...data,
      transactions: data.transactions.filter((entry) => entry.id !== id),
      ...(shoppingList !== undefined ? { shoppingList } : {}),
    },
    result: { transaction, pendingSnapshots },
  };
}

/** Undo never replaces a recreated expense or overwrites a plan edited afterwards. */
export function undoExpense(
  data: AppData,
  snapshot: ExpenseDeletionSnapshot,
): AppData {
  const transaction = snapshot.transaction;
  if (
    !transaction ||
    data.transactions.some((entry) => entry.id === transaction.id)
  )
    return data;
  if (data.transactions.length >= MAX_TRANSACTIONS) {
    throw new LocalizedError("ui.theJournalCanContainUpToCountEntries", {
      count: MAX_TRANSACTIONS,
    });
  }
  const pending = new Map(
    snapshot.pendingSnapshots.map((item) => [item.id, item]),
  );
  const shoppingList = data.shoppingList?.map((item) => {
    const before = pending.get(item.id);
    if (
      !before ||
      item.transactionId ||
      item.title !== before.title ||
      item.currency !== before.currency ||
      item.createdAt !== before.createdAt
    )
      return item;
    return { ...item, transactionId: transaction.id };
  });
  return {
    ...data,
    transactions: [...data.transactions, transaction],
    ...(shoppingList !== undefined ? { shoppingList } : {}),
  };
}

export const newestFirst = (a: Transaction, b: Transaction) =>
  b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

/** Collect the selected month's totals and the previous month in one pass. */
export function summarizeExpenses(
  records: Transaction[],
  month: string,
  currency: Currency,
  rates?: ExchangeRates,
) {
  const previous = new Date(`${month}-01T12:00:00`);
  previous.setMonth(previous.getMonth() - 1);
  const previousKey = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
  const transactions: Transaction[] = [];
  const amounts = new Map<CategoryId, number>();
  const recent: Transaction[] = [];
  let total = 0,
    previousTotal = 0;
  for (const record of records) {
    if (record.date.startsWith(`${month}-`)) {
      transactions.push(record);
      const amount = convertAmount(
        record.amount,
        record.currency,
        currency,
        rates,
      );
      total += amount;
      amounts.set(
        record.category,
        (amounts.get(record.category) ?? 0) + amount,
      );
      const position = recent.findIndex(
        (item) => newestFirst(record, item) < 0,
      );
      if (position !== -1) recent.splice(position, 0, record);
      else if (recent.length < 5) recent.push(record);
      if (recent.length > 5) recent.pop();
    } else if (record.date.startsWith(`${previousKey}-`)) {
      previousTotal += convertAmount(
        record.amount,
        record.currency,
        currency,
        rates,
      );
    }
  }
  return {
    transactions,
    total,
    previousTotal,
    recent,
    categories: CATEGORIES.map((category) => ({
      ...category,
      value: amounts.get(category.id) ?? 0,
    }))
      .filter((category) => category.value > 0)
      .sort((a, b) => b.value - a.value),
  };
}

export function indexExpenseText(
  records: Transaction[],
): ReadonlyMap<string, string> {
  return new Map(
    records.map((record) => [
      record.id,
      `${record.title} ${record.note ?? ""} ${(record.items ?? []).map((item) => item.title).join(" ")}`.toLocaleLowerCase(
        "ru",
      ),
    ]),
  );
}

/** Order once when records or sort settings change; typing only filters this order. */
export function orderExpenses(
  records: Transaction[],
  sort: string,
  currency: Currency,
  rates?: ExchangeRates,
): Transaction[] {
  if (sort === "largest") {
    const amounts = new Map(
      records.map((record) => [
        record.id,
        convertAmount(record.amount, record.currency, currency, rates),
      ]),
    );
    return [...records].sort((a, b) => amounts.get(b.id)! - amounts.get(a.id)!);
  }
  return [...records].sort(
    sort === "oldest" ? (a, b) => a.date.localeCompare(b.date) : newestFirst,
  );
}

export function filterExpenses(
  ordered: Transaction[],
  query: string,
  category: string,
  currency: string,
  index: ReadonlyMap<string, string>,
): Transaction[] {
  const text = query.toLocaleLowerCase("ru");
  if (!text && category === "all" && currency === "all") return ordered;
  return ordered.filter(
    (record) =>
      (category === "all" || record.category === category) &&
      (currency === "all" || record.currency === currency) &&
      (!text || index.get(record.id)?.includes(text)),
  );
}
