// Run against a built preview: BELILOG_URL=http://127.0.0.1:5175/FinanceControl/ node tests/browser-regressions.mjs
// Set CHROMIUM_PATH when using a system browser instead of Playwright's bundled Chromium.
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
const results = [];
const pageErrors = [];

function seed({ language = 'en', theme = 'light', pending = false, name = 'Browser regression' } = {}) {
  return {
    version: 1,
    profile: { name, email: '', currency: 'USD', monthlyBudget: 0, theme, language },
    transactions: pending ? [] : [{
      id: 'linked-expense', title: 'Original', amount: 10, currency: 'USD', category: 'food', date: today, createdAt: today,
    }],
    shoppingList: [{
      id: 'product', title: 'Original', currency: 'USD', createdAt: today,
      ...(pending ? {} : { transactionId: 'linked-expense' }),
    }],
  };
}

async function until(check, message = 'Expected state was not observed') {
  const deadline = Date.now() + 8_000;
  let error;
  do {
    try { return await check(); } catch (cause) { error = cause; }
    await delay(30);
  } while (Date.now() < deadline);
  throw new Error(message, { cause: error });
}

async function tab(context, route = 'shopping', pauseClock = true) {
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  await page.clock.install();
  await page.clock.resume();
  const url = new URL(baseUrl);
  url.hash = route;
  await page.goto(url.href);
  await page.locator('h1').first().waitFor();
  await page.locator({ overview: '.overview-stats', tracker: '.tracker-panel', shopping: '.shopping-add-form', profile: '.profile-form' }[route]).waitFor();
  await page.evaluate(() => document.fonts.ready);
  // Pause after loading so 599/600 ms checks do not include real action time.
  if (pauseClock) await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
  return page;
}

async function withSeed(data, run, { route = 'shopping', width = 1024, pauseClock = true } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 950 }, timezoneId: 'Europe/Berlin', reducedMotion: 'reduce',
  });
  contexts.add(context);
  await context.addInitScript(({ data, storageKey }) => {
    if (localStorage.getItem('__belilog_browser_regression_seed')) return;
    localStorage.setItem(storageKey, JSON.stringify(data));
    localStorage.setItem('__belilog_browser_regression_seed', '1');
  }, { data, storageKey });
  try { await run(await tab(context, route, pauseClock), context); }
  finally { contexts.delete(context); await context.close(); }
}

async function check(name, run) {
  const errorCount = pageErrors.length;
  try {
    await run();
    assert.equal(pageErrors.length, errorCount, pageErrors.slice(errorCount).join('\n'));
    results.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false });
    process.exitCode = 1;
    console.error(`FAIL ${name}\n${error.stack ?? error}`);
  }
}

const read = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
const price = (page) => page.locator('.shopping-price-input').first();
const currency = (page) => page.locator('.shopping-currency').first();
const blur = (page) => page.locator('h1').first().click();
async function navigate(page, route) {
  await page.clock.resume();
  await page.locator(`a[href="#${route}"]:visible`).first().click();
  await page.locator({ overview: '.overview-stats', tracker: '.tracker-panel', shopping: '.shopping-add-form', profile: '.profile-form' }[route]).waitFor();
  assert.equal(new URL(page.url()).hash, `#${route}`);
}
async function assertAmount(page, amount) {
  await until(async () => assert.equal((await read(page)).transactions[0]?.amount, amount));
}
async function assertNoOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(dimensions.content <= dimensions.width + 1, JSON.stringify(dimensions));
}

