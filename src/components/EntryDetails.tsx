import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  Check,
  FileText,
  ListChecks,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { CATEGORIES, formatMoney, getItemTotal } from "../lib/finance";
import type { Language, Transaction, TransactionItem } from "../lib/finance";
import { translate } from "../lib/i18n";

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
  onChange: (value: Transaction) => void;
  onClose: () => void;
  onEdit: () => void;
  onExport: () => void;
}) {
  const tr = (text: string) => translate(language, text);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const items = transaction.items ?? [];
  const itemTotal = getItemTotal(transaction);
  const remaining = Math.round((transaction.amount - itemTotal) * 100) / 100;
  const money = (value: number) =>
    formatMoney(value, transaction.currency, language);
  function updateItems(next: TransactionItem[]) {
    const nextTotal = getItemTotal({ items: next });
    if (Math.round(nextTotal * 100) > Math.round(transaction.amount * 100)) {
      setError(tr("Сумма покупок не может превышать общую сумму записи."));
      return false;
    }
    onChange({ ...transaction, items: next });
    setError("");
    return true;
  }
  function addItem(event: FormEvent) {
    event.preventDefault();
    const numeric = Math.round(Number(amount.replace(",", ".")) * 100) / 100;
    if (
      !title.trim() ||
      !Number.isFinite(numeric) ||
      numeric < 0.01 ||
      numeric > 1e12
    ) {
      setError(tr("Укажите название и сумму не меньше 0,01."));
      return;
    }
    if (items.length >= 200) {
      setError(tr("В одной записи может быть не больше 200 покупок."));
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
          <span className="dialog-eyebrow">
            {tr("СУДОВОЙ ЖУРНАЛ · ДЕТАЛИ ЗАПИСИ")}
          </span>
          <h2>{transaction.title}</h2>
        </div>
        <button
          className="icon-button modal-close"
          type="button"
          onClick={onClose}
          aria-label={tr("Закрыть")}
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
              CATEGORIES.find((c) => c.id === transaction.category)?.label ??
                "",
            )}
          </span>
        </div>
        {transaction.note && <p className="detail-note">{transaction.note}</p>}
      </div>
      <div className="items-header">
        <h3>{tr("Что было в покупке")}</h3>
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
              onSave={(next) =>
                updateItems(items.map((i) => (i.id === item.id ? next : i)))
              }
              onDelete={() =>
                updateItems(items.filter((i) => i.id !== item.id))
              }
            />
          ))}
        </ul>
      ) : (
        <div className="items-empty">
          <ListChecks />
          <p>
            {tr(
              "Здесь можно расшифровать покупку: батон, филе и всё остальное.",
            )}
          </p>
        </div>
      )}
      <form className="add-item-form" onSubmit={addItem}>
        <label>
          {tr("Название покупки")}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr("Например, батон")}
            required
            maxLength={160}
          />
        </label>
        <label>
          {tr("Сумма")} · {transaction.currency}
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
          {tr("Добавить")}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="item-total-row">
        <span>{tr("Расшифровано")}</span>
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
        <span>{tr("Осталось расшифровать")}</span>
        <strong>{money(Math.max(0, remaining))}</strong>
      </div>
      <div className="detail-autosave">
        <ShieldCheck size={14} />
        {tr("Покупки сохраняются сразу после добавления или изменения.")}
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
          {tr("Изменить запись")}
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={onClose}
        >
          <Check size={16} />
          {tr("Готово")}
        </button>
      </div>
    </div>
  );
}
function ItemRow({
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
  onDelete: () => void;
}) {
  const tr = (text: string) => translate(language, text);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [amount, setAmount] = useState(String(item.amount));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!editing) {
      setTitle(item.title);
      setAmount(String(item.amount));
    }
  }, [item, editing]);
  function submit(e: FormEvent) {
    e.preventDefault();
    const numeric = Math.round(Number(amount.replace(",", ".")) * 100) / 100;
    if (
      !title.trim() ||
      !Number.isFinite(numeric) ||
      numeric < 0.01 ||
      numeric > 1e12
    ) {
      setError(tr("Укажите название и сумму не меньше 0,01."));
      return;
    }
    if (onSave({ ...item, title: title.trim(), amount: numeric })) {
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
              {tr("Название покупки")}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={160}
              />
            </label>
            <label>
              {tr("Сумма")} · {currency}
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
            aria-label={tr("Сохранить покупку")}
            title={tr("Сохранить покупку")}
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
            aria-label={tr("Отмена")}
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
            onClick={() => setEditing(true)}
            aria-label={`${tr("Изменить покупку")}: ${item.title}`}
            title={tr("Изменить покупку")}
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className="icon-button delete-action"
            onClick={onDelete}
            aria-label={`${tr("Удалить покупку")}: ${item.title}`}
            title={tr("Удалить покупку")}
          >
            <Trash2 size={15} />
          </button>
        </>
      )}
    </li>
  );
}
