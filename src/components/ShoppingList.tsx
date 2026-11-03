import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Check, CheckCheck, ListChecks, Plus, Trash2 } from "lucide-react";
import { CURRENCIES, formatMoney } from "../lib/finance";
import type { Currency, Language, ShoppingItem, Transaction } from "../lib/finance";
import { parseShoppingPrice } from "../lib/shopping";
import "./ShoppingList.css";

interface ShoppingListProps {
  items: ShoppingItem[];
  transactions: Transaction[];
  defaultCurrency: Currency;
  language: Language;
  onAdd: (title: string, currency: Currency) => boolean;
  onPriceChange: (id: string, amount: number, currency: Currency) => boolean;
  onUpdate: (id: string, patch: { title?: string; currency?: Currency }) => boolean;
  onRemove: (id: string) => boolean;
}

const copy = {
  ru: {
    heading: "Список покупок",
    product: "Что купить",
    placeholder: "Например, хлеб и молоко",
    currency: "Валюта",
    add: "Добавить",
    addError: "Не удалось добавить продукт. Проверьте доступность хранилища и попробуйте ещё раз.",
    nameError: "Напишите название продукта.",
    pending: "В плане",
    purchased: "Куплено",
    all: "Всё",
    filters: "Показать покупки",
    totals: "Стоимость купленного",
    empty: "Собираемся за продуктами?",
    emptyDescription: "Добавьте первый продукт выше. Цену можно вписать после покупки — она сохранится сама.",
    emptyFilter: "Здесь пока нет продуктов",
    emptyPending: "Все продукты из списка уже куплены.",
    emptyPurchased: "Впишите цену рядом с продуктом, и он появится здесь.",
    explanation: "Продукты с ценой уже учтены в журнале расходов, в категории «Еда и продукты». Удаление строки из списка сохраняет запись о расходе.",
    auto: "Сохраняется автоматически",
    saving: "Сохраняем…",
    saved: "Сохранено",
    price: "Цена",
    pricePlaceholder: "Цена",
    priceError: "Введите цену от 0,01 до 1 000 000 000 000, не больше двух знаков после запятой.",
    saveError: "Не удалось сохранить. Измените значение или выйдите из поля, чтобы повторить.",
    remove: "Удалить из списка",
    title: "Название продукта",
    list: "Продукты в списке покупок",
  },
  en: {
    heading: "Shopping list",
    product: "What to buy",
    placeholder: "For example, bread and milk",
    currency: "Currency",
    add: "Add",
    addError: "Unable to add this item. Check that browser storage is available and try again.",
    nameError: "Enter a product name.",
    pending: "Planned",
    purchased: "Purchased",
    all: "All",
    filters: "Show purchases",
    totals: "Purchased total",
    empty: "Getting ready for groceries?",
    emptyDescription: "Add your first product above. Enter the price after buying it — it saves automatically.",
    emptyFilter: "No products here yet",
    emptyPending: "Everything on your list has been purchased.",
    emptyPurchased: "Enter a price beside a product to see it here.",
    explanation: "Products with a price are already included in the expense journal under Food & groceries. Removing a row keeps its expense record.",
    auto: "Saves automatically",
    saving: "Saving…",
    saved: "Saved",
    price: "Price",
    pricePlaceholder: "Price",
    priceError: "Enter a price from 0.01 to 1,000,000,000,000, with up to two decimal places.",
    saveError: "Unable to save. Edit the value or leave the field to try again.",
    remove: "Remove from list",
    title: "Product name",
    list: "Shopping list products",
  },
};

type Filter = "all" | "pending" | "purchased";
type SaveStatus = "idle" | "saving" | "saved" | "failed";
type RegisterFlush = (id: string, flush: (() => void) | null) => void;
const SAVE_DELAY = 600;

