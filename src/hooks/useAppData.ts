import { useCallback, useEffect } from "react";
import { usePersistentData } from "./usePersistentData";
import { useLocalCalendarDay } from "./useStreakStats";
import { reconcileStreak } from "../lib/streak/streakLedger";
import { withTrackingDays } from "../lib/streak/withTrackingDays";
import type { AppData } from "../lib/finance";
import type { DataChange } from "./appTypes";

/** Expense changes and their daily facts share one storage commit. */
export function useAppData() {
  const storage = usePersistentData();
  const { data, commit, commitFresh, commitOperation, status } = storage;
  const localDay = useLocalCalendarDay();
  const setData = useCallback(
    (change: DataChange) =>
      commit((current) =>
        withTrackingDays(
          current,
          typeof change === "function" ? change(current) : change,
        ),
      ),
    [commit],
  );
  const mutateData = useCallback(
    (change: (current: AppData) => AppData) =>
      commitFresh((current) => withTrackingDays(current, change(current))),
    [commitFresh],
  );
  const operateData = useCallback(
    <Result>(
      operation: (current: AppData) => { data: AppData; result: Result },
    ) =>
      commitOperation((current) => {
        const desired = operation(current);
        return {
          data: withTrackingDays(current, desired.data),
          result: desired.result,
        };
      }),
    [commitOperation],
  );
  useEffect(() => {
    // Empty installations remain unwritten; recovery never overwrites its source.
    if (status !== "ready" || (!data.streak && data.transactions.length === 0))
      return;
    if (reconcileStreak(data.transactions, data.streak) === data.streak) return;
    commitFresh((current) => withTrackingDays(current, current));
  }, [data.transactions, data.streak, localDay, status, commitFresh]);
  return {
    ...storage,
    setData,
    mutateData,
    operateData,
    storageOk: !storage.error && (status === "ready" || status === "empty"),
  };
}
export type AppDataController = ReturnType<typeof useAppData>;
