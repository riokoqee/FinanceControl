import { describe, expect, it } from "vitest";
import type { Transaction } from "./finance";
import { todayString } from "./finance";
import { getPirateProgress, getStreakIncrease, PIRATE_RANKS } from "./pirateRanks";
import { BERRIES_PER_DAY, getStreakStats } from "./streak";
import type { StreakStats } from "./streak";

const now = new Date(2026, 9, 27, 12);

function record(day: string, id = day): Transaction {
  return {
    id,
    title: "Supplies",
    amount: 12,
    currency: "EUR",
    category: "shopping",
    date: day,
    createdAt: day,
  };
}

/** Consecutive recording days immediately before today. */
function previousRecords(days: number): Transaction[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - index - 1);
    return record(todayString(date));
  });
}

function stats(current: number, activeToday: boolean): StreakStats {
  return {
    current,
    longest: current,
    activeToday,
    lastActiveDate: current ? "2026-10-26" : null,
    bounty: current * BERRIES_PER_DAY,
    nextBounty: (current + 1) * BERRIES_PER_DAY,
  };
}

describe("pirate rank progression", () => {
  it("defines the four rank thresholds and exact Russian names", () => {
    expect(PIRATE_RANKS.map(({ id, minDays, name }) => [id, minDays, name.ru])).toEqual([
      ["rookie", 1, "Новичок Гранд Лайн"],
      ["rising", 7, "Восходящий пират"],
      ["supernova", 30, "Сверхновая"],
      ["legend", 100, "Легенда морей"],
    ]);
    expect(PIRATE_RANKS.every((rank) => rank.name.en.length > 0)).toBe(true);
  });

  it.each([
    [0, null, "rookie", 1, 0],
    [1, "rookie", "rising", 6, 0],
    [6, "rookie", "rising", 1, 5 / 6],
    [7, "rising", "supernova", 23, 0],
    [29, "rising", "supernova", 1, 22 / 23],
    [30, "supernova", "legend", 70, 0],
    [99, "supernova", "legend", 1, 69 / 70],
    [100, "legend", null, 0, 1],
    [365, "legend", null, 0, 1],
  ] as const)(
    "resolves %i days to the appropriate rank and within-rank progress",
    (days, rankId, nextRankId, daysRemaining, progress) => {
      const result = getPirateProgress(days);
      expect(result.rank?.id ?? null).toBe(rankId);
      expect(result.nextRank?.id ?? null).toBe(nextRankId);
      expect(result.daysRemaining).toBe(daysRemaining);
      expect(result.progress).toBeCloseTo(progress);
    },
  );

  it.each([-10, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY])(
    "keeps invalid day counts bounded: %s",
    (days) => {
      expect(getPirateProgress(days)).toMatchObject({
        rank: null,
        daysRemaining: 1,
        progress: 0,
      });
    },
  );

  it("starts with a rookie reward without announcing a promotion", () => {
    const before = getStreakStats([], now);
    const after = getStreakStats([record("2026-10-27")], now);
    expect(getStreakIncrease(before, after)).toMatchObject({
      fromDays: 0,
      toDays: 1,
      fromBounty: 0,
      toBounty: 500_000,
      rank: { id: "rookie" },
      promoted: false,
    });
  });

  it.each([
    [1, "rookie", false],
    [5, "rookie", false],
    [6, "rising", true],
    [7, "rising", false],
    [29, "supernova", true],
    [30, "supernova", false],
    [99, "legend", true],
    [100, "legend", false],
  ] as const)(
    "rewards a new day after %i days and promotes only on a rank boundary",
    (days, rankId, promoted) => {
      const records = previousRecords(days);
      const before = getStreakStats(records, now);
      const after = getStreakStats([...records, record("2026-10-27")], now);
      const reward = getStreakIncrease(before, after);

      expect(reward).toMatchObject({
        fromDays: days,
        toDays: days + 1,
        fromBounty: days * 500_000,
        toBounty: (days + 1) * 500_000,
        rank: { id: rankId },
        promoted,
      });
      expect(reward!.toBounty - reward!.fromBounty).toBe(BERRIES_PER_DAY);
    },
  );

  it("resets after a recording gap and starts a fresh rookie streak", () => {
    const records = [record("2026-10-23"), record("2026-10-24")];
    const before = getStreakStats(records, now);
    const after = getStreakStats([...records, record("2026-10-27")], now);

    expect(before.current).toBe(0);
    expect(after.longest).toBe(2);
    expect(getStreakIncrease(before, after)).toMatchObject({
      fromDays: 0,
      toDays: 1,
      rank: { id: "rookie" },
      promoted: false,
    });
  });

  it("does not celebrate additional records on the same day", () => {
    const records = [...previousRecords(6), record("2026-10-27")];
    const before = getStreakStats(records, now);
    const after = getStreakStats([...records, record("2026-10-27", "second")], now);

    expect(getStreakIncrease(before, after)).toBeNull();
  });

  it.each([
    [stats(6, false), stats(7, false)],
    [stats(6, false), stats(6, true)],
    [stats(6, false), stats(1, true)],
    [stats(7, true), stats(8, true)],
    [stats(7, true), stats(0, false)],
  ])("requires an inactive-to-active day and an increased streak", (before, after) => {
    expect(getStreakIncrease(before, after)).toBeNull();
  });

  it("keeps the existing 500,000 berries per day in every expense currency", () => {
    expect(BERRIES_PER_DAY).toBe(500_000);
    for (const currency of ["USD", "EUR", "KZT"] as const) {
      const previous = previousRecords(6).map((transaction) => ({ ...transaction, currency }));
      const next = [...previous, { ...record("2026-10-27"), currency, amount: 999_999 }];
      const increase = getStreakIncrease(getStreakStats(previous, now), getStreakStats(next, now));
      expect(increase).toMatchObject({ fromBounty: 3_000_000, toBounty: 3_500_000 });
    }
  });
});
