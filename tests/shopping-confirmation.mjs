// Run against a built preview: BELILOG_URL=http://127.0.0.1:5175/FinanceControl/ node tests/shopping-confirmation.mjs
// CHROMIUM_PATH optionally selects a locally installed Chromium.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.BELILOG_URL ?? 'http://127.0.0.1:5175/FinanceControl/';
const storageKey = 'finance-control:data:v1';
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox'],
});
const contexts = new Set();
const errors = [];
const results = [];

function seed({ language = 'en', theme = 'light', purchased = false, extra = false } = {}) {
  return {
    version: 1,
    profile: { name: 'Purchase confirmation', email: '', currency: 'USD', monthlyBudget: 0, theme, language },
    transactions: purchased ? [{
      id: 'expense', title: 'Bread', amount: 10, currency: 'USD', category: 'food',
      date: '2026-10-27', createdAt: '2026-10-28', note: 'Keep this purchase detail',
      items: [{ id: 'detail', title: 'Sourdough', amount: 4 }],
    }] : [],
    shoppingList: [{
      id: 'bread', title: 'Bread', currency: 'USD', createdAt: today,
      ...(purchased ? { transactionId: 'expense' } : {}),
    }, ...(extra ? [{ id: 'milk', title: 'Milk', currency: 'EUR', createdAt: today }] : [])],
  };
}

async function until(check, message = 'Expected purchase confirmation state was not observed') {
  const deadline = Date.now() + 8_000;
  let error;
  do {
    try { return await check(); } catch (cause) { error = cause; }
    await delay(30);
  } while (Date.now() < deadline);
  throw new Error(message, { cause: error });
}

async function open(context, route = 'shopping', pauseClock = true) {
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.clock.install();
  const url = new URL(baseUrl);
  url.hash = route;
  await page.goto(url.href);
  await page.locator('h1').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  if (pauseClock) await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
  return page;
}

async function withSeed(data, run, { width = 1024, pauseClock = true } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 950 }, timezoneId: 'Europe/Berlin', reducedMotion: 'reduce',
    isMobile: width <= 390, hasTouch: width <= 390,
  });
  contexts.add(context);
  await context.addInitScript(({ data, storageKey }) => {
    if (localStorage.getItem('__belilog_confirmation_seed')) return;
    localStorage.setItem(storageKey, JSON.stringify(data));
    localStorage.setItem('__belilog_confirmation_seed', '1');
  }, { data, storageKey });
  try { await run(await open(context, 'shopping', pauseClock), context); }
  finally { contexts.delete(context); await context.close(); }
}

async function check(name, run) {
  const errorCount = errors.length;
  try {
    await run();
    assert.equal(errors.length, errorCount, errors.slice(errorCount).join('\n'));
    results.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    process.exitCode = 1;
    results.push({ name, passed: false });
    console.error(`FAIL ${name}\n${error.stack ?? error}`);
  }
}

const read = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
const row = (page, id = 'bread') => page.locator(`[data-shopping-item="${id}"]`);
const price = (page, id = 'bread') => row(page, id).locator('.shopping-price-input');
const confirm = (page, id = 'bread') => row(page, id).locator('.shopping-confirm');
const title = (page, id = 'bread') => row(page, id).locator('.shopping-title-input');
// Explicitly run animation frames while the autosave clock remains under test control.
const frames = (page) => page.clock.runFor(32);

async function attemptConfirmation(page) {
  const button = confirm(page);
  if (!await button.count()) return;
  if (await button.isEnabled()) await button.click();
  else await button.evaluate((element) => element.click());
  await frames(page);
}

async function assertNoOverflow(page) {
  const bounds = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(bounds.content <= bounds.width + 1, JSON.stringify(bounds));
}

async function assertFocusAfterRemoval(page, nextId) {
  await frames(page);
  await until(async () => {
    const focused = await page.evaluate(() => ({
      id: document.activeElement?.closest('[data-shopping-item]')?.getAttribute('data-shopping-item'),
      add: Boolean(document.activeElement?.matches('.shopping-add-name input')),
    }));
    if (nextId) assert.equal(focused.id, nextId, JSON.stringify(focused));
    else assert.equal(focused.add, true, JSON.stringify(focused));
  }, 'Focus should move to the next product or the add-product input after confirmation');
}

