// Run against a built preview: BELILOG_URL=http://127.0.0.1:5175/FinanceControl/ node tests/planning-browser.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.BELILOG_URL ?? 'http://127.0.0.1:5175/FinanceControl/';
const storageKey = 'finance-control:data:v1';
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const month = today.slice(0, 7);
const previousDate = new Date(`${month}-01T12:00:00`);
previousDate.setMonth(previousDate.getMonth() - 1);
const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const contexts = new Set();
const errors = [];
const results = [];

const product = (id, title = `Product ${id}`, currency = 'USD') => ({ id, title, currency, createdAt: today });
const expense = (id, amount, category = 'food', currency = 'USD') => ({
  id, title: `Expense ${id}`, amount, category, currency, date: today, createdAt: today,
});
const weekly = { id: 'weekly', name: 'Weekly groceries', items: [
  { title: 'Bread', currency: 'USD' }, { title: 'Milk', currency: 'EUR' },
] };
function seed(values = {}) {
  return {
    version: 1,
    profile: { name: 'Planning captain', email: '', currency: 'USD', monthlyBudget: 0, theme: 'light', language: 'en' },
    transactions: [], shoppingList: [product('bread', 'Bread'), product('milk', 'Milk', 'EUR')],
    ...values,
  };
}
const read = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
const money = (value, currency, language = 'en') => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ru-RU', {
  style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(value);
const categoryLabels = { food: 'Food & groceries', shopping: 'Shopping', transport: 'Transport', home: 'Home' };
const budgetInput = (page, category) => page.locator('.category-budgets-form').getByRole('textbox', { name: categoryLabels[category], exact: true });
const budgetCurrency = (page, category) => page.locator('.category-budgets-form').getByRole('combobox', { name: `Currency: ${categoryLabels[category]}`, exact: true });
const submitBudget = (page) => page.locator('.category-budgets-form button[type="submit"]').click();
const templateName = (page) => page.locator('.shopping-template-form input');
const saveTemplate = (page) => page.locator('.shopping-template-form button[type="submit"]').click();
const applyTemplate = (page, id = 'weekly') => page.locator(`[data-shopping-template="${id}"] .shopping-template-apply`).click();
const bar = (page, category) => page.getByRole('progressbar', { name: `${categoryLabels[category]}: monthly limit`, exact: true });

async function until(check, message = 'Expected planning state was not observed') {
  const deadline = Date.now() + 10_000;
  let error;
  do {
    try { return await check(); } catch (cause) { error = cause; }
    await delay(30);
  } while (Date.now() < deadline);
  throw new Error(message, { cause: error });
}
async function open(context, route = 'overview') {
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  const url = new URL(baseUrl);
  url.hash = route;
  await page.goto(url.href);
  await page.locator({ overview: '.overview-stats', shopping: '.shopping-add-form', profile: '.profile-form' }[route]).waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function navigate(page, route) {
  await page.locator(`a[href="#${route}"]:visible`).first().click();
  await page.locator({ overview: '.overview-stats', shopping: '.shopping-add-form', profile: '.profile-form' }[route]).waitFor();
}
async function openBudgets(page) {
  await page.locator('.category-limits-button').click();
  await page.locator('.category-budgets-form').waitFor();
}
async function openTemplates(page) {
  await page.locator('.shopping-templates-button').click();
  await page.locator('.shopping-template-form').waitFor();
}
async function check(name, run, { data = seed(), route = 'overview', width = 1024 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Europe/Berlin',
    reducedMotion: 'reduce', isMobile: width <= 390, hasTouch: width <= 390 });
  contexts.add(context);
  const errorCount = errors.length;
  await context.addInitScript(({ data, storageKey }) => {
    if (localStorage.getItem('__belilog_planning_seed')) return;
    localStorage.setItem(storageKey, JSON.stringify(data));
    localStorage.setItem('__belilog_planning_seed', '1');
  }, { data, storageKey });
  try {
    await run(await open(context, route), context);
    assert.equal(errors.length, errorCount, errors.slice(errorCount).join('\n'));
    results.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    process.exitCode = 1;
    results.push({ name, passed: false });
    console.error(`FAIL ${name}\n${error.stack ?? error}`);
  } finally { contexts.delete(context); await context.close(); }
}
async function blockStorage(page) {
  await page.evaluate((key) => {
    window.__belilogPlanningSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Storage is full', 'QuotaExceededError');
      return window.__belilogPlanningSetItem.call(this, name, value);
    };
  }, storageKey);
}
async function restoreStorage(page) {
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__belilogPlanningSetItem;
    delete window.__belilogPlanningSetItem;
  });
}
async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(dimensions.content <= dimensions.width + 1, JSON.stringify(dimensions));
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    const box = await dialog.boundingBox();
    assert.ok(box && box.x >= -1 && box.x + box.width <= dimensions.width + 1, JSON.stringify(box));
    assert.equal(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true);
    const overlay = await page.locator('.modal-backdrop').evaluate((element) => {
      const box = element.getBoundingClientRect();
      const ownsPoint = (x, y) => element.contains(document.elementFromPoint(x, y));
      return {
        x: box.x, y: box.y, width: box.width, height: box.height,
        viewportWidth: innerWidth, viewportHeight: innerHeight,
        blocksTop: ownsPoint(Math.floor(innerWidth / 2), 1),
        blocksBottom: ownsPoint(Math.floor(innerWidth / 2), innerHeight - 2),
      };
    });
    assert.ok(Math.abs(overlay.x) <= 1 && Math.abs(overlay.y) <= 1 &&
      Math.abs(overlay.width - overlay.viewportWidth) <= 1 && Math.abs(overlay.height - overlay.viewportHeight) <= 1,
    `Modal backdrop must cover the entire viewport: ${JSON.stringify(overlay)}`);
    assert.equal(overlay.blocksTop, true, `Background header must be blocked: ${JSON.stringify(overlay)}`);
    assert.equal(overlay.blocksBottom, true, `Background navigation must be blocked: ${JSON.stringify(overlay)}`);
  }
}
async function accessible(page, selector) {
  if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async (selector) => {
    const report = await window.axe.run(document.querySelector(selector), {
      runOnly: { type: 'rule', values: [
        'color-contrast', 'button-name', 'label', 'aria-progressbar-name', 'aria-valid-attr-value', 'aria-dialog-name',
      ] },
    });
    return report.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
  }, selector);
  assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
}

