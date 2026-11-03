import { useEffect, useId, useMemo, useRef, useState } from "react";
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

export default function ActivityCalendar({
  transactions,
  language,
}: {
  transactions: Transaction[];
  language: Language;
}) {
  const tr = (text: string) => translate(language, text);
  const entryLabel = (count: number) => {
    if (language === "en") return count === 1 ? "record" : "records";
    const form = new Intl.PluralRules("ru").select(count);
    return form === "one" ? "запись" : form === "few" ? "записи" : "записей";
  };
  const thisYear = new Date().getFullYear();
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
  const today = todayString();
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
  const first = new Date(year, 0, 1, 12);
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const last = new Date(year, 11, 31, 12);
  const weeks: {
    date: string;
    inYear: boolean;
    count: number;
    weekday: number;
  }[][] = [];
  const cursor = new Date(first);
  while (cursor <= last) {
    const week = [];
    for (let day = 0; day < 7; day++) {
      const date = todayString(cursor);
      week.push({
        date,
        inYear: cursor.getFullYear() === year,
        count: counts[date] ?? 0,
        weekday: day,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  const yearDays = weeks.flat().filter((d) => d.inYear && d.date <= today);
  const activeDays = yearDays.filter((d) => d.count > 0).length;
  const total = yearDays.reduce((sum, d) => sum + d.count, 0);
  let streak = 0,
    longest = 0;
  yearDays.forEach((d) => {
    streak = d.count > 0 ? streak + 1 : 0;
    longest = Math.max(longest, streak);
  });
  const firstWeekForMonth = (month: number) =>
    weeks.findIndex((w) =>
      w.some(
        (d) =>
          d.inYear &&
          Number(d.date.slice(5, 7)) === month &&
          d.date.endsWith("-01"),
      ),
    );
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
          <span className="activity-eyebrow">
            <CalendarDays size={15} />
            {tr("ЖУРНАЛ КАПИТАНА")}
          </span>
          <h2>{tr("Календарь активности")}</h2>
          <p className="panel-subtitle">
            {tr("Каждая запись — маленький шаг к большому сокровищу.")}
          </p>
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
            {Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                style={{
                  gridColumn: `${firstWeekForMonth(i + 1) + 1} / span 3`,
                }}
              >
                {new Date(year, i, 1)
                  .toLocaleDateString(locale, { month: "short" })
                  .replace(".", "")}
              </span>
            ))}
          </div>
          <div className="activity-body">
            <div className="activity-weekdays" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i}>
                  {[0, 2, 4].includes(i)
                    ? new Date(2026, 9, 26 + i).toLocaleDateString(locale, {
                        weekday: "short",
                      })
                    : ""}
                </span>
              ))}
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
                    const label = `${new Date(`${d.date}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long" })}: ${d.count} ${entryLabel(d.count)}`;
                    return d.inYear ? (
                      <button
                        key={d.date}
                        type="button"
                        className={`activity-day ${d.date === today ? "activity-today" : ""} ${d.date === selectedDay ? "activity-selected" : ""}`}
                        data-level={future ? 0 : getActivityLevel(d.count)}
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
          <span>{tr("записей за год")}</span>
        </div>
        <div>
          <CalendarDays size={16} />
          <strong>{activeDays}</strong>
          <span>{tr("активных дней")}</span>
        </div>
        <div>
          <Flame size={16} />
          <strong>{longest}</strong>
          <span>{tr("дней подряд — лучший результат")}</span>
        </div>
      </div>
      <p className="activity-hint">
        {tr(
          "Считаем день создания записи, а не дату покупки. Для старых записей используем дату покупки.",
        )}
      </p>
    </section>
  );
}
