import { withCanonicalVersion } from "../appDataVersion";
import { LocalizedError } from "../localizedError";
import type { AppData } from "../finance";
import { MAX_SHOPPING_ITEMS, MAX_TRANSACTIONS } from "../finance";
import { mergeStreakLedgers } from "../streak/streakTypes";

/** Merge only appendable records; a full restore owns profile/settings replacement. */
export function mergeBackupData(current: AppData, incoming: AppData): AppData {
  const existing = new Set(current.transactions.map((record) => record.id));
  const transactions = [
    ...current.transactions,
    ...incoming.transactions.filter((record) => !existing.has(record.id)),
  ];
  if (transactions.length > MAX_TRANSACTIONS)
    throw new LocalizedError("ui.theJournalCanContainUpToCountEntries", {
      count: MAX_TRANSACTIONS,
    });
  const shoppingList = [...(current.shoppingList ?? [])];
  const shoppingIds = new Set(shoppingList.map((item) => item.id));
  const linkedExpenses = new Set(
    shoppingList.flatMap((item) =>
      item.transactionId ? [item.transactionId] : [],
    ),
  );
  for (const item of incoming.shoppingList ?? []) {
    if (
      shoppingIds.has(item.id) ||
      (item.transactionId && linkedExpenses.has(item.transactionId))
    )
      continue;
    shoppingList.push(item);
    shoppingIds.add(item.id);
    if (item.transactionId) linkedExpenses.add(item.transactionId);
  }
  if (shoppingList.length > MAX_SHOPPING_ITEMS)
    throw new LocalizedError("ui.theShoppingListCanContainUpToCountItems", {
      count: MAX_SHOPPING_ITEMS,
    });
  const streak = mergeStreakLedgers(current.streak, incoming.streak);
  return withCanonicalVersion({
    ...current,
    transactions,
    ...(streak ? { streak } : {}),
    ...(current.shoppingList || incoming.shoppingList ? { shoppingList } : {}),
  });
}