try {
  await check('focused untouched price reconciles on blur; currency keeps current amount', () => withSeed(seed(), async (a, context) => {
    const b = await tab(context);
    await price(a).focus();
    await price(b).fill('20');
    await price(b).press('Enter');
    await assertAmount(a, 20);
    assert.equal(await price(a).inputValue(), '10');
    await blur(a);
    await until(async () => assert.equal(await price(a).inputValue(), '20'));
    await currency(a).selectOption('EUR');
    await a.clock.fastForward(600);
    await until(async () => {
      const data = await read(a);
      assert.deepEqual(data.transactions.map((item) => [item.id, item.amount, item.currency]), [['linked-expense', 20, 'EUR']]);
    });
  }));

  for (const resolution of ['load', 'keep']) {
    await check(`dirty shopping price conflict blocks implicit saves; explicit ${resolution}`, () => withSeed(seed(), async (a, context) => {
      const b = await tab(context);
      await price(a).fill('12');
      await price(b).fill('20');
      await price(b).press('Enter');
      await until(async () => assert.equal(await a.locator('.shopping-conflict').count(), 1));
      await a.clock.fastForward(1_000);
      await blur(a);
      await price(a).press('Enter');
      await a.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await assertAmount(a, 20);
      assert.equal(await price(a).inputValue(), '12');
      assert.equal(await a.getByRole('dialog').count(), 0);
      await a.getByRole('button', { name: resolution === 'load' ? 'Load current values' : 'Keep my changes', exact: true }).click();
      const expected = resolution === 'load' ? 20 : 12;
      await assertAmount(a, expected);
      assert.equal(await price(a).inputValue(), String(expected));
      assert.equal(await a.locator('.shopping-conflict').count(), 0);
      assert.equal((await read(a)).transactions[0].id, 'linked-expense');
      assert.equal((await read(a)).transactions.length, 1);
    }));
  }

  await check('stale manual title edit preserves remote amount and purchase details', () => withSeed(seed(), async (a, context) => {
    const b = await tab(context, 'tracker');
    await a.clock.resume();
    await b.clock.resume();
    await a.locator('.row-actions button').first().click();
    await a.locator('.amount-input').waitFor();
    await b.locator('.transaction-open').first().click();
    await b.locator('.add-item-form input').nth(0).fill('Remote item');
    await b.locator('.add-item-form input').nth(1).fill('5');
    await b.locator('.add-item-form button').click();
    await b.getByRole('button', { name: 'Edit record', exact: true }).click();
    await b.locator('.amount-input').fill('20');
    await b.locator('.dialog-footer button[type="submit"]').click();
    await assertAmount(a, 20);
    await a.locator('.modal .form-grid input').first().fill('Only title edited');
    await a.locator('.dialog-footer button[type="submit"]').click();
    await until(async () => {
      const transaction = (await read(a)).transactions[0];
      assert.equal(transaction.title, 'Only title edited');
      assert.equal(transaction.amount, 20);
      assert.equal(transaction.items?.length, 1);
      assert.equal(transaction.items[0].title, 'Remote item');
      assert.equal(transaction.items[0].amount, 5);
    });
    assert.equal(await a.getByRole('dialog').count(), 0);
  }, { route: 'tracker' }));

  await check('externally deleted expense clears an untouched focused price on blur', () => withSeed(seed(), async (a, context) => {
    const b = await tab(context, 'tracker');
    await price(a).focus();
    await b.locator('.delete-action').first().click();
    await until(async () => assert.equal((await read(a)).transactions.length, 0));
    await blur(a);
    await until(async () => assert.equal(await price(a).inputValue(), ''));
    assert.equal(await a.locator('.shopping-item-state').innerText(), 'Planned');
    await a.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    assert.equal((await read(a)).transactions.length, 0);
  }));

  await check('deleted expense does not reappear from a dirty draft without acknowledgement', () => withSeed(seed(), async (a, context) => {
    const b = await tab(context, 'tracker');
    await price(a).fill('12');
    await b.locator('.delete-action').first().click();
    await until(async () => assert.equal(await a.locator('.shopping-conflict').count(), 1));
    await a.clock.fastForward(1_000);
    await a.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    assert.equal((await read(a)).transactions.length, 0);
    await a.getByRole('button', { name: 'Keep my changes', exact: true }).click();
    const data = await read(a);
    assert.equal(data.transactions.length, 1);
    assert.equal(data.transactions[0].amount, 12);
    assert.notEqual(data.transactions[0].id, 'linked-expense');
    assert.equal(data.shoppingList[0].transactionId, data.transactions[0].id);
  }));

  await check('600 ms autosave, blur and Enter reuse the expense', () => withSeed(seed(), async (page) => {
    await price(page).fill('12');
    await page.clock.fastForward(599);
    assert.equal((await read(page)).transactions[0].amount, 10);
    await page.clock.fastForward(1);
    await assertAmount(page, 12);
    await price(page).fill('14');
    await price(page).press('Enter');
    await assertAmount(page, 14);
    await price(page).fill('16');
    await blur(page);
    await assertAmount(page, 16);
    assert.equal((await read(page)).transactions.length, 1);
    assert.equal((await read(page)).transactions[0].id, 'linked-expense');
  }));

  await check('rapid row flushes and navigation persist every edit once', () => {
    const data = seed({ pending: true });
    data.shoppingList = ['Alpha', 'Beta'].map((title) => ({ id: title, title, currency: 'USD', createdAt: today }));
    return withSeed(data, async (page) => {
      await page.locator('[data-shopping-item="Alpha"] .shopping-price-input').fill('3.25');
      await page.locator('[data-shopping-item="Beta"] .shopping-price-input').fill('4.75');
      await page.locator('[data-shopping-item="Alpha"] .shopping-title-input').fill('Fresh Alpha');
      await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pagehide')); });
      await page.clock.fastForward(1_000);
      await navigate(page, 'overview');
      await page.reload();
      const saved = await read(page);
      assert.equal(saved.transactions.length, 2);
      assert.deepEqual(saved.transactions.map((item) => item.amount).sort((a, b) => a - b), [3.25, 4.75]);
      assert.equal(saved.transactions.find((item) => item.amount === 3.25).title, 'Fresh Alpha');
      assert.equal(new Set(saved.shoppingList.map((item) => item.transactionId)).size, 2);
    });
  });

  await check('invalid price remains a draft while currency saves without Saved status', () => withSeed(seed(), async (page) => {
    await price(page).fill('2.');
    await currency(page).selectOption('EUR');
    await page.clock.fastForward(600);
    const transaction = (await read(page)).transactions[0];
    assert.equal(transaction.amount, 10);
    assert.equal(transaction.currency, 'EUR');
    assert.equal(await price(page).inputValue(), '2.');
    assert.equal(await price(page).getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('.shopping-save-status').innerText(), '');
  }));

  await check('keyboard detail close and notification expiry preserve row focus', () => withSeed(seed(), async (page) => {
    await page.clock.resume();
    const row = page.locator('.transaction-open').first();
    await row.focus();
    await row.press('Enter');
    await page.locator('.add-item-form').waitFor();
    await page.clock.runFor(32);
    await page.keyboard.press('Escape');
    await until(async () => assert.equal(await row.evaluate((element) => element === document.activeElement), true));
    await page.locator('.row-actions button').first().click();
    await page.locator('.modal .form-grid input').first().fill('Focus after notification');
    await page.locator('.dialog-footer button[type="submit"]').click();
    await row.focus();
    const focused = await row.elementHandle();
    await page.clock.fastForward(7_000);
    assert.equal(await focused.evaluate((element) => element.isConnected && element === document.activeElement), true);
  }, { route: 'tracker' }));

  await check('chart keys and touch selector agree; calendar has one keyboard entry', () => withSeed(seed(), async (page) => {
    const chart = page.locator('.chart-container svg');
    const select = page.locator('.chart-selected-detail select');
    await chart.focus();
    await chart.press('Home');
    assert.equal(await select.inputValue(), '0');
    await chart.press('ArrowRight');
    assert.equal(await select.inputValue(), '1');
    await select.selectOption('0');
    assert.equal(await select.inputValue(), '0');
    await navigate(page, 'profile');
    await page.locator('.activity-year button').first().click();
    assert.equal(await page.locator('.activity-day[tabindex="0"]').count(), 1);
    const day = page.locator('.activity-day[tabindex="0"]');
    await day.focus();
    await day.press('Control+Home');
    const first = page.locator('.activity-day[tabindex="0"]');
    assert.ok((await first.getAttribute('data-date')).endsWith('-01-01'));
    await first.press('ArrowDown');
    assert.ok((await page.locator('.activity-day[tabindex="0"]').getAttribute('data-date')).endsWith('-01-02'));
    assert.equal(await page.locator('.activity-day[tabindex="0"]').count(), 1);
  }, { route: 'overview' }));

  for (const language of ['ru', 'en']) for (const theme of ['light', 'dark']) for (const width of [320, 390]) {
    await check(`maximum unbroken name fits mobile profile and overview: ${language}/${theme}/${width}`, () => withSeed(seed({
      language, theme, name: 'W'.repeat(80),
    }), async (page) => {
      await assertNoOverflow(page);
      assert.equal(await page.locator('.profile-identity strong').innerText(), 'W'.repeat(80));
      await navigate(page, 'overview');
      await assertNoOverflow(page);
    }, { route: 'profile', width, pauseClock: false }));
  }

  for (const language of ['ru', 'en']) for (const theme of ['light', 'dark']) for (const route of ['overview', 'shopping', 'tracker', 'profile']) {
    await check(`sampled text contrast: ${route}/${language}/${theme}/390`, () => withSeed(seed({ language, theme }), async (page) => {
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => {
        const report = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] } });
        return report.violations.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
        }));
      });
      assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
    }, { route, width: 390, pauseClock: false }));
  }
} finally {
  await Promise.allSettled([...contexts].map((context) => context.close()));
  await browser.close();
  console.log(`${results.filter((result) => result.passed).length}/${results.length} browser regressions passed`);
  if (pageErrors.length) { process.exitCode = 1; console.error(pageErrors.join('\n')); }
}
