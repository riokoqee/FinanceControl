import { useDeferredValue, useMemo, useState } from "react";
import type { AppData } from "../lib/finance";
import { todayString } from "../lib/finance";
import {
  filterExpenses,
  indexExpenseText,
  orderExpenses,
  summarizeExpenses,
} from "../lib/expenses";
import type { Page } from "./appTypes";

export const currentMonth = () => todayString().slice(0, 7);

/** View filters stay separate from stored finances; exports use the current query. */
export function useExpenseView(data: AppData, page: Page) {
  const [month, setMonth] = useState(currentMonth);
  const [chartRange, setChartRange] = useState<"month" | "week">("month");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [sort, setSort] = useState("newest");
  const [allTime, setAllTime] = useState(false);
  const currency = data.profile.currency;
  const rates = data.profile.exchangeRates;
  const analyticsEnabled = page === "overview" || page === "tracker";
  const summary = useMemo(
    () =>
      summarizeExpenses(
        analyticsEnabled ? data.transactions : [],
        month,
        currency,
        rates,
      ),
    [data.transactions, month, currency, rates, analyticsEnabled],
  );
  const deferredSearch = useDeferredValue(search);
  const hasQuery = Boolean(deferredSearch);
  const searchIndex = useMemo(
    () =>
      indexExpenseText(hasQuery && page === "tracker" ? data.transactions : []),
    [data.transactions, hasQuery, page],
  );
  const ordered = useMemo(
    () =>
      orderExpenses(
        page === "tracker"
          ? allTime
            ? data.transactions
            : summary.transactions
          : [],
        sort,
        currency,
        rates,
      ),
    [
      page,
      allTime,
      data.transactions,
      summary.transactions,
      sort,
      currency,
      rates,
    ],
  );
  const filtered = useMemo(
    () =>
      filterExpenses(
        ordered,
        deferredSearch,
        category,
        filterCurrency,
        searchIndex,
      ),
    [ordered, deferredSearch, category, filterCurrency, searchIndex],
  );
  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setFilterCurrency("all");
  };
  const reportRecords = () =>
    page === "tracker"
      ? search !== deferredSearch
        ? filterExpenses(
            ordered,
            search,
            category,
            filterCurrency,
            hasQuery ? searchIndex : indexExpenseText(data.transactions),
          )
        : filtered
      : summary.transactions;
  function shiftMonth(direction: number) {
    const next = new Date(`${month}-01T12:00:00`);
    next.setMonth(next.getMonth() + direction);
    setMonth(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return {
    month,
    setMonth,
    shiftMonth,
    summary,
    chartRange,
    setChartRange,
    search,
    setSearch,
    deferredSearch,
    category,
    setCategory,
    filterCurrency,
    setFilterCurrency,
    sort,
    setSort,
    allTime,
    setAllTime,
    filtered,
    resetFilters,
    reportRecords,
    paginationKey: JSON.stringify([
      deferredSearch,
      category,
      filterCurrency,
      sort,
      month,
      allTime,
    ]),
  };
}
export type ExpenseView = ReturnType<typeof useExpenseView>;
