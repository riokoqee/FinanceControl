// Production regressions for bounded lists, deferred bundles and debounced persistence.
// BELILOG_URL=http://127.0.0.1:5175/FinanceControl/ node tests/performance-regressions.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

const baseUrl = process.env.BELILOG_URL ?? 'http://127.0.0.1:5175/FinanceControl/';
const KEY = 'finance-control:data:v1';
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
let passed = 0, total = 0;
const errors = [];
const scriptRequests = new WeakMap();
const requestedScripts = (page) => [...scriptRequests.get(page)];
const seed = ({ products = 0, language = 'en', purchased = 0 } = {}) => ({
  version: 1,
  profile: { name: 'Benchmark', email: '', currency: 'USD', monthlyBudget: 100, theme: 'light', language },
  transactions: Array.from({ length: purchased }, (_, index) => ({
    id: `expense-${index}`, title: `Product ${index}`, amount: 10, currency: 'USD', category: 'food', date: today,
  })),
  shoppingList: Array.from({ length: products }, (_, index) => ({
    id: `product-${index}`, title: `Product ${index}`, currency: 'USD', createdAt: today,
    ...(index < purchased ? { transactionId: `expense-${index}` } : {}),
  })),
});
const read = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
const row = (page, index) => page.locator(`[data-shopping-item="product-${index}"]`);
const rows = (page) => page.locator('[data-shopping-item]');
const frames = (page) => page.clock.runFor(32);
const writes = (page) => page.evaluate(() => window.__performanceWrites);
const resetWrites = (page) => page.evaluate(() => { window.__performanceWrites = { primary: 0, lastGood: 0 }; });

async function until(check, message = 'Expected application state was not observed') {
  const deadline = Date.now() + 10_000;
  let cause;
  do { try { return await check(); } catch (error) { cause = error; } await delay(30); } while (Date.now() < deadline);
  throw new Error(message, { cause });
}
async function open(context, route = 'shopping') {
  const page = await context.newPage();
  const requested = new Set();
  scriptRequests.set(page, requested);
  page.on('request', (request) => {
    const name = new URL(request.url()).pathname.split('/').at(-1);
    if (name?.endsWith('.js')) requested.add(name);
  });
  page.setDefaultTimeout(15_000);
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.clock.install();
  await page.clock.resume();
  const target = new URL(baseUrl); target.hash = route;
  await page.goto(target.href);
  await page.locator('h1').first().waitFor();
  if (route === 'shopping') await page.locator('.shopping-add-name input').waitFor();
  if (route === 'profile') await page.locator('.profile-form input[required]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
  return page;
}
async function test(name, fn, { data = seed(), route = 'shopping' } = {}) {
  total++;
  const context = await browser.newContext({ viewport: { width: 1024, height: 950 },
    reducedMotion: 'reduce', timezoneId: 'Europe/Berlin' });
  await context.addInitScript(({ KEY, data }) => {
    if (!localStorage.getItem('__performance_seed')) {
      localStorage.setItem(KEY, JSON.stringify(data));
      localStorage.setItem('__performance_seed', '1');
    }
    window.__performanceWrites = { primary: 0, lastGood: 0 };
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      const result = original.call(this, key, value);
      if (key === KEY) window.__performanceWrites.primary++;
      if (key === `${KEY}:last-good`) window.__performanceWrites.lastGood++;
      return result;
    };
  }, { KEY, data });
  const errorCount = errors.length;
  try {
    await fn(await open(context, route), context);
    assert.equal(errors.length, errorCount, errors.slice(errorCount).join('\n'));
    passed++; console.log(`PASS ${name}`);
  } catch (error) { process.exitCode = 1; console.error(`FAIL ${name}\n${error.stack ?? error}`); }
  finally { await context.close(); }
}

