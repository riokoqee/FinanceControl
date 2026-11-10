import type { MessageKey } from "../lib/messages";
import { CheckCheck, CircleHelp, Sparkles, X } from "lucide-react";
import type { Language } from "../lib/finance";
import type { Toast } from "../hooks/appTypes";
import { translate } from "../lib/i18n";

export default function AppToast({
  toast,
  language,
  onDismiss,
}: {
  toast: Toast;
  language: Language;
  onDismiss: () => void;
}) {
  const tr = (text: MessageKey) => translate(language, text);
  return (
    <>
      <div
        className={`toast ${toast.error ? "toast-error" : ""} ${toast.pirate ? "toast--pirate" : ""}`}
        role={toast.error ? "alert" : "status"}
      >
        {toast.error ? (
          <CircleHelp size={19} />
        ) : toast.pirate ? (
          <Sparkles size={19} />
        ) : (
          <CheckCheck size={19} />
        )}
        <span>{toast.message}</span>
        {toast.undo && (
          <button className="toast-action" onClick={toast.undo}>
            {tr("ui.undo")}
          </button>
        )}
        <button
          className="toast-close icon-button"
          onClick={onDismiss}
          aria-label={tr("ui.dismissNotification")}
        >
          <X size={16} />
        </button>
      </div>
    </>
  );
}
