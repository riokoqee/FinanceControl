import type { AppData } from "../lib/finance";
import type { BountyCelebration } from "../components/StreakBounty";

export type Page = "overview" | "tracker" | "shopping" | "profile";
export type Toast = {
  message: string;
  error?: boolean;
  undo?: () => void;
  pirate?: boolean;
};
export type Celebration = BountyCelebration & { page: Page };
export type DataChange = AppData | ((current: AppData) => AppData);
export type DataCommit = (change: DataChange) => AppData | null;
export type DataOperation = <Result>(
  operation: (current: AppData) => {
    data: AppData;
    result: Result;
  },
) => { data: AppData; result: Result } | null;
