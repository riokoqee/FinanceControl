// Production regressions for persisted check-ins, automatic freezes and local days.
// BELILOG_URL=http://127.0.0.1:5175/belilog/ node tests/streak-browser.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.BELILOG_URL ?? 'http://127.0.0.1:5175/belilog/';
const key = 'finance-control:data:v1';
const today = '2026-11-09';
const now = '2026-11-09T12:00:00+01:00';
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const errors = [];
let passed = 0;
let total = 0;

function day(offset) {
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
const entry = (date, id = date) => ({
  id, title: `Expense ${id}`, amount: 12.5, currency: 'EUR', category: 'food', date, createdAt: date,
});
const ledger = (confirmedDays = [], startedOn = '2026-10-01') => ({ version: 1, startedOn, confirmedDays });
const run = (count, endingOffset = -1) => Array.from({ length: count }, (_, index) => ({
  date: day(endingOffset - count + 1 + index), status: 'NO_SPEND',
}));
function seed(overrides = {}, language = 'en', theme = 'light') {
  return {
    version: 1,
    profile: { name: 'Check-in captain', email: '', currency: 'EUR', monthlyBudget: 300, theme, language },
    transactions: [],
    ...overrides,
  };
}
const read = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
const region = (page) => page.locator('.streak-bounty');
const dateCell = (page, date) => page.locator(`.streak-day[data-date="${date}"]`);
const bounty = async (page) => Number(await page.locator('.bounty-poster').getAttribute('data-bounty'));

async function until(check, message = 'Expected check-in state was not observed') {
  const deadline = Date.now() + 12_000;
  let cause;
  do {
    try { return await check(); } catch (error) { cause = error; }
    await delay(30);
  } while (Date.now() < deadline);
  throw new Error(message, { cause });
}
async function open(context, route = 'overview', time = now) {
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.clock.install({ time: new Date(time) });
  const url = new URL(baseUrl); url.hash = route;
  await page.goto(url.href);
  await page.locator(route === 'profile' ? '.profile-form' : '.overview-stats').waitFor();
  await region(page).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const data = await read(page);
  if (data.transactions.length || data.streak) {
    await until(async () => assert.equal((await read(page)).version, 3));
  }
  return page;
}
async function navigate(page, route) {
  await page.locator(`a[href="#${route}"]:visible`).first().click();
  await page.locator(route === 'profile' ? '.profile-form' : '.overview-stats').waitFor();
  await region(page).waitFor();
}
async function check(name, test, { data = seed(), width = 1024, time = now, route = 'overview' } = {}) {
  if (process.env.STREAK_CASE && !name.includes(process.env.STREAK_CASE)) return;
  total++;
  const context = await browser.newContext({
    viewport: { width, height: 950 }, timezoneId: 'Europe/Berlin', reducedMotion: 'reduce',
    isMobile: width <= 390, hasTouch: width <= 390,
  });
  await context.addInitScript(({ key, data }) => {
    if (!localStorage.getItem('__belilogStreakSeed')) {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem('__belilogStreakSeed', '1');
    }
    // Tests can deliberately retain an old UI while its mutation still reads
    // the latest primary, rather than depending on a narrow two-tab race.
    addEventListener('storage', (event) => {
      if (window.__belilogSuspendStreakSync) event.stopImmediatePropagation();
    }, true);
  }, { key, data });
  const errorCount = errors.length;
  try {
    await test(await open(context, route, time), context);
    assert.equal(errors.length, errorCount, errors.slice(errorCount).join('\n'));
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    process.exitCode = 1;
    console.error(`FAIL ${name}\n${error.stack ?? error}`);
  } finally { await context.close(); }
}
async function confirmToday(page) {
  await page.locator('.streak-no-spend').click();
  await until(async () => assert.equal((await read(page)).streak?.confirmedDays.find((entry) => entry.date === today)?.status, 'NO_SPEND'));
}
async function confirmPast(page, date) {
  await dateCell(page, date).click();
  await page.locator('.streak-day-backfill button').click();
}
async function addExpense(page, title = 'Bread after check-in', purchaseDay) {
  await page.getByRole('button', { name: /^(Add expense|Добавить расход)$/ }).first().click();
  await page.locator('.modal .form-grid input').first().fill(title);
  await page.locator('.amount-input').fill('2');
  if (purchaseDay) await page.locator('.modal input[type="date"]').fill(purchaseDay);
  await page.locator('.dialog-footer button[type="submit"]').click();
  await until(async () => assert.equal(await page.getByRole('dialog').count(), 0));
}
async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  assert.equal(dimensions.width, page.viewportSize().width, JSON.stringify(dimensions));
  assert.ok(dimensions.content <= dimensions.width + 1, JSON.stringify(dimensions));
}
async function accessibleTracking(page) {
  await page.addScriptTag({ path: axePath });
  const violations = await region(page).evaluate(async (element) => {
    const report = await window.axe.run(element, { runOnly: { type: 'rule', values: [
      'color-contrast', 'button-name', 'label', 'aria-valid-attr-value', 'aria-allowed-attr',
    ] } });
    return report.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
  });
  assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
  const undersized = await region(page).locator('button').evaluateAll((buttons) => buttons.flatMap((button) => {
    const box = button.getBoundingClientRect();
    if (!box.width || !box.height || button.disabled) return [];
    return box.width >= 43.5 && box.height >= 43.5 ? []
      : [{ name: button.getAttribute('aria-label') ?? button.textContent, width: box.width, height: box.height }];
  }));
  assert.deepEqual(undersized, [], JSON.stringify(undersized, null, 2));
}

