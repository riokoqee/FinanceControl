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
  const english = language === 'en';
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
          setError(`${translate(language, category.label)}: ${english ? 'enter a valid amount (up to 2 decimal places).' : 'укажите сумму, не более 2 знаков после запятой.'}`);
          document.getElementById(`${id}-${field.id}-amount`)?.focus();
          return;
        }
        if (amount > 0) next.push({ id: field.id, amount, currency: field.currency });
      }
      if (onSave(base, next)) onClose();
      else {
        setFailedSave(true);
        setError(english ? 'Could not save. Reload current limits and try again.' : 'Не удалось сохранить. Загрузите актуальные лимиты и повторите.');
      }
    }}>
      <div className="dialog-header">
        <h2>{english ? 'Category limits' : 'Лимиты категорий'}<span className="heading-dot">.</span></h2>
        <button type="button" className="icon-button modal-close" aria-label={english ? 'Close' : 'Закрыть'} onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      <p className="category-budgets-hint" id={`${id}-hint`}>
        {english ? 'Per month. Leave blank or enter 0 for no limit.' : 'На месяц. Пусто или 0 — без лимита.'}
      </p>
      <div className="category-budgets-fields" aria-describedby={`${id}-hint`}>
        {fields.map((field, index) => {
          const label = translate(language, CATEGORIES[index].label);
          return (
            <div className="category-budget-field" key={field.id}>
              <label className="category-budget-field-label" htmlFor={`${id}-${field.id}-amount`}>{label}</label>
              <input id={`${id}-${field.id}-amount`} className="form-input" type="text" inputMode="decimal"
                value={field.amount} maxLength={18} placeholder={english ? 'No limit' : 'Без лимита'}
                onChange={(event) => update(field.id, { amount: event.target.value })} />
              <select className="form-input" aria-label={`${english ? 'Currency' : 'Валюта'}: ${label}`}
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
      }}><RotateCcw size={15} />{english ? 'Reload current limits' : 'Загрузить актуальные лимиты'}</Button>}
      <div className="dialog-footer">
        <Button onClick={onClose}>{english ? 'Cancel' : 'Отмена'}</Button>
        <Button variant="primary" type="submit"><Check size={17} />{english ? 'Save' : 'Сохранить'}</Button>
      </div>
    </form>
  );
}