export default function ShoppingList({
  items, transactions, defaultCurrency, language, onAdd, onPriceChange, onUpdate, onRemove,
}: ShoppingListProps) {
  const text = copy[language];
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [error, setError] = useState<"name" | "save" | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const addId = useId();
  const flushers = useRef(new Map<string, () => void>());
  const registerFlush = useCallback<RegisterFlush>((id, flush) => {
    if (flush) flushers.current.set(id, flush);
    else flushers.current.delete(id);
  }, []);

  useEffect(() => { setCurrency(defaultCurrency); }, [defaultCurrency]);
  useEffect(() => {
    const flush = () => { for (const save of flushers.current.values()) save(); };
    const visibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const transactionMap = useMemo(
    () => new Map(transactions.map((transaction) => [transaction.id, transaction])),
    [transactions],
  );
  const purchased = items.filter((item) => item.transactionId && transactionMap.has(item.transactionId));
  const pendingCount = items.length - purchased.length;
  const visible = items.filter((item) => {
    const paid = Boolean(item.transactionId && transactionMap.has(item.transactionId));
    return filter === "all" || (filter === "purchased" ? paid : !paid);
  });
  const totals = CURRENCIES.map(({ code }) => ({
    currency: code,
    amount: purchased.reduce((total, item) => {
      const transaction = transactionMap.get(item.transactionId!);
      return total + (transaction?.currency === code ? Math.round(transaction.amount * 100) : 0);
    }, 0) / 100,
  })).filter(({ amount }) => amount > 0);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("name");
      inputRef.current?.focus();
      return;
    }
    if (!onAdd(title.trim(), currency)) {
      setError("save");
      return;
    }
    setTitle("");
    setError(null);
    setFilter("all");
    inputRef.current?.focus();
  }

  return (
    <section className="shopping-page" aria-labelledby={`${addId}-heading`}>
      <h2 id={`${addId}-heading`} className="shopping-sr-only">{text.heading}</h2>

      <div className="shopping-ledger panel">
        <form className="shopping-add-form" onSubmit={add} noValidate>
          <div className="shopping-add-name">
            <label htmlFor={`${addId}-product`}>{text.product}</label>
            <input
              ref={inputRef}
              id={`${addId}-product`}
              name="product"
              className="form-input"
              value={title}
              onChange={(event) => { setTitle(event.target.value); setError(null); }}
              placeholder={text.placeholder}
              maxLength={160}
              autoComplete="off"
              aria-invalid={error === "name" || undefined}
              aria-describedby={error ? `${addId}-error` : undefined}
            />
          </div>
          <div className="shopping-add-money">
            <label htmlFor={`${addId}-currency`}>{text.currency}</label>
            <select id={`${addId}-currency`} className="form-input shopping-add-currency" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
              {CURRENCIES.map(({ code }) => <option key={code} value={code}>{code}</option>)}
            </select>
          </div>
          <button className="button button-primary shopping-add-button" type="submit"><Plus size={17} aria-hidden="true" /> {text.add}</button>
          {error && <p id={`${addId}-error`} className="shopping-form-error" role="alert">{error === "name" ? text.nameError : text.addError}</p>}
        </form>

        <div className="shopping-summary">
          <div className="shopping-counts">
            <span><span className="shopping-count-dot" /> {text.pending} <strong>{pendingCount}</strong></span>
            <span><CheckCheck size={14} aria-hidden="true" /> {text.purchased} <strong>{purchased.length}</strong></span>
          </div>
          <span className="shopping-auto"><Check size={12} aria-hidden="true" /> {text.auto}</span>
        </div>

        {items.length > 0 && <div className="shopping-filters" role="group" aria-label={text.filters}>
          {(["all", "pending", "purchased"] as const).map((value) => <button
            className="shopping-filter" key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
          >{text[value]}</button>)}
        </div>}

        {visible.length ? <ul className="shopping-items" aria-label={text.list}>
          {visible.map((item) => <ShoppingRow
            key={item.id}
            item={item}
            transaction={item.transactionId ? transactionMap.get(item.transactionId) : undefined}
            language={language}
            onPriceChange={onPriceChange}
            onUpdate={onUpdate}
            onRemove={onRemove}
            registerFlush={registerFlush}
          />)}
        </ul> : <div className="shopping-empty">
          <ListChecks size={34} strokeWidth={1.35} aria-hidden="true" />
          <h3>{items.length ? text.emptyFilter : text.empty}</h3>
          <p>{items.length ? (filter === "pending" ? text.emptyPending : text.emptyPurchased) : text.emptyDescription}</p>
        </div>}

        {totals.length > 0 && <div className="shopping-totals" aria-label={text.totals}>
          <span>{text.totals}</span>
          <div>{totals.map(({ currency: code, amount }) => <strong key={code}>{formatMoney(amount, code, language)} <small>{code}</small></strong>)}</div>
        </div>}
      </div>
      <p className="shopping-explanation">{text.explanation}</p>
    </section>
  );
}