try {
  await check('confirm before the 600 ms autosave creates one expense and clears only the purchased row', () => withSeed(seed({ extra: true }), async (page) => {
    const pending = (await read(page)).shoppingList.find((item) => item.id === 'milk');
    assert.equal(await confirm(page).count(), 0);
    await price(page).fill('12.75');
    assert.equal((await read(page)).transactions.length, 0);
    await confirm(page).click();
    await until(async () => assert.equal(await row(page).count(), 0));
    const saved = await read(page);
    assert.equal(saved.transactions.length, 1);
    assert.equal(saved.transactions[0].title, 'Bread');
    assert.equal(saved.transactions[0].amount, 12.75);
    assert.equal(saved.transactions[0].currency, 'USD');
    assert.equal(saved.transactions[0].category, 'food');
    assert.deepEqual(saved.shoppingList, [pending]);
    await assertFocusAfterRemoval(page, 'milk');
    await page.clock.fastForward(2_000);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    assert.deepEqual(await read(page), saved);
    await page.reload();
    await page.locator('h1').first().waitFor();
    assert.equal(await row(page).count(), 0);
    assert.equal(await row(page, 'milk').count(), 1);
    assert.deepEqual(await read(page), saved);
    await page.locator('a[href="#tracker"]:visible').first().click();
    assert.equal(await page.locator('.transaction-open').count(), 1);
    assert.ok((await page.locator('.transaction-open').innerText()).includes('Bread'));
    assert.equal((await read(page)).transactions[0].id, saved.transactions[0].id);
  }));

  await check('confirmation after autosave retains expense ID, dates, note and item details', () => withSeed(seed({ purchased: true }), async (page) => {
    await price(page).fill('17.25');
    await page.clock.fastForward(599);
    assert.equal((await read(page)).transactions[0].amount, 10);
    await page.clock.fastForward(1);
    await until(async () => assert.equal((await read(page)).transactions[0].amount, 17.25));
    const existing = (await read(page)).transactions[0];
    assert.equal(existing.id, 'expense');
    assert.equal(existing.date, '2026-10-27');
    assert.equal(existing.createdAt, '2026-10-28');
    assert.equal(existing.items[0].title, 'Sourdough');
    await confirm(page).click();
    await until(async () => assert.equal(await row(page).count(), 0));
    assert.deepEqual((await read(page)).transactions, [existing]);
    assert.deepEqual((await read(page)).shoppingList, []);
    await assertFocusAfterRemoval(page);
    await page.clock.fastForward(2_000);
    await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pagehide')); });
    assert.deepEqual((await read(page)).transactions, [existing]);
  }));

  await check('confirmation saves a currently focused title draft before removing the row', () => withSeed(seed({ purchased: true }), async (page) => {
    await title(page).fill('Freshly baked bread');
    assert.equal((await read(page)).transactions[0].title, 'Bread');
    await confirm(page).click();
    await until(async () => assert.equal(await row(page).count(), 0));
    const saved = await read(page);
    assert.equal(saved.transactions.length, 1);
    assert.equal(saved.transactions[0].title, 'Freshly baked bread');
    assert.equal(saved.transactions[0].amount, 10);
    assert.equal(saved.transactions[0].id, 'expense');
    assert.equal(saved.transactions[0].items[0].title, 'Sourdough');
  }));

  await check('confirmation saves a pending currency draft with the price and reuses the expense', () => withSeed(seed({ purchased: true }), async (page) => {
    await row(page).locator('.shopping-currency').selectOption('EUR');
    assert.equal((await read(page)).transactions[0].currency, 'USD');
    await confirm(page).click();
    await until(async () => assert.equal(await row(page).count(), 0));
    const saved = await read(page);
    assert.equal(saved.transactions.length, 1);
    assert.equal(saved.transactions[0].id, 'expense');
    assert.equal(saved.transactions[0].amount, 10);
    assert.equal(saved.transactions[0].currency, 'EUR');
  }));

  await check('empty or invalid prices never confirm a pending product', () => withSeed(seed(), async (page) => {
    const original = await read(page);
    for (const value of ['', '0', '-1', '2.', '1.234', '1000000000001']) {
      await price(page).fill(value);
      await attemptConfirmation(page);
      assert.equal(await row(page).count(), 1, `Removed product for price ${JSON.stringify(value)}`);
      assert.deepEqual(await read(page), original);
      assert.equal(await price(page).inputValue(), value);
    }
  }));

  await check('empty title blocks confirmation without altering the expense or removing the draft', () => withSeed(seed({ purchased: true }), async (page) => {
    const original = await read(page);
    await title(page).fill('   ');
    await attemptConfirmation(page);
    assert.equal(await row(page).count(), 1);
    assert.equal(await title(page).inputValue(), '   ');
    assert.deepEqual(await read(page), original);
    assert.equal(await title(page).getAttribute('aria-invalid'), 'true');
  }));

  await check('failed storage keeps the row and draft; retry saves once and then removes it', () => withSeed(seed(), async (page) => {
    const original = await read(page);
    await page.evaluate((key) => {
      window.__belilogConfirmationSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new DOMException('Storage is full', 'QuotaExceededError');
        return window.__belilogConfirmationSetItem.call(this, name, value);
      };
    }, storageKey);
    await price(page).fill('12.75');
    await confirm(page).click();
    await frames(page);
    assert.equal(await row(page).count(), 1);
    assert.equal(await price(page).inputValue(), '12.75');
    assert.deepEqual(await read(page), original);
    assert.ok((await row(page).locator('.shopping-row-error').allInnerTexts()).join('').length > 0);
    assert.notEqual(await row(page).locator('.shopping-save-status').innerText(), 'Saved');
    await page.evaluate(() => {
      Storage.prototype.setItem = window.__belilogConfirmationSetItem;
      delete window.__belilogConfirmationSetItem;
    });
    await confirm(page).click();
    await until(async () => assert.equal(await row(page).count(), 0));
    assert.equal((await read(page)).transactions.length, 1);
    assert.equal((await read(page)).transactions[0].amount, 12.75);
    assert.deepEqual((await read(page)).shoppingList, []);
    await page.clock.fastForward(2_000);
    assert.equal((await read(page)).transactions.length, 1);
  }));

  for (const resolution of ['load', 'keep']) {
    await check(`cross-tab conflict blocks confirmation until explicit ${resolution} resolution`, () => withSeed(seed({ purchased: true }), async (a, context) => {
      const b = await open(context);
      await price(a).fill('12');
      await price(b).fill('20');
      await price(b).press('Enter');
      await until(async () => assert.equal(await a.locator('.shopping-conflict').count(), 1));
      await attemptConfirmation(a);
      assert.equal(await row(a).count(), 1);
      assert.equal((await read(a)).shoppingList.length, 1);
      assert.equal((await read(a)).transactions[0].amount, 20);
      assert.equal(await price(a).inputValue(), '12');
      await a.getByRole('button', { name: resolution === 'load' ? 'Load current values' : 'Keep my changes', exact: true }).click();
      await until(async () => assert.equal(await a.locator('.shopping-conflict').count(), 0));
      const expectedAmount = resolution === 'load' ? 20 : 12;
      await until(async () => assert.equal((await read(a)).transactions[0].amount, expectedAmount));
      await confirm(a).click();
      await until(async () => assert.equal(await row(a).count(), 0));
      const saved = await read(a);
      assert.equal(saved.transactions.length, 1);
      assert.equal(saved.transactions[0].id, 'expense');
      assert.equal(saved.transactions[0].amount, expectedAmount);
      assert.equal(saved.transactions[0].items[0].title, 'Sourdough');
      assert.deepEqual(saved.shoppingList, []);
      await until(async () => assert.equal(await row(b).count(), 0));
    }));
  }

  for (const language of ['ru', 'en']) for (const theme of ['light', 'dark']) for (const width of [320, 390]) {
    await check(`confirmation button is usable without mobile overflow: ${language}/${theme}/${width}`, () => withSeed(seed({ language, theme }), async (page) => {
      await price(page).fill('12.50');
      await confirm(page).waitFor({ state: 'visible' });
      const label = language === 'ru' ? 'Подтвердить покупку' : 'Confirm purchase';
      assert.ok((await confirm(page).innerText()).includes(label));
      await assertNoOverflow(page);
      const bounds = await confirm(page).boundingBox();
      assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44, JSON.stringify(bounds));
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, JSON.stringify(bounds));
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => {
        const report = await window.axe.run(document.querySelector('.shopping-page'), {
          runOnly: { type: 'rule', values: ['color-contrast', 'button-name', 'label'] },
        });
        return report.violations.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
        }));
      });
      assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
      await confirm(page).tap();
      await until(async () => assert.equal(await row(page).count(), 0));
      await assertNoOverflow(page);
      assert.equal((await read(page)).transactions.length, 1);
      assert.equal((await read(page)).transactions[0].amount, 12.5);
    }, { width, pauseClock: false }));
  }
} finally {
  await Promise.allSettled([...contexts].map((context) => context.close()));
  await browser.close();
  console.log(`${results.filter((result) => result.passed).length}/${results.length} shopping confirmation regressions passed`);
  if (errors.length) { process.exitCode = 1; console.error(errors.join('\n')); }
}
