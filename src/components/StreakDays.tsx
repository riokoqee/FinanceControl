import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, CircleDashed, Leaf, Minus, Snowflake } from "lucide-react";
import type { Language, Transaction } from "../lib/finance";
import { getTrackingDays } from "../lib/streak/streakLedger";
import type { StreakLedger, TrackingDayStatus } from "../lib/streak/streakTypes";
import { streakCopy } from "../lib/streak/streakCopy";
import { useLocalCalendarDay } from "../hooks/useStreakStats";
import "./StreakDays.css";

const icons = { LOGGED: Check, NO_SPEND: Leaf, FROZEN: Snowflake, MISSED: Minus, PENDING: CircleDashed, NONE: Circle };

export function trackingStatusLabel(status: TrackingDayStatus, language: Language): string {
  const t = streakCopy[language];
  return { LOGGED: t.logged, NO_SPEND: t.noSpendDay, FROZEN: t.frozen, MISSED: t.missed, PENDING: t.pending, NONE: t.beforeTracking }[status];
}

export default memo(function StreakDays({
  transactions,
  ledger,
  language,
  busy = false,
  onConfirmDay,
}: {
  transactions: readonly Transaction[];
  ledger?: StreakLedger;
  language: Language;
  busy?: boolean;
  onConfirmDay?: (day: string) => void;
}) {
  const today = useLocalCalendarDay();
  const t = streakCopy[language];
  // The engine evaluates eligibility at the actual local time, not a fixed noon.
  const days = getTrackingDays(transactions, ledger, new Date());
  const [selection, setSelection] = useState(today);
  const listRef = useRef<HTMLOListElement>(null);
  const selected = days.find((day) => day.date === selection) ?? days[days.length - 1];
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(t.locale, { day: "numeric", month: "long" }),
    [t.locale],
  );
  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(t.locale, { weekday: "short" }),
    [t.locale],
  );
  useEffect(() => {
    const container = listRef.current;
    if (container) container.scrollLeft = container.scrollWidth;
  }, [today]);
  if (!selected) return null;
  const SelectedIcon = icons[selected.status];
  const canBackfill = selected.date !== today && selected.canConfirm;
  const hasPurchases = selected.confirmationStatus === "LOGGED";
  const selectedLabel = trackingStatusLabel(selected.status, language);

  return (
    <div className="streak-days" role="group" aria-label={t.recent}>
      <ol className="streak-days-list" ref={listRef}>
        {days.map((day) => {
          const date = new Date(`${day.date}T12:00:00`);
          const Icon = icons[day.status];
          const label = `${dateFormatter.format(date)}: ${trackingStatusLabel(day.status, language)}`;
          return (
            <li key={day.date}>
              <button
                type="button"
                className="streak-day"
                data-date={day.date}
                data-status={day.status}
                aria-label={label}
                title={label}
                aria-current={day.date === today ? "date" : undefined}
                aria-pressed={selected.date === day.date}
                onClick={() => setSelection(day.date)}
              >
                <span>{weekdayFormatter.format(date).replace(".", "")}</span>
                <Icon size={16} aria-hidden="true" />
                <strong>{date.getDate()}</strong>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="streak-day-detail" data-status={selected.status}>
        <p className="streak-day-detail-label" aria-live="polite">
          <SelectedIcon size={14} aria-hidden="true" />
          <span>{dateFormatter.format(new Date(`${selected.date}T12:00:00`))} · {selectedLabel}</span>
        </p>
        {selected.status === "FROZEN" && <p className="streak-day-freeze-rule">{t.freezeRule}</p>}
        {canBackfill && onConfirmDay && (
          <div className="streak-day-backfill">
            <div className="streak-day-backfill-actions">
              <button type="button" className="button button-secondary" disabled={busy} onClick={() => onConfirmDay(selected.date)}>
                {hasPurchases ? <Check size={14} aria-hidden="true" /> : <Leaf size={14} aria-hidden="true" />}
                {hasPurchases ? t.confirmTracking : t.confirmNoSpend}
              </button>
            </div>
            <p>{t.backfillHint}</p>
          </div>
        )}
      </div>
    </div>
  );
});
