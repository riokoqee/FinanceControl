import { message } from "../lib/messages";
import { useId, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { CATEGORIES, CURRENCIES, parseMoney } from '../lib/finance';
import type { CategoryBudget, CategoryId, Currency, Language } from '../lib/finance';
import { translate } from '../lib/i18n';
import Button from './Button';
import './CategoryBudgetsDialog.css';

type BudgetField = { id: CategoryId; amount: string; currency: Currency };

function fieldsFor(budgets: CategoryBudget[], defaultCurrency: Currency): BudgetField[] {
  return CATEGORIES.map((category) => {
    const budget = budgets.find((item) => item.id === category.id);
    return { id: category.id, amount: budget ? String(budget.amount) : '', currency: budget?.currency ?? defaultCurrency };
  });
}

export default function CategoryBudgetsDialog({
  budgets, defaultCurrency, language, onSave, onClose,
}: {
  budgets: CategoryBudget[];
  defaultCurrency: Currency;
  language: Language;
  onSave: (base: CategoryBudget[], next: CategoryBudget[]) => boolean;
  onClose: () => void;
}) {
  const id = useId();
    const [base, setBase] = useState(() => budgets.map((budget) => ({ ...budget })));
  const [fields, setFields] = useState(() => fieldsFor(budgets, defaultCurrency));
  const [error, setError] = useState('');
  const [failedSave, setFailedSave] = useState(false);
  const update = (category: CategoryId, patch: Partial<BudgetField>) => {
    setFields((current) => current.map((field) => field.id === category ? { ...field, ...patch } : field));
    setError('');
  };
  return (
    <form className="category-budgets-form" onSubmit={(event) => {
      event.preventDefault();
      const next: CategoryBudget[] = [];
      for (const field of fields) {
        if (!field.amount.trim()) continue;
        const amount = parseMoney(field.amount, true);
        if (amount === null) {
          const category = CATEGORIES.find((item) => item.id === field.id)!;
          setError(`${translate(language, category.labelKey)}: ${message(language, "ui.enterAValidAmountUpTo2DecimalPlaces")}`);
          document.getElementById(`${id}-${field.id}-amount`)?.focus();
          return;
        }
        if (amount > 0) next.push({ id: field.id, amount, currency: field.currency });
      }
      if (onSave(base, next)) onClose();
      else {
        setFailedSave(true);
        setError(message(language, "ui.couldNotSaveReloadCurrentLimitsAndTryAgain"));
      }
    }}>
      <div className="dialog-header">
        <h2>{message(language, "ui.categoryLimits")}<span className="heading-dot">.</span></h2>
        <button type="button" className="icon-button modal-close" aria-label={message(language, "common.close")} onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      <p className="category-budgets-hint" id={`${id}-hint`}>
        {message(language, "ui.perMonthLeaveBlankOrEnter0ForNoLimit")}
      </p>
      <div className="category-budgets-fields" aria-describedby={`${id}-hint`}>
        {fields.map((field, index) => {
          const label = translate(language, CATEGORIES[index].labelKey);
          return (
            <div className="category-budget-field" key={field.id}>
              <label className="category-budget-field-label" htmlFor={`${id}-${field.id}-amount`}>{label}</label>
              <input id={`${id}-${field.id}-amount`} className="form-input" type="text" inputMode="decimal"
                value={field.amount} maxLength={18} placeholder={message(language, "ui.noLimit")}
                onChange={(event) => update(field.id, { amount: event.target.value })} />
              <select className="form-input" aria-label={`${message(language, "ui.currency")}: ${label}`}
                value={field.currency} onChange={(event) => update(field.id, { currency: event.target.value as Currency })}>
                {CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code}</option>)}
              </select>
            </div>
          );
        })}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {failedSave && <Button onClick={() => {
        setBase(budgets.map((budget) => ({ ...budget })));
        setFields(fieldsFor(budgets, defaultCurrency));
        setError('');
        setFailedSave(false);
      }}><RotateCcw size={15} />{message(language, "ui.reloadCurrentLimits")}</Button>}
      <div className="dialog-footer">
        <Button onClick={onClose}>{message(language, "common.cancel")}</Button>
        <Button variant="primary" type="submit"><Check size={17} />{message(language, "common.save")}</Button>
      </div>
    </form>
  );
}
