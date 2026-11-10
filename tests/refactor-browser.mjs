// Production regressions for route state, domain controllers and keyed feedback.
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.BELILOG_URL ?? 'http://127.0.0.1:5175/belilog/';
const key = 'finance-control:data:v1';
const today = '2026-11-10';
const now = '2026-11-10T12:00:00+01:00';
const ready = { overview: '.overview-stats', tracker: '.tracker-panel', shopping: '.shopping-add-form', profile: '.profile-form' };
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const errors = [];
let passed = 0;
let total = 0;
const expense = (patch = {}) => ({ id: 'bread', title: 'Bread', amount: 5, currency: 'EUR', category: 'food', date: today, createdAt: today, ...patch });
const seed = (patch = {}) => ({
  version: 3,
  profile: { name: 'Controller captain', email: '', currency: 'EUR', monthlyBudget: 100, theme: 'light', language: 'en' },
  transactions: [expense()],
  streak: { version: 1, startedOn: today, confirmedDays: [{ date: today, status: 'LOGGED' }] },
  ...patch,
});
const read = (page) => page.evaluate((name) => JSON.parse(localStorage.getItem(name)), key);
async function until(check) {
  const deadline = Date.now() + 12_000;
  let cause;
  do {
    try { return await check(); } catch (error) { cause = error; }
    await delay(25);
  } while (Date.now() < deadline);
  throw new Error('Expected refactor regression state was not observed', { cause });
}
async function open(context, route) {
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(`${message.type()}: ${message.text()}`);
  });
  await page.clock.install({ time: new Date(now) });
  const url = new URL(baseUrl); url.hash = route;
  await page.goto(url.href);
  await page.locator(ready[route]).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  return page;
}
async function settle(page, selector) {
  // React keeps a lazy loading fallback briefly; advance it explicitly while
  // profile autosave/reward expiry remain under the test's clock control.
  await until(async () => {
    await page.clock.runFor(50);
    assert.equal(await page.locator(selector).first().isVisible(), true);
  });
}
async function routeReady(page, route) {
  await settle(page, ready[route]);
  await until(async () => assert.equal(await page.locator('.nav-active').getAttribute('href'), `#${route}`));
}
async function navigate(page, route) {
  await page.locator(`.nav-list a[href="#${route}"]`).click();
  await routeReady(page, route);
}
async function countWrites(page) {
  await page.evaluate((key) => {
    window.__controllerWrites = 0;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) window.__controllerWrites++;
      return set.call(this, name, value);
    };
  }, key);
}
async function check(name, run, { data = seed(), route = 'overview', width = 1200 } = {}) {
  if (process.env.REFACTOR_CASE && !name.includes(process.env.REFACTOR_CASE)) return;
  total++;
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Europe/Berlin', reducedMotion: 'reduce',
    isMobile: width <= 390, hasTouch: width <= 390 });
  await context.addInitScript(({ key, data }) => {
    if (!localStorage.getItem('__controllerSeed')) {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem('__controllerSeed', '1');
    }
  }, { key, data });
  const errorCount = errors.length;
  try {
    await run(await open(context, route));
    assert.equal(errors.length, errorCount, errors.slice(errorCount).join('\n'));
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    process.exitCode = 1;
    console.error(`FAIL ${name}\n${error.stack ?? error}`);
    if (error.cause) console.error(`Caused by: ${error.cause.stack ?? error.cause}`);
  } finally { await context.close(); }
}

