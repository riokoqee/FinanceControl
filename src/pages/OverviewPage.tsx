import type { MessageKey } from "../lib/messages";
import { message } from "../lib/messages";
import { useId, useMemo } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CircleHelp,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { CATEGORIES, formatMoney } from "../lib/finance";
import type {
  AppData,
  CategoryBudget,
  CategoryId,
  Currency,
  Language,
  Transaction,
} from "../lib/finance";
import { getRateSourceLabel, getRateLabel } from "../lib/currency";
import type { summarizeExpenses } from "../lib/expenses";
import { plural } from "../lib/display";
import { translate } from "../lib/i18n";
import { useLocalCalendarDay } from "../hooks/useStreakStats";
import { summarizeCategoryBudgets } from "../lib/budgets";
import StreakBounty from "../components/StreakBounty";
import type { BountyCelebration } from "../components/StreakBounty";
import ExpenseChart from "../components/ExpenseChart";
import TransactionTable from "../components/TransactionTable";
import BudgetState from "../components/BudgetState";
import "../components/CategoryBudgetsDialog.css";

const NO_CATEGORY_BUDGETS: CategoryBudget[] = [];
const categoryLabels = new Map(
  CATEGORIES.map((category) => [category.id, category.labelKey]),
);

const categoryColors: Record<CategoryId, string> = {
  food: "var(--chart-food)",
  shopping: "var(--chart-shopping)",
  transport: "var(--chart-transport)",
  home: "var(--chart-home)",
  entertainment: "var(--chart-entertainment)",
  health: "var(--chart-health)",
  other: "var(--chart-other)",
};
const categoryPatterns: Record<CategoryId, string> = {
  food: "M0 2H8 M0 6H8",
  transport: "M2 0V8 M6 0V8",
  home: "M0 4H8 M4 0V8",
  entertainment: "M0 0L8 8 M8 0L0 8",
  health: "M2 2h1 M6 6h1",
  shopping: "M-2 2L2-2 M0 8L8 0 M6 10L10 6",
  other: "M0 0L8 8 M-4 4L4 12 M4-4L12 4",
};
function CategorySwatch({
  category,
  patternId,
}: {
  category: CategoryId;
  patternId: string;
}) {
  return (
    <span className="legend-dot" aria-hidden="true">
      <svg viewBox="0 0 8 8">
        <rect width="8" height="8" fill={`url(#${patternId}-${category})`} />
      </svg>
    </span>
  );
}

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
  onNoSpend: (day: string) => void;
  onConfirmDay: (day: string) => void;
  onShowAll: () => void;
  onProfile: () => void;
  onTracker: () => void;
  onConfigureBudgets: () => void;
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
  onNoSpend,
  onConfirmDay,
  onShowAll,
  onProfile,
  onTracker,
  onConfigureBudgets,
  onOpen,
  onEdit,
  onDelete,
  emptyState,
}: OverviewPageProps) {
  const tr = (text: MessageKey) => translate(language, text);
  const patternId = useId().replace(/:/g, "");
  const today = useLocalCalendarDay();
  const {
    transactions,
    total,
    previousTotal,
    categories,
    recent: sortedTransactions,
  } = summary;
  const categoryBudgets = data.categoryBudgets ?? NO_CATEGORY_BUDGETS;
  const budgetProgress = useMemo(
    () =>
      summarizeCategoryBudgets(
        transactions,
        categoryBudgets,
        month,
        data.profile.exchangeRates,
      ),
    [transactions, categoryBudgets, month, data.profile.exchangeRates],
  );
  const unbudgetedCategories = useMemo(() => {
    const configured = new Set(categoryBudgets.map((item) => item.id));
    return categories.filter((category) => !configured.has(category.id));
  }, [categories, categoryBudgets]);
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
            <strong>{tr("ui.towardsYourTreasure")}</strong>
          </div>
          <div className="voyage-art" aria-hidden="true">
            <img
              src={`${import.meta.env.BASE_URL}belilog-icon-512.png`}
              alt=""
            />
          </div>
        </section>
      )}
      {showDemoBanner && data.transactions.length === 0 && (
        <div className="demo-banner">
          <span className="demo-icon">
            <Sparkles size={21} />
          </span>
          <button className="demo-link" onClick={onDemo}>
            {tr("ui.exploreDemo")} <ArrowUpRight size={16} />
          </button>
          <button
            className="icon-button demo-dismiss"
            aria-label={tr("ui.dismissTip")}
            onClick={onDismissDemo}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <StreakBounty
        transactions={data.transactions}
        ledger={data.streak}
        profile={data.profile}
        language={language}
        variant="overview"
        celebration={celebration}
        onAddExpense={onAddExpense}
        onNoSpend={onNoSpend}
        onConfirmDay={onConfirmDay}
      />

      <div className="overview-stats">
        <div className="stat-card stat-card-featured">
          <div className="stat-label">
            {tr("ui.monthlySpending")}
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
                <span>{tr("ui.comparedWithLastMonth")}</span>
              </>
            ) : (
              <>
                <span className="tiny-dot" />
                <span>
                  {transactions.length
                    ? `${transactions.length} ${plural(transactions.length, tr("ui.record"), tr("ui.records"), tr("ui.recordsAlternative"), language)}`
                    : tr("ui.noExpensesYet")}
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
        <div
          className="stat-card stat-card-budget"
          data-state={
            budget
              ? progress > 100
                ? "over"
                : progress >= 80
                  ? "warning"
                  : "normal"
              : undefined
          }
        >
          <div className="stat-label">
            {budget ? tr("ui.budgetRemaining") : tr("ui.monthlyBudget")}
            <span className="stat-icon">
              <Wallet size={18} />
            </span>
          </div>
          <div className="stat-value">
            {budget ? (
              shortMoney(remaining, currency, language)
            ) : (
              <span className="unset-value">{tr("ui.notSet")}</span>
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
                  {tr("ui.used")}
                </span>
                <BudgetState
                  state={
                    progress > 100
                      ? "over"
                      : progress >= 80
                        ? "warning"
                        : "normal"
                  }
                  language={language}
                  reached={progress === 100}
                />
              </>
            ) : (
              <button className="inline-link" onClick={() => onProfile()}>
                {tr("ui.setAComfortableLimit")} <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            {tr("ui.dailyAverage")}
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
                ? `${tr("ui.over")} ${elapsedDays} ${plural(elapsedDays, tr("ui.day"), tr("ui.days"), tr("ui.daysAlternative"), language)} ${tr("ui.thisMonthAlternative")}`
                : tr("ui.thisMonthHasNotStartedYet")}
            </span>
          </div>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>{tr("ui.spendingOverTime")}</h2>
            </div>
            <div className="segment-control">
              <button
                className={chartRange === "week" ? "segment-active" : ""}
                onClick={() => onChartRangeChange("week")}
              >
                {tr("ui.7Days")}
              </button>
              <button
                className={chartRange === "month" ? "segment-active" : ""}
                onClick={() => onChartRangeChange("month")}
              >
                {tr("ui.month")}
              </button>
            </div>
          </div>
          <ExpenseChart
            language={language}
            transactions={transactions}
            month={month}
            range={chartRange}
            currency={currency}
            rates={data.profile.exchangeRates}
          />
          {chartRange === "week" && (
            <div className="chart-legend">
              <span className="chart-legend-note">
                {tr("ui.last7DaysOfTheSelectedMonth")}
              </span>
            </div>
          )}
        </section>
        <section className="panel category-panel">
          <div className="panel-header">
            <div>
              <h2>{tr("ui.whereYourMoneyGoes")}</h2>
            </div>
            <button
              className="section-link category-limits-button"
              onClick={onConfigureBudgets}
            >
              {message(language, "ui.limits")}
            </button>
          </div>
          <div className="donut-wrap">
            <svg
              className="donut"
              viewBox="0 0 180 180"
              role="img"
              aria-label={
                total
                  ? tr("ui.spendingBreakdownByCategory")
                  : tr("ui.noCategorySpendingYet")
              }
            >
              <defs>
                {CATEGORIES.map((category) => (
                  <pattern
                    key={category.id}
                    id={`${patternId}-${category.id}`}
                    width="8"
                    height="8"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect
                      width="8"
                      height="8"
                      fill={categoryColors[category.id]}
                    />
                    <path
                      d={categoryPatterns[category.id]}
                      stroke="var(--surface)"
                      strokeWidth="1"
                      fill="none"
                      opacity="0.65"
                    />
                  </pattern>
                ))}
              </defs>
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
                    stroke={`url(#${patternId}-${c.id})`}
                    strokeWidth="17"
                    strokeDasharray={`${Math.max(0, (c.value / total) * 446.1 - 5)} ${446.1}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 90 90)"
                  >
                    <title>
                      {tr(c.labelKey)}:{" "}
                      {formatMoney(c.value, currency, language)}
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
                      tr("ui.categoryAlternative"),
                      tr("ui.categories"),
                      tr("ui.categoriesAlternative"),
                      language,
                    )
                  : tr("ui.aFreshStart")}
              </small>
            </div>
          </div>
          <div className="legend-list">
            {budgetProgress.map((limit) => {
              const label = tr(categoryLabels.get(limit.id)!);
              const amounts = `${formatMoney(limit.spent, limit.currency, language)} / ${formatMoney(limit.amount, limit.currency, language)}`;
              return (
                <div
                  className={`category-budget-item category-budget-${limit.state}`}
                  key={limit.id}
                >
                  <div className="category-budget-caption">
                    <span className="category-budget-name">
                      <CategorySwatch
                        category={limit.id}
                        patternId={patternId}
                      />
                      <span>{label}</span>
                    </span>
                    <span className="category-budget-percent">
                      {Math.round(limit.percent)}%
                    </span>
                  </div>
                  <div
                    className="category-budget-track"
                    role="progressbar"
                    aria-label={`${label}: ${message(language, "ui.monthlyLimit")}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={limit.progress}
                    aria-valuetext={`${amounts}; ${Math.round(limit.percent)}%`}
                  >
                    <span style={{ width: `${limit.progress}%` }} />
                  </div>
                  <div className="category-budget-amounts">
                    <span>{amounts}</span>
                    <BudgetState
                      state={limit.state}
                      language={language}
                      reached={limit.percent === 100}
                    />
                    {limit.state === "over" && (
                      <span className="category-budget-overrun">
                        {message(language, "ui.overBy")}
                        {formatMoney(
                          -limit.remaining,
                          limit.currency,
                          language,
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {unbudgetedCategories.length ? (
              unbudgetedCategories.slice(0, 4).map((c) => (
                <div className="legend-row" key={c.id}>
                  <CategorySwatch category={c.id} patternId={patternId} />
                  <span className="legend-name">{tr(c.labelKey)}</span>
                  <span className="legend-value">
                    {formatMoney(c.value, currency, language)}
                  </span>
                  <span className="legend-percent">
                    {Math.round((c.value / total) * 100)}%
                  </span>
                </div>
              ))
            ) : budgetProgress.length ? null : (
              <p className="category-placeholder">{tr("ui.noExpensesYet")}</p>
            )}
            {unbudgetedCategories.length > 4 && (
              <button
                className="inline-link more-categories"
                onClick={() => onTracker()}
              >
                {tr("ui.more")} {unbudgetedCategories.length - 4}{" "}
                {plural(
                  unbudgetedCategories.length - 4,
                  tr("ui.categoryAlternative"),
                  tr("ui.categories"),
                  tr("ui.categoriesAlternative"),
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
                {tr("ui.recentExpenses")}{" "}
                <span className="count-badge">{transactions.length}</span>
              </h2>
            </div>
            <button className="section-link" onClick={onShowAll}>
              {tr("ui.allExpenses")} <ArrowRight size={16} />
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
        <div
          className="budget-panel"
          data-state={
            budget
              ? progress > 100
                ? "over"
                : progress >= 80
                  ? "warning"
                  : "normal"
              : undefined
          }
        >
          <span className="budget-icon">
            <Wallet size={21} strokeWidth={1.6} />
          </span>
          <h2>{tr("ui.monthlyBudget")}</h2>
          {budget > 0 && (
            <>
              <div className="budget-values">
                <strong>{Math.round(progress)}%</strong>
                <span>
                  {tr("ui.of")} {formatMoney(budget, currency, language)}
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
                {progress === 100
                  ? message(language, "ui.limitReached")
                  : progress > 100
                    ? `${tr("ui.overBudgetBy")} ${formatMoney(total - budget, currency, language)}`
                    : `${tr("ui.remaining")} ${formatMoney(remaining, currency, language)}`}
              </span>
              <BudgetState
                state={
                  progress > 100
                    ? "over"
                    : progress >= 80
                      ? "warning"
                      : "normal"
                }
                language={language}
                reached={progress === 100}
              />
            </>
          )}
          <button className="budget-link" onClick={() => onProfile()}>
            {budget ? tr("ui.adjustBudget") : tr("ui.setBudget")}
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
        <button
          type="button"
          className="inline-link"
          title={getRateLabel(
            data.profile.exchangeRates,
            language,
            data.profile.exchangeRateSync,
          )}
          onClick={onProfile}
        >
          <CircleHelp size={13} />
          {getRateSourceLabel(
            data.profile.exchangeRates,
            language,
            data.profile.exchangeRateSync,
          )}
        </button>
      </p>
    </>
  );
}
