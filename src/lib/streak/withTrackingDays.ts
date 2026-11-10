import type { AppData } from "../finance";
import { withCanonicalVersion } from "../appDataVersion";
import { reconcileStreak } from "./streakLedger";
import { mergeStreakLedgers } from "./streakTypes";

/** Persist daily facts with the expense that earned them, never as a second write. */
export function withTrackingDays(
  previous: AppData,
  desired: AppData,
  now = new Date(),
): AppData {
  const original =
    previous.streak ??
    (previous.transactions.length
      ? reconcileStreak(previous.transactions, undefined, now)
      : undefined);
  const source = mergeStreakLedgers(original, desired.streak);
  if (!source && desired.transactions.length === 0)
    return withCanonicalVersion(desired);
  const streak = reconcileStreak(desired.transactions, source, now);
  return withCanonicalVersion(
    desired.streak === streak ? desired : { ...desired, streak },
  );
}
