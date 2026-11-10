import { removeExpense, undoExpense } from "../lib/expenses";
import { LocalizedError } from "../lib/localizedError";
import type { MessageKey } from "../lib/messages";
import { message } from "../lib/messages";
import type { Transaction } from "../lib/finance";
import { MAX_TRANSACTIONS } from "../lib/finance";
import { mergeTransactionDraft } from "../lib/storage/storage";
import { getTrackingStats } from "../lib/streak/streakLedger";
import { getStreakIncrease } from "../lib/streak/pirateRanks";
import { translate } from "../lib/i18n";
import type { AppDataController } from "./useAppData";
import type { DialogController } from "./useDialogState";
import type { AppFeedback } from "./useAppFeedback";
import type { ExpenseView } from "./useExpenseView";
import type { Page } from "./appTypes";

interface Options {
  store: AppDataController;
  dialogs: DialogController;
  feedback: AppFeedback;
  page: Page;
  setMonth: ExpenseView["setMonth"];
}
export function useTransactions({
  store,
  dialogs,
  feedback,
  page,
  setMonth,
}: Options) {
  const { data, operateData, setData, lastError } = store;
  const { setToast, setCelebration } = feedback;
  const language = data.profile.language;
  const tr = (text: MessageKey) => translate(language, text);
  const detailId =
    dialogs.state.kind === "details" ? dialogs.state.id : undefined;
  const detailRecord = detailId
    ? data.transactions.find((record) => record.id === detailId)
    : undefined;
  function saveTransaction(value: Transaction): true | string {
    if (dialogs.state.kind !== "transaction") return lastError.current;
    const modal = dialogs.state.value;
    const editing = modal !== "new";
    const saved = operateData((d) => {
      const now = new Date();
      if (!editing && d.transactions.length >= MAX_TRANSACTIONS)
        throw new LocalizedError("ui.theJournalCanContainUpToCountEntries", {
          count: MAX_TRANSACTIONS,
        });
      const record = editing
        ? mergeTransactionDraft(
            modal,
            d.transactions.find((t) => t.id === value.id),
            value,
          )
        : value;
      const transactions = editing
        ? d.transactions.map((t) => (t.id === value.id ? record : t))
        : [record, ...d.transactions];
      const increase = editing
        ? null
        : getStreakIncrease(
            getTrackingStats(d.transactions, d.streak, now),
            getTrackingStats(transactions, d.streak, now),
          );
      return { data: { ...d, transactions }, result: increase };
    });
    if (!saved) return lastError.current;
    const increase = saved.result;
    setMonth(value.date.slice(0, 7));
    dialogs.close();
    setCelebration(
      increase
        ? { ...increase, id: value.id, expiresAt: Date.now() + 6000, page }
        : null,
    );
    setToast({
      message: increase?.promoted
        ? `${tr("ui.expenseAddedEverythingIsUnderControl")} ${message(language, "streak.newRank")}: ${increase.rank.name[language]}!`
        : editing
          ? tr("ui.changesSaved")
          : tr("ui.expenseAddedEverythingIsUnderControl"),
      pirate: increase?.promoted,
    });
    return true;
  }
  function deleteTransaction(transaction: Transaction) {
    setCelebration(null);
    const saved = operateData((current) =>
      removeExpense(current, transaction.id),
    );
    if (!saved?.result.transaction) return;
    const snapshot = saved.result;
    setToast({
      message: message(language, "ui.expenseDeleted"),
      undo: () => {
        const restored = operateData((current) => ({
          data: undoExpense(current, snapshot),
          result: undefined,
        }));
        if (restored)
          setToast({ message: message(language, "ui.expenseRestored") });
      },
    });
  }

  function saveEntryDetails(value: Transaction): boolean {
    if (!detailRecord) return false;
    return Boolean(
      setData((current) => {
        const record = mergeTransactionDraft(
          detailRecord,
          current.transactions.find((entry) => entry.id === value.id),
          value,
        );
        return {
          ...current,
          transactions: current.transactions.map((entry) =>
            entry.id === value.id ? record : entry,
          ),
        };
      }),
    );
  }
  function reloadTransaction() {
    if (dialogs.state.kind !== "transaction" || dialogs.state.value === "new")
      return;
    const id = dialogs.state.value.id;
    const record = data.transactions.find((entry) => entry.id === id);
    if (record) dialogs.transaction(record);
    else dialogs.close();
  }
  return {
    detailRecord,
    saveTransaction,
    deleteTransaction,
    saveEntryDetails,
    reloadTransaction,
  };
}
export type TransactionActions = ReturnType<typeof useTransactions>;
