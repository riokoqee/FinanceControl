import { describe, expect, it } from "vitest";
import type { Transaction } from "./finance";
import { BERRIES_PER_DAY, getStreakStats } from "./streak";

function record(date: string, createdAt?: string): Transaction {
  return {
    id: `${date}-${createdAt ?? ""}`,
    title: "Groceries",
    amount: 5,
    currency: "EUR",
    category: "food",
    date,
    createdAt,
  };
}

const now = new Date(2026, 9, 27, 23, 55);

describe("daily recording streak and fictional berry bounty", () => {
  it("starts without a bounty and offers the first daily reward", () => {
    expect(getStreakStats([], now)).toEqual({
      current: 0,
      longest: 0,
      activeToday: false,
      lastActiveDate: null,
      bounty: 0,
      nextBounty: 500_000,
    });
  });

  it("counts unique recording days, regardless of order or purchases per day", () => {
    const records = [
      record("2026-10-27"),
      record("2026-10-25"),
      record("2026-10-26"),
      record("2026-10-27"),
    ];
    expect(getStreakStats(records, now)).toEqual({
      current: 3,
      longest: 3,
      activeToday: true,
      lastActiveDate: "2026-10-27",
      bounty: 1_500_000,
      nextBounty: 2_000_000,
    });
  });

  it("keeps yesterday’s streak available until the end of today", () => {
    const records = [record("2026-10-25"), record("2026-10-26")];
    expect(getStreakStats(records, now)).toMatchObject({
      current: 2,
      longest: 2,
      activeToday: false,
      bounty: 1_000_000,
    });
    expect(getStreakStats(records, new Date(2026, 9, 28, 0, 1))).toMatchObject({
      current: 0,
      longest: 2,
      bounty: 0,
      nextBounty: 500_000,
    });
  });

  it("preserves the historical best after a gap and starts a new streak", () => {
    const records = [
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-27",
    ].map((day) => record(day));
    expect(getStreakStats(records, now)).toMatchObject({
      current: 1,
      longest: 3,
      activeToday: true,
    });
  });

  it.each([
    [["2026-12-30", "2026-12-31", "2027-01-01"], new Date(2027, 0, 1, 0, 5)],
    [["2024-02-28", "2024-02-29", "2024-03-01"], new Date(2024, 2, 1, 1)],
    [["2025-02-28", "2025-03-01", "2025-03-02"], new Date(2025, 2, 2, 23)],
    [["2026-03-28", "2026-03-29", "2026-03-30"], new Date(2026, 2, 30, 0, 5)],
    [["2026-10-24", "2026-10-25", "2026-10-26"], new Date(2026, 9, 26, 23, 55)],
  ] as const)(
    "uses calendar days across year, leap and DST boundaries: %s",
    (days, date) => {
      expect(
        getStreakStats(
          days.map((day) => record(day)),
          date,
        ),
      ).toMatchObject({ current: 3, longest: 3, activeToday: true });
    },
  );

  it("rewards creating a backdated expense today, using purchase dates only for legacy records", () => {
    const records = [record("2020-01-01", "2026-10-27"), record("2026-10-26")];
    expect(getStreakStats(records, now)).toMatchObject({
      current: 2,
      activeToday: true,
      lastActiveDate: "2026-10-27",
    });
  });

  it("ignores future creation dates and malformed calendar days", () => {
    const records = [
      record("2026-10-27", "2026-10-28"),
      record("2026-11-01"),
      record("2026-02-30"),
      record("bad-date"),
    ];
    expect(getStreakStats(records, now)).toMatchObject({
      current: 0,
      longest: 0,
      activeToday: false,
      lastActiveDate: null,
    });
  });

  it("calculates from remaining records when the last record on a day is deleted", () => {
    const records = [
      record("2026-10-24"),
      record("2026-10-25"),
      record("2026-10-27"),
    ];
    expect(getStreakStats(records, now).current).toBe(1);
    expect(getStreakStats(records.slice(0, -1), now)).toMatchObject({
      current: 0,
      longest: 2,
      bounty: 0,
    });
    expect(getStreakStats([], now).longest).toBe(0);
  });

  it("rewards exactly 500,000 fictional berries per day in every expense currency", () => {
    for (const currency of ["USD", "EUR", "KZT"] as const) {
      const transaction = { ...record("2026-10-27"), currency, amount: 999 };
      expect(getStreakStats([transaction], now).bounty).toBe(BERRIES_PER_DAY);
    }
  });
});