try {
  await check('direct hash changes flush a queued profile draft once, including back and forward', async (page) => {
    await countWrites(page);
    await page.locator('.profile-form input[required]').fill('Hash captain');
    assert.equal((await read(page)).profile.name, 'Controller captain');
    await page.evaluate(() => { location.hash = 'tracker'; });
    await until(async () => assert.equal((await read(page)).profile.name, 'Hash captain'));
    await routeReady(page, 'tracker');
    assert.equal((await read(page)).profile.name, 'Hash captain');
    assert.equal(await page.evaluate(() => window.__controllerWrites), 1);
    await page.goBack(); await routeReady(page, 'profile');
    assert.equal(await page.locator('.profile-form input[required]').inputValue(), 'Hash captain');
    await page.goForward(); await routeReady(page, 'tracker');
    assert.equal(await page.evaluate(() => window.__controllerWrites), 1);
  }, { route: 'profile' });

  await check('mobile navigation flushes a draft before switching the URL without a duplicate write', async (page) => {
    await countWrites(page);
    await page.locator('.profile-form input[required]').fill('Mobile captain');
    await navigate(page, 'overview');
    assert.equal((await read(page)).profile.name, 'Mobile captain');
    assert.equal(await page.evaluate(() => window.__controllerWrites), 1);
    await navigate(page, 'profile');
    assert.equal(await page.locator('.profile-form input[required]').inputValue(), 'Mobile captain');
    const sizes = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
    assert.ok(sizes.content <= sizes.width + 1, JSON.stringify(sizes));
  }, { route: 'profile', width: 360 });

  await check('invalid profile text remains a draft across direct hash changes', async (page) => {
    await countWrites(page);
    await page.locator('.profile-form input[type="email"]').fill('unfinished@');
    await page.locator('.profile-form input[required]').fill('Unfinished captain');
    await page.evaluate(() => { location.hash = 'overview'; });
    await routeReady(page, 'overview');
    assert.equal((await read(page)).profile.name, 'Controller captain');
    assert.equal((await read(page)).profile.email, '');
    await page.goBack(); await routeReady(page, 'profile');
    assert.equal(await page.locator('.profile-form input[required]').inputValue(), 'Unfinished captain');
    assert.equal(await page.locator('.profile-form input[type="email"]').inputValue(), 'unfinished@');
    assert.equal(await page.evaluate(() => window.__controllerWrites), 0);
  }, { route: 'profile' });

  await check('detail-to-editor transition has one dialog and Escape restores transaction focus', async (page) => {
    const row = page.locator('.transaction-open').first();
    await row.focus(); await row.press('Enter');
    await settle(page, '.add-item-form');
    await page.clock.runFor(32);
    assert.equal(await page.getByRole('dialog').count(), 1);
    await page.getByRole('button', { name: 'Edit record', exact: true }).click();
    await settle(page, '.modal .form-grid input');
    await page.clock.runFor(32);
    assert.equal(await page.getByRole('dialog').count(), 1);
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))), true);
    await page.keyboard.press('Escape');
    await until(async () => assert.equal(await page.getByRole('dialog').count(), 0));
    await until(async () => assert.equal(await row.evaluate((element) => element === document.activeElement), true));
  }, { route: 'tracker' });

  await check('English expense feedback stays translated through create, delete and undo', async (page) => {
    await page.getByRole('button', { name: 'Add expense', exact: true }).first().click();
    await settle(page, '.modal .form-grid input');
    await page.locator('.modal .form-grid input').first().fill('English feedback');
    await page.locator('.amount-input').fill('2');
    await page.locator('.dialog-footer button[type="submit"]').click();
    await until(async () => assert.equal(await page.getByRole('dialog').count(), 0));
    await until(async () => assert.match(await page.locator('.toast').innerText(), /Expense added\. Everything is under control!/));
    await navigate(page, 'tracker');
    await page.getByRole('button', { name: 'Delete English feedback', exact: true }).click();
    await until(async () => assert.match(await page.locator('.toast').innerText(), /Expense deleted/));
    await page.locator('.toast-action').click();
    await until(async () => assert.match(await page.locator('.toast').innerText(), /Expense restored/));
    assert.equal((await read(page)).transactions.filter(({ title }) => title === 'English feedback').length, 1);
    assert.doesNotMatch(await page.locator('.toast').innerText(), /[А-Яа-яЁё]/);
  });

  const manualData = seed({ version: 4, transactions: [], streak: { version: 1, startedOn: today, confirmedDays: [] },
    shoppingList: [], shoppingTemplates: [{ id: 'weekly', name: 'Weekly groceries', items: [{ title: 'Milk', currency: 'EUR' }] }] });
  manualData.profile.exchangeRates = { USD: 1, EUR: 0.5, KZT: 500 };
  await check('check-in and shopping templates retain manual rates and upgrade one daily fact', async (page) => {
    await page.locator('.streak-no-spend').click();
    await until(async () => assert.deepEqual((await read(page)).streak.confirmedDays, [{ date: today, status: 'NO_SPEND' }]));
    assert.equal((await read(page)).version, 4);
    await navigate(page, 'shopping');
    await page.locator('.shopping-templates-button').click();
    await settle(page, '.shopping-template-apply');
    await page.locator('.shopping-template-apply').click();
    await page.locator('.shopping-price-input').fill('2');
    await page.locator('.shopping-confirm').click();
    await until(async () => assert.equal((await read(page)).transactions.length, 1));
    const saved = await read(page);
    assert.equal(saved.version, 4);
    assert.deepEqual(saved.profile.exchangeRates, manualData.profile.exchangeRates);
    assert.deepEqual(saved.streak.confirmedDays, [{ date: today, status: 'LOGGED' }]);
    assert.deepEqual(saved.shoppingList, []);
    await page.reload(); await settle(page, ready.shopping);
    assert.deepEqual(await read(page), saved);
  }, { data: manualData });

  const russianProfile = seed();
  russianProfile.profile.language = 'ru';
  await check('restore and reset feedback follows the newly committed profile language', async (page) => {
    const incoming = seed({ transactions: [expense({ id: 'restored', title: 'Restored journal' })] });
    await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({
      name: 'english-profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)),
    });
    await settle(page, '.import-actions');
    await page.getByRole('button', { name: 'Восстановить всё', exact: true }).click();
    await until(async () => assert.equal((await read(page)).profile.language, 'en'));
    await until(async () => assert.equal(await page.locator('html').getAttribute('lang'), 'en'));
    assert.match(await page.locator('.page-heading h1').innerText(), /My profile/);
    assert.deepEqual((await read(page)).transactions, incoming.transactions);
    const restoredToast = await page.locator('.toast > span').innerText();
    await page.locator('.data-danger-zone button').click();
    await settle(page, '.modal .dialog-footer');
    await page.getByRole('dialog').getByRole('button', { name: 'Delete all data', exact: true }).click();
    await until(async () => assert.equal((await read(page)).profile.language, 'ru'));
    await until(async () => assert.equal(await page.locator('html').getAttribute('lang'), 'ru'));
    assert.match(await page.locator('.page-heading h1').innerText(), /Мой профиль/);
    assert.deepEqual((await read(page)).transactions, []);
    const resetToast = await page.locator('.toast > span').innerText();
    assert.deepEqual({ restoredToast, resetToast }, {
      restoredToast: 'Backup restored', resetToast: 'Данные удалены. Можно начать заново.',
    });
  }, { route: 'profile', data: russianProfile });

  await check('undo restores an expense without overwriting a newly edited shopping plan', async (page) => {
    await page.getByRole('button', { name: 'Delete Bread', exact: true }).click();
    await until(async () => assert.equal((await read(page)).transactions.length, 0));
    await navigate(page, 'shopping');
    await page.locator('.shopping-title-input').fill('Milk');
    await page.locator('.shopping-title-input').press('Enter');
    await page.locator('.shopping-currency').focus();
    await page.locator('.shopping-currency').selectOption('KZT');
    await page.locator('h1').click();
    await until(async () => assert.equal((await read(page)).shoppingList[0].currency, 'KZT'));
    await page.locator('.toast-action').click();
    await until(async () => assert.equal((await read(page)).transactions.length, 1));
    const saved = await read(page);
    assert.deepEqual(saved.transactions, [expense()]);
    assert.equal(saved.shoppingList[0].title, 'Milk');
    assert.equal(saved.shoppingList[0].currency, 'KZT');
    assert.equal(saved.shoppingList[0].transactionId, undefined);
    await page.reload(); await settle(page, ready.shopping);
    assert.deepEqual(await read(page), saved);
  }, { route: 'tracker', data: seed({ shoppingList: [{ id: 'planned-bread', title: 'Bread', currency: 'EUR', createdAt: today, transactionId: 'bread' }] }) });
} finally {
  await browser.close();
  console.log(`\n${passed}/${total} controller refactor regressions passed`);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
}
