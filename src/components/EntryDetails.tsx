import type { MessageKey } from "../lib/messages";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  Check,
  FileText,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { CATEGORIES, formatMoney, getItemTotal } from "../lib/finance";
import type { Language, Transaction, TransactionItem } from "../lib/finance";
import { translate } from "../lib/i18n";
import { parseMoney } from "../lib/storage/storage";

const EMPTY_ITEMS: TransactionItem[] = [];

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export default function EntryDetails({
  transaction,
  language,
  onChange,
  onClose,
  onEdit,
  onExport,
}: {
  transaction: Transaction;
  language: Language;
  onChange: (value: Transaction) => boolean;
  onClose: () => void;
  onEdit: () => void;
  onExport: () => void;
}) {
  const tr = (text: MessageKey) => translate(language, text);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const items = transaction.items ?? EMPTY_ITEMS;
  const itemTotal = useMemo(() => getItemTotal(transaction), [transaction]);
  const remaining = Math.round((transaction.amount - itemTotal) * 100) / 100;
  const money = (value: number) =>
    formatMoney(value, transaction.currency, language);
  const updateItems = useCallback((next: TransactionItem[]) => {
    const tr = (text: MessageKey) => translate(language, text);
    const nextTotal = getItemTotal({ items: next });
    if (Math.round(nextTotal * 100) > Math.round(transaction.amount * 100)) {
      setError(tr("ui.theItemTotalCannotExceedTheRecordAmount"));
      return false;
    }
    if (!onChange({ ...transaction, items: next })) {
      setError(tr("ui.changesWereNotSavedCheckTheCurrentDataAndTryAgain"));
      return false;
    }
    setError("");
    return true;
  }, [transaction, onChange, language]);
  const saveItem = useCallback((next: TransactionItem) =>
    updateItems(items.map((item) => item.id === next.id ? next : item)), [items, updateItems]);
  const deleteItem = useCallback((id: string) =>
    updateItems(items.filter((item) => item.id !== id)), [items, updateItems]);
  function addItem(event: FormEvent) {
    event.preventDefault();
    const numeric = parseMoney(amount);
    if (
      !title.trim() ||
      numeric === null ||
      numeric < 0.01 ||
      numeric > 1e12
    ) {
      setError(tr("ui.enterATitleAndAnAmountOfAtLeast001"));
      return;
    }
    if (items.length >= 200) {
      setError(tr("ui.aRecordCanContainUpTo200Items"));
      return;
    }
    if (
      updateItems([
        ...items,
        { id: makeId(), title: title.trim(), amount: numeric },
      ])
    ) {
      setTitle("");
      setAmount("");
    }
  }
  return (
    <div className="entry-details">
      <div className="dialog-header">
        <div>
          <h2>{transaction.title}</h2>
        </div>
        <button
          className="icon-button modal-close"
          type="button"
          onClick={onClose}
          aria-label={tr("common.close")}
        >
          <X size={21} />
        </button>
      </div>
      <div className="detail-summary">
        <strong>{money(transaction.amount)}</strong>
        <div className="detail-meta">
          <span>
            <CalendarDays size={14} />
            {new Date(`${transaction.date}T12:00:00`).toLocaleDateString(
              language === "en" ? "en-US" : "ru-RU",
              { day: "numeric", month: "long", year: "numeric" },
            )}
          </span>
          <span>·</span>
          <span>
            {tr(
              CATEGORIES.find((c) => c.id === transaction.category)?.labelKey ??
                "category.other",
            )}
          </span>
        </div>
        {transaction.note && <p className="detail-note">{transaction.note}</p>}
      </div>
      <div className="items-header">
        <h3>{tr("ui.whatYouBought")}</h3>
        <span>{items.length} / 200</span>
      </div>
      {items.length ? (
        <ul className="items-list">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              language={language}
              currency={transaction.currency}
              onSave={saveItem}
              onDelete={deleteItem}
            />
          ))}
        </ul>
      ) : null}
      <form className="add-item-form" onSubmit={addItem}>
        <label>
          {tr("ui.itemName")}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr("ui.forExampleBread")}
            required
            maxLength={160}
          />
        </label>
        <label>
          {tr("ui.amount")} · {transaction.currency}
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            required
            maxLength={18}
          />
        </label>
        <button
          type="submit"
          className="button button-primary"
          disabled={items.length >= 200}
        >
          <Plus size={16} />
          {tr("common.add")}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="item-total-row">
        <span>{tr("ui.itemized")}</span>
        <strong>
          {money(itemTotal)} / {money(transaction.amount)}
        </strong>
      </div>
      <div className="item-progress">
        <span
          style={{
            width: `${Math.min(100, (itemTotal / transaction.amount) * 100)}%`,
          }}
        />
      </div>
      <div className="item-total-summary">
        <span>{tr("ui.leftToItemize")}</span>
        <strong>{money(Math.max(0, remaining))}</strong>
      </div>
      <div className="detail-autosave">
        <ShieldCheck size={14} />
        {tr("ui.autosave")}
      </div>
      <div className="dialog-footer">
        <button
          type="button"
          className="button button-secondary"
          onClick={onExport}
        >
          <FileText size={16} />
          PDF
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={onEdit}
        >
          <Pencil size={15} />
          {tr("ui.editRecord")}
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={onClose}
        >
          <Check size={16} />
          {tr("common.done")}
        </button>
      </div>
    </div>
  );
}
const ItemRow = memo(function ItemRow({
  item,
  language,
  currency,
  onSave,
  onDelete,
}: {
  item: TransactionItem;
  language: Language;
  currency: Transaction["currency"];
  onSave: (next: TransactionItem) => boolean;
  onDelete: (id: string) => void;
}) {
  const tr = (text: MessageKey) => translate(language, text);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [amount, setAmount] = useState(String(item.amount));
  const [error, setError] = useState("");
  const baseline = useRef(item);
  useEffect(() => {
    if (!editing) {
      setTitle(item.title);
      setAmount(String(item.amount));
    }
  }, [item, editing]);
  function submit(e: FormEvent) {
    e.preventDefault();
    const numeric = parseMoney(amount);
    if (
      !title.trim() ||
      numeric === null ||
      numeric < 0.01 ||
      numeric > 1e12
    ) {
      setError(tr("ui.enterATitleAndAnAmountOfAtLeast001"));
      return;
    }
    const changedTitle = title.trim() !== baseline.current.title;
    const changedAmount = numeric !== baseline.current.amount;
    if ((changedTitle && item.title !== baseline.current.title && item.title !== title.trim()) ||
        (changedAmount && item.amount !== baseline.current.amount && item.amount !== numeric)) {
      setError(tr("ui.thisItemChangedInAnotherTabCancelEditingAndOpenItAgain"));
      return;
    }
    if (onSave({ ...item, title: changedTitle ? title.trim() : item.title, amount: changedAmount ? numeric : item.amount })) {
      setEditing(false);
      setError("");
    }
  }
  return (
    <li className="purchase-item">
      {editing ? (
        <form className="item-edit-form" onSubmit={submit}>
          <div className="item-fields">
            <label>
              {tr("ui.itemName")}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={160}
              />
            </label>
            <label>
              {tr("ui.amount")} · {currency}
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                maxLength={18}
              />
            </label>
          </div>
          <button
            type="submit"
            className="icon-button"
            aria-label={tr("ui.saveItem")}
            title={tr("ui.saveItem")}
          >
            <Check size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setTitle(item.title);
              setAmount(String(item.amount));
              setEditing(false);
              setError("");
            }}
            aria-label={tr("common.cancel")}
          >
            <X size={17} />
          </button>
          {error && <span className="form-error">{error}</span>}
        </form>
      ) : (
        <>
          <span className="purchase-item-title">{item.title}</span>
          <strong className="purchase-item-amount">
            {formatMoney(item.amount, currency, language)}
          </strong>
          <button
            type="button"
            className="icon-button"
            onClick={() => { baseline.current = item; setEditing(true); }}
            aria-label={`${tr("ui.editItem")}: ${item.title}`}
            title={tr("ui.editItem")}
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className="icon-button delete-action"
            onClick={() => onDelete(item.id)}
            aria-label={`${tr("ui.deleteItem")}: ${item.title}`}
            title={tr("ui.deleteItem")}
          >
            <Trash2 size={15} />
          </button>
        </>
      )}
    </li>
  );
});
