import type { MessageKey } from "../lib/messages";
import { CircleHelp, Download } from "lucide-react";
import type { Language } from "../lib/finance";
import { translate } from "../lib/i18n";
import type { AppDataController } from "../hooks/useAppData";
import type { ConfirmationAction } from "../hooks/useDialogState";
import type { Page } from "../hooks/appTypes";
import Button from "./Button";

interface Props {
  status: AppDataController["status"];
  error: string;
  language: Language;
  onExport: () => void;
  onConfirm: (action: ConfirmationAction) => void;
  onNavigate: (page: Page) => void;
}
export default function StorageWarning({
  status,
  error,
  language,
  onExport,
  onConfirm,
  onNavigate,
}: Props) {
  const tr = (text: MessageKey) => translate(language, text);
  return (
    <>
      <div className="storage-warning" role="alert">
        <CircleHelp size={21} />
        <div>
          <strong>
            {tr(
              status === "corrupt" || status === "recovered"
                ? "ui.damagedDataDetectedTheOriginalCopyIsPreserved"
                : "error.saveFailed",
            )}
          </strong>
          <p>
            {error ||
              tr(
                status === "corrupt" || status === "recovered"
                  ? "ui.autosaveIsPausedRestoreABackupOrStartAgain"
                  : "ui.theChangeWasNotAppliedCheckAvailableSpaceAndBrowserStorageAccess",
              )}
          </p>
        </div>
        <Button onClick={onExport}>
          <Download size={16} />
          {tr("ui.downloadBackup")}
        </Button>
        {status === "recovered" && (
          <Button onClick={() => onConfirm("recovery")}>
            {tr("ui.restoreLastGoodCopy")}
          </Button>
        )}
        {(status === "corrupt" || status === "recovered") && (
          <>
            <Button onClick={() => onNavigate("profile")}>
              {tr("ui.importBackup")}
            </Button>
            <Button onClick={() => onConfirm("reset")}>
              {tr("ui.startAgain")}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
