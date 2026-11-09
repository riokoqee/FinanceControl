import { memo } from "react";
import { Flame } from "lucide-react";
import type { Language, Transaction } from "../lib/finance";
import { useStreakStats } from "../lib/useStreakStats";
import type { StreakLedger } from "../lib/streakTypes";
import { streakCopy, streakDayLabel, streakMessage } from "../lib/streakCopy";
import "./StreakBadge.css";

export const dayLabel = streakDayLabel;

export default memo(function StreakBadge({
  transactions,
  language,
  ledger,
  onClick,
}: {
  transactions: Transaction[];
  language: Language;
  ledger?: StreakLedger;
  onClick?: () => void;
}) {
  const stats = useStreakStats(transactions, ledger);
  const t = streakCopy[language];
  const status = stats.todayStatus === "NO_SPEND" ? t.noSpendRecorded : stats.activeToday ? t.recorded : t.waiting;
  const label = streakMessage(t.badge, { days: dayLabel(stats.current, language), status });
  return (
    <button
      type="button"
      className={`streak-nav-badge ${stats.current > 0 ? "streak-nav-badge--active" : ""}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      data-streak={stats.current}
    >
      <Flame size={15} aria-hidden="true" />
      <span>{dayLabel(stats.current, language)}</span>
      {stats.activeToday && <span className="streak-nav-badge-dot" aria-hidden="true" />}
    </button>
  );
});
