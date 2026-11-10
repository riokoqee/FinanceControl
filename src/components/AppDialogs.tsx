import type { MessageKey } from "../lib/messages";
import { lazy, Suspense } from "react";
import { Download, Plus, Upload, X } from "lucide-react";
import type { AppData } from "../lib/finance";
import { translate } from "../lib/i18n";
import type { DialogController } from "../hooks/useDialogState";
import type { TransactionActions } from "../hooks/useTransactions";
import type { ProfileSettings } from "../hooks/useProfileSettings";
import type { BackupActions } from "../hooks/useBackupRestore";
import Button from "./Button";
import FeatureBoundary from "./FeatureBoundary";
import LoadingState from "./LoadingState";
import Modal from "./Modal";

const TransactionDialog = lazy(() => import("./TransactionDialog"));
const EntryDetails = lazy(() => import("./EntryDetails"));
const AvatarCropper = lazy(() => import("./AvatarCropper"));
const CategoryBudgetsDialog = lazy(() => import("./CategoryBudgetsDialog"));

interface AppDialogsProps {
  data: AppData;
  dialogs: DialogController;
  transactions: TransactionActions;
  profile: ProfileSettings;
  backup: BackupActions;
}

/** Dialog state owns focus; domain controllers own validation and persistence. */
export default function AppDialogs({
  data,
  dialogs,
  transactions,
  profile,
  backup,
}: AppDialogsProps) {
  const language = data.profile.language;
  const currency = data.profile.currency;
  const { state, close } = dialogs;
  const categoryBudgetsOpen = state.kind === "budgets";
  const avatarSource = state.kind === "avatar" ? state.source : null;
  const detailRecord =
    state.kind === "details" ? transactions.detailRecord : undefined;
  const pendingImport = state.kind === "import" ? state.data : null;
  const modal = state.kind === "transaction" ? state.value : null;
  const confirmation = state.kind === "confirmation" ? state.action : null;
  const onCategoryBudgetsClose = close;
  const onCategoryBudgetsSave = profile.saveCategoryBudgets;
  const onAvatarClose = close;
  const onAvatarSave = profile.saveAvatar;
  const onDetailsClose = close;
  const onDetailsEdit = () => {
    if (detailRecord) dialogs.transaction(detailRecord);
  };
  const onDetailsExport = () => {
    if (detailRecord) backup.exportRecord(detailRecord);
  };
  const onDetailsChange = transactions.saveEntryDetails;
  const onImportClose = close;
  const onRestoreBackup = backup.restoreBackup;
  const onTransactionClose = close;
  const onTransactionSave = transactions.saveTransaction;
  const onTransactionReload = transactions.reloadTransaction;
  const onConfirmationClose = close;
  const onConfirmationConfirm = backup.confirmReplacement;
  const onBackupExport = backup.exportBackup;
  const tr = (text: MessageKey) => translate(language, text);
  return (
    <>
      {categoryBudgetsOpen && (
        <Modal
          label={tr("ui.categoryLimits")}
          className="category-budgets-modal"
          onClose={onCategoryBudgetsClose}
        >
          <FeatureBoundary language={language}>
            <Suspense fallback={<LoadingState />}>
              <CategoryBudgetsDialog
                budgets={data.categoryBudgets ?? []}
                defaultCurrency={currency}
                language={language}
                onSave={onCategoryBudgetsSave}
                onClose={onCategoryBudgetsClose}
              />
            </Suspense>
          </FeatureBoundary>
        </Modal>
      )}
      {avatarSource && (
        <Modal
          className="avatar-crop-modal"
          label={tr("ui.avatarEditor")}
          onClose={onAvatarClose}
        >
          <FeatureBoundary language={language}>
            <Suspense fallback={<LoadingState />}>
              <AvatarCropper
                {...avatarSource}
                language={language}
                onSave={onAvatarSave}
                onClose={onAvatarClose}
              />
            </Suspense>
          </FeatureBoundary>
        </Modal>
      )}
      {detailRecord && !modal && (
        <Modal className="detail-modal" onClose={onDetailsClose}>
          <FeatureBoundary language={language}>
            <Suspense fallback={<LoadingState />}>
              <EntryDetails
                transaction={detailRecord}
                language={language}
                onClose={onDetailsClose}
                onEdit={onDetailsEdit}
                onExport={onDetailsExport}
                onChange={onDetailsChange}
              />
            </Suspense>
          </FeatureBoundary>
        </Modal>
      )}
      {pendingImport && (
        <Modal onClose={onImportClose}>
          <div className="dialog-header">
            <div>
              <h2>{tr("ui.backupVerified")}</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={tr("common.close")}
              onClick={onImportClose}
            >
              <X size={20} />
            </button>
          </div>
          <p className="modal-description">
            {tr(
              "ui.chooseHowToRestoreYourDataYouCanMergeYourCurrentRecordsWithTheBackup",
            )}
          </p>
          <p className="field-hint">
            {tr("ui.restoreEverythingReplacesAllBelilogDataWithThisBackup")}
          </p>
          <div className="import-summary">
            <strong>{pendingImport.transactions.length}</strong>{" "}
            {tr("ui.recordsAlternative")} · {pendingImport.profile.name}
            {Boolean(pendingImport.shoppingList?.length) && (
              <span>
                {" "}
                · {tr("nav.shopping")}: {pendingImport.shoppingList!.length}
              </span>
            )}
            {Boolean(pendingImport.categoryBudgets?.length) && (
              <span>
                {" "}
                · {tr("ui.limits")}: {pendingImport.categoryBudgets!.length}
              </span>
            )}
            {Boolean(pendingImport.shoppingTemplates?.length) && (
              <span>
                {" "}
                · {tr("ui.templates")}:{" "}
                {pendingImport.shoppingTemplates!.length}
              </span>
            )}
          </div>
          <div className="import-actions">
            <Button onClick={() => onRestoreBackup(false)}>
              <Plus size={16} />
              {tr("ui.addRecords")}
            </Button>
            <Button variant="primary" onClick={() => onRestoreBackup(true)}>
              <Upload size={16} />
              {tr("ui.restoreEverything")}
            </Button>
          </div>
          <Button variant="ghost" onClick={onImportClose}>
            {tr("common.cancel")}
          </Button>
        </Modal>
      )}
      {modal && (
        <Modal onClose={onTransactionClose}>
          <FeatureBoundary language={language}>
            <Suspense fallback={<LoadingState />}>
              <TransactionDialog
                key={modal === "new" ? "new" : JSON.stringify(modal)}
                value={modal === "new" ? null : modal}
                defaultCurrency={currency}
                onClose={onTransactionClose}
                onSave={onTransactionSave}
                onReload={modal === "new" ? undefined : onTransactionReload}
              />
            </Suspense>
          </FeatureBoundary>
        </Modal>
      )}
      {confirmation && (
        <Modal onClose={onConfirmationClose}>
          <div className="dialog-header">
            <div>
              <h2>
                {confirmation === "recovery"
                  ? tr("ui.restoreTheLastGoodCopy")
                  : confirmation === "reset"
                    ? tr("ui.startFresh")
                    : tr("ui.loadDemoAlternative")}
              </h2>
            </div>
            <button
              className="icon-button modal-close"
              onClick={onConfirmationClose}
              aria-label={tr("common.close")}
            >
              <X size={20} />
            </button>
          </div>
          <p className="modal-description">
            {confirmation === "recovery"
              ? tr(
                  "ui.theDamagedDataWillBeArchivedSeparatelyYourWorkingCopyWillBeEditableAgain",
                )
              : confirmation === "reset"
                ? tr(
                    "ui.allBelilogDataWillBeRemovedFromThisBrowserYouCanDownloadABackupFirst",
                  )
                : tr(
                    "ui.theDemoReplacesAllBelilogDataDownloadABackupToReturnToYourData",
                  )}
          </p>
          <div className="confirmation-backup">
            <Button onClick={onBackupExport}>
              <Download size={16} />
              {tr("ui.downloadABackupFirst")}
            </Button>
          </div>
          <div className="dialog-footer">
            <Button onClick={onConfirmationClose}>{tr("common.cancel")}</Button>
            <Button
              variant={confirmation === "reset" ? "danger" : "primary"}
              onClick={onConfirmationConfirm}
            >
              {confirmation === "recovery"
                ? tr("ui.restoreBackup")
                : confirmation === "reset"
                  ? tr("ui.deleteAllData")
                  : tr("ui.loadDemo")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
