import { message } from "../lib/messages";
import { useState } from "react";
import type { Transaction } from "../lib/finance";
import { useDataTransfer } from "./useDataTransfer";
import { createDemoData, createEmptyData } from "../lib/finance";
import { mergeBackupData } from "../lib/storage/mergeBackup";
import { currentMonth } from "./useExpenseView";
import type { AppDataController } from "./useAppData";
import type { DialogController } from "./useDialogState";
import type { AppFeedback } from "./useAppFeedback";
import type { ProfileSettings } from "./useProfileSettings";
import type { ExpenseView } from "./useExpenseView";

interface Options {
  store: AppDataController;
  dialogs: DialogController;
  feedback: AppFeedback;
  profile: ProfileSettings;
  view: ExpenseView;
}
export function useBackupRestore({
  store,
  dialogs,
  feedback,
  profile,
  view,
}: Options) {
  const [showDemoBanner, setShowDemoBanner] = useState(true);
  const { data, commit, setData } = store;
  const transfer = useDataTransfer({
    data,
    language: data.profile.language,
    month: view.month,
    allTime: view.allTime,
    onToast: feedback.setToast,
    onImport: dialogs.importBackup,
  });
  const exportBackup = () => {
    void transfer.exportPdf(data.transactions, true);
  };
  const exportReport = () => {
    void transfer.exportPdf(view.reportRecords());
  };
  const exportCsvReport = () => transfer.exportCsv(view.reportRecords());
  const exportRecord = (record: Transaction) => {
    void transfer.exportPdf([record]);
  };
  function restoreBackup(replaceAll: boolean) {
    if (dialogs.state.kind !== "import") return;
    const incoming = dialogs.state.data;
    feedback.setCelebration(null);
    const saved = replaceAll
      ? commit(incoming, true)
      : setData((current) => mergeBackupData(current, incoming));
    if (!saved) return;
    if (replaceAll) profile.setProfile(saved.profile);
    dialogs.close();
    feedback.setToast({
      message: message(
        saved.profile.language,
        replaceAll
          ? "ui.backupRestored"
          : "ui.backupImportedDuplicatesWereSkipped",
      ),
    });
  }
  function applyDemo() {
    feedback.setCelebration(null);
    const demo = createDemoData();
    const next = {
      ...demo,
      profile: {
        ...demo.profile,
        theme: data.profile.theme,
        language: data.profile.language,
      },
    };
    const saved = commit(next, true);
    if (!saved) return;
    profile.setProfile(saved.profile);
    view.setMonth(currentMonth());
    dialogs.close();
    setShowDemoBanner(false);
    feedback.setToast({
      message: message(
        saved.profile.language,
        "ui.demoLoadedYouCanEditOrDeleteAnyRecord",
      ),
    });
  }
  function startDemo() {
    if (
      data.transactions.length ||
      data.shoppingList?.length ||
      data.categoryBudgets?.length ||
      data.shoppingTemplates?.length ||
      data.streak?.confirmedDays.length ||
      data.profile.name !== "Пользователь" ||
      data.profile.email ||
      data.profile.avatar ||
      data.profile.monthlyBudget ||
      data.profile.currency !== "USD" ||
      data.profile.exchangeRates
    ) {
      dialogs.confirm("demo");
      return;
    }
    applyDemo();
  }
  function confirmReplacement() {
    if (dialogs.state.kind !== "confirmation") return;
    if (dialogs.state.action === "recovery") {
      const saved = commit(data, true);
      if (!saved) return;
      dialogs.close();
      feedback.setToast({
        message: message(saved.profile.language, "ui.backupRestored"),
      });
    } else if (dialogs.state.action === "reset") {
      feedback.setCelebration(null);
      const empty = createEmptyData();
      const saved = commit(empty, true);
      if (!saved) return;
      profile.setProfile(saved.profile);
      view.setMonth(currentMonth());
      view.resetFilters();
      setShowDemoBanner(true);
      dialogs.close();
      feedback.setToast({
        message: message(
          saved.profile.language,
          "ui.dataDeletedYouCanStartFresh",
        ),
      });
    } else applyDemo();
  }
  return {
    ...transfer,
    exportBackup,
    exportReport,
    exportCsvReport,
    exportRecord,
    showDemoBanner,
    dismissDemo: () => setShowDemoBanner(false),
    restoreBackup,
    startDemo,
    confirmReplacement,
  };
}
export type BackupActions = ReturnType<typeof useBackupRestore>;
