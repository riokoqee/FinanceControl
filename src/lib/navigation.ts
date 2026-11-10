import type { MessageKey } from "./messages";
import type { Page } from "../hooks/appTypes";
export const pageLabels: Record<Page, MessageKey> = {
  overview: "nav.overview",
  tracker: "ui.expenseTracker",
  shopping: "nav.shopping",
  profile: "ui.myProfile",
};
