import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CircleHelp,
  Download,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  CATEGORIES,
  CURRENCIES,
  convertAmount,
  formatMoney,
} from "../lib/finance";
import type { Currency, Language, Transaction } from "../lib/finance";
import { translate } from "../lib/i18n";
import { plural } from "../lib/display";
import TransactionTable from "../components/TransactionTable";
interface TrackerPageProps {
  filtered: Transaction[];
  language: Language;
  currency: Currency;
  search: string;
  category: string;
  filterCurrency: string;
  sort: string;
  allTime: boolean;
  searchPending: boolean;
  paginationKey: string;
  storageOk: boolean;
  pdfBusy: boolean;
  emptyState: ReactNode;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onCurrencyFilter: (value: string) => void;
  onSort: (value: string) => void;
  onAllTime: (value: boolean) => void;
  onOpen: (id: string) => void;
  onEdit: (record: Transaction) => void;
  onDelete: (record: Transaction) => void;
  onExport: () => void;
  onProfile: () => void;
}
export default function TrackerPage({
  filtered,
  language,
  currency,
  search,
  category,
  filterCurrency,
  sort,
  allTime,
  searchPending,
  paginationKey,
  storageOk,
  pdfBusy,
  emptyState,
  onSearch,
  onCategory,
  onCurrencyFilter,
  onSort,
  onAllTime,
  onOpen,
  onEdit,
  onDelete,
  onExport,
  onProfile,
}: TrackerPageProps) {
  const tr = (text: string) => translate(language, text);
  const filteredTotal = useMemo(
    () =>
      filtered.reduce(
        (sum, record) =>
          sum + convertAmount(record.amount, record.currency, currency),
        0,
      ),
    [filtered, currency],
  );
  return (
    <>
      <div className="tracker-summary">
        <div>
          <span>
            {tr("Расходы")}{" "}
            {allTime ? tr("за всё время") : tr("за выбранный месяц")}
          </span>
          <strong>{formatMoney(filteredTotal, currency, language)}</strong>
        </div>
        <div>
          <span>{tr("Количество записей")}</span>
          <strong>
            {filtered.length}
            <small>
              {" "}
              {plural(
                filtered.length,
                tr("расход"),
                tr("расхода"),
                tr("расходов"),
                language,
              )}
            </small>
          </strong>
        </div>
        <span className="tracker-summary-note">
          <ShieldCheck size={18} />
          {tr("Каждая запись — шаг к ясности")}
        </span>
      </div>
      <section
        className="panel tracker-panel"
        aria-busy={searchPending || undefined}
      >
        <div className="filter-bar">
          <label className="search-field">
            <Search size={18} />
            <input
              placeholder={tr("Найти покупку или заметку…")}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              aria-label={tr("Поиск расходов")}
            />
            {search && (
              <button
                className="icon-button"
                aria-label={tr("Очистить поиск")}
                onClick={() => onSearch("")}
              >
                <X size={15} />
              </button>
            )}
          </label>
          <select
            className="filter-select"
            value={category}
            onChange={(e) => onCategory(e.target.value)}
            aria-label={tr("Фильтр по категории")}
          >
            <option value="all">{tr("Все категории")}</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {tr(c.label)}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={filterCurrency}
            onChange={(e) => onCurrencyFilter(e.target.value)}
            aria-label={tr("Фильтр по валюте")}
          >
            <option value="all">{tr("Все валюты")}</option>
            {CURRENCIES.map((c) => (
              <option key={c.code}>{c.code}</option>
            ))}
          </select>
          <select
            className="filter-select sort-select"
            value={sort}
            onChange={(e) => onSort(e.target.value)}
            aria-label={tr("Сортировка расходов")}
          >
            <option value="newest">{tr("Сначала новые")}</option>
            <option value="oldest">{tr("Сначала старые")}</option>
            <option value="largest">{tr("По сумме ↓")}</option>
          </select>
        </div>
        <div className="filter-summary">
          <span>
            {tr("Найдено записей:")} <strong>{filtered.length}</strong>
          </span>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={allTime}
              onChange={(e) => onAllTime(e.target.checked)}
            />
            {tr("За всё время")}
          </label>
        </div>
        {filtered.length ? (
          <TransactionTable
            items={filtered}
            language={language}
            onOpen={onOpen}
            onEdit={onEdit}
            onDelete={onDelete}
            paginationKey={paginationKey}
          />
        ) : (
          emptyState
        )}
        <div className="table-footer">
          <ShieldCheck size={14} />
          <span>
            {storageOk
              ? tr("Все изменения сохраняются автоматически")
              : tr("Хранилище недоступно. Скачайте резервную копию.")}
          </span>
          <button className="inline-link" onClick={onExport} disabled={pdfBusy}>
            <Download size={14} />
            {tr("Создать PDF")}
          </button>
        </div>
      </section>
      <p className="workspace-footnote">
        <CircleHelp size={13} />
        {tr("Суммы покупок сохраняются в исходной валюте. Итог в")} {currency}{" "}
        {tr("— по условному курсу.")}
        <button className="inline-link" onClick={() => onProfile()}>
          {tr("О курсах")} <ArrowRight size={13} />
        </button>
      </p>
    </>
  );
}
