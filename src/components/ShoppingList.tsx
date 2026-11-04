import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Check, CheckCheck, ListChecks, Plus, Trash2 } from "lucide-react";
import { CURRENCIES, formatMoney } from "../lib/finance";
import type { Currency, Language, ShoppingItem, Transaction } from "../lib/finance";
import { parseShoppingPrice } from "../lib/shopping";
import "./ShoppingList.css";

export interface ShoppingPurchaseConfirmation {
  amount: number;
  currency: Currency;
  title?: string;
  base: Transaction | null;
  changed: Partial<Pick<Transaction, "title" | "amount" | "currency">>;
}

interface ShoppingListProps {
  items: ShoppingItem[];
  transactions: Transaction[];
  defaultCurrency: Currency;
  language: Language;
  onAdd: (title: string, currency: Currency) => boolean;
  onPriceChange: (id: string, amount: number, currency: Currency, base?: Transaction | null, changed?: { amount?: number; currency?: Currency }) => boolean;
  onUpdate: (id: string, patch: { title?: string; currency?: Currency }, base?: Transaction | null) => boolean;
  onRemove: (id: string) => boolean;
  onConfirm: (id: string, purchase: ShoppingPurchaseConfirmation) => boolean;
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
    emptyDescription: "Добавьте продукты, а после покупки впишите цену и подтвердите — расход сохранится, товар уйдёт из списка.",
    emptyFilter: "Здесь пока нет продуктов",
    emptyPending: "Все продукты из списка уже куплены.",
    emptyPurchased: "Впишите цену рядом с продуктом, и он появится здесь.",
    explanation: "Введите цену и нажмите «Подтвердить покупку»: товар исчезнет из списка, а расход останется в категории «Еда и продукты». Цены также сохраняются автоматически, пока вы заполняете список.",
    auto: "Сохраняется автоматически",
    saving: "Сохраняем…",
    saved: "Сохранено",
    price: "Цена",
    pricePlaceholder: "Цена",
    priceError: "Введите цену от 0,01 до 1 000 000 000 000, не больше двух знаков после запятой.",
    saveError: "Не удалось сохранить. Измените значение или выйдите из поля, чтобы повторить.",
    conflict: "Эта покупка изменена в другой вкладке. Загрузите актуальные значения или подтвердите сохранение своих изменений.",
    deletedConflict: "Связанный расход удалён в другой вкладке. Загрузите актуальные значения или подтвердите создание расхода со своей ценой.",
    loadCurrent: "Загрузить актуальные",
    keepDraft: "Сохранить мои изменения",
    remove: "Удалить из списка",
    confirm: "Подтвердить покупку",
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
    emptyDescription: "Add your groceries, then enter the price and confirm after buying. The expense stays; the item leaves your list.",
    emptyFilter: "No products here yet",
    emptyPending: "Everything on your list has been purchased.",
    emptyPurchased: "Enter a price beside a product to see it here.",
    explanation: "Enter the price and choose Confirm purchase: the item leaves your list and its expense stays under Food & groceries. Prices also save automatically while you fill in the list.",
    auto: "Saves automatically",
    saving: "Saving…",
    saved: "Saved",
    price: "Price",
    pricePlaceholder: "Price",
    priceError: "Enter a price from 0.01 to 1,000,000,000,000, with up to two decimal places.",
    saveError: "Unable to save. Edit the value or leave the field to try again.",
    conflict: "This purchase changed in another tab. Load the current values or confirm saving your changes.",
    deletedConflict: "The linked expense was deleted in another tab. Load the current values or confirm creating an expense with your price.",
    loadCurrent: "Load current values",
    keepDraft: "Keep my changes",
    remove: "Remove from list",
    confirm: "Confirm purchase",
    title: "Product name",
    list: "Shopping list products",
  },
};

type Filter = "all" | "pending" | "purchased";
type SaveStatus = "idle" | "saving" | "saved" | "failed";
type RegisterFlush = (id: string, flush: (() => void) | null) => void;
const SAVE_DELAY = 600;

