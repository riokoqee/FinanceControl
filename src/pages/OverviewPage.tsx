import type { ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CircleHelp,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { formatMoney, RATE_LABEL } from "../lib/finance";
import type {
  AppData,
  CategoryId,
  Currency,
  Language,
  Transaction,
} from "../lib/finance";
import type { summarizeExpenses } from "../lib/expenses";
import { plural } from "../lib/display";
import { translate } from "../lib/i18n";
import { useLocalCalendarDay } from "../lib/useStreakStats";
import StreakBounty from "../components/StreakBounty";
import type { BountyCelebration } from "../components/StreakBounty";
import ExpenseChart from "../components/ExpenseChart";
import TransactionTable from "../components/TransactionTable";

const categoryColors: Record<CategoryId, string> = {
  food: "#C35D4C",
  shopping: "#5A9C9B",
  transport: "#718EAB",
  home: "#D7B777",
  entertainment: "#A68469",
  health: "#80B8A3",
  other: "#b7b9b5",
};

interface OverviewPageProps {
  data: AppData;
  summary: ReturnType<typeof summarizeExpenses>;
  month: string;
  currency: Currency;
  language: Language;
  streakCurrent: number;
  chartRange: "week" | "month";
  onChartRangeChange: (range: "week" | "month") => void;
  celebration: BountyCelebration | null;
  showDemoBanner: boolean;
  onDismissDemo: () => void;
  onDemo: () => void;
  onAddExpense: () => void;
  onShowAll: () => void;
  onProfile: () => void;
  onTracker: () => void;
  onOpen: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  emptyState: ReactNode;
}
export default function OverviewPage({
  data,
  summary,
  month,
  currency,
  language,
  streakCurrent,
  chartRange,
  onChartRangeChange,
  celebration,
  showDemoBanner,
  onDismissDemo,
  onDemo,
  onAddExpense,
  onShowAll,
  onProfile,
  onTracker,
  onOpen,
  onEdit,
  onDelete,
  emptyState,
}: OverviewPageProps) {
  const tr = (text: string) => translate(language, text);
  const today = useLocalCalendarDay();
  const {
    transactions,
    total,
    previousTotal,
    categories,
    recent: sortedTransactions,
  } = summary;
  const budget = data.profile.monthlyBudget;
  const progress = budget ? (total / budget) * 100 : 0;
  const remaining = Math.max(0, budget - total);
  const daysInMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  const elapsedDays =
    month === today.slice(0, 7)
      ? Number(today.slice(8))
      : month > today.slice(0, 7)
        ? 0
        : daysInMonth;
  const average = elapsedDays ? total / elapsedDays : 0;
  const changePercent = previousTotal
    ? ((total - previousTotal) / previousTotal) * 100
    : null;
  const shortMoney = formatMoney;
  return (
    <>
      {streakCurrent === 0 && (
        <section className="voyage-banner" aria-label="BeliLog">
          <div className="voyage-copy">
            <span className="voyage-kicker">BeliLog · Grand Line Ledger</span>
            <strong>{tr("Навстречу своим сокровищам")}</strong>
            <p>{tr("Записывайте траты и держите курс к цели.")}</p>
            <span className="voyage-meta">
              <ShieldCheck size={13} />
              {tr("Личный журнал · Без облака")}
            </span>
          </div>
          <div className="voyage-art" aria-hidden="true">
            <img
              src={`${import.meta.env.BASE_URL}belilog-icon-512.png`}
              alt=""
            />
          </div>
        </section>
      )}
      <StreakBounty
        transactions={data.transactions}
        profile={data.profile}
        language={language}
        variant="overview"
        celebration={celebration}
        onAddExpense={onAddExpense}
      />
      {showDemoBanner && data.transactions.length === 0 && (
        <div className="demo-banner">
          <span className="demo-icon">
            <Sparkles size={21} />
          </span>
          <div className="demo-copy">
            <strong>{tr("Место для ваших финансовых привычек")}</strong>
            <span>
              {tr(
                "Начните с первой покупки или посмотрите, как всё работает, на примере.",
              )}
            </span>
          </div>
          <button className="demo-link" onClick={onDemo}>
            {tr("Посмотреть демо")} <ArrowUpRight size={16} />
          </button>
          <button
            className="icon-button demo-dismiss"
            aria-label={tr("Скрыть подсказку")}
            onClick={onDismissDemo}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="overview-stats">
        <div className="stat-card stat-card-featured">
          <div className="stat-label">
            {tr("Расходы за месяц")}
            <span className="stat-icon">
              <ArrowUpRight size={18} />
            </span>
          </div>
          <div className="stat-value">
            {shortMoney(total, currency, language)}
          </div>
          <div className="stat-footer">
            {changePercent !== null ? (
              <>
                <span
                  className={`stat-trend ${changePercent > 0 ? "trend-up" : ""}`}
                >
                  {changePercent > 0 ? "+" : ""}
                  {Math.round(changePercent)}%
                </span>
                <span>{tr("к прошлому месяцу")}</span>
              </>
            ) : (
              <>
                <span className="tiny-dot" />
                <span>
                  {transactions.length
                    ? `${transactions.length} ${plural(transactions.length, tr("запись"), tr("записи"), tr("записей"), language)} ${tr("за этот месяц")}`
                    : tr("Новый месяц — чистый лист")}
                </span>
              </>
            )}
          </div>
          <div className="stat-decoration" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            {budget ? tr("Осталось в бюджете") : tr("Месячный бюджет")}
            <span className="stat-icon">
              <Wallet size={18} />
            </span>
          </div>
          <div className="stat-value">
            {budget ? (
              shortMoney(remaining, currency, language)
            ) : (
              <span className="unset-value">{tr("Не задан")}</span>
            )}
          </div>
          <div className="stat-footer">
            {budget ? (
              <>
                <span
                  className={`mini-progress ${progress >= 100 ? "is-over" : ""}`}
                >
                  <i style={{ width: `${Math.min(progress, 100)}%` }} />
                </span>
                <span>
                  {Math.round(progress)}
                  {tr("% использовано")}
                </span>
              </>
            ) : (
              <button className="inline-link" onClick={() => onProfile()}>
                {tr("Задать комфортный лимит")} <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            {tr("В среднем за день")}
            <span className="stat-icon">
              <TrendingUp size={18} />
            </span>
          </div>
          <div className="stat-value">
            {shortMoney(average, currency, language)}
          </div>
          <div className="stat-footer">
            <span className="stat-neutral-icon">
              <ArrowDownLeft size={13} />
            </span>
            <span>
              {elapsedDays
                ? `${tr("За")} ${elapsedDays} ${plural(elapsedDays, tr("день"), tr("дня"), tr("дней"), language)} ${tr("месяца")}`
                : tr("Месяц ещё не начался")}
            </span>
          </div>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>{tr("Динамика расходов")}</h2>
            </div>
            <div className="segment-control">
              <button
                className={chartRange === "week" ? "segment-active" : ""}
                onClick={() => onChartRangeChange("week")}
              >
                {tr("7 дней")}
              </button>
              <button
                className={chartRange === "month" ? "segment-active" : ""}
                onClick={() => onChartRangeChange("month")}
              >
                {tr("Месяц")}
              </button>
            </div>
          </div>
          <ExpenseChart
            language={language}
            transactions={transactions}
            month={month}
            range={chartRange}
            currency={currency}
          />
          <div className="chart-legend">
            <span className="legend-dot" style={{ background: "#C35D4C" }} />
            {tr("Расходы")}{" "}
            <span className="chart-legend-note">
              {chartRange === "week"
                ? tr("Последние 7 дней выбранного месяца")
                : tr("По дням месяца")}
            </span>
          </div>
        </section>
        <section className="panel category-panel">
          <div className="panel-header">
            <div>
              <h2>{tr("Куда уходят деньги")}</h2>
            </div>
            <span className="muted-icon">
              <ShoppingBag size={18} />
            </span>
          </div>
          <div className="donut-wrap">
            <svg
              className="donut"
              viewBox="0 0 180 180"
              role="img"
              aria-label={
                total
                  ? tr("Распределение расходов по категориям")
                  : tr("Пока нет расходов по категориям")
              }
            >
              <circle
                cx="90"
                cy="90"
                r="71"
                fill="none"
                stroke="var(--track)"
                strokeWidth="17"
              />
              {categories.map((c, i) => {
                const offset = categories
                  .slice(0, i)
                  .reduce((s, item) => s + (item.value / total) * 446.1, 0);
                return (
                  <circle
                    key={c.id}
                    cx="90"
                    cy="90"
                    r="71"
                    fill="none"
                    stroke={categoryColors[c.id]}
                    strokeWidth="17"
                    strokeDasharray={`${Math.max(0, (c.value / total) * 446.1 - 5)} ${446.1}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 90 90)"
                  >
                    <title>
                      {tr(c.label)}: {formatMoney(c.value, currency, language)}
                    </title>
                  </circle>
                );
              })}
            </svg>
            <div className="donut-center">
              <span>{categories.length || "—"}</span>
              <small>
                {categories.length
                  ? plural(
                      categories.length,
                      tr("категория"),
                      tr("категории"),
                      tr("категорий"),
                      language,
                    )
                  : tr("Всё впереди")}
              </small>
            </div>
          </div>
          <div className="legend-list">
            {categories.length ? (
              categories.slice(0, 4).map((c) => (
                <div className="legend-row" key={c.id}>
                  <span
                    className="legend-dot"
                    style={{ background: categoryColors[c.id] }}
                  />
                  <span className="legend-name">{tr(c.label)}</span>
                  <span className="legend-value">
                    {formatMoney(c.value, currency, language)}
                  </span>
                  <span className="legend-percent">
                    {Math.round((c.value / total) * 100)}%
                  </span>
                </div>
              ))
            ) : (
              <p className="category-placeholder">
                {tr("Добавьте расходы, и здесь появится")}
                <br />
                {tr("распределение по категориям.")}
              </p>
            )}
            {categories.length > 4 && (
              <button
                className="inline-link more-categories"
                onClick={() => onTracker()}
              >
                {tr("Ещё")} {categories.length - 4}{" "}
                {plural(
                  categories.length - 4,
                  tr("категория"),
                  tr("категории"),
                  tr("категорий"),
                  language,
                )}{" "}
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel recent-panel">
          <div className="panel-header">
            <div>
              <h2>
                {tr("Последние расходы")}{" "}
                <span className="count-badge">{transactions.length}</span>
              </h2>
            </div>
            <button className="section-link" onClick={onShowAll}>
              {tr("Все расходы")} <ArrowRight size={16} />
            </button>
          </div>
          {sortedTransactions.length ? (
            <TransactionTable
              language={language}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
              items={sortedTransactions.slice(0, 5)}
              compact
            />
          ) : (
            emptyState
          )}
        </section>
        <div className="budget-panel">
          <span className="budget-icon">
            <Wallet size={21} strokeWidth={1.6} />
          </span>
          <h2>{tr("С заботой о будущем")}</h2>
          <p>
            {budget
              ? tr("Бюджет помогает планировать траты.")
              : tr("Задайте лимит и следите за остатком.")}
          </p>
          {budget > 0 && (
            <>
              <div className="budget-values">
                <strong>{Math.round(progress)}%</strong>
                <span>
                  {tr("от")} {formatMoney(budget, currency, language)}
                </span>
              </div>
              <div
                className={`budget-track ${progress >= 100 ? "is-over" : ""}`}
              >
                <div
                  className="budget-fill"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="budget-caption">
                {progress >= 100
                  ? `${tr("Лимит превышен на")} ${formatMoney(total - budget, currency, language)}`
                  : `${tr("В запасе")} ${formatMoney(remaining, currency, language)}`}
              </span>
            </>
          )}
          <button className="budget-link" onClick={() => onProfile()}>
            {budget ? tr("Настроить бюджет") : tr("Установить бюджет")}
            <ArrowUpRight size={16} />
          </button>
          <div className="budget-art" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
      <p className="workspace-footnote">
        <ShieldCheck size={13} />
        {tr("Только вы и ваши финансы. Данные хранятся в этом браузере.")}
        <span title={tr(RATE_LABEL)}>
          <CircleHelp size={13} />
          {tr("Суммы в валюте обзора — по условному курсу.")}
        </span>
      </p>
    </>
  );
}
