// Opt-in-only networking, stale-response safety and offline reference-rate snapshots.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.BELILOG_URL ?? 'http://127.0.0.1:5175/belilog/';
const key = 'finance-control:data:v1';
const endpoint = 'https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,KZT';
const now = '2026-11-11T12:00:00+01:00';
const manual = { USD: 1, EUR: 0.5, KZT: 500 };
const rows = () => [
  { base: 'USD', quote: 'EUR', date: '2026-11-10', rate: 0.892123456 },
  { base: 'USD', quote: 'KZT', date: '2026-11-09', rate: 448.51234567 },
];
const loaded = { USD: 1, EUR: 0.892123, KZT: 448.512346 };
const snapshot = { mode: 'automatic', source: 'frankfurter', checkedAt: '2026-11-11T10:00:00.000Z',
  dates: { EUR: '2026-11-10', KZT: '2026-11-09' } };
const seed = (sync, language = 'en', theme = 'light') => ({
  version: sync ? 5 : 4,
  profile: { name: 'Reference captain', email: 'captain@example.test', currency: 'USD', monthlyBudget: 200,
    theme, language, exchangeRates: { ...manual }, ...(sync ? { exchangeRateSync: structuredClone(sync) } : {}) },
  transactions: [{ id: 'eur', title: 'Original expense', amount: 12.34, currency: 'EUR', category: 'food', date: '2026-11-11', createdAt: '2026-11-11' }],
  streak: { version: 1, startedOn: '2026-11-11', confirmedDays: [{ date: '2026-11-11', status: 'LOGGED' }] },
});
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
let passed = 0;
let total = 0;
const form = (page) => page.locator('.exchange-rates-settings');
const mode = (page) => form(page).getByRole('combobox', { name: 'Rate updates', exact: true });
const read = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
async function until(check, message = 'Expected automatic-rate state was not observed') {
  const deadline = Date.now() + 12_000;
  let cause;
  do { try { return await check(); } catch (error) { cause = error; } await delay(30); } while (Date.now() < deadline);
  throw new Error(message, { cause });
}
async function open(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  await page.clock.install({ time: new Date(now) });
  const url = new URL(baseUrl); url.hash = 'profile';
  await page.goto(url.href);
  await form(page).waitFor();
  return page;
}
async function check(name, run, { data = seed(), width = 1200, offline = false, response = rows } = {}) {
  if (process.env.RATES_CASE && !process.env.RATES_CASE.split('|').some((part) => name.includes(part))) return;
  total++;
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Europe/Berlin', reducedMotion: 'reduce' });
  const calls = [];
  const errors = [];
  let responder = async (route) => route.fulfill({ status: 200, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(response()) });
  await context.route(endpoint, async (route) => {
    calls.push(route.request());
    await responder(route);
  });
  await context.addInitScript(({ key, data, offline }) => {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    if (!localStorage.getItem('__belilogRateSeed')) {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem('__belilogRateSeed', '1');
    }
    if (offline) Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  }, { key, data, offline });
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.stack ?? error.message)));
  try {
    await run(await open(context), context, calls, (next) => { responder = next; });
    assert.deepEqual(errors, []);
    passed++;
    console.log(`PASS ${name}`);
  } catch (cause) {
    console.error(`FAIL ${name}`);
    throw cause;
  } finally { await context.close(); }
}
async function enable(page) {
  await mode(page).selectOption('automatic');
  await until(async () => assert.deepEqual((await read(page)).profile.exchangeRates, loaded));
}
async function foreground(page) {
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')); });
  await delay(150);
}

