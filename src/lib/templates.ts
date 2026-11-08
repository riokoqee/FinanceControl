import {
  MAX_SHOPPING_TEMPLATES,
  MAX_TEMPLATE_ITEMS,
  createEmptyData,
  todayString,
  validateBackup,
  type AppData,
  type ShoppingTemplate,
} from './finance';

const MAX_SHOPPING_ITEMS = 1_000;
const makeId = () => globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function canonicalTemplate(value: ShoppingTemplate): ShoppingTemplate {
  return validateBackup({ ...createEmptyData(), shoppingTemplates: [value] }).shoppingTemplates![0];
}

function pendingItems(data: AppData) {
  const purchased = new Set(data.transactions.map(({ id }) => id));
  return (data.shoppingList ?? []).filter(({ transactionId }) => !transactionId || !purchased.has(transactionId));
}

/** A reusable plan contains names and currencies, never past prices or expenses. */
export function makeShoppingTemplate(name: string, data: AppData): ShoppingTemplate {
  if ((data.shoppingTemplates?.length ?? 0) >= MAX_SHOPPING_TEMPLATES) {
    throw new Error('Можно сохранить не больше 20 шаблонов.');
  }
  const pending = pendingItems(data);
  if (!pending.length || pending.length > MAX_TEMPLATE_ITEMS) {
    throw new Error('В шаблоне должно быть от 1 до 200 товаров.');
  }
  const ids = new Set(data.shoppingTemplates?.map(({ id }) => id));
  let id = makeId();
  while (ids.has(id)) id = makeId();
  return canonicalTemplate({
    id,
    name,
    items: pending.map(({ title, currency }) => ({ title, currency })),
  });
}

const productKey = ({ title, currency }: { title: string; currency: string }) =>
  JSON.stringify([title.trim().replace(/\s+/gu, ' ').toLowerCase(), currency]);

/** Apply against the latest data; either the complete plan fits or nothing changes. */
export function applyShoppingTemplate(data: AppData, templateId: string): AppData {
  const stored = data.shoppingTemplates?.find(({ id }) => id === templateId);
  if (!stored) throw new Error('Шаблон удалён. Откройте актуальный список.');
  const template = canonicalTemplate(stored);
  const planned = new Set(pendingItems(data).map(productKey));
  const additions = template.items.filter((item) => {
    const key = productKey(item);
    if (planned.has(key)) return false;
    planned.add(key);
    return true;
  });
  const list = data.shoppingList ?? [];
  if (list.length + additions.length > MAX_SHOPPING_ITEMS) {
    throw new Error('В списке покупок может быть не больше 1000 товаров.');
  }
  if (!additions.length) return data;
  const ids = new Set(list.map(({ id }) => id));
  const createdAt = todayString();
  const rows = additions.map(({ title, currency }) => {
    let id = makeId();
    while (ids.has(id)) id = makeId();
    ids.add(id);
    return { id, title, currency, createdAt };
  });
  return { ...data, version: 2, shoppingList: [...list, ...rows] };
}