try {
  for (const language of ['ru', 'en']) {
    await test(`${language}: 1,000 products mount only 50; show more preserves focused drafts and the 600 ms autosave`, async (page) => {
      assert.equal(await rows(page).count(), 50);
      assert.equal(await page.locator('.shopping-counts > span').first().locator('strong').innerText(), '1000');
      const price = row(page, 0).locator('.shopping-price-input');
      await price.fill('12.50');
      await price.evaluate((input) => { window.__originalPriceInput = input; });
      assert.equal((await read(page)).transactions.length, 0);
      // Avoid blur: revealing more rows must not remount the focused row or cancel its timer.
      await page.getByRole('button', { name: language === 'en' ? /^Show more/ : /^Показать ещё/ })
        .evaluate((button) => button.click());
      await until(async () => assert.equal(await rows(page).count(), 100));
      assert.equal(await price.evaluate((input) => input === window.__originalPriceInput), true);
      assert.equal(await price.evaluate((input) => document.activeElement === input), true);
      assert.equal(await price.inputValue(), '12.50');
      await page.clock.fastForward(599);
      assert.equal((await read(page)).transactions.length, 0);
      await page.clock.fastForward(1);
      await until(async () => assert.equal((await read(page)).transactions[0]?.amount, 12.5));
      assert.equal(await rows(page).count(), 100);
      assert.equal(await price.evaluate((input) => input === window.__originalPriceInput), true);
    }, { data: seed({ products: 1000, language }) });
  }

  await test('adding the 1,000th product reveals it while keeping the rest of the list bounded', async (page) => {
    assert.equal(await rows(page).count(), 50);
    await page.locator('.shopping-add-name input').fill('Newly added product');
    await page.locator('.shopping-add-form button[type="submit"]').click();
    await until(async () => assert.equal((await read(page)).shoppingList.length, 1000));
    await until(async () => assert.equal(await page.locator('.shopping-title-input').evaluateAll((inputs) => inputs.filter((input) => input.value === 'Newly added product').length), 1));
    assert.equal(await rows(page).count(), 51);
    assert.equal(await page.locator('.shopping-counts > span').first().locator('strong').innerText(), '1000');
  }, { data: seed({ products: 999 }) });

  await test('filters reset the visible window and confirmation backfills it without deleting the expense', async (page) => {
    await page.getByRole('button', { name: /^Show more/ }).click();
    assert.equal(await rows(page).count(), 100);
    await page.locator('.shopping-filters').getByRole('button', { name: 'Planned', exact: true }).click();
    assert.equal(await rows(page).count(), 50);
    assert.equal(await row(page, 0).count(), 0);
    assert.equal(await row(page, 69).count(), 1);
    assert.equal(await row(page, 70).count(), 0);
    await row(page, 20).locator('.shopping-price-input').fill('9.25');
    // Confirm before autosave; one expense must be created and retained.
    assert.equal((await read(page)).transactions.length, 20);
    await row(page, 20).locator('.shopping-confirm').click();
    await until(async () => assert.equal(await row(page, 20).count(), 0));
    assert.equal(await rows(page).count(), 50);
    assert.equal(await row(page, 70).count(), 1);
    const saved = await read(page);
    assert.equal(saved.shoppingList.length, 999);
    assert.equal(saved.transactions.length, 21);
    assert.equal(saved.transactions.find((entry) => entry.title === 'Product 20')?.amount, 9.25);
    await page.clock.fastForward(2000);
    assert.deepEqual(await read(page), saved);
  }, { data: seed({ products: 1000, purchased: 20 }) });

  await test('optional editor, shopping and PDF bundles are deferred until their feature opens', async (page) => {
    const scripts = () => requestedScripts(page);
    const initial = await scripts();
    assert.equal(initial.some((name) => /^(?:AvatarCropper|EntryDetails|ShoppingList|pdf)-/.test(name)), false, JSON.stringify(initial));
    await page.clock.resume();
    await page.locator('a[href="#shopping"]:visible').first().click();
    await page.locator('.shopping-add-name input').waitFor();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
    assert.equal((await scripts()).some((name) => /^ShoppingList-/.test(name)), true);
    await row(page, 0).locator('.shopping-price-input').fill('3.25');
    assert.equal((await read(page)).transactions.length, 0);
    await row(page, 0).locator('.shopping-confirm').click();
    await until(async () => assert.equal(await row(page, 0).count(), 0));
    assert.equal((await read(page)).transactions[0].amount, 3.25);
    await page.clock.resume();
    await page.locator('a[href="#tracker"]:visible').first().click();
    await page.locator('.transaction-open').first().click();
    await page.getByRole('dialog').waitFor();
    await until(async () => assert.equal((await scripts()).some((name) => /^EntryDetails-/.test(name)), true));
    assert.equal((await scripts()).some((name) => /^(?:AvatarCropper|pdf)-/.test(name)), false);
  }, { data: seed({ products: 1 }), route: 'overview' });

  await test('PDF export uses the latest query while deferred search is still pending', async (page) => {
    const original = await read(page);
    await page.locator('.transaction-open').first().waitFor();
    await page.clock.resume();
    async function exportPendingQuery(query) {
      const downloaded = page.waitForEvent('download', { timeout: 30_000 });
      const snapshot = await page.evaluate(async (query) => {
        const input = document.querySelector('.search-field input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, query);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        // React commits the urgent input update before deferred work gets its next task.
        await Promise.resolve();
        const pending = document.querySelector('.tracker-panel').getAttribute('aria-busy') === 'true';
        document.querySelector('.header-actions .export-button').click();
        return { pending, value: input.value };
      }, query);
      assert.equal(snapshot.value, query);
      assert.equal(snapshot.pending, true, 'The regression must exercise export before deferred results commit');
      const download = await downloaded;
      const file = await download.path();
      assert.ok(file);
      const pdf = await PDFDocument.load(await readFile(file));
      assert.equal(pdf.getCreator(), 'BeliLog');
      return pdf.getPageCount();
    }
    assert.equal(await exportPendingQuery('Needle product'), 1);
    // Clearing a query must also export every matching row, even while the old query is deferred.
    await until(async () => assert.equal(await page.locator('.transaction-open').count(), 1));
    assert.ok(await exportPendingQuery('') > 1);
    assert.deepEqual(await read(page), original);
  }, { route: 'tracker', data: { ...seed(), transactions: Array.from({ length: 200 }, (_, index) => ({
    id: `pdf-${index}`, title: index ? `Another purchase ${index}` : 'Needle product',
    amount: 10, currency: 'USD', category: 'food', date: today,
  })) } });

  await test('a deferred avatar editor receives focus and restores the upload button on close', async (page) => {
    const upload = page.locator('.avatar-editor-actions button').first();
    await upload.focus();
    await page.clock.resume();
    await page.locator('input[type="file"][accept*="image/png"]').setInputFiles({
      name: 'avatar.png', mimeType: 'image/png',
      buffer: await readFile(new URL('../public/belilog-icon-512.png', import.meta.url)),
    });
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Save avatar', exact: true }).waitFor();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
    await frames(page);
    await until(async () => assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))), true));
    assert.equal(requestedScripts(page).some((name) => /^AvatarCropper-/.test(name)), true);
    await page.keyboard.press('Escape');
    await frames(page);
    await until(async () => assert.equal(await upload.evaluate((button) => document.activeElement === button), true));
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal((await read(page)).profile.avatar, undefined);
  }, { route: 'profile' });

  await test('cold and warm expense dialogs trap fallback focus and restore the original edit trigger', async (page) => {
    assert.equal(requestedScripts(page).some((name) => /^TransactionDialog-/.test(name)), false);
    const before = await read(page);
    const trigger = page.locator('.row-actions button').first();
    const pattern = /\/TransactionDialog-[^/]+\.js$/;
    let releaseChunk;
    let chunkRequests = 0;
    const blockedChunk = new Promise((resolve) => { releaseChunk = resolve; });
    await page.route(pattern, async (route) => {
      chunkRequests++;
      await blockedChunk;
      await route.continue();
    });
    try {
      await page.clock.resume();
      await trigger.click();
      await until(() => assert.equal(chunkRequests, 1));
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.equal(await dialog.locator('input, button, select, textarea').count(), 0);
      await until(async () => assert.equal(await dialog.evaluate((element) => document.activeElement === element), true));
      // With the chunk blocked there are no child controls: both directions must stay on the modal.
      for (const key of ['Tab', 'Shift+Tab', 'Tab']) {
        await page.keyboard.press(key);
        assert.equal(await dialog.evaluate((element) => document.activeElement === element), true);
      }
      releaseChunk();
      const title = page.locator('.modal .form-grid input').first();
      await title.waitFor();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
      await frames(page);
      await until(async () => assert.equal(await title.evaluate((input) => document.activeElement === input), true));
      assert.equal(requestedScripts(page).some((name) => /^TransactionDialog-/.test(name)), true);
      await title.press('End'); await title.press('X');
      assert.equal(await title.inputValue(), 'Product 0X');
      assert.deepEqual(await read(page), before);
      await page.keyboard.press('Escape');
      await frames(page);
      assert.equal(await page.getByRole('dialog').count(), 0);
      await until(async () => assert.equal(await trigger.evaluate((button) => document.activeElement === button), true));
      assert.deepEqual(await read(page), before);

      // A cached chunk mounts its fields immediately; it must still capture the external trigger.
      await trigger.click();
      await title.waitFor();
      await frames(page);
      await until(async () => assert.equal(await title.evaluate((input) => document.activeElement === input), true));
      assert.equal(await title.inputValue(), 'Product 0');
      await page.keyboard.press('Escape');
      await frames(page);
      await until(async () => assert.equal(await trigger.evaluate((button) => document.activeElement === button), true));
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.equal(chunkRequests, 1);
      assert.deepEqual(await read(page), before);
    } finally {
      releaseChunk();
      await page.unroute(pattern);
    }
  }, { data: seed({ purchased: 1 }), route: 'tracker' });

  await test('rapid profile typing preserves spaces and performs one commit after 350 ms', async (page) => {
    const name = page.locator('.profile-form input[required]');
    await name.focus(); await name.press('End'); await resetWrites(page);
    await name.pressSequentially(' Hello');
    assert.equal(await name.inputValue(), 'Benchmark Hello');
    assert.equal((await read(page)).profile.name, 'Benchmark');
    assert.deepEqual(await writes(page), { primary: 0, lastGood: 0 });
    await page.clock.fastForward(349);
    assert.deepEqual(await writes(page), { primary: 0, lastGood: 0 });
    await page.clock.fastForward(1);
    await until(async () => assert.equal((await read(page)).profile.name, 'Benchmark Hello'));
    assert.deepEqual(await writes(page), { primary: 1, lastGood: 1 });
    assert.equal(await name.inputValue(), 'Benchmark Hello');
  }, { route: 'profile' });

  await test('blur immediately saves a pending valid profile without a duplicate delayed commit', async (page) => {
    await resetWrites(page);
    await page.locator('.profile-form input[required]').fill('Straw Hat Crew');
    assert.equal((await read(page)).profile.name, 'Benchmark');
    await page.locator('.topbar .avatar').focus();
    await until(async () => assert.equal((await read(page)).profile.name, 'Straw Hat Crew'));
    assert.deepEqual(await writes(page), { primary: 1, lastGood: 1 });
    await page.clock.fastForward(1000);
    assert.deepEqual(await writes(page), { primary: 1, lastGood: 1 });
  }, { route: 'profile' });

  await test('navigation and pagehide flush the latest valid profile draft before leaving', async (page) => {
    const name = page.locator('.profile-form input[required]');
    await name.fill('Navigator Crew');
    await page.locator('a[href="#tracker"]:visible').first().click();
    await until(async () => assert.equal((await read(page)).profile.name, 'Navigator Crew'));
    await page.clock.resume();
    await page.locator('a[href="#profile"]:visible').first().click();
    await page.locator('.profile-form input[required]').waitFor();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
    await page.locator('.profile-form input[required]').fill('Pagehide Crew');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    assert.equal((await read(page)).profile.name, 'Pagehide Crew');
    await page.clock.resume();
    await page.reload();
    await page.locator('.profile-form input[required]').waitFor();
    assert.equal(await page.locator('.profile-form input[required]').inputValue(), 'Pagehide Crew');
  }, { route: 'profile' });

  await test('a queued profile edit still rejects a competing same-field change from another tab', async (a, context) => {
    const b = await open(context, 'profile');
    await a.locator('.profile-form input[required]').fill('My pending draft');
    await b.locator('.profile-form input[required]').fill('Remote captain');
    await b.locator('.topbar .avatar').focus();
    await until(async () => assert.equal((await read(a)).profile.name, 'Remote captain'));
    await a.locator('.topbar .avatar').focus();
    await until(async () => assert.equal(await a.getByRole('button', { name: 'Load current profile', exact: true }).count(), 1));
    assert.equal((await read(a)).profile.name, 'Remote captain');
    assert.equal(await a.locator('.profile-form input[required]').inputValue(), 'My pending draft');
    await a.getByRole('button', { name: 'Load current profile', exact: true }).click();
    assert.equal(await a.locator('.profile-form input[required]').inputValue(), 'Remote captain');
    await a.clock.fastForward(1000);
    assert.equal((await read(a)).profile.name, 'Remote captain');
  }, { route: 'profile' });
} finally {
  await browser.close();
  console.log(`${passed}/${total} performance browser regressions passed`);
}
