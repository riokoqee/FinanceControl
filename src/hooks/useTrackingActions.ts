import { confirmDay, getTrackingStats } from "../lib/streak/streakLedger";
import { getStreakIncrease } from "../lib/streak/pirateRanks";
import { streakCopy } from "../lib/streak/streakCopy";
import type { AppDataController } from "./useAppData";
import type { AppFeedback } from "./useAppFeedback";
import type { Page } from "./appTypes";

export function useTrackingActions(
  store: AppDataController,
  feedback: AppFeedback,
  page: Page,
) {
  function confirmTrackingDate(day: string) {
    const copy = streakCopy[store.data.profile.language];
    const saved = store.operateData((current) => {
      const now = new Date();
      const outcome = confirmDay(
        current.transactions,
        current.streak,
        day,
        now,
      );
      const increase =
        outcome.status === "saved"
          ? getStreakIncrease(
              getTrackingStats(current.transactions, current.streak, now),
              getTrackingStats(current.transactions, outcome.ledger, now),
            )
          : null;
      return {
        data:
          outcome.status === "saved"
            ? { ...current, streak: outcome.ledger }
            : current,
        result: {
          status: outcome.status,
          dayStatus: outcome.dayStatus,
          increase,
        },
      };
    });
    if (!saved) {
      feedback.setToast({ message: copy.confirmFailed, error: true });
      return;
    }
    const outcome = saved.result;
    if (outcome.status !== "saved") {
      feedback.setToast({
        message:
          outcome.status === "already"
            ? copy.noSpendAlready
            : outcome.status === "unavailable"
              ? copy.unavailableDay
              : copy.tooOld,
      });
      return;
    }
    const increase = outcome.increase;
    feedback.setCelebration(
      increase
        ? {
            ...increase,
            id: `check-in-${day}`,
            expiresAt: Date.now() + 6000,
            page,
          }
        : null,
    );
    feedback.setToast({
      message:
        outcome.dayStatus === "NO_SPEND"
          ? copy.savedNoSpend
          : copy.savedTracking,
      pirate: increase?.promoted,
    });
  }
  return { confirmTrackingDate };
}
