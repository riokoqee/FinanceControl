import type { Language } from "./finance";
import type { StreakStats } from "./streak";

export type PirateRankId = "rookie" | "rising" | "supernova" | "legend";

export interface PirateRank {
  id: PirateRankId;
  minDays: number;
  name: Record<Language, string>;
}

export const PIRATE_RANKS: readonly PirateRank[] = [
  {
    id: "rookie",
    minDays: 1,
    name: { ru: "Новичок Гранд Лайн", en: "Grand Line Rookie" },
  },
  {
    id: "rising",
    minDays: 7,
    name: { ru: "Восходящий пират", en: "Rising Pirate" },
  },
  {
    id: "supernova",
    minDays: 30,
    name: { ru: "Сверхновая", en: "Supernova" },
  },
  {
    id: "legend",
    minDays: 100,
    name: { ru: "Легенда морей", en: "Legend of the Seas" },
  },
];

export interface PirateProgress {
  rank: PirateRank | null;
  nextRank: PirateRank | null;
  daysRemaining: number;
  /** Progress between the current rank's threshold and the next one. */
  progress: number;
}

export function getPirateProgress(days: number): PirateProgress {
  const completedDays = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
  const rankIndex = PIRATE_RANKS.reduce(
    (currentIndex, rank, index) => completedDays >= rank.minDays ? index : currentIndex,
    -1,
  );
  const rank = PIRATE_RANKS[rankIndex] ?? null;
  const nextRank = PIRATE_RANKS[rankIndex + 1] ?? null;

  if (!nextRank) {
    return { rank, nextRank: null, daysRemaining: 0, progress: 1 };
  }

  const startDays = rank?.minDays ?? 0;
  return {
    rank,
    nextRank,
    daysRemaining: nextRank.minDays - completedDays,
    progress: (completedDays - startDays) / (nextRank.minDays - startDays),
  };
}

export interface StreakIncrease {
  fromBounty: number;
  toBounty: number;
  fromDays: number;
  toDays: number;
  rank: PirateRank;
  promoted: boolean;
}

/** Call after saving a newly created record to celebrate the first recording today. */
export function getStreakIncrease(
  previous: StreakStats,
  next: StreakStats,
): StreakIncrease | null {
  if (previous.activeToday || !next.activeToday || next.current <= previous.current) {
    return null;
  }

  const rank = getPirateProgress(next.current).rank;
  if (!rank) return null;

  return {
    fromBounty: previous.bounty,
    toBounty: next.bounty,
    fromDays: previous.current,
    toDays: next.current,
    rank,
    promoted: rank.minDays > 1 && previous.current < rank.minDays,
  };
}
