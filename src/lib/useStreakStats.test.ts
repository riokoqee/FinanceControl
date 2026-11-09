import { describe, expect, it } from "vitest";
import type { Transaction } from "./finance";
import { getCachedStreakStats } from "./useStreakStats";
import { confirmNoSpend, reconcileStreak } from "./streakLedger";

const transaction: Transaction = {
  id: "expense", title: "Bread", amount: 2, currency: "EUR", category: "food",
  date: "2026-11-05", createdAt: "2026-11-05",
};

describe("shared streak results", () => {
  it("reuses the same result for widgets showing the same immutable records and day", () => {
    const records = [transaction];
    const first = getCachedStreakStats(records, "2026-11-05");
    expect(getCachedStreakStats(records, "2026-11-05")).toBe(first);
  });

  it("refreshes the cached result when the local calendar day changes", () => {
    const records = [transaction];
    const first = getCachedStreakStats(records, "2026-11-05");
    const next = getCachedStreakStats(records, "2026-11-07");
    expect(next).not.toBe(first);
    expect(next).toMatchObject({ current: 0, longest: 1, activeToday: false });
  });

  it("recalculates when records are added or deleted without mutating old results", () => {
    const records = [transaction];
    const first = getCachedStreakStats(records, "2026-11-06");
    const updated = getCachedStreakStats([...records, { ...transaction, id: "today", createdAt: "2026-11-06" }], "2026-11-06");
    expect(first).toMatchObject({ current: 1, activeToday: false });
    expect(updated).toMatchObject({ current: 2, activeToday: true });
    expect(getCachedStreakStats([], "2026-11-06").current).toBe(0);
  });

  it("refreshes every widget when a no-spend confirmation changes the ledger", () => {
    const records = [transaction];
    const now = new Date("2026-11-06T12:00:00");
    const ledger = reconcileStreak(records, undefined, now);
    const first = getCachedStreakStats(records, "2026-11-06", ledger);
    const confirmed = confirmNoSpend(records, ledger, "2026-11-06", now);
    const next = getCachedStreakStats(records, "2026-11-06", confirmed);
    expect(next).not.toBe(first);
    expect(first).toMatchObject({ current: 1, activeToday: false });
    expect(next).toMatchObject({ current: 2, todayStatus: "NO_SPEND", bounty: 1_000_000 });
    expect(getCachedStreakStats(records, "2026-11-06", confirmed)).toBe(next);
  });
});