function ShoppingRow({ item, transaction, language, onPriceChange, onUpdate, onRemove, registerFlush }: {
  item: ShoppingItem;
  transaction?: Transaction;
  language: Language;
  onPriceChange: ShoppingListProps["onPriceChange"];
  onUpdate: ShoppingListProps["onUpdate"];
  onRemove: ShoppingListProps["onRemove"];
  registerFlush: RegisterFlush;
}) {
  const text = copy[language];
  const id = useId();
  const initialCurrency = transaction?.currency ?? item.currency;
  const [title, setTitle] = useState(item.title);
  const [price, setPrice] = useState(transaction ? String(transaction.amount) : "");
  const [currency, setCurrency] = useState(initialCurrency);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [priceError, setPriceError] = useState<"invalid" | "save" | null>(null);
  const [titleError, setTitleError] = useState<"invalid" | "save" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discarded = useRef(false);
  const focused = useRef({ price: false, title: false });
  const latest = useRef({ item, transaction, onPriceChange, onUpdate });
  latest.current = { item, transaction, onPriceChange, onUpdate };
  const draft = useRef({ title: item.title, price: transaction ? String(transaction.amount) : "", currency: initialCurrency, priceDirty: false, currencyDirty: false, titleDirty: false });
  const saved = useRef({ title: item.title, amount: transaction?.amount ?? null, currency: initialCurrency });

  // A prop refresh must never erase an unfinished or invalid draft.
  useEffect(() => {
    const current = draft.current;
    if (!current.titleDirty && !focused.current.title) {
      current.title = item.title;
      saved.current.title = item.title;
      setTitle(item.title);
    }
    if (!current.priceDirty && !current.currencyDirty && !focused.current.price) {
      current.price = transaction ? String(transaction.amount) : "";
      current.currency = transaction?.currency ?? item.currency;
      saved.current.amount = transaction?.amount ?? null;
      saved.current.currency = current.currency;
      setPrice(current.price);
      setCurrency(current.currency);
    }
  }, [item.title, item.currency, transaction?.id, transaction?.amount, transaction?.currency]);

  function cancelTimer() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }

  function saveTitle() {
    if (discarded.current || !draft.current.titleDirty) return;
    const next = draft.current.title.trim();
    if (!next) { setTitleError("invalid"); return; }
    if (next === saved.current.title) {
      draft.current.titleDirty = false;
      setTitleError(null);
      return;
    }
    const current = latest.current;
    if (current.onUpdate(current.item.id, { title: next })) {
      saved.current.title = next;
      draft.current.title = next;
      draft.current.titleDirty = false;
      setTitle(next);
      setTitleError(null);
      setStatus("saved");
    } else {
      setTitleError("save");
      setStatus("failed");
    }
  }

  function savePrice() {
    cancelTimer();
    if (discarded.current) return;
    const current = draft.current;
    if (!current.priceDirty && !current.currencyDirty) return;
    const amount = parseShoppingPrice(current.price);
    const callbacks = latest.current;
    if (amount === null) {
      // A planned product can keep an empty price while its currency is saved.
      setPriceError(current.price.trim() || callbacks.transaction ? "invalid" : null);
      if (current.currencyDirty) {
        if (callbacks.onUpdate(callbacks.item.id, { currency: current.currency })) {
          saved.current.currency = current.currency;
          current.currencyDirty = false;
          setStatus("saved");
        } else {
          setPriceError("save");
          setStatus("failed");
        }
      } else setStatus("idle");
      return;
    }
    if (amount === saved.current.amount && current.currency === saved.current.currency) {
      current.priceDirty = false;
      current.currencyDirty = false;
      setPriceError(null);
      setStatus("saved");
      return;
    }
    if (callbacks.onPriceChange(callbacks.item.id, amount, current.currency)) {
      saved.current.amount = amount;
      saved.current.currency = current.currency;
      current.priceDirty = false;
      current.currencyDirty = false;
      setPriceError(null);
      setStatus("saved");
    } else {
      setPriceError("save");
      setStatus("failed");
    }
  }

  const flush = useRef(() => {});
  flush.current = () => { saveTitle(); savePrice(); };
  useEffect(() => {
    registerFlush(item.id, () => flush.current());
    return () => {
      flush.current();
      registerFlush(item.id, null);
    };
  }, [item.id, registerFlush]);

  function queuePriceSave() {
    cancelTimer();
    const current = draft.current;
    const amount = parseShoppingPrice(current.price);
    const invalid = amount === null && Boolean(current.price.trim() || latest.current.transaction);
    setPriceError(invalid ? "invalid" : null);
    if (amount !== null || current.currencyDirty) {
      setStatus("saving");
      timer.current = setTimeout(() => { savePrice(); }, SAVE_DELAY);
    } else setStatus("idle");
  }

  function isRowControl(target: EventTarget | null) {
    return target instanceof HTMLElement && Boolean(target.closest(".shopping-currency, .shopping-remove"));
  }

  const stateText = status === "saving" ? text.saving : status === "saved" ? text.saved : "";
  return (
    <li className={`shopping-item${transaction ? " shopping-item-purchased" : ""}`} data-shopping-item={item.id}>
      <span className="shopping-item-marker" aria-hidden="true">{transaction ? <Check size={15} /> : <span />}</span>
      <div className="shopping-item-name">
        <input
          className="shopping-title-input"
          aria-label={`${text.title}: ${item.title}`}
          aria-invalid={Boolean(titleError) || undefined}
          aria-describedby={titleError ? `${id}-title-error` : undefined}
          value={title}
          maxLength={160}
          onFocus={() => { focused.current.title = true; }}
          onChange={(event) => {
            draft.current.title = event.target.value;
            draft.current.titleDirty = true;
            setTitle(event.target.value);
            setTitleError(null);
          }}
          onBlur={(event) => {
            focused.current.title = false;
            if (!(event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest(".shopping-remove"))) saveTitle();
          }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveTitle(); } }}
        />
        <span className="shopping-item-state">{transaction ? text.purchased : text.pending}</span>
        {titleError && <span className="shopping-row-error" id={`${id}-title-error`} role="alert">{titleError === "invalid" ? text.nameError : text.saveError}</span>}
      </div>
      <div className="shopping-item-price">
        <label className="shopping-sr-only" htmlFor={`${id}-price`}>{text.price}: {item.title}</label>
        <input
          id={`${id}-price`}
          className="form-input shopping-price-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={text.pricePlaceholder}
          value={price}
          aria-invalid={Boolean(priceError) || undefined}
          aria-describedby={priceError ? `${id}-price-error` : `${id}-save-status`}
          onFocus={() => { focused.current.price = true; }}
          onChange={(event) => {
            draft.current.price = event.target.value;
            draft.current.priceDirty = true;
            setPrice(event.target.value);
            queuePriceSave();
          }}
          onBlur={(event) => { focused.current.price = false; if (!isRowControl(event.relatedTarget)) savePrice(); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); savePrice(); } }}
        />
        <label className="shopping-sr-only" htmlFor={`${id}-currency`}>{text.currency}: {item.title}</label>
        <select
          id={`${id}-currency`}
          className="form-input shopping-currency"
          value={currency}
          onChange={(event) => {
            const next = event.target.value as Currency;
            draft.current.currency = next;
            draft.current.currencyDirty = true;
            setCurrency(next);
            queuePriceSave();
          }}
          onBlur={(event) => { if (!(event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest(".shopping-remove"))) savePrice(); }}
        >{CURRENCIES.map(({ code }) => <option key={code} value={code}>{code}</option>)}</select>
        <span className="shopping-save-status" id={`${id}-save-status`} role="status" aria-live="polite">{!priceError && stateText}</span>
      </div>
      <button
        className="shopping-remove"
        type="button"
        aria-label={`${text.remove}: ${item.title}`}
        onClick={() => {
          discarded.current = true;
          cancelTimer();
          if (!onRemove(item.id)) discarded.current = false;
        }}
      ><Trash2 size={17} aria-hidden="true" /></button>
      {priceError && <p className="shopping-row-error shopping-price-error" id={`${id}-price-error`} role="alert">{priceError === "invalid" ? text.priceError : text.saveError}</p>}
    </li>
  );
}
