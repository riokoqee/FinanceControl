import { memo } from "react";
import { Flame } from "lucide-react";
import type { Language, Transaction } from "../lib/finance";
import { useStreakStats } from "../lib/useStreakStats";
import "./StreakBadge.css";

const russianPlural = new Intl.PluralRules("ru");

export function dayLabel(count: number, language: Language): string {
  if (language === "en") return `${count} ${count === 1 ? "day" : "days"}`;
  const plural = russianPlural.select(count);
  return `${count} ${plural === "one" ? "день" : plural === "few" ? "дня" : "дней"}`;
}

export default memo(function StreakBadge({
  transactions,
  language,
  onClick,
}: {
  transactions: Transaction[];
  language: Language;
  onClick?: () => void;
}) {
  const stats = useStreakStats(transactions);
  const label = language === "en"
    ? `Recording streak: ${dayLabel(stats.current, language)}. ${stats.activeToday ? "Recorded today." : "Add a record today."}`
    : `Серия записей: ${dayLabel(stats.current, language)}. ${stats.activeToday ? "Сегодня запись уже добавлена." : "Добавьте запись сегодня."}`;
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