try {
  for (const version of [1, 2]) {
    const transactions = [entry(day(-2)), entry(day(-1)), entry('2026-10-01'), entry('2026-10-02'), entry('2026-10-03')];
    const original = seed({ version, transactions });
    await check(`legacy v${version} migration preserves expenses, profile, current streak and best`, async (page) => {
      const saved = await read(page);
      assert.equal(saved.version, 3);
      assert.deepEqual(saved.profile, original.profile);
      assert.deepEqual(saved.transactions, transactions);
      assert.equal(saved.streak.startedOn, today);
      assert.deepEqual(saved.streak.confirmedDays, transactions.map(({ createdAt }) => ({ date: createdAt, status: 'LOGGED' }))
        .sort((left, right) => left.date.localeCompare(right.date)));
      assert.equal(await region(page).getAttribute('data-streak'), '2');
      assert.match(await page.locator('.streak-bounty-metrics > div').first().innerText(), /3/);
      assert.equal(await bounty(page), 1_000_000);
      await page.reload(); await region(page).waitFor();
      assert.deepEqual(await read(page), saved);
    }, { data: original });
  }

  await check('no-spend check-in persists without a fictional expense and agrees across profile, badge and poster', async (page) => {
    assert.equal(await page.locator('.bounty-poster').count(), 0);
    await confirmToday(page);
    const saved = await read(page);
    assert.deepEqual(saved.transactions, []);
    assert.deepEqual(saved.streak.confirmedDays, [{ date: today, status: 'NO_SPEND' }]);
    assert.equal(await region(page).getAttribute('data-streak'), '1');
    assert.equal(await bounty(page), 500_000);
    assert.equal(await page.locator('.streak-nav-badge').getAttribute('data-streak'), '1');
    assert.equal(await page.locator('.streak-no-spend').count(), 0);
    await page.reload(); await region(page).waitFor();
    assert.deepEqual(await read(page), saved);
    await navigate(page, 'profile');
    assert.equal(await region(page).getAttribute('data-today-status'), 'NO_SPEND');
    assert.equal(await bounty(page), 500_000);
    assert.deepEqual(await read(page), saved);
  });

  await check('a real expense upgrades a no-spend day to LOGGED without a second daily reward', async (page) => {
    await confirmToday(page);
    await addExpense(page);
    const saved = await read(page);
    assert.equal(saved.transactions.length, 1);
    assert.equal(saved.transactions[0].amount, 2);
    assert.deepEqual(saved.streak.confirmedDays, [{ date: today, status: 'LOGGED' }]);
    assert.equal(await region(page).getAttribute('data-streak'), '1');
    assert.equal(await bounty(page), 500_000);
    assert.equal(await dateCell(page, today).getAttribute('data-status'), 'LOGGED');
    await page.reload(); await region(page).waitFor();
    assert.deepEqual(await read(page), saved);
  });

  await check('a late purchase corrects a prior no-spend label and only rewards its new creation day', async (page) => {
    await addExpense(page, 'Yesterday’s purchase', day(-1));
    const saved = await read(page);
    assert.equal(saved.transactions[0].date, day(-1));
    assert.equal(saved.transactions[0].createdAt, today);
    assert.deepEqual(saved.streak.confirmedDays, [
      { date: day(-1), status: 'LOGGED' }, { date: today, status: 'LOGGED' },
    ]);
    assert.equal(await dateCell(page, day(-1)).getAttribute('data-status'), 'LOGGED');
    assert.equal(await bounty(page), 1_000_000);
  }, { data: seed({ version: 3, streak: ledger([{ date: day(-1), status: 'NO_SPEND' }]) }) });

  await check('the seventh check-in earns one freeze and midnight consumes it without new berries', async (page) => {
    await page.locator('.streak-no-spend').click();
    await until(async () => assert.equal(await region(page).getAttribute('data-freezes'), '1'));
    assert.equal(await region(page).getAttribute('data-streak'), '7');
    assert.equal(await bounty(page), 3_500_000);
    const facts = (await read(page)).streak.confirmedDays;
    // Jump over the following unconfirmed day. One midnight opens it; the next
    // closes it and spends the reserve, while timers run as an inactive tab would.
    await page.clock.fastForward(36 * 60 * 60 * 1000 + 1000);
    await until(async () => assert.equal(await dateCell(page, today).getAttribute('data-status'), 'FROZEN'));
    assert.equal(await region(page).getAttribute('data-freezes'), '0');
    assert.equal(await region(page).getAttribute('data-streak'), '7');
    assert.equal(await bounty(page), 3_500_000);
    assert.deepEqual((await read(page)).streak.confirmedDays, facts);
  }, { time: '2026-11-08T12:00:00+01:00', data: seed({ version: 3, streak: ledger(run(6, -2)) }) });

  await check('backfilling a frozen yesterday restores its freeze and awards only the confirmed day', async (page) => {
    assert.equal(await dateCell(page, day(-1)).getAttribute('data-status'), 'FROZEN');
    assert.equal(await region(page).getAttribute('data-freezes'), '0');
    assert.equal(await bounty(page), 3_500_000);
    await confirmPast(page, day(-1));
    await until(async () => assert.equal(await dateCell(page, day(-1)).getAttribute('data-status'), 'NO_SPEND'));
    assert.equal(await region(page).getAttribute('data-freezes'), '1');
    assert.equal(await region(page).getAttribute('data-streak'), '8');
    assert.equal(await bounty(page), 4_000_000);
    assert.equal((await read(page)).streak.confirmedDays.length, 8);
  }, { data: seed({ version: 3, streak: ledger(run(7, -2)) }) });

  await check('backfilling a missed yesterday can confirm its real purchase without creating another expense', async (page) => {
    const originalTransactions = (await read(page)).transactions;
    assert.equal(await dateCell(page, day(-1)).getAttribute('data-status'), 'MISSED');
    await dateCell(page, day(-1)).click();
    assert.equal(await page.locator('.streak-day-backfill button').innerText(), 'Confirm check-in');
    await page.locator('.streak-day-backfill button').click();
    await until(async () => assert.equal(await dateCell(page, day(-1)).getAttribute('data-status'), 'LOGGED'));
    assert.deepEqual((await read(page)).transactions, originalTransactions);
    assert.equal(await region(page).getAttribute('data-streak'), '3');
    assert.equal(await bounty(page), 1_500_000);
  }, { data: seed({ version: 3, streak: ledger([{ date: day(-2), status: 'NO_SPEND' }]),
    transactions: [{ ...entry(day(-1), 'backdated-purchase'), createdAt: today }] }) });

  await check('a day older than the backfill window has no confirmation action and leaves saved data intact', async (page) => {
    const saved = await read(page);
    await dateCell(page, day(-4)).click();
    assert.equal(await page.locator('.streak-day-backfill button').count(), 0);
    assert.equal(await dateCell(page, day(-4)).getAttribute('data-status'), 'MISSED');
    assert.deepEqual(await read(page), saved);
  }, { data: seed({ version: 3, streak: ledger() }) });

  await check('stale tabs confirm the same day once and union different-day check-ins', async (a, context) => {
    const b = await open(context);
    await a.evaluate(() => { window.__belilogSuspendStreakSync = true; });
    await confirmToday(b);
    await confirmToday(a);
    assert.equal((await read(a)).streak.confirmedDays.length, 1);
    assert.equal(await bounty(a), 500_000);
    assert.equal(await a.locator('.bounty-poster--increased').count(), 0, 'A stale tab must not celebrate a day already earned elsewhere');
    await dateCell(a, day(-1)).click();
    await a.locator('.streak-day-backfill button').click();
    await until(async () => assert.equal((await read(b)).streak.confirmedDays.length, 2));
    await until(async () => assert.equal(await region(b).getAttribute('data-streak'), '2'));
    assert.deepEqual((await read(a)).streak.confirmedDays, [
      { date: day(-1), status: 'NO_SPEND' }, { date: today, status: 'NO_SPEND' },
    ]);
    assert.equal(await bounty(a), 1_000_000);
    assert.equal(await bounty(b), 1_000_000);
  }, { data: seed({ version: 3, streak: ledger() }) });

  await check('a stale expense editor respects another tab’s no-spend reward without replaying it', async (a, context) => {
    const b = await open(context);
    await a.evaluate(() => { window.__belilogSuspendStreakSync = true; });
    await confirmToday(b);
    await addExpense(a);
    const saved = await read(a);
    assert.equal(saved.transactions.length, 1);
    assert.deepEqual(saved.streak.confirmedDays, [{ date: today, status: 'LOGGED' }]);
    assert.equal(await bounty(a), 500_000);
    assert.equal(await a.locator('.bounty-poster--increased').count(), 0);
  }, { data: seed({ version: 3, streak: ledger() }) });

  await check('a quota failure keeps the check-in retryable and never claims an unsaved reward', async (page) => {
    const saved = await read(page);
    await page.evaluate((key) => {
      window.__streakOriginalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new DOMException('Storage is full', 'QuotaExceededError');
        return window.__streakOriginalSetItem.call(this, name, value);
      };
    }, key);
    await page.locator('.streak-no-spend').click();
    assert.deepEqual(await read(page), saved);
    assert.equal(await page.locator('.bounty-poster').count(), 0);
    assert.equal(await page.locator('.streak-no-spend').isEnabled(), true);
    assert.equal(await region(page).getAttribute('data-streak'), '0');
    await page.evaluate(() => { Storage.prototype.setItem = window.__streakOriginalSetItem; });
    await confirmToday(page);
    assert.equal(await bounty(page), 500_000);
    assert.equal((await read(page)).streak.confirmedDays.length, 1);
  });

  await check('check-ins alone require confirmation before demo data can replace them', async (page) => {
    await confirmToday(page);
    await navigate(page, 'profile');
    const saved = await read(page);
    assert.deepEqual(saved.transactions, []);
    await page.locator('.demo-card button').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Load demo', exact: true }).waitFor();
    assert.deepEqual(await read(page), saved);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(await read(page), saved);
  }, { data: seed({ profile: { name: 'Пользователь', email: '', currency: 'USD', monthlyBudget: 0, language: 'en', theme: 'light' } }) });

  await check('a full PDF backup restores check-ins and profile without inventing expense records', async (page) => {
    await confirmToday(page);
    await navigate(page, 'profile');
    const saved = await read(page);
    const downloaded = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: 'PDF backup with all your data', exact: true }).click();
    const download = await downloaded;
    const path = await download.path();
    assert.ok(path);
    const bytes = await readFile(path);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    await page.locator('.profile-form input[required]').fill('Temporary captain');
    await page.locator('.profile-form button[type="submit"]').click();
    await until(async () => assert.equal((await read(page)).profile.name, 'Temporary captain'));
    await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({
      name: download.suggestedFilename(), mimeType: 'application/pdf', buffer: bytes,
    });
    await page.getByRole('button', { name: 'Restore everything', exact: true }).click();
    await until(async () => assert.deepEqual(await read(page), saved));
    await page.reload(); await page.locator('.profile-form').waitFor();
    assert.deepEqual(await read(page), saved);
    assert.equal(await bounty(page), 500_000);
  });

  for (const language of ['ru', 'en']) for (const theme of ['light', 'dark']) {
    await check(`check-in statuses and actions remain accessible at 360px: ${language}/${theme}`, async (page) => {
      assert.equal(await region(page).getAttribute('data-freezes'), '2');
      assert.equal(await dateCell(page, today).getAttribute('data-status'), 'PENDING');
      assert.equal(await dateCell(page, day(-1)).getAttribute('data-status'), 'NO_SPEND');
      assert.ok(await page.locator('.streak-no-spend').getAttribute('class'));
      await noOverflow(page); await accessibleTracking(page);
      await dateCell(page, day(-4)).click();
      assert.ok(await page.locator('.streak-day-detail-label').innerText());
      await noOverflow(page);
      await page.locator('.streak-no-spend').click();
      await until(async () => assert.equal(await region(page).getAttribute('data-today-status'), 'NO_SPEND'));
      assert.equal(await region(page).getAttribute('data-freezes'), '2');
      await navigate(page, 'profile');
      await noOverflow(page);
      // axe has to be installed again only after a full document navigation.
      const violations = await region(page).evaluate(async (element) => (await window.axe.run(element, {
        runOnly: { type: 'rule', values: ['color-contrast', 'button-name', 'aria-valid-attr-value'] },
      })).violations.map(({ id }) => id));
      assert.deepEqual(violations, []);
      assert.equal(await dateCell(page, today).getAttribute('data-status'), 'NO_SPEND');
    }, { width: 360, data: seed({ version: 3, streak: ledger(run(21)) }, language, theme) });
  }
} finally { await browser.close(); }

console.log(`${passed}/${total} streak browser checks passed.`);
if (passed !== total) process.exitCode = 1;
