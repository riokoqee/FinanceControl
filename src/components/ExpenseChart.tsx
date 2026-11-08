import { memo, useId, useMemo, useState } from "react";
import { convertAmount, formatMoney } from "../lib/finance";
import type { Currency, Language, Transaction } from "../lib/finance";
import { translate } from "../lib/i18n";
import { useLocalCalendarDay } from "../lib/useStreakStats";

export interface ExpenseChartProps {
  transactions: Transaction[];
  month: string;
  range: "month" | "week";
  currency: Currency;
  language: Language;
}

export default memo(function ExpenseChart({
  transactions,
  month,
  range,
  currency,
  language,
}: ExpenseChartProps) {
  const tr = (text: string) => translate(language, text);
  const locale = language === "en" ? "en-US" : "ru-RU";
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const today = useLocalCalendarDay();
  const end = month === today.slice(0, 7) ? Number(today.slice(8)) : days;
  const first = range === "week" ? Math.max(1, end - 6) : 1;
  const last = range === "week" ? end : days;
  const values = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      totals.set(transaction.date, (totals.get(transaction.date) ?? 0) + convertAmount(transaction.amount, transaction.currency, currency));
    }
    const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
    return Array.from({ length: last - first + 1 }, (_, index) => {
      const day = first + index;
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const total = totals.get(date) ?? 0;
      return { day, date, total, label: formatter.format(new Date(`${date}T12:00:00`)), money: formatMoney(total, currency, language) };
    });
  }, [transactions, currency, month, first, last, locale, language]);
  const selectionKey = `${month}:${range}`;
  const [selection, setSelection] = useState({ key: selectionKey, index: end - first });
  const [hover, setHover] = useState<{ key: string; index: number } | null>(null);
  const selected = Math.min(selection.key === selectionKey ? selection.index : end - first, values.length - 1);
  const active = hover?.key === selectionKey ? hover.index : selected;
  const activeValue = values[active];
  const hintId = useId();
  const detailId = useId();
  const selectDay = (index: number) => {
    setHover(null);
    setSelection({ key: selectionKey, index: Math.max(0, Math.min(values.length - 1, index)) });
  };
  const maximum = Math.max(100, ...values.map((value) => value.total)) * 1.2;
  const width = 680, height = 214, bottom = 188, left = 52, right = 668, top = 12;
  const step = (right - left) / values.length;
  const monthLabel = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })
    .format(new Date(`${month}-01T12:00:00`)).replace(" г.", ""), [month, locale]);

  return (
    <div className="chart-container">
      <div className="chart-hover-info" id={detailId} role="status" aria-live="polite" aria-atomic="true">
        <span>{activeValue.label}</span>
        <strong>{activeValue.money}</strong>
      </div>
      <p id={hintId} className="sr-only">
        {language === "en"
          ? "Use Left and Right arrow keys to choose a day, Home for the first day and End for the last day. You can also choose a day from the list below the chart."
          : "Выбирайте день стрелками влево и вправо, Home — первый день, End — последний. Также можно выбрать день в списке под графиком."}
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        tabIndex={0}
        aria-label={`${tr("Расходы по дням,")} ${monthLabel}`}
        aria-describedby={`${hintId} ${detailId}`}
        onMouseLeave={() => setHover(null)}
        onKeyDown={(event) => {
          let next: number;
          switch (event.key) {
            case "ArrowLeft":
            case "ArrowDown": next = selected - 1; break;
            case "ArrowRight":
            case "ArrowUp": next = selected + 1; break;
            case "Home": next = 0; break;
            case "End": next = values.length - 1; break;
            default: return;
          }
          event.preventDefault();
          selectDay(next);
        }}
      >
        {[0, 1, 2, 3].map((index) => {
          const y = top + (index * (bottom - top)) / 3;
          return (
            <g key={index} aria-hidden="true">
              <line x1={left} y1={y} x2={right} y2={y} className="chart-gridline" />
              <text x={left - 10} y={y + 4} textAnchor="end" className="chart-axis-text">
                {Math.round(maximum * (1 - index / 3)).toLocaleString(locale)}
              </text>
            </g>
          );
        })}
        {values.map((value, index) => {
          const barHeight = (value.total / maximum) * (bottom - top);
          return (
            <g
              key={value.day}
              aria-hidden="true"
              onMouseEnter={() => setHover({ key: selectionKey, index })}
              onClick={() => selectDay(index)}
            >
              <rect
                x={left + index * step + step * 0.2}
                y={bottom - Math.max(barHeight, 3)}
                width={step * 0.6}
                height={Math.max(barHeight, 3)}
                rx={Math.min(4, step * 0.25)}
                fill={active === index ? "var(--chart-bar-active)" : value.total ? "var(--chart-bar)" : "var(--chart-empty)"}
                opacity={1}
                stroke={active === index ? "var(--chart-outline)" : "none"}
                strokeWidth={active === index ? 2 : 0}
              >
                <title>{value.label}: {value.money}</title>
              </rect>
              <rect x={left + index * step} y={top} width={step} height={bottom - top} fill="transparent" />
              {(range === "week" || index === 0 || index === values.length - 1 || value.day % 5 === 0) && (
                <text x={left + (index + 0.5) * step} y={height - 5} textAnchor="middle" className="chart-axis-text">
                  {String(value.day).padStart(2, "0")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <label className="chart-selected-detail">
        <span>{language === "en" ? "Day" : "День"}</span>
        <select value={selected} onChange={(event) => selectDay(Number(event.target.value))}>
          {values.map((value, index) => (
            <option key={value.date} value={index}>
              {value.label} — {value.money}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
});
