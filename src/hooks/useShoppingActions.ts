import type { MessageKey } from "../lib/messages";
import { message } from "../lib/messages";
import type { DataOperation } from "./appTypes";
import type { AppData, Currency, Language, Transaction } from "../lib/finance";
import { todayString } from "../lib/finance";
import type { ShoppingPurchaseConfirmation } from "../components/ShoppingList";
import type { BountyCelebration } from "../components/StreakBounty";
import { DataConflictError } from "../lib/storage/storage";
import {
  addShoppingItem,
  confirmShoppingPurchase,
  removeShoppingItem,
  saveShoppingPrice,
  updateShoppingItem,
} from "../lib/shopping/shopping";
import { getTrackingStats } from "../lib/streak/streakLedger";
import { getStreakIncrease } from "../lib/streak/pirateRanks";
import { translate } from "../lib/i18n";
import { createRecordId } from "../lib/recordId";

type ShoppingPage = "overview" | "tracker" | "shopping" | "profile";

interface ShoppingActionsOptions {
  operateData: DataOperation;
  page: ShoppingPage;
  language: Language;
  setToast: (toast: {
    message: string;
    error?: boolean;
    undo?: () => void;
    pirate?: boolean;
  }) => void;
  setBountyCelebration: (
    celebration: (BountyCelebration & { page: ShoppingPage }) | null,
  ) => void;
}

/** Shopping mutations always recompute against current storage before feedback. */
export function useShoppingActions({
  operateData,
  page,
  language,
  setToast,
  setBountyCelebration,
}: ShoppingActionsOptions) {
  const tr = (text: MessageKey) => translate(language, text);
  function commitShoppingChange(
    change: (current: AppData) => AppData,
  ): AppData | null {
    return (
      operateData((current) => ({ data: change(current), result: undefined }))
        ?.data ?? null
    );
  }
  function addPlannedItem(title: string, itemCurrency: Currency): boolean {
    return Boolean(
      commitShoppingChange((current) =>
        addShoppingItem(current, {
          id: createRecordId(),
          title,
          currency: itemCurrency,
          createdAt: todayString(),
        }),
      ),
    );
  }
  function checkShoppingBase(
    current: AppData,
    id: string,
    base: Transaction | null | undefined,
    patch: Partial<Transaction>,
  ) {
    if (base === undefined) return;
    const row = current.shoppingList?.find((item) => item.id === id);
    if (!row) throw new DataConflictError();
    const record = current.transactions.find((t) => t.id === row.transactionId);
    if ((record?.id ?? null) !== (base?.id ?? null))
      throw new DataConflictError();
    if (record && base)
      for (const field of Object.keys(patch) as (keyof Transaction)[]) {
        if (record[field] !== base[field] && record[field] !== patch[field])
          throw new DataConflictError();
      }
  }
  function updatePlannedItem(
    id: string,
    patch: { title?: string; currency?: Currency },
    base?: Transaction | null,
  ): boolean {
    return Boolean(
      commitShoppingChange((current) => {
        checkShoppingBase(current, id, base, patch);
        return updateShoppingItem(current, id, patch);
      }),
    );
  }
  function savePlannedPrice(
    id: string,
    amount: number,
    itemCurrency: Currency,
    base?: Transaction | null,
    changed?: { amount?: number; currency?: Currency },
  ): boolean {
    const eventId = createRecordId();
    const next = operateData((current) => {
      const now = new Date();
      checkShoppingBase(
        current,
        id,
        base,
        changed ?? { amount, currency: itemCurrency },
      );
      const row = current.shoppingList?.find((item) => item.id === id);
      const record = current.transactions.find(
        (t) => t.id === row?.transactionId,
      );
      const desired = saveShoppingPrice(
        current,
        id,
        changed && changed.amount === undefined && record
          ? record.amount
          : amount,
        changed && changed.currency === undefined && record
          ? record.currency
          : itemCurrency,
        eventId,
        now,
      );
      const increase =
        desired.transactions.length > current.transactions.length
          ? getStreakIncrease(
              getTrackingStats(current.transactions, current.streak, now),
              getTrackingStats(desired.transactions, current.streak, now),
            )
          : null;
      return { data: desired, result: increase };
    });
    if (!next) return false;
    const increase = next.result;
    setBountyCelebration(
      increase
        ? { ...increase, id: eventId, expiresAt: Date.now() + 6000, page }
        : null,
    );
    if (increase?.promoted) {
      setToast({
        message: `${message(language, "streak.newRank")}: ${increase.rank.name[language]}!`,
        pirate: true,
      });
    }
    return true;
  }
  function removePlannedItem(id: string): boolean {
    return Boolean(
      commitShoppingChange((current) => removeShoppingItem(current, id)),
    );
  }
  function confirmPlannedPurchase(
    id: string,
    purchase: ShoppingPurchaseConfirmation,
  ): boolean {
    const eventId = createRecordId();
    const next = operateData((current) => {
      const now = new Date();
      checkShoppingBase(current, id, purchase.base, purchase.changed);
      const row = current.shoppingList?.find((item) => item.id === id);
      const record = current.transactions.find(
        (t) => t.id === row?.transactionId,
      );
      const desired = confirmShoppingPurchase(
        current,
        id,
        purchase.changed.amount === undefined && record
          ? record.amount
          : purchase.amount,
        purchase.changed.currency === undefined
          ? (record?.currency ?? row?.currency ?? purchase.currency)
          : purchase.currency,
        eventId,
        now,
        purchase.changed.title === undefined
          ? undefined
          : { title: purchase.title },
      );
      const increase =
        desired.transactions.length > current.transactions.length
          ? getStreakIncrease(
              getTrackingStats(current.transactions, current.streak, now),
              getTrackingStats(desired.transactions, current.streak, now),
            )
          : null;
      return { data: desired, result: increase };
    });
    if (!next) return false;
    const increase = next.result;
    setBountyCelebration(
      increase
        ? { ...increase, id: eventId, expiresAt: Date.now() + 6000, page }
        : null,
    );
    setToast({
      message: increase?.promoted
        ? `${tr("ui.purchaseConfirmedExpenseSaved")} ${message(language, "streak.newRank")}: ${increase.rank.name[language]}!`
        : tr("ui.purchaseConfirmedExpenseSaved"),
      pirate: increase?.promoted,
    });
    return true;
  }
  return {
    addPlannedItem,
    updatePlannedItem,
    savePlannedPrice,
    removePlannedItem,
    confirmPlannedPurchase,
  };
}
