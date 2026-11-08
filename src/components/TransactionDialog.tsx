import { useState } from "react";
import {
  Check,
  X,
  Utensils,
  ShoppingBag,
  Car,
  Home,
  Clapperboard,
  HeartPulse,
  Ellipsis,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CATEGORIES,
  CURRENCIES,
  todayString,
  getItemTotal,
} from "../lib/finance";
import type { CategoryId, Currency, Transaction } from "../lib/finance";
import { parseMoney } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import Button from "./Button";

const categoryIcons: Record<CategoryId, LucideIcon> = {
  food: Utensils,
  shopping: ShoppingBag,
  transport: Car,
  home: Home,
  entertainment: Clapperboard,
  health: HeartPulse,
  other: Ellipsis,
};

export default function TransactionDialog({
  value,
  defaultCurrency,
  onClose,
  onSave,
  onReload,
}: {
  value: Transaction | null;
  defaultCurrency: Currency;
  onClose: () => void;
  onSave: (value: Transaction) => true | string;
  onReload?: () => void;
}) {
  const { language, tr } = useI18n();
  const [title, setTitle] = useState(value?.title ?? "");
  const [amount, setAmount] = useState(value?.amount.toString() ?? "");
  const [currency, setCurrency] = useState<Currency>(
    value?.currency ?? defaultCurrency,
  );
  const [category, setCategory] = useState<CategoryId>(
    value?.category ?? "food",
  );
  const [date, setDate] = useState(value?.date ?? todayString());
  const [note, setNote] = useState(value?.note ?? "");
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const numeric =
          value && amount === String(value.amount)
            ? value.amount
            : parseMoney(amount);
        if (
          !title.trim() ||
          numeric === null ||
          numeric <= 0 ||
          numeric > 1e12 ||
          !date ||
          date < "1900-01-01" ||
          date > "2200-12-31"
        ) {
          setError("Укажите название, корректную дату и сумму не меньше 0,01.");
          return;
        }
        if (
          value &&
          Math.round(getItemTotal(value) * 100) > Math.round(numeric * 100)
        ) {
          setError(
            "Общая сумма меньше суммы покупок внутри записи. Сначала измените состав.",
          );
          return;
        }
        const result = onSave({
          ...value,
          createdAt: value ? value.createdAt : todayString(),
          id:
            value?.id ??
            globalThis.crypto?.randomUUID?.() ??
            `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
          title: title.trim(),
          amount: Math.round(numeric * 100) / 100,
          currency,
          category,
          date,
          note: value && note === (value.note ?? "") ? value.note : note.trim(),
        });
        if (result !== true) setError(result);
      }}
    >
      <div className="dialog-header">
        <div>
          <h2>
            {value ? tr("Изменить расход") : tr("Новый расход")}
            <span className="heading-dot">.</span>
          </h2>
        </div>
        <button
          type="button"
          className="icon-button modal-close"
          aria-label={tr("Закрыть")}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      <div className="form-grid">
        <label className="field full-width">
          <span className="field-label">{tr("На что потратили?")}</span>
          <input
            className="form-input"
            placeholder={tr("Например, кофе и круассан")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={160}
          />
        </label>
        <label className="field amount-field">
          <span className="field-label">{tr("Сумма")}</span>
          <input
            className="form-input amount-input"
            type="text"
            inputMode="decimal"
            placeholder={language === "en" ? "0.00" : "0,00"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            maxLength={18}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">{tr("Валюта")}</span>
          <select
            className="form-input currency-input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} {c.symbol}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="field full-width category-fieldset">
          <legend className="field-label">{tr("Категория")}</legend>
          <div className="category-picker">
            {CATEGORIES.map((c) => {
              const Icon = categoryIcons[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`category-option ${category === c.id ? "is-selected" : ""}`}
                  onClick={() => setCategory(c.id)}
                  aria-pressed={category === c.id}
                >
                  <Icon size={17} />
                  <span>{tr(c.label)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="field full-width">
          <span className="field-label">{tr("Дата покупки")}</span>
          <input
            type="date"
            className="form-input"
            value={date}
            min="1900-01-01"
            max="2200-12-31"
            required
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="field full-width">
          <span className="field-label">
            {tr("Заметка")} <small>{tr("необязательно")}</small>
          </span>
          <textarea
            className="form-input"
            rows={2}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {tr(error)}
        </p>
      )}
      {error && onReload && (
        <Button onClick={onReload}>{tr("Загрузить актуальную запись")}</Button>
      )}
      <div className="dialog-footer">
        <Button onClick={onClose}>{tr("Отмена")}</Button>
        <Button variant="primary" type="submit">
          <Check size={17} />
          {value ? tr("Сохранить") : tr("Добавить расход")}
        </Button>
      </div>
    </form>
  );
}
