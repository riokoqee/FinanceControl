import { useState } from "react";
import type { AppData, Transaction } from "../lib/finance";

export type ConfirmationAction = "reset" | "demo" | "recovery" | "pre-replace";
export type TransactionModal = "new" | Transaction;
export interface AvatarEditorSource {
  file?: File;
  src?: string;
}
export type DialogState =
  | { kind: "none" }
  | { kind: "transaction"; value: TransactionModal }
  | { kind: "details"; id: string }
  | { kind: "avatar"; source: AvatarEditorSource }
  | { kind: "budgets" }
  | { kind: "import"; data: AppData }
  | { kind: "confirmation"; action: ConfirmationAction };

/** A single dialog owns focus; opening another replaces the previous dialog. */
export function useDialogState() {
  const [state, setState] = useState<DialogState>({ kind: "none" });
  return {
    state,
    close: () => setState({ kind: "none" }),
    transaction: (value: TransactionModal = "new") =>
      setState({ kind: "transaction", value }),
    details: (id: string) => setState({ kind: "details", id }),
    avatar: (source: AvatarEditorSource) =>
      setState({ kind: "avatar", source }),
    budgets: () => setState({ kind: "budgets" }),
    importBackup: (data: AppData) => setState({ kind: "import", data }),
    confirm: (action: ConfirmationAction) =>
      setState({ kind: "confirmation", action }),
  };
}
export type DialogController = ReturnType<typeof useDialogState>;