try {
  await check('category limits save atomically, cancel safely, remove with zero and survive reload', async (page) => {
    const before = await read(page);
    await openBudgets(page);
    await budgetInput(page, 'food').fill('200');
    await page.locator('.category-budgets-form').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(await read(page), before);
    await openBudgets(page);
    await budgetInput(page, 'food').fill('200,50');
    await budgetCurrency(page, 'food').selectOption('EUR');
    await budgetInput(page, 'home').fill('100');
    await submitBudget(page);
    await until(async () => assert.equal(await page.getByRole('dialog').count(), 0));
    const saved = await read(page);
    assert.equal(saved.version, 2);
    assert.deepEqual(saved.categoryBudgets, [
      { id: 'food', amount: 200.5, currency: 'EUR' }, { id: 'home', amount: 100, currency: 'USD' },
    ]);
    assert.deepEqual(saved.transactions, before.transactions);
    await page.reload();
    await page.locator('.category-budget-item').first().waitFor();
    assert.equal(await page.locator('.category-budget-item').count(), 2);
    await openBudgets(page);
    assert.equal(await budgetInput(page, 'food').inputValue(), '200.5');
    assert.equal(await budgetCurrency(page, 'food').inputValue(), 'EUR');
    await budgetInput(page, 'food').fill('0');
    await budgetInput(page, 'home').fill('');
    await submitBudget(page);
    await until(async () => assert.deepEqual((await read(page)).categoryBudgets, []));
    assert.equal(await page.locator('.category-budget-item').count(), 0);
  });

  await check('monthly limits use mixed original currencies, show zero-spend, and distinguish 80%, 100% and overrun', async (page) => {
    assert.equal(await bar(page, 'food').getAttribute('aria-valuenow'), '80');
    assert.equal(await bar(page, 'home').getAttribute('aria-valuenow'), '100');
    assert.equal(await bar(page, 'transport').getAttribute('aria-valuenow'), '100');
    assert.equal(await bar(page, 'shopping').getAttribute('aria-valuenow'), '0');
    assert.equal(await page.locator('.category-budget-warning').count(), 2);
    assert.equal(await page.locator('.category-budget-over').count(), 1);
    assert.ok((await bar(page, 'transport').getAttribute('aria-valuetext')).includes('144%'));
    assert.ok((await bar(page, 'food').getAttribute('aria-valuetext')).includes(`${money(80, 'USD')} / ${money(100, 'USD')}`));
    assert.ok((await bar(page, 'home').getAttribute('aria-valuetext')).includes(`${money(100, 'EUR')} / ${money(100, 'EUR')}`));
    const budgets = (await read(page)).categoryBudgets;
    await page.locator('.month-picker input').fill(previousMonth);
    await until(async () => assert.deepEqual(await page.locator('.category-panel').getByRole('progressbar').evaluateAll((elements) => elements.map((item) => item.getAttribute('aria-valuenow'))), ['0', '0', '0', '0']));
    await page.locator('.month-picker input').fill(month);
    await until(async () => assert.equal(await bar(page, 'food').getAttribute('aria-valuenow'), '80'));
    await navigate(page, 'profile');
    await page.locator('.profile-form select').first().selectOption('KZT');
    await until(async () => assert.equal((await read(page)).profile.currency, 'KZT'));
    await navigate(page, 'overview');
    assert.deepEqual((await read(page)).categoryBudgets, budgets);
    assert.equal(await bar(page, 'food').getAttribute('aria-valuenow'), '80');
  }, { data: seed({ version: 2, categoryBudgets: [
    { id: 'food', amount: 100, currency: 'USD' }, { id: 'home', amount: 100, currency: 'EUR' },
    { id: 'transport', amount: 1000, currency: 'KZT' }, { id: 'shopping', amount: 100, currency: 'EUR' },
  ], transactions: [expense('usd', 50), expense('eur', 9.2, 'food', 'EUR'), expense('kzt', 9600, 'food', 'KZT'),
    expense('home', 100, 'home', 'EUR'), expense('transport', 3, 'transport')] }) });

  await check('invalid category amounts keep the entire draft and do not partially save valid rows', async (page) => {
    const original = await read(page);
    await openBudgets(page);
    await budgetInput(page, 'food').fill('200');
    for (const value of ['-1', '1.234', '1000000000001']) {
      await budgetInput(page, 'home').fill(value);
      await submitBudget(page);
      assert.deepEqual(await read(page), original);
      assert.equal(await budgetInput(page, 'food').inputValue(), '200');
      assert.equal(await budgetInput(page, 'home').inputValue(), value);
      assert.equal(await page.locator('.category-budgets-form .form-error').count(), 1);
    }
  });

  await check('failed storage preserves category drafts and a retry saves once', async (page) => {
    const original = await read(page);
    await openBudgets(page);
    await budgetInput(page, 'food').fill('125.50');
    await blockStorage(page);
    await submitBudget(page);
    assert.deepEqual(await read(page), original);
    assert.equal(await budgetInput(page, 'food').inputValue(), '125.50');
    assert.equal(await page.locator('.category-budgets-form .form-error').count(), 1);
    await restoreStorage(page);
    await submitBudget(page);
    await until(async () => assert.deepEqual((await read(page)).categoryBudgets, [{ id: 'food', amount: 125.5, currency: 'USD' }]));
    assert.equal(await page.getByRole('dialog').count(), 0);
  });

  await check('two tabs merge independent category edits without overwriting newer limits', async (a, context) => {
    const b = await open(context);
    await openBudgets(a); await openBudgets(b);
    await budgetInput(a, 'food').fill('120');
    await budgetInput(b, 'home').fill('70');
    await submitBudget(b);
    await until(async () => assert.ok((await bar(a, 'home').getAttribute('aria-valuetext')).includes(money(70, 'USD'))));
    await submitBudget(a);
    await until(async () => assert.equal(await a.getByRole('dialog').count(), 0));
    const actual = (await read(a)).categoryBudgets;
    assert.equal(actual.find(({ id }) => id === 'food').amount, 120);
    assert.equal(actual.find(({ id }) => id === 'home').amount, 70);
    await until(async () => assert.equal(await b.locator('.category-budget-item').count(), 2));
  }, { data: seed({ version: 2, categoryBudgets: [{ id: 'food', amount: 100, currency: 'USD' }, { id: 'home', amount: 50, currency: 'USD' }] }) });

  await check('same-category conflicts require explicit reload before saving the new draft', async (a, context) => {
    const b = await open(context);
    await openBudgets(a); await openBudgets(b);
    await budgetInput(a, 'food').fill('130');
    await budgetInput(b, 'food').fill('140');
    await submitBudget(b);
    await until(async () => assert.ok((await bar(a, 'food').getAttribute('aria-valuetext')).includes(money(140, 'USD'))));
    await submitBudget(a);
    assert.equal(await a.locator('.category-budgets-form .form-error').count(), 1);
    assert.equal(await budgetInput(a, 'food').inputValue(), '130');
    assert.equal((await read(a)).categoryBudgets[0].amount, 140);
    await a.getByRole('button', { name: 'Reload current limits', exact: true }).click();
    assert.equal(await budgetInput(a, 'food').inputValue(), '140');
    await budgetInput(a, 'food').fill('150');
    await submitBudget(a);
    await until(async () => assert.equal((await read(a)).categoryBudgets[0].amount, 150));
  }, { data: seed({ version: 2, categoryBudgets: [{ id: 'food', amount: 100, currency: 'USD' }] }) });

  await check('template captures every pending item beyond the first 50 rows and excludes purchased products', async (page) => {
    const original = await read(page);
    const streak = await page.locator('.streak-nav-badge').getAttribute('data-streak');
    assert.equal(await page.locator('[data-shopping-item]').count(), 50);
    await openTemplates(page);
    await templateName(page).fill('All 61 pending items');
    await saveTemplate(page);
    await until(async () => assert.equal((await read(page)).shoppingTemplates?.length, 1));
    const saved = await read(page);
    assert.equal(saved.shoppingTemplates[0].items.length, 61);
    assert.equal(saved.shoppingTemplates[0].items.at(-1).title, 'Product 60');
    assert.equal(saved.shoppingTemplates[0].items.some(({ title }) => title === 'Purchased product'), false);
    assert.equal(saved.shoppingTemplates[0].items.some((item) => 'amount' in item || 'transactionId' in item), false);
    assert.deepEqual(saved.transactions, original.transactions);
    assert.deepEqual(saved.shoppingList, original.shoppingList);
    assert.equal(await page.locator('.streak-nav-badge').getAttribute('data-streak'), streak);
    await page.keyboard.press('Escape');
    await page.reload();
    await page.locator('.shopping-add-form').waitFor();
    await openTemplates(page);
    assert.equal(await page.locator('[data-shopping-template]').count(), 1);
    assert.deepEqual((await read(page)).shoppingTemplates, saved.shoppingTemplates);
  }, { route: 'shopping', data: seed({
    shoppingList: [...Array.from({ length: 61 }, (_, index) => product(String(index))),
      { ...product('paid', 'Purchased product'), transactionId: 'paid-expense' }],
    transactions: [{ ...expense('paid-expense', 7), title: 'Purchased product' }],
  }) });

  await check('applying a template deduplicates pending names and currencies without creating expenses or streak activity', async (page) => {
    const original = await read(page);
    const streak = await page.locator('.streak-nav-badge').getAttribute('data-streak');
    await openTemplates(page);
    await applyTemplate(page);
    await until(async () => assert.equal(await page.getByRole('dialog').count(), 0));
    const saved = await read(page);
    assert.equal(saved.shoppingList.length, 4);
    assert.deepEqual(saved.shoppingList.slice(2).map(({ title, currency }) => ({ title, currency })), [
      { title: 'Bread', currency: 'EUR' }, { title: 'Eggs', currency: 'KZT' },
    ]);
    assert.deepEqual(saved.transactions, original.transactions);
    assert.equal(saved.shoppingList.slice(2).every((item) => !('transactionId' in item)), true);
    assert.equal(await page.locator('.streak-nav-badge').getAttribute('data-streak'), streak);
    await openTemplates(page); await applyTemplate(page);
    await until(async () => assert.equal(await page.getByRole('dialog').count(), 0));
    assert.deepEqual(await read(page), saved);
  }, { route: 'shopping', data: seed({ version: 2,
    shoppingList: [product('bread', 'Bread'), product('milk', 'Fresh   milk', 'EUR')],
    transactions: [expense('old-expense', 5)], shoppingTemplates: [{ ...weekly, items: [
      { title: 'BREAD', currency: 'USD' }, { title: 'fresh milk', currency: 'EUR' },
      { title: 'Bread', currency: 'EUR' }, { title: 'Eggs', currency: 'KZT' }, { title: 'eggs', currency: 'KZT' },
    ] }],
  }) });

  await check('a template removed before its storage event cannot be applied from stale UI', async (page) => {
    await openTemplates(page);
    const remote = await page.evaluate((key) => {
      const current = JSON.parse(localStorage.getItem(key));
      current.shoppingTemplates = [];
      // Writing in this document deliberately leaves React stale: no storage event fires here.
      localStorage.setItem(key, JSON.stringify(current));
      return current;
    }, storageKey);
    assert.equal(await page.locator('[data-shopping-template="weekly"]').count(), 1);
    await applyTemplate(page);
    assert.equal(await page.locator('.shopping-template-error').count(), 1);
    assert.equal(await page.getByRole('dialog').count(), 1);
    assert.deepEqual(await read(page), remote);
    assert.deepEqual((await read(page)).shoppingList, []);
    assert.deepEqual((await read(page)).transactions, []);
  }, { route: 'shopping', data: seed({ version: 2, shoppingList: [], shoppingTemplates: [weekly] }) });

  await check('template application deduplicates a remotely planned row before receiving its storage event', async (page) => {
    await openTemplates(page);
    const remote = await page.evaluate(({ key, planned }) => {
      const current = JSON.parse(localStorage.getItem(key));
      current.shoppingList.push(planned);
      localStorage.setItem(key, JSON.stringify(current));
      return current;
    }, { key: storageKey, planned: product('remote-bread', 'Bread') });
    assert.equal(await page.locator('[data-shopping-item]').count(), 0, 'React must still display the old empty list');
    await applyTemplate(page);
    await until(async () => assert.equal(await page.getByRole('dialog').count(), 0));
    const saved = await read(page);
    assert.equal(saved.shoppingList.length, 2);
    assert.deepEqual(saved.shoppingList[0], remote.shoppingList[0]);
    assert.deepEqual(saved.shoppingList.map(({ title, currency }) => ({ title, currency })), weekly.items);
    assert.deepEqual(saved.transactions, remote.transactions);
    assert.deepEqual(saved.shoppingTemplates, remote.shoppingTemplates);
    assert.equal(await page.locator('[data-shopping-item]').count(), 2);
  }, { route: 'shopping', data: seed({ version: 2, shoppingList: [], shoppingTemplates: [weekly] }) });

  await check('invalid product drafts block opening templates and remain available for correction', async (page) => {
    const original = await read(page);
    const title = page.locator('[data-shopping-item="bread"] .shopping-title-input');
    await title.fill('   ');
    await page.locator('.shopping-templates-button').click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await title.inputValue(), '   ');
    assert.deepEqual(await read(page), original);
    await title.fill('Bread'); await title.press('Enter');
    const price = page.locator('[data-shopping-item="bread"] .shopping-price-input');
    await price.fill('1.234');
    await page.locator('.shopping-templates-button').click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await price.inputValue(), '1.234');
    assert.deepEqual(await read(page), original);
  }, { route: 'shopping' });

  await check('failed template storage retains its name and permits a successful retry', async (page) => {
    const original = await read(page);
    await openTemplates(page);
    await templateName(page).fill('Keep this template draft');
    await blockStorage(page);
    await saveTemplate(page);
    assert.deepEqual(await read(page), original);
    assert.equal(await templateName(page).inputValue(), 'Keep this template draft');
    assert.equal(await page.locator('.shopping-template-error').count(), 1);
    await restoreStorage(page);
    await saveTemplate(page);
    await until(async () => assert.equal((await read(page)).shoppingTemplates?.length, 1));
    assert.equal((await read(page)).shoppingTemplates[0].name, 'Keep this template draft');
    assert.equal(await templateName(page).inputValue(), '');
    assert.deepEqual((await read(page)).transactions, original.transactions);
  }, { route: 'shopping' });

  await check('a template that exceeds list capacity applies no partial rows or expenses', async (page) => {
    const original = await read(page);
    await openTemplates(page);
    await applyTemplate(page);
    assert.equal(await page.locator('.shopping-template-form').count(), 1);
    assert.equal(await page.locator('.shopping-template-error').count(), 1);
    assert.deepEqual(await read(page), original);
    assert.equal(await page.locator('[data-shopping-item]').count(), 50);
  }, { route: 'shopping', data: seed({ version: 2, shoppingTemplates: [weekly],
    shoppingList: Array.from({ length: 999 }, (_, index) => product(String(index))),
  }) });

  await check('full PDF backup restores category limits and shopping templates together with existing data', async (page) => {
    const original = await read(page);
    const downloaded = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: 'PDF backup with all your data', exact: true }).click();
    const download = await downloaded;
    const path = await download.path();
    assert.ok(path);
    const bytes = await readFile(path);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    const input = page.locator('input[type="file"][accept*=".pdf"]');
    await input.setInputFiles({ name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed({ shoppingList: [] }))) });
    await page.getByRole('button', { name: 'Restore everything', exact: true }).click();
    await until(async () => assert.equal((await read(page)).shoppingTemplates, undefined));
    await input.setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/pdf', buffer: bytes });
    await page.getByRole('button', { name: 'Restore everything', exact: true }).click();
    await until(async () => assert.deepEqual(await read(page), original));
    await page.reload(); await page.locator('.profile-form').waitFor();
    assert.deepEqual(await read(page), original);
  }, { route: 'profile', data: seed({ version: 2, shoppingTemplates: [weekly],
    categoryBudgets: [{ id: 'food', amount: 250, currency: 'EUR' }], transactions: [expense('pdf-record', 12.5)],
  }) });

  for (const settings of ['categoryBudgets', 'shoppingTemplates']) {
    await check(`demo replacement requires confirmation when only ${settings} contain user data`, async (page) => {
      const original = await read(page);
      assert.equal(original.transactions.length, 0);
      assert.equal(original.shoppingList.length, 0);
      await page.locator('.demo-card button').click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Load demo', exact: true }).waitFor();
      assert.deepEqual(await read(page), original);
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.deepEqual(await read(page), original);
      await page.locator('.demo-card button').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Load demo', exact: true }).click();
      await until(async () => assert.ok((await read(page)).transactions.length > 0));
      assert.equal((await read(page))[settings], undefined);
    }, { route: 'profile', data: seed({ version: 2,
      profile: { ...seed().profile, name: 'Пользователь' }, shoppingList: [],
      ...(settings === 'categoryBudgets'
        ? { categoryBudgets: [{ id: 'food', amount: 100, currency: 'EUR' }] }
        : { shoppingTemplates: [weekly] }),
    }) });
  }

  for (const language of ['ru', 'en']) for (const theme of ['light', 'dark']) for (const width of [320, 390]) {
    await check(`planning limits and templates remain accessible without mobile overflow: ${language}/${theme}/${width}`, async (page) => {
      await noOverflow(page);
      await accessible(page, '.category-panel');
      const progressBounds = await page.locator('.category-panel').getByRole('progressbar').first().boundingBox();
      assert.ok(progressBounds && progressBounds.width > width * 0.65, JSON.stringify(progressBounds));
      const names = await page.locator('.category-budget-name > span:last-child').evaluateAll((elements) =>
        elements.map((element) => ({ width: element.clientWidth, content: element.scrollWidth })));
      assert.equal(names.every(({ width, content }) => content <= width + 1), true, JSON.stringify(names));
      await openBudgets(page); await noOverflow(page); await accessible(page, '[role="dialog"]');
      assert.equal(await page.locator('.category-budget-field input').count(), 7);
      assert.equal(await page.locator('.category-budget-field select').count(), 7);
      await page.keyboard.press('Escape');
      await navigate(page, 'shopping'); await openTemplates(page);
      await noOverflow(page); await accessible(page, '[role="dialog"]');
      assert.equal(await page.locator('[data-shopping-template]').count(), 1);
    }, { width, data: seed({ version: 2,
      profile: { ...seed().profile, language, theme }, shoppingTemplates: [weekly],
      categoryBudgets: [{ id: 'food', amount: 100, currency: 'EUR' }, { id: 'transport', amount: 0.01, currency: 'KZT' }],
      transactions: [expense('food', 80, 'food', 'EUR'), expense('huge', 1_000_000_000_000, 'transport')],
    }) });
  }

  await check('desktop planning panels and dialogs have accessible names, contrast and no overflow', async (page) => {
    await noOverflow(page); await accessible(page, '.category-panel');
    await openBudgets(page); await noOverflow(page); await accessible(page, '[role="dialog"]');
    await page.keyboard.press('Escape'); await navigate(page, 'shopping'); await openTemplates(page);
    await noOverflow(page); await accessible(page, '[role="dialog"]');
  }, { width: 1440, data: seed({ version: 2, shoppingTemplates: [weekly],
    categoryBudgets: [{ id: 'food', amount: 100, currency: 'USD' }], transactions: [expense('desktop', 90)],
  }) });
} finally {
  await Promise.allSettled([...contexts].map((context) => context.close()));
  await browser.close();
  console.log(`${results.filter(({ passed }) => passed).length}/${results.length} planning regressions passed`);
  if (errors.length) { process.exitCode = 1; console.error(errors.join('\n')); }
}
