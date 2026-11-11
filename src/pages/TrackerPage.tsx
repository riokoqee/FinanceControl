import type { ExchangeRateSync } from "../lib/currency";
import type { MessageKey } from "../lib/messages";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { CircleHelp, Download, Search, X } from "lucide-react";
import {
  CATEGORIES,
  CURRENCIES,
  convertAmount,
  formatMoney,
} from "../lib/finance";
import type {
  Currency,
  ExchangeRates,
  Language,
  Transaction,
} from "../lib/finance";
import { getRateSourceLabel, getRateLabel } from "../lib/currency";
import { translate } from "../lib/i18n";
import TransactionTable from "../components/TransactionTable";
interface TrackerPageProps {
  filtered: Transaction[];
  language: Language;
  currency: Currency;
  rates?: ExchangeRates;
  sync?: ExchangeRateSync;
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
  onExportCsv: () => void;
  onProfile: () => void;
}
export default function TrackerPage({
  filtered,
  language,
  currency,
  rates,
  sync,
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
  onExportCsv,
  onProfile,
}: TrackerPageProps) {
  const tr = (text: MessageKey) => translate(language, text);
  const filteredTotal = useMemo(
    () =>
      filtered.reduce(
        (sum, record) =>
          sum + convertAmount(record.amount, record.currency, currency, rates),
        0,
      ),
    [filtered, currency, rates],
  );
  return (
    <>
      <div className="tracker-summary">
        <div>
          <span>
            {tr("ui.spending")}{" "}
            {allTime ? tr("ui.ofAllTime") : tr("ui.forTheSelectedMonth")}
          </span>
          <strong>{formatMoney(filteredTotal, currency, language)}</strong>
        </div>
        <div>
          <span>{tr("ui.numberOfRecords")}</span>
          <strong>{filtered.length}</strong>
        </div>
      </div>
      <section
        className="panel tracker-panel"
        aria-busy={searchPending || undefined}
      >
        <div className="filter-bar">
          <label className="search-field">
            <Search size={18} />
            <input
              placeholder={tr("ui.findAPurchaseOrNote")}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              aria-label={tr("ui.searchExpenses")}
            />
            {search && (
              <button
                className="icon-button"
                aria-label={tr("ui.clearSearch")}
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
            aria-label={tr("ui.filterByCategory")}
          >
            <option value="all">{tr("ui.allCategories")}</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {tr(c.labelKey)}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={filterCurrency}
            onChange={(e) => onCurrencyFilter(e.target.value)}
            aria-label={tr("ui.filterByCurrency")}
          >
            <option value="all">{tr("ui.allCurrencies")}</option>
            {CURRENCIES.map((c) => (
              <option key={c.code}>{c.code}</option>
            ))}
          </select>
          <select
            className="filter-select sort-select"
            value={sort}
            onChange={(e) => onSort(e.target.value)}
            aria-label={tr("ui.sortExpenses")}
          >
            <option value="newest">{tr("ui.newestFirst")}</option>
            <option value="oldest">{tr("ui.oldestFirst")}</option>
            <option value="largest">{tr("ui.amountAlternative")}</option>
          </select>
        </div>
        <div className="filter-summary">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={allTime}
              onChange={(e) => onAllTime(e.target.checked)}
            />
            {tr("ui.allTime")}
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
          {!storageOk && (
            <>
              <CircleHelp size={14} />
              <span>{tr("ui.storageIsUnavailableDownloadABackup")}</span>
            </>
          )}
          <button className="inline-link" onClick={onExportCsv}>
            <Download size={14} />
            CSV
          </button>
          <button className="inline-link" onClick={onExport} disabled={pdfBusy}>
            <Download size={14} />
            {tr("ui.createPdf")}
          </button>
        </div>
      </section>
      <p className="workspace-footnote">
        <button
          className="inline-link"
          title={getRateLabel(rates, language, sync)}
          onClick={onProfile}
        >
          <CircleHelp size={13} />
          {getRateSourceLabel(rates, language, sync)}
        </button>
      </p>
    </>
  );
}
