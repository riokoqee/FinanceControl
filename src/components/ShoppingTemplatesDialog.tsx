import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowDownToLine, Plus, Trash2, X } from 'lucide-react';
import { MAX_SHOPPING_TEMPLATES, MAX_TEMPLATE_ITEMS } from '../lib/finance';
import type { Language, ShoppingTemplate } from '../lib/finance';
import './ShoppingTemplatesDialog.css';

const copy = {
  ru: {
    heading: 'Шаблоны', close: 'Закрыть', empty: 'Пока нет шаблонов',
    name: 'Название шаблона', placeholder: 'Продукты на неделю', save: 'Сохранить список',
    planned: 'В плане', items: 'Товаров', apply: 'В список', remove: 'Удалить шаблон',
    nameError: 'Введите название шаблона.', saveError: 'Шаблон не сохранён. Попробуйте ещё раз.',
    applyError: 'Не удалось добавить товары. Проверьте актуальные данные и свободное место в списке.',
    deleteError: 'Не удалось удалить шаблон. Попробуйте ещё раз.',
    itemLimit: 'Для сохранения нужно от 1 до 200 товаров в плане.',
    templateLimit: 'Достигнут лимит: 20 шаблонов.',
  },
  en: {
    heading: 'Templates', close: 'Close', empty: 'No templates yet',
    name: 'Template name', placeholder: 'Weekly groceries', save: 'Save list',
    planned: 'Planned', items: 'Items', apply: 'Add to list', remove: 'Delete template',
    nameError: 'Enter a template name.', saveError: 'Template was not saved. Try again.',
    applyError: 'Unable to add these items. Check the current data and available space in the list.',
    deleteError: 'Unable to delete the template. Try again.',
    itemLimit: 'Keep 1–200 planned items to save a template.',
    templateLimit: 'Template limit reached: 20.',
  },
};

export default function ShoppingTemplatesDialog({
  templates, pendingCount, language, onSave, onApply, onDelete, onClose,
}: {
  templates: ShoppingTemplate[];
  pendingCount: number;
  language: Language;
  onSave: (name: string) => boolean;
  onApply: (id: string) => boolean;
  onDelete: (id: string) => boolean;
  onClose: () => void;
}) {
  const text = copy[language];
  const id = useId();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const capacityError = templates.length >= MAX_SHOPPING_TEMPLATES ? text.templateLimit :
    pendingCount < 1 || pendingCount > MAX_TEMPLATE_ITEMS ? text.itemLimit : '';

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError(true);
      setError(text.nameError);
      inputRef.current?.focus();
      return;
    }
    if (capacityError) { setError(capacityError); return; }
    if (!onSave(name.trim())) { setError(text.saveError); return; }
    setName('');
    setNameError(false);
    setError('');
    inputRef.current?.focus();
  }

  function remove(id: string) {
    const rows = Array.from(listRef.current?.children ?? []);
    const index = rows.findIndex((row) => (row as HTMLElement).dataset.shoppingTemplate === id);
    const next = rows[index + 1] ?? rows[index - 1];
    if (!onDelete(id)) { setError(text.deleteError); return; }
    setError('');
    requestAnimationFrame(() => {
      const target = next?.isConnected ? next.querySelector<HTMLButtonElement>('.shopping-template-apply') : null;
      (target ?? inputRef.current)?.focus();
    });
  }

  return <div className="shopping-templates">
    <div className="dialog-header">
      <h2>{text.heading}</h2>
      <button className="modal-close" type="button" onClick={onClose} aria-label={text.close}><X size={17} aria-hidden="true" /></button>
    </div>
    <form className="shopping-template-form" onSubmit={save} noValidate>
      <div className="shopping-template-save-label">
        <label htmlFor={`${id}-name`}>{text.name}</label>
        <span>{text.planned} · {pendingCount}</span>
      </div>
      <input
        ref={inputRef} id={`${id}-name`} className="form-input" value={name} maxLength={60}
        placeholder={text.placeholder} autoComplete="off" aria-invalid={nameError || undefined}
        aria-describedby={error ? `${id}-error` : capacityError ? `${id}-capacity` : undefined}
        onChange={(event) => { setName(event.target.value); setNameError(false); setError(''); }}
      />
      <button className="button button-primary" type="submit" disabled={Boolean(capacityError)}>
        <Plus size={16} aria-hidden="true" />{text.save}
      </button>
      {capacityError && <p className="shopping-template-hint" id={`${id}-capacity`}>{capacityError}</p>}
    </form>
    {error && <p className="shopping-template-error" id={`${id}-error`} role="alert">{error}</p>}
    {templates.length ? <ul className="shopping-template-list" aria-label={text.heading} ref={listRef}>
      {templates.map((template) => <li key={template.id} data-shopping-template={template.id}>
        <div className="shopping-template-name"><strong>{template.name}</strong><span>{text.items} · {template.items.length}</span></div>
        <button className="button button-secondary shopping-template-apply" type="button"
          aria-label={`${text.apply}: ${template.name}`}
          onClick={() => { if (!onApply(template.id)) setError(text.applyError); }}>
          <ArrowDownToLine size={16} aria-hidden="true" />{text.apply}
        </button>
        <button className="shopping-template-remove" type="button" aria-label={`${text.remove}: ${template.name}`}
          onClick={() => remove(template.id)}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </li>)}
    </ul> : <p className="shopping-template-empty">{text.empty}</p>}
  </div>;
}
