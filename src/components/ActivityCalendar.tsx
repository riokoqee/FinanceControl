import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  PenLine,
} from "lucide-react";
import {
  getActivityCounts,
  getActivityLevel,
  todayString,
} from "../lib/finance";
import type { Language, Transaction } from "../lib/finance";
import { translate } from "../lib/i18n";
import { plural } from "../lib/display";
import { useLocalCalendarDay } from "../lib/useStreakStats";

const russianPlural = new Intl.PluralRules("ru");

export default memo(function ActivityCalendar({
  transactions,
  language,
}: {
  transactions: Transaction[];
  language: Language;
}) {
  const tr = (text: string) => translate(language, text);
  const entryLabel = (count: number) => {
    if (language === "en") return count === 1 ? "record" : "records";
    const form = russianPlural.select(count);
    return form === "one" ? "запись" : form === "few" ? "записи" : "записей";
  };
  const today = useLocalCalendarDay();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scrollRef.current;
    const current = container?.querySelector<HTMLElement>(".activity-today");
    if (container && current) {
      container.scrollLeft = Math.max(
        0,
        current.getBoundingClientRect().left -
          container.getBoundingClientRect().left +
          container.scrollLeft -
          container.clientWidth * 0.75,
      );
    } else if (container) container.scrollLeft = 0;
  }, [year]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [focusedDay, setFocusedDay] = useState(todayString);
  const keyboardHintId = useId();
  const counts = useMemo(() => getActivityCounts(transactions), [transactions]);
  const locale = language === "en" ? "en-US" : "ru-RU";
  const firstEnabledDay = `${year}-01-01`;
  const lastEnabledDay = year === thisYear ? today : `${year}-12-31`;
  const tabDay = focusedDay >= firstEnabledDay && focusedDay <= lastEnabledDay
    ? focusedDay
    : year === thisYear ? today : firstEnabledDay;
  const revealDay = (button: HTMLButtonElement) => {
    const container = scrollRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const dayBounds = button.getBoundingClientRect();
    if (dayBounds.left < bounds.left + 3) {
      container.scrollLeft -= bounds.left + 3 - dayBounds.left;
    } else if (dayBounds.right > bounds.right - 3) {
      container.scrollLeft += dayBounds.right - bounds.right + 3;
    }
  };
  const moveDayFocus = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const next = new Date(`${date}T12:00:00`);
    const weekday = (next.getDay() + 6) % 7;
    switch (event.key) {
      case "ArrowUp": next.setDate(next.getDate() - 1); break;
      case "ArrowDown": next.setDate(next.getDate() + 1); break;
      case "ArrowLeft": next.setDate(next.getDate() - 7); break;
      case "ArrowRight": next.setDate(next.getDate() + 7); break;
      case "Home":
        if (event.ctrlKey || event.metaKey) next.setFullYear(year, 0, 1);
        else next.setDate(next.getDate() - weekday);
        break;
      case "End":
        if (event.ctrlKey || event.metaKey) next.setFullYear(year, 11, 31);
        else next.setDate(next.getDate() + 6 - weekday);
        break;
      default: return;
    }
    event.preventDefault();
    const nextDate = todayString(next);
    const bounded = nextDate < firstEnabledDay ? firstEnabledDay : nextDate > lastEnabledDay ? lastEnabledDay : nextDate;
    setFocusedDay(bounded);
    const button = scrollRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${bounded}"]`);
    button?.focus({ preventScroll: true });
    if (button) revealDay(button);
  };
  // Dates, labels and month positions do not change when keyboard focus moves.
  const { weeks, monthLabels } = useMemo(() => {
    const first = new Date(year, 0, 1, 12);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const last = new Date(year, 11, 31, 12);
    const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
    const weeks: { date: string; inYear: boolean; label: string }[][] = [];
    const firstWeeks: number[] = [];
    const cursor = new Date(first);
    while (cursor <= last) {
      const week = [];
      for (let day = 0; day < 7; day++) {
        const date = todayString(cursor);
        const inYear = cursor.getFullYear() === year;
        if (inYear && cursor.getDate() === 1) firstWeeks[cursor.getMonth()] = weeks.length;
        week.push({ date, inYear, label: formatter.format(cursor) });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }
    const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
    const monthLabels = Array.from({ length: 12 }, (_, month) => ({
      column: firstWeeks[month] + 1,
      label: monthFormatter.format(new Date(year, month, 1)).replace(".", ""),
    }));
    return { weeks, monthLabels };
  }, [year, locale]);
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, index) =>
      [0, 2, 4].includes(index) ? formatter.format(new Date(2026, 9, 26 + index)) : "",
    );
  }, [locale]);
  const { activeDays, total, longest } = useMemo(() => {
    let activeDays = 0, total = 0, streak = 0, longest = 0;
    for (const week of weeks) for (const day of week) {
      if (!day.inYear || day.date > today) continue;
      const count = counts[day.date] ?? 0;
      total += count;
      if (count > 0) activeDays++;
      streak = count > 0 ? streak + 1 : 0;
      longest = Math.max(longest, streak);
    }
    return { activeDays, total, longest };
  }, [weeks, counts, today]);
  const detailDay =
    selectedDay && selectedDay.startsWith(String(year))
      ? selectedDay
      : today.startsWith(String(year))
        ? today
        : `${year}-01-01`;
  const detailCount = counts[detailDay] ?? 0;
  const detailDate = new Date(`${detailDay}T12:00:00`).toLocaleDateString(
    locale,
    { day: "numeric", month: "long", year: "numeric" },
  );
  return (
    <section className="panel activity-panel">
      <div className="activity-header">
        <div>
          <h2>{tr("Календарь активности")}</h2>
        </div>
        <div className="activity-year">
          <button
            type="button"
            className="icon-button"
            aria-label={tr("Предыдущий год")}
            onClick={() => {
              setYear((y) => Math.max(1900, y - 1));
              setSelectedDay(null);
            }}
            disabled={year <= 1900}
          >
            <ChevronLeft size={17} />
          </button>
          <strong>{year}</strong>
          <button
            type="button"
            className="icon-button"
            aria-label={tr("Следующий год")}
            onClick={() => {
              setYear((y) => y + 1);
              setSelectedDay(null);
            }}
            disabled={year >= thisYear}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <p id={keyboardHintId} className="sr-only">
        {language === "en"
          ? "Use Up and Down to move one day, Left and Right to move one week. Home and End move to the first and last day of the week; Control plus Home or End moves to the start or end of the year. Press Enter or Space to select a day."
          : "Стрелки вверх и вниз перемещают на день, влево и вправо — на неделю. Home и End переходят к началу и концу недели; Control с Home или End — к началу или концу года. Нажмите Enter или пробел, чтобы выбрать день."}
      </p>
      <div className="activity-scroll" ref={scrollRef}>
        <div
          className="activity-inner"
          style={{ minWidth: `${weeks.length * 16 + 30}px` }}
        >
          <div
            className="activity-months"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${weeks.length}, 1fr)`,
              marginLeft: 30,
            }}
          >
            {monthLabels.map((month, index) => (
              <span key={index} style={{ gridColumn: `${month.column} / span 3` }}>
                {month.label}
              </span>
            ))}
          </div>
          <div className="activity-body">
            <div className="activity-weekdays" aria-hidden="true">
              {weekdayLabels.map((label, index) => <span key={index}>{label}</span>)}
            </div>
            <div
              className="activity-grid"
              role="group"
              aria-label={tr("Активность по дням")}
              aria-describedby={keyboardHintId}
            >
              {weeks.map((week, index) => (
                <div className="activity-week" key={index}>
                  {week.map((d) => {
                    const future = d.date > today;
                    const count = counts[d.date] ?? 0;
                    const label = `${d.label}: ${count} ${entryLabel(count)}`;
                    return d.inYear ? (
                      <button
                        key={d.date}
                        type="button"
                        className={`activity-day ${d.date === today ? "activity-today" : ""} ${d.date === selectedDay ? "activity-selected" : ""}`}
                        data-level={future ? 0 : getActivityLevel(count)}
                        data-future={future || undefined}
                        data-date={d.date}
                        tabIndex={!future && d.date === tabDay ? 0 : -1}
                        title={label}
                        aria-label={label}
                        aria-pressed={selectedDay === d.date}
                        aria-current={d.date === today ? "date" : undefined}
                        disabled={future}
                        onFocus={(event) => {
                          setFocusedDay(d.date);
                          revealDay(event.currentTarget);
                        }}
                        onKeyDown={(event) => moveDayFocus(event, d.date)}
                        onClick={() => {
                          setFocusedDay(d.date);
                          setSelectedDay(d.date);
                        }}
                      />
                    ) : (
                      <span
                        key={d.date}
                        className="activity-day activity-outside"
                        aria-hidden="true"
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="activity-legend">
        <span className="activity-selected-label" role="status">
          {detailDate} · <strong>{detailCount}</strong>{" "}
          {entryLabel(detailCount)}
        </span>
        <span>{tr("Меньше")}</span>
        <span className="activity-scale" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((level) => (
            <i className="activity-day" data-level={level} key={level} />
          ))}
        </span>
        <span>{tr("Больше")}</span>
      </div>
      <div className="activity-stats">
        <div>
          <PenLine size={16} />
          <strong>{total}</strong>
          <span>{entryLabel(total)}</span>
        </div>
        <div>
          <CalendarDays size={16} />
          <strong>{activeDays}</strong>
          <span>{tr("активных дней")}</span>
        </div>
        <div>
          <Flame size={16} />
          <strong>{longest}</strong>
          <span>{plural(longest, tr("день"), tr("дня"), tr("дней"), language)} · {tr("Лучшая серия")}</span>
        </div>
      </div>
      <p className="activity-hint">
        {language === "en"
          ? "By date added; older records use the purchase date."
          : "По дате добавления; старые записи — по дате покупки."}
      </p>
    </section>
  );
});