try {
  await check('manual default performs no external request on open, focus or reload', async (page, _context, calls) => {
    await foreground(page);
    await page.reload(); await form(page).waitFor();
    await foreground(page);
    assert.equal(calls.length, 0);
    assert.equal(await mode(page).inputValue(), 'manual');
    assert.equal((await read(page)).profile.exchangeRateSync, undefined);
  });

  await check('explicit opt-in saves complete rounded quotes and separate dates without changing expenses or budget', async (page, _context, calls) => {
    const before = await read(page);
    await enable(page);
    const after = await read(page);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url(), endpoint);
    assert.equal(calls[0].postData(), null);
    assert.deepEqual(after.transactions, before.transactions);
    assert.equal(after.profile.monthlyBudget, before.profile.monthlyBudget);
    assert.equal(after.version, 5);
    assert.equal(after.profile.exchangeRateSync.source, 'frankfurter');
    assert.deepEqual(after.profile.exchangeRateSync.dates, { EUR: '2026-11-10', KZT: '2026-11-09' });
    assert.match(await form(page).innerText(), /EUR 2026-11-10 · KZT 2026-11-09/);
    assert.equal(await form(page).getByRole('textbox', { name: '1 USD in EUR', exact: true }).getAttribute('readonly'), '');
    await page.locator('a[href="#overview"]:visible').first().click();
    await page.locator('.overview-stats').waitFor();
    assert.match(await page.locator('main').innerText(), /Frankfurter/);
  });

  await check('fresh snapshot avoids duplicate daily calls across focus, reconnect and reload', async (page, _context, calls) => {
    await foreground(page);
    await page.reload(); await form(page).waitFor();
    await foreground(page);
    assert.equal(calls.length, 0);
  }, { data: seed(snapshot) });

  await check('explicit refresh remains available after a successful daily update', async (page, _context, calls) => {
    await form(page).getByRole('button', { name: 'Refresh rates', exact: true }).click();
    await until(async () => assert.deepEqual((await read(page)).profile.exchangeRates, loaded));
    assert.equal(calls.length, 1);
  }, { data: seed(snapshot) });

  await check('a foreground tab refreshes once when the local day changes', async (page, _context, calls) => {
    assert.equal(calls.length, 0);
    await page.clock.fastForward(24 * 60 * 60 * 1000);
    await until(() => assert.equal(calls.length, 1));
    await until(async () => assert.equal((await read(page)).profile.exchangeRateSync.checkedAt.slice(0, 10), '2026-11-12'));
    await foreground(page);
    assert.equal(calls.length, 1);
  }, { data: seed(snapshot) });

  await check('offline snapshot is preserved and reconnect clears the message without fetching fresh data', async (page, _context, calls) => {
    await form(page).getByRole('button', { name: 'Refresh rates', exact: true }).click();
    await until(async () => assert.match(await form(page).innerText(), /You are offline/));
    const before = await read(page);
    await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }));
    await foreground(page);
    assert.doesNotMatch(await form(page).innerText(), /You are offline/);
    assert.deepEqual(await read(page), before);
    assert.equal(calls.length, 0);
  }, { data: seed(snapshot), offline: true });

  await check('invalid partial data preserves the last good values and applies retry backoff', async (page, _context, calls) => {
    await until(async () => assert.match(await form(page).innerText(), /invalid rates/));
    const before = await read(page);
    assert.deepEqual(await read(page), before);
    await foreground(page);
    assert.equal(calls.length, 1);
    await page.clock.fastForward(60_001);
    await foreground(page);
    await until(() => assert.equal(calls.length, 2));
    assert.deepEqual(await read(page), before);
  }, { data: seed({ ...snapshot, checkedAt: '2026-11-10T12:00:00.000Z' }), response: () => [rows()[0]] });

  await check('provider dates cannot roll a saved snapshot backwards', async (page, _context, calls) => {
    const before = await read(page);
    await form(page).getByRole('button', { name: 'Refresh rates', exact: true }).click();
    await until(async () => assert.match(await form(page).innerText(), /invalid rates/));
    assert.deepEqual(await read(page), before);
    assert.equal(calls.length, 1);
  }, { data: seed(snapshot), response: () => rows().map((row) => ({ ...row, date: '2026-11-01' })) });

  await check('a failed snapshot write retains last-good rates and reports a save failure instead of a false conflict', async (page) => {
    const before = await read(page);
    await page.evaluate((key) => {
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key && JSON.parse(value).profile.exchangeRates?.EUR === 0.892123)
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        return write.call(this, name, value);
      };
    }, key);
    await form(page).getByRole('button', { name: 'Refresh rates', exact: true }).click();
    await until(async () => assert.equal(await form(page).getByRole('button', { name: 'Refresh rates', exact: true }).isEnabled(), true));
    await until(async () => assert.match(await form(page).innerText(), /New rates were received but could not be saved/));
    assert.doesNotMatch(await form(page).innerText(), /Rate settings have changed|Rates could not be updated/);
    assert.equal(await form(page).getByRole('status').filter({ hasText: 'New rates were received' }).getAttribute('class'), 'field-hint');
    assert.deepEqual(await read(page), before);
  }, { data: seed(snapshot) });

  await check('switching to manual cancels a late response and retains saved numeric rates', async (page, _context, calls, respond) => {
    let release;
    respond(async (route) => { await new Promise((resolve) => { release = resolve; }); try { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows()) }); } catch { /* aborted request */ } });
    await mode(page).selectOption('automatic');
    await until(() => assert.equal(calls.length, 1));
    await mode(page).selectOption('manual');
    release();
    await delay(200);
    const after = await read(page);
    assert.deepEqual(after.profile.exchangeRates, manual);
    assert.deepEqual(after.profile.exchangeRateSync, { mode: 'manual' });
    assert.equal(after.version, 5);
  });

  await check('dirty manual edits must be saved or cancelled before enabling network access', async (page, _context, calls) => {
    const eur = form(page).getByRole('textbox', { name: '1 USD in EUR', exact: true });
    await eur.fill('0.75');
    assert.equal(await mode(page).isDisabled(), true);
    assert.equal(calls.length, 0);
    await form(page).getByRole('button', { name: 'Cancel changes', exact: true }).click();
    assert.equal(await eur.inputValue(), '0.5');
    assert.equal(await mode(page).isDisabled(), false);
    await enable(page);
    assert.equal(calls.length, 1);
  });

  await check('a profile draft remains editable while quotes are refreshed', async (page) => {
    const name = page.locator('.profile-form input[required]');
    await name.fill('Draft captain');
    await enable(page);
    await name.blur();
    await until(async () => assert.equal((await read(page)).profile.name, 'Draft captain'));
    assert.equal((await read(page)).profile.monthlyBudget, 200);
  });

  await check('a dirty manual draft cannot be labelled as the automatic snapshot from another tab', async (page, context) => {
    const eur = form(page).getByRole('textbox', { name: '1 USD in EUR', exact: true });
    await eur.fill('0.75');
    const other = await open(context);
    await enable(other);
    await until(async () => assert.equal(await mode(page).inputValue(), 'automatic'));
    await until(async () => assert.deepEqual((await read(page)).profile.exchangeRates, loaded));
    assert.equal(await eur.inputValue(), '0.75');
    assert.equal(await form(page).locator('.exchange-rate-dates').count(), 0);
    assert.match(await form(page).innerText(), /Cancel your draft to see saved rates/);
    await form(page).getByRole('button', { name: 'Cancel changes', exact: true }).click();
    await until(async () => assert.equal(await eur.inputValue(), '0.892123'));
    assert.equal(await form(page).locator('.exchange-rate-dates').count(), 1);
  });

  await check('a competing tab can disable auto without a late response overwriting it', async (page, context, calls, respond) => {
    const releases = [];
    respond(async (route) => { await new Promise((resolve) => { releases.push(resolve); }); try { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows()) }); } catch { /* aborted request */ } });
    await mode(page).selectOption('automatic');
    await until(() => assert.equal(calls.length, 1));
    const other = await open(context);
    // Opening a second stale tab may start its own request; release both when cancelled.
    await mode(other).selectOption('manual');
    for (const release of releases) release();
    await until(async () => assert.equal(await mode(page).inputValue(), 'manual'));
    assert.deepEqual((await read(page)).profile.exchangeRates, manual);
    assert.deepEqual((await read(page)).profile.exchangeRateSync, { mode: 'manual' });
  });

  await check('a full restore cancels an old request even when the restored rates and policy are identical', async (page, _context, calls, respond) => {
    let release;
    respond(async (route) => { await new Promise((resolve) => { release = resolve; }); try { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows()) }); } catch { /* aborted request */ } });
    const before = await read(page);
    await form(page).getByRole('button', { name: 'Refresh rates', exact: true }).click();
    await until(() => assert.equal(calls.length, 1));
    await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({ name: 'belilog.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)) });
    await page.getByRole('button', { name: 'Restore everything', exact: true }).click();
    release();
    await delay(250);
    assert.deepEqual(await read(page), before);
  }, { data: seed(snapshot) });

  await check('JSON backups retain automatic policy, provenance and original financial amounts', async (page) => {
    await enable(page);
    const before = await read(page);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'JSON backup of all data', exact: true }).click();
    const download = await downloading;
    const payload = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.deepEqual(payload, before);
    assert.equal(payload.version, 5);
    assert.equal(payload.profile.exchangeRateSync.source, 'frankfurter');
  });

  await check('a full PDF backup restores the version-five provider snapshot after switching to manual', async (page, _context, calls) => {
    await enable(page);
    const before = await read(page);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PDF backup with all your data', exact: true }).click();
    const download = await downloading;
    const bytes = await readFile(await download.path());
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    await mode(page).selectOption('manual');
    await until(async () => assert.deepEqual((await read(page)).profile.exchangeRateSync, { mode: 'manual' }));
    await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/pdf', buffer: bytes });
    await page.getByRole('button', { name: 'Restore everything', exact: true }).click();
    await until(async () => assert.deepEqual(await read(page), before));
    assert.equal(calls.length, 1);
  });

  const emptyAutomatic = seed({ mode: 'automatic' });
  emptyAutomatic.profile.name = 'Пользователь'; emptyAutomatic.profile.email = ''; emptyAutomatic.profile.monthlyBudget = 0;
  delete emptyAutomatic.profile.exchangeRates;
  delete emptyAutomatic.streak;
  emptyAutomatic.transactions = [];
  await check('an unfilled automatic policy is protected by demo confirmation while offline', async (page, _context, calls) => {
    const before = await read(page);
    await page.getByRole('button', { name: 'Load demo', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('heading', { name: 'Load demo?', exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(await read(page), before);
    assert.deepEqual(before.profile.exchangeRateSync, { mode: 'automatic' });
    assert.equal(calls.length, 0);
  }, { data: emptyAutomatic, offline: true });

  for (const language of ['en', 'ru']) for (const theme of ['light', 'dark']) {
    await check(`automatic settings fit a 360px viewport in ${language}/${theme}`, async (page) => {
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
      const select = form(page).getByRole('combobox');
      assert.equal(await select.inputValue(), 'automatic');
      assert.match(await form(page).innerText(), /Frankfurter/);
      assert.equal(await form(page).getByRole('textbox').first().getAttribute('readonly'), '');
      if (language === 'en' && theme === 'light') {
        await mkdir('test-results/pwa-rates', { recursive: true });
        await page.setViewportSize({ width: 390, height: 950 });
        await form(page).scrollIntoViewIfNeeded();
        await page.screenshot({ path: 'test-results/pwa-rates/mobile-rates.png' });
        await form(page).screenshot({ path: 'test-results/pwa-rates/mobile-rates-controls.png' });
      }
    }, { data: seed(snapshot, language, theme), width: 360 });
  }
} finally {
  await browser.close();
  console.log(`${passed}/${total} automatic-rate regressions passed`);
}
