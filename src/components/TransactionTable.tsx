import { useEffect, useMemo, useState } from "react";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Ellipsis,
  HeartPulse,
  Home,
  ListChecks,
  Pencil,
  ShoppingBag,
  Trash2,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CATEGORIES, formatDate, formatMoney } from "../lib/finance";
import type { CategoryId, Language, Transaction } from "../lib/finance";
import { translate } from "../lib/i18n";

export interface TransactionTableProps {
  items: Transaction[];
  compact?: boolean;
  language: Language;
  onOpen: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  pageSize?: number;
  /** Changes when the filters change, so unrelated renders keep the current page. */
  paginationKey?: string;
}

const categoryIcons: Record<CategoryId, LucideIcon> = {
  food: Utensils,
  shopping: ShoppingBag,
  transport: Car,
  home: Home,
  entertainment: Clapperboard,
  health: HeartPulse,
  other: Ellipsis,
};
const categoryColors: Record<CategoryId, string> = {
  food: "var(--chart-food)",
  shopping: "var(--chart-shopping)",
  transport: "var(--chart-transport)",
  home: "var(--chart-home)",
  entertainment: "var(--chart-entertainment)",
  health: "var(--chart-health)",
  other: "var(--chart-other)",
};

function CategoryIcon({ category }: { category: CategoryId }) {
  const Icon = categoryIcons[category];
  return (
    <span
      className="transaction-icon"
      style={{ color: categoryColors[category], background: `color-mix(in srgb, ${categoryColors[category]} 8%, var(--surface))` }}
      aria-hidden="true"
    >
      <Icon size={18} strokeWidth={1.8} />
    </span>
  );
}

const russianPlural = new Intl.PluralRules("ru");

function itemLabel(count: number, language: Language) {
  if (language === "en") return count === 1 ? "item" : "items";
  const form = russianPlural.select(count);
  return form === "one" ? "покупка" : form === "few" ? "покупки" : "покупок";
}

export default function TransactionTable({
  items,
  compact = false,
  language,
  onOpen,
  onEdit,
  onDelete,
  pageSize = 50,
  paginationKey,
}: TransactionTableProps) {
  const tr = (text: string) => translate(language, text);
  const size = Math.max(1, Math.floor(pageSize) || 50);
  const filterKey = useMemo(() => paginationKey ?? items.map((item) => item.id).join("\u0000"), [paginationKey, items]);
  const [position, setPosition] = useState({ key: filterKey, page: 1 });
  const pages = compact ? 1 : Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(position.key === filterKey ? position.page : 1, pages);
  // Clamp after deletions and reset only when the meaningful filter key changes.
  useEffect(() => {
    setPosition((current) => current.key === filterKey && current.page === page
      ? current
      : { key: filterKey, page });
  }, [filterKey, page]);
  const offset = compact ? 0 : (page - 1) * size;
  const visible = compact ? items : items.slice(offset, offset + size);
  const summary = language === "en"
    ? `Showing records ${items.length ? offset + 1 : 0}–${offset + visible.length} of ${items.length}`
    : `Записи ${items.length ? offset + 1 : 0}–${offset + visible.length} из ${items.length}`;
  const pageLabel = language === "en" ? `Page ${page} of ${pages}` : `Страница ${page} из ${pages}`;

  return (
    <div className="transaction-table-section">
      <div className="table-wrap">
        <table className="transaction-table">
          <thead>
            <tr>
              <th>{tr("Название")}</th>
              <th>{tr("Категория")}</th>
              <th>{tr("Дата")}</th>
              <th className="amount-cell">{tr("Сумма")}</th>
              <th><span className="sr-only">{tr("Действия")}</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((transaction) => (
              <tr key={transaction.id}>
                <td>
                  <button
                    type="button"
                    className="transaction-open"
                    onClick={() => onOpen(transaction.id)}
                    aria-label={`${tr("Открыть запись")}: ${transaction.title}`}
                  >
                    <CategoryIcon category={transaction.category} />
                    <div>
                      <span className="transaction-name">{transaction.title}</span>
                      {(transaction.items?.length ?? 0) > 0 && (
                        <small className="item-count">
                          <ListChecks size={12} aria-hidden="true" />
                          {transaction.items!.length} {itemLabel(transaction.items!.length, language)}
                        </small>
                      )}
                      {transaction.note && !compact && (
                        <small className="transaction-note">{transaction.note}</small>
                      )}
                    </div>
                  </button>
                </td>
                <td>
                  <span className="category-badge">
                    {tr(CATEGORIES.find((category) => category.id === transaction.category)?.label ?? "")}
                  </span>
                </td>
                <td className="text-muted date-cell">{formatDate(transaction.date, language)}</td>
                <td className="amount-cell">
                  <span className="transaction-amount">−{formatMoney(transaction.amount, transaction.currency, language)}</span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onEdit(transaction)}
                      aria-label={`${tr("Изменить")} ${transaction.title}`}
                      title={tr("Изменить")}
                    ><Pencil size={15} /></button>
                    <button
                      type="button"
                      className="icon-button delete-action"
                      onClick={() => onDelete(transaction)}
                      aria-label={`${tr("Удалить")} ${transaction.title}`}
                      title={tr("Удалить")}
                    ><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!compact && (
        <nav className="table-pagination" aria-label={language === "en" ? "Expense history pages" : "Страницы журнала расходов"}>
          <span className="table-pagination-summary" role="status" aria-live="polite" aria-atomic="true">{summary}</span>
          {pages > 1 && (
            <div className="table-pagination-controls">
              <button
                type="button"
                className="icon-button"
                disabled={page === 1}
                aria-label={language === "en" ? "Previous page" : "Предыдущая страница"}
                onClick={() => setPosition({ key: filterKey, page: page - 1 })}
              ><ChevronLeft size={18} /></button>
              <span>{pageLabel}</span>
              <button
                type="button"
                className="icon-button"
                disabled={page === pages}
                aria-label={language === "en" ? "Next page" : "Следующая страница"}
                onClick={() => setPosition({ key: filterKey, page: page + 1 })}
              ><ChevronRight size={18} /></button>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}