export default function ShoppingList({
  items, transactions, defaultCurrency, language, onAdd, onPriceChange, onUpdate, onRemove, onConfirm,
}: ShoppingListProps) {
  const text = copy[language];
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [error, setError] = useState<"name" | "save" | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
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

  function confirm(id: string, purchase: ShoppingPurchaseConfirmation) {
    const rows = Array.from(listRef.current?.children ?? []);
    const index = rows.findIndex((row) => (row as HTMLElement).dataset.shoppingItem === id);
    const next = rows[index + 1] ?? rows[index - 1];
    if (!onConfirm(id, purchase)) return false;
    requestAnimationFrame(() => {
      const target = next?.isConnected ? next.querySelector<HTMLInputElement>(".shopping-title-input") : null;
      (target ?? inputRef.current)?.focus();
    });
    return true;
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

        {visible.length ? <ul className="shopping-items" aria-label={text.list} ref={listRef}>
          {visible.map((item) => <ShoppingRow
            key={item.id}
            item={item}
            transaction={item.transactionId ? transactionMap.get(item.transactionId) : undefined}
            language={language}
            onPriceChange={onPriceChange}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onConfirm={confirm}
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

function ShoppingRow({ item, transaction, language, onPriceChange, onUpdate, onRemove, onConfirm, registerFlush }: {
  item: ShoppingItem;
  transaction?: Transaction;
  language: Language;
  onPriceChange: ShoppingListProps["onPriceChange"];
  onUpdate: ShoppingListProps["onUpdate"];
  onRemove: ShoppingListProps["onRemove"];
  onConfirm: ShoppingListProps["onConfirm"];
  registerFlush: RegisterFlush;
}) {
  const text = copy[language];
  const id = useId();
  const initialTitle = transaction?.title ?? item.title;
  const initialCurrency = transaction?.currency ?? item.currency;
  const [title, setTitle] = useState(initialTitle);
  const [price, setPrice] = useState(transaction ? String(transaction.amount) : "");
  const [currency, setCurrency] = useState(initialCurrency);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [priceError, setPriceError] = useState<"invalid" | "save" | null>(null);
  const [titleError, setTitleError] = useState<"invalid" | "save" | null>(null);
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discarded = useRef(false);
  const focused = useRef({ price: false, title: false, currency: false });
  const latest = useRef({ item, transaction, onPriceChange, onUpdate, onConfirm });
  latest.current = { item, transaction, onPriceChange, onUpdate, onConfirm };
  const draft = useRef({ title: initialTitle, price: transaction ? String(transaction.amount) : "", currency: initialCurrency, priceDirty: false, currencyDirty: false, titleDirty: false });
  const saved = useRef({ title: initialTitle, amount: transaction?.amount ?? null, currency: initialCurrency });
  // Each field keeps the expense it was read from until its draft is saved or discarded.
  const baseline = useRef({ title: transaction ?? null, price: transaction ?? null, currency: transaction ?? null });

  function cancelTimer() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }

  function hasExternalConflict() {
    const current = latest.current;
    const value = draft.current;
    const source = current.transaction;
    const changedIdentity = (base: Transaction | null) => (base?.id ?? null) !== (source?.id ?? null);
    return (value.titleDirty && (changedIdentity(baseline.current.title) ||
      ((source?.title ?? current.item.title) !== saved.current.title && value.title.trim() !== (source?.title ?? current.item.title)))) ||
      (value.priceDirty && (changedIdentity(baseline.current.price) ||
        ((source?.amount ?? null) !== saved.current.amount && parseShoppingPrice(value.price) !== (source?.amount ?? null)))) ||
      (value.currencyDirty && (changedIdentity(baseline.current.currency) ||
        ((source?.currency ?? current.item.currency) !== saved.current.currency && value.currency !== (source?.currency ?? current.item.currency))));
  }

  function blockConflict() {
    if (!conflictRef.current && !hasExternalConflict()) return false;
    cancelTimer();
    conflictRef.current = true;
    setConflict(true);
    setStatus("idle");
    return true;
  }

  function syncUntouched() {
    const current = latest.current;
    const value = draft.current;
    if (!value.titleDirty && !focused.current.title) {
      value.title = current.transaction?.title ?? current.item.title;
      saved.current.title = value.title;
      baseline.current.title = current.transaction ?? null;
      setTitle(value.title);
    }
    if (!value.priceDirty && !focused.current.price) {
      value.price = current.transaction ? String(current.transaction.amount) : "";
      saved.current.amount = current.transaction?.amount ?? null;
      baseline.current.price = current.transaction ?? null;
      setPrice(value.price);
    }
    if (!value.currencyDirty && !focused.current.currency) {
      value.currency = current.transaction?.currency ?? current.item.currency;
      saved.current.currency = value.currency;
      baseline.current.currency = current.transaction ?? null;
      setCurrency(value.currency);
    }
  }

  // Preserve unfinished drafts; a focused, untouched field catches up as soon as it blurs.
  useEffect(() => {
    blockConflict();
    syncUntouched();
  }, [item.title, item.currency, transaction?.id, transaction?.title, transaction?.amount, transaction?.currency]);

  function saveTitle() {
    syncUntouched();
    if (discarded.current || !draft.current.titleDirty || blockConflict()) return;
    const next = draft.current.title.trim();
    if (!next) { setTitleError("invalid"); setStatus("idle"); return; }
    const current = latest.current;
    const source = baseline.current.title;
    const base = source ? { ...source, title: saved.current.title } : null;
    if (current.onUpdate(current.item.id, { title: next }, base)) {
      saved.current.title = next;
      draft.current.title = next;
      draft.current.titleDirty = false;
      baseline.current.title = current.transaction ? { ...current.transaction, title: next } : null;
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
    syncUntouched();
    if (discarded.current || blockConflict()) return;
    const value = draft.current;
    if (!value.priceDirty && !value.currencyDirty) return;
    const amount = parseShoppingPrice(value.price);
    const callbacks = latest.current;
    const invalid = amount === null && Boolean(value.price.trim() || callbacks.transaction);
    setPriceError(invalid ? "invalid" : null);
    const source = value.priceDirty ? baseline.current.price : baseline.current.currency;
    const base = source ? { ...source, amount: saved.current.amount ?? source.amount, currency: saved.current.currency } : null;
    if (amount === null || !value.priceDirty) {
      // Currency changes patch only currency, including while an invalid price is unfinished.
      if (!value.currencyDirty) { setStatus("idle"); return; }
      if (callbacks.onUpdate(callbacks.item.id, { currency: value.currency }, base)) {
        saved.current.currency = value.currency;
        baseline.current.currency = callbacks.transaction ? { ...callbacks.transaction, currency: value.currency } : null;
        value.currencyDirty = false;
        setStatus(invalid ? "idle" : "saved");
      } else {
        setPriceError("save");
        setStatus("failed");
      }
      return;
    }
    const changed = {
      amount,
      ...(value.currencyDirty ? { currency: value.currency } : {}),
    };
    if (callbacks.onPriceChange(callbacks.item.id, amount, value.currency, base, changed)) {
      saved.current.amount = amount;
      saved.current.currency = value.currency;
      baseline.current.price = callbacks.transaction ? { ...callbacks.transaction, amount, currency: value.currency } : null;
      baseline.current.currency = baseline.current.price;
      value.priceDirty = false;
      value.currencyDirty = false;
      setPriceError(null);
      setStatus("saved");
    } else {
      setPriceError("save");
      setStatus("failed");
    }
  }

  function confirmPurchase() {
    cancelTimer();
    syncUntouched();
    if (discarded.current || blockConflict()) return;
    const value = draft.current;
    const amount = parseShoppingPrice(value.price);
    if (amount === null) { setPriceError("invalid"); setStatus("idle"); return; }
    const nextTitle = value.title.trim();
    if (!nextTitle) { setTitleError("invalid"); setStatus("idle"); return; }
    const current = latest.current;
    const source = current.transaction ?? baseline.current.price ?? baseline.current.title;
    const base = source ? { ...source, title: saved.current.title, amount: saved.current.amount ?? source.amount, currency: saved.current.currency } : null;
    // Prevent the unmount cleanup from flushing a row that has just been completed.
    discarded.current = true;
    const ok = current.onConfirm(current.item.id, {
      amount,
      currency: value.currency,
      ...(value.titleDirty ? { title: nextTitle } : {}),
      base,
      changed: {
        ...(value.priceDirty ? { amount } : {}),
        ...(value.currencyDirty ? { currency: value.currency } : {}),
        ...(value.titleDirty ? { title: nextTitle } : {}),
      },
    });
    if (!ok) {
      discarded.current = false;
      setPriceError("save");
      setStatus("failed");
    }
  }

  function resolveConflict(keepDraft: boolean) {
    cancelTimer();
    const current = latest.current;
    const value = draft.current;
    const liveTitle = current.transaction?.title ?? current.item.title;
    const liveAmount = current.transaction?.amount ?? null;
    const liveCurrency = current.transaction?.currency ?? current.item.currency;
    saved.current = { title: liveTitle, amount: liveAmount, currency: liveCurrency };
    baseline.current = { title: current.transaction ?? null, price: current.transaction ?? null, currency: current.transaction ?? null };
    if (!keepDraft || !value.titleDirty) { value.title = liveTitle; value.titleDirty = false; }
    if (!keepDraft || !value.priceDirty) { value.price = liveAmount === null ? "" : String(liveAmount); value.priceDirty = false; }
    if (!keepDraft || !value.currencyDirty) { value.currency = liveCurrency; value.currencyDirty = false; }
    setTitle(value.title);
    setPrice(value.price);
    setCurrency(value.currency);
    setTitleError(null);
    setPriceError(null);
    setStatus("idle");
    conflictRef.current = false;
    setConflict(false);
    if (keepDraft) { saveTitle(); savePrice(); }
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
    if (blockConflict()) return;
    if ((amount !== null && current.priceDirty) || current.currencyDirty) {
      setStatus("saving");
      timer.current = setTimeout(() => { savePrice(); }, SAVE_DELAY);
    } else setStatus("idle");
  }

  function isRowControl(target: EventTarget | null) {
    return target instanceof HTMLElement && Boolean(target.closest(".shopping-currency, .shopping-remove, .shopping-confirm, .shopping-conflict-actions"));
  }

  const hasUnsavedDraft = draft.current.titleDirty || draft.current.priceDirty || draft.current.currencyDirty;
  const stateText = status === "saving" ? text.saving : status === "saved" && !hasUnsavedDraft ? text.saved : "";
  return (
    <li className={`shopping-item${transaction ? " shopping-item-purchased" : ""}`} data-shopping-item={item.id}>
      <span className="shopping-item-marker" aria-hidden="true">{transaction ? <Check size={15} /> : <span />}</span>
      <div className="shopping-item-name">
        <input
          className="shopping-title-input"
          aria-label={`${text.title}: ${item.title}`}
          aria-invalid={Boolean(titleError || conflict) || undefined}
          aria-describedby={conflict ? `${id}-conflict` : titleError ? `${id}-title-error` : undefined}
          value={title}
          maxLength={160}
          onFocus={() => { focused.current.title = true; }}
          onChange={(event) => {
            draft.current.title = event.target.value;
            draft.current.titleDirty = event.target.value.trim() !== saved.current.title;
            setTitle(event.target.value);
            setTitleError(null);
            setStatus("idle");
          }}
          onBlur={(event) => {
            focused.current.title = false;
            syncUntouched();
            if (!(event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest(".shopping-remove, .shopping-confirm, .shopping-conflict-actions"))) saveTitle();
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
          aria-invalid={Boolean(priceError || conflict) || undefined}
          aria-describedby={conflict ? `${id}-conflict` : priceError ? `${id}-price-error` : `${id}-save-status`}
          onFocus={() => { focused.current.price = true; }}
          onChange={(event) => {
            draft.current.price = event.target.value;
            draft.current.priceDirty = parseShoppingPrice(event.target.value) !== saved.current.amount || Boolean(event.target.value.trim() && parseShoppingPrice(event.target.value) === null);
            setPrice(event.target.value);
            queuePriceSave();
          }}
          onBlur={(event) => { focused.current.price = false; syncUntouched(); if (!isRowControl(event.relatedTarget)) savePrice(); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); savePrice(); } }}
        />
        <label className="shopping-sr-only" htmlFor={`${id}-currency`}>{text.currency}: {item.title}</label>
        <select
          id={`${id}-currency`}
          className="form-input shopping-currency"
          value={currency}
          onFocus={() => { focused.current.currency = true; }}
          onChange={(event) => {
            const next = event.target.value as Currency;
            draft.current.currency = next;
            draft.current.currencyDirty = next !== saved.current.currency;
            setCurrency(next);
            queuePriceSave();
          }}
          onBlur={(event) => { focused.current.currency = false; syncUntouched(); if (!isRowControl(event.relatedTarget)) savePrice(); }}
        >{CURRENCIES.map(({ code }) => <option key={code} value={code}>{code}</option>)}</select>
        <span className="shopping-save-status" id={`${id}-save-status`} role="status" aria-live="polite">{!priceError && !titleError && !conflict && stateText}</span>
        {(price.trim() || transaction) && <button
          className="shopping-confirm"
          type="button"
          aria-label={`${text.confirm}: ${title || item.title}`}
          disabled={conflict}
          onPointerDown={(event) => event.preventDefault()}
          onClick={confirmPurchase}
        ><CheckCheck size={16} aria-hidden="true" />{text.confirm}</button>}
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
      {conflict && <div className="shopping-row-error shopping-conflict" id={`${id}-conflict`} role="alert">
        <span>{!transaction && (baseline.current.price || baseline.current.title || baseline.current.currency) ? text.deletedConflict : text.conflict}</span>
        <div className="shopping-conflict-actions">
          <button className="button button-secondary" type="button" onClick={() => resolveConflict(false)}>{text.loadCurrent}</button>
          <button className="button button-secondary" type="button" onClick={() => resolveConflict(true)}>{text.keepDraft}</button>
        </div>
      </div>}
      {priceError && <p className="shopping-row-error shopping-price-error" id={`${id}-price-error`} role="alert">{priceError === "invalid" ? text.priceError : text.saveError}</p>}
    </li>
  );
}
