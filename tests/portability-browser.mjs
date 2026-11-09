// Production checks for manual exchange rates and portable JSON/CSV/PDF files.
// BELILOG_URL=http://127.0.0.1:5175/belilog/ node tests/portability-browser.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { chromium } from 'playwright';

const baseUrl = process.env.BELILOG_URL ?? 'http://127.0.0.1:5175/belilog/';
const key = 'finance-control:data:v1';
const today = '2026-11-09';
const now = '2026-11-09T12:00:00+01:00';
const manual = { USD: 1, EUR: 0.5, KZT: 500 };
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const ready = { overview: '.overview-stats', tracker: '.tracker-panel', profile: '.profile-form' };
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const errors = [];
const requests = new WeakMap();
let passed = 0;
let total = 0;

const expense = (id, amount, currency) => ({
  id, title: `${currency} purchase`, amount, currency, category: 'food', date: today, createdAt: today,
});
function seed({ language = 'en', theme = 'light', rates, empty = false } = {}) {
  return {
    version: rates ? 4 : 2,
    profile: { name: 'Portability captain', email: 'captain@example.test', currency: 'USD',
      monthlyBudget: 100, theme, language, ...(rates ? { exchangeRates: { ...rates } } : {}) },
    transactions: empty ? [] : [expense('usd', 10, 'USD'), expense('eur', 10, 'EUR'), expense('kzt', 1000, 'KZT')],
    shoppingList: [{ id: 'bread', title: 'Bread', currency: 'EUR', createdAt: today }],
    categoryBudgets: [{ id: 'food', amount: 100, currency: 'USD' }],
    shoppingTemplates: [{ id: 'weekly', name: 'Weekly groceries', items: [{ title: 'Milk', currency: 'KZT' }] }],
    ...(rates ? { streak: { version: 1, startedOn: today,
      confirmedDays: empty ? [] : [{ date: today, status: 'LOGGED' }] } } : {}),
  };
}
const read = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
const ratesForm = (page) => page.locator('.exchange-rates-settings');
const rate = (page, code, language = 'en') => ratesForm(page).getByRole('textbox', {
  name: `1 USD ${language === 'en' ? 'in' : 'в'} ${code}`, exact: true,
});
const saveRates = (page, language = 'en') => ratesForm(page).getByRole('button', {
  name: language === 'en' ? 'Save rates' : 'Сохранить курсы', exact: true,
}).click();
const money = (value, currency = 'USD', language = 'en') => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ru-RU', {
  style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(value);

async function until(check, message = 'Expected portability state was not observed') {
  const deadline = Date.now() + 12_000;
  let cause;
  do {
    try { return await check(); } catch (error) { cause = error; }
    await delay(30);
  } while (Date.now() < deadline);
  throw new Error(message, { cause });
}
async function open(context, route = 'profile') {
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(`Console ${message.type()}: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  requests.set(page, []);
  page.on('request', (request) => {
    const url = new URL(request.url());
    requests.get(page).push(url.href);
    if (/^https?:$/.test(url.protocol) && url.origin !== new URL(baseUrl).origin) errors.push(`External request: ${url.href}`);
  });
  await page.clock.install({ time: new Date(now) });
  const url = new URL(baseUrl); url.hash = route;
  await page.goto(url.href);
  await page.locator(ready[route]).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const stored = await read(page);
  if (stored.transactions.length || stored.streak) {
    await until(async () => assert.equal((await read(page)).version, stored.profile.exchangeRates ? 4 : 3));
  }
  return page;
}
async function navigate(page, route) {
  await page.locator(`a[href="#${route}"]:visible`).first().click();
  await page.locator(ready[route]).waitFor();
}
async function check(name, run, { data = seed(), route = 'profile', width = 1200, colorScheme = 'light' } = {}) {
  if (process.env.PORTABILITY_CASE && !name.includes(process.env.PORTABILITY_CASE)) return;
  total++;
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Europe/Berlin',
    reducedMotion: 'reduce', isMobile: width <= 390, hasTouch: width <= 390, colorScheme });
  await context.addInitScript(({ key, data }) => {
    if (!localStorage.getItem('__belilogPortabilitySeed')) {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem('__belilogPortabilitySeed', '1');
    }
    window.__belilogPortabilityThemes = [];
    new MutationObserver(() => {
      const root = document.getElementById('root');
      const theme = document.documentElement?.dataset.theme;
      if (theme && (!root || !root.childElementCount)) window.__belilogPortabilityThemes.push(theme);
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme'] });
  }, { key, data });
  const count = errors.length;
  try {
    await run(await open(context, route), context);
    assert.equal(errors.length, count, errors.slice(count).join('\n'));
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    process.exitCode = 1;
    console.error(`FAIL ${name}\n${error.stack ?? error}`);
    if (error.cause) console.error(`Caused by: ${error.cause.stack ?? error.cause}`);
  } finally { await context.close(); }
}
async function setRates(page, EUR = '0.5', KZT = '500', language = 'en') {
  await rate(page, 'EUR', language).fill(EUR);
  await rate(page, 'KZT', language).fill(KZT);
  await saveRates(page, language);
}
async function downloadBytes(page, name) {
  const pending = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name, exact: true }).click();
  const download = await pending;
  const path = await download.path();
  assert.ok(path, 'Download must produce a file');
  return { bytes: await readFile(path), name: download.suggestedFilename() };
}
async function replaceName(page, name) {
  await page.locator('.profile-form input[required]').fill(name);
  await page.locator('.profile-form button[type="submit"]').click();
  await until(async () => assert.equal((await read(page)).profile.name, name));
}
async function restoreFile(page, { bytes, name }, mimeType) {
  await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({ name, mimeType, buffer: bytes });
  await page.getByRole('button', { name: 'Restore everything', exact: true }).click();
}
async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  assert.equal(dimensions.width, page.viewportSize().width, JSON.stringify(dimensions));
  assert.ok(dimensions.content <= dimensions.width + 1, JSON.stringify(dimensions));
}
async function accessible(page) {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const roots = [...document.querySelectorAll('.exchange-rates-settings,.storage-card')];
    const report = await window.axe.run(roots, { runOnly: { type: 'rule', values: [
      'color-contrast', 'button-name', 'label', 'aria-valid-attr-value', 'aria-allowed-attr',
    ] } });
    return report.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
  });
  assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
  const small = await page.locator('.exchange-rates-settings,.storage-card').evaluateAll((roots) => roots.flatMap((root) =>
    [...root.querySelectorAll('button,input:not([type="file"])')].flatMap((element) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || element.disabled) return [];
      return rect.width >= 43.5 && rect.height >= 43.5 ? [] : [{ name: element.textContent, width: rect.width, height: rect.height }];
    })));
  assert.deepEqual(small, [], JSON.stringify(small));
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\r' || char === '\n') && !quoted) {
      row.push(cell); rows.push(row); row = []; cell = '';
      if (char === '\r' && text[index + 1] === '\n') index++;
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
async function pdfText(bytes) {
  const document = await PDFDocument.load(bytes);
  const streams = document.context.enumerateIndirectObjects().map(([, object]) => object)
    .filter((object) => object instanceof PDFRawStream)
    .flatMap((stream) => {
      try { return [new TextDecoder().decode(decodePDFRawStream(stream).decode())]; } catch { return []; }
    });
  const characters = new Map();
  for (const stream of streams.filter((stream) => stream.includes('beginbfchar'))) {
    for (const [, source, unicode] of stream.matchAll(/^\s*<([\da-f]+)>\s+<([\da-f]+)>\s*$/gim)) {
      if (source.length !== 4 || unicode.length % 4) continue;
      let value = '';
      for (let index = 0; index < unicode.length; index += 4) value += String.fromCharCode(Number.parseInt(unicode.slice(index, index + 4), 16));
      characters.set(source.toUpperCase(), value);
    }
  }
  const text = [];
  for (const stream of streams.filter((stream) => stream.includes('BT') && !stream.includes('beginbfchar'))) {
    for (const [, encoded] of stream.matchAll(/<([\da-f]+)>\s*Tj/gi)) {
      let line = '';
      for (let index = 0; index < encoded.length; index += 4) line += characters.get(encoded.slice(index, index + 4).toUpperCase()) ?? '';
      text.push(line);
    }
  }
  assert.ok(text.length, 'PDF must contain decodable Unicode text');
  return text.join('\n');
}

try {
  await check('manual rates update overview, chart, category budgets, tracker total and largest sorting', async (page) => {
    const before = await read(page);
    assert.equal(before.profile.exchangeRates, undefined);
    await setRates(page);
    await until(async () => assert.deepEqual((await read(page)).profile.exchangeRates, manual));
    assert.equal((await read(page)).version, 4);
    await navigate(page, 'overview');
    assert.equal(await page.locator('.stat-card-featured .stat-value').innerText(), money(32));
    assert.equal(await page.locator('.chart-hover-info strong').innerText(), money(32));
    assert.equal(await page.getByRole('progressbar', { name: 'Food & groceries: monthly limit', exact: true }).getAttribute('aria-valuenow'), '32');
    assert.match(await page.locator('.workspace-footnote').innerText(), /Your rates/);
    await navigate(page, 'tracker');
    assert.equal(await page.locator('.tracker-summary > div').first().locator('strong').innerText(), money(32));
    await page.locator('.sort-select').selectOption('largest');
    await until(async () => assert.deepEqual(await page.locator('.transaction-name').allTextContents(), ['EUR purchase', 'USD purchase', 'KZT purchase']));
    await page.getByRole('textbox', { name: 'Search expenses', exact: true }).fill('EUR purchase');
    await until(async () => assert.deepEqual(await page.locator('.transaction-name').allTextContents(), ['EUR purchase']));
    const filteredCsv = parseCsv(new TextDecoder().decode((await downloadBytes(page, 'CSV')).bytes));
    assert.equal(filteredCsv.length, 2);
    assert.equal(filteredCsv[1][0], 'eur');
    assert.equal(filteredCsv[1][5], '10');
    assert.equal(filteredCsv[1][6], 'EUR');
    assert.deepEqual((await read(page)).transactions, before.transactions);
  });

  await check('switching the main currency converts the budget and every view using manual rates', async (page) => {
    const original = (await read(page)).transactions;
    await page.locator('.profile-form select').first().selectOption('EUR');
    await until(async () => assert.equal((await read(page)).profile.currency, 'EUR'));
    assert.equal((await read(page)).profile.monthlyBudget, 50);
    assert.deepEqual((await read(page)).profile.exchangeRates, manual);
    await navigate(page, 'overview');
    assert.equal(await page.locator('.stat-card-featured .stat-value').innerText(), money(16, 'EUR'));
    assert.equal(await page.locator('.chart-hover-info strong').innerText(), money(16, 'EUR'));
    assert.equal(await page.getByRole('progressbar', { name: 'Food & groceries: monthly limit', exact: true }).getAttribute('aria-valuenow'), '32');
    await navigate(page, 'profile');
    await page.locator('.profile-form select').first().selectOption('KZT');
    await until(async () => assert.equal((await read(page)).profile.currency, 'KZT'));
    assert.equal((await read(page)).profile.monthlyBudget, 50_000);
    assert.deepEqual((await read(page)).transactions, original);
  }, { data: seed({ rates: manual }) });

  await check('invalid rate drafts reject zero, exponents and excess precision atomically', async (page) => {
    const before = await read(page);
    await rate(page, 'KZT').fill('520');
    for (const value of ['0', '1e2', '0.1234567']) {
      await rate(page, 'EUR').fill(value);
      await saveRates(page);
      assert.deepEqual(await read(page), before);
      assert.equal(await rate(page, 'EUR').inputValue(), value);
      assert.equal(await rate(page, 'KZT').inputValue(), '520');
      assert.equal(await ratesForm(page).getByRole('alert').count(), 1);
    }
    await rate(page, 'EUR').fill('0,123456');
    await saveRates(page);
    await until(async () => assert.deepEqual((await read(page)).profile.exchangeRates, { USD: 1, EUR: 0.123456, KZT: 520 }));
  });

  await check('failed rate storage preserves both drafts and a retry saves one complete configuration', async (page) => {
    const original = await read(page);
    await page.evaluate((key) => {
      window.__portabilitySetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new DOMException('Storage full', 'QuotaExceededError');
        return window.__portabilitySetItem.call(this, name, value);
      };
    }, key);
    await setRates(page);
    assert.deepEqual(await read(page), original);
    assert.equal(await rate(page, 'EUR').inputValue(), '0.5');
    assert.equal(await rate(page, 'KZT').inputValue(), '500');
    assert.equal(await ratesForm(page).getByRole('alert').count(), 1);
    await page.evaluate(() => { Storage.prototype.setItem = window.__portabilitySetItem; });
    await saveRates(page);
    await until(async () => assert.deepEqual((await read(page)).profile.exchangeRates, manual));
  });

  await check('dirty rate drafts cannot overwrite a newer pair from another tab', async (a, context) => {
    const b = await open(context);
    await rate(a, 'EUR').fill('0.7');
    await setRates(b, '0.8', '600');
    await until(async () => assert.deepEqual((await read(a)).profile.exchangeRates, { USD: 1, EUR: 0.8, KZT: 600 }));
    assert.equal(await rate(a, 'EUR').inputValue(), '0.7');
    await saveRates(a);
    assert.equal(await ratesForm(a).getByRole('alert').count(), 1);
    assert.deepEqual((await read(a)).profile.exchangeRates, { USD: 1, EUR: 0.8, KZT: 600 });
    await ratesForm(a).getByRole('button', { name: 'Cancel changes', exact: true }).click();
    assert.equal(await rate(a, 'EUR').inputValue(), '0.8');
    assert.equal(await rate(a, 'KZT').inputValue(), '600');
    await rate(a, 'EUR').fill('0.75'); await saveRates(a);
    await until(async () => assert.deepEqual((await read(b)).profile.exchangeRates, { USD: 1, EUR: 0.75, KZT: 600 }));
  }, { data: seed({ rates: manual }) });

  await check('version-four rates survive reload and use the saved theme before React paints', async (page) => {
    const saved = await read(page);
    assert.equal(saved.version, 4);
    const before = await page.evaluate(() => window.__belilogPortabilityThemes);
    assert.ok(before.length, 'Initial theme must be observable before React renders');
    assert.equal(before.every((theme) => theme === 'dark'), true, JSON.stringify(before));
    await page.reload(); await ratesForm(page).waitFor();
    assert.deepEqual(await read(page), saved);
    assert.equal(await rate(page, 'EUR').inputValue(), '0.5');
    assert.equal(await rate(page, 'KZT').inputValue(), '500');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.evaluate(() => window.__belilogPortabilityThemes.every((theme) => theme === 'dark')), true);
  }, { data: seed({ rates: manual, theme: 'dark' }), colorScheme: 'light' });

  await check('JSON download is a complete restorable version-four backup without loading PDF code', async (page) => {
    const saved = await read(page);
    const file = await downloadBytes(page, 'JSON backup of all data');
    assert.match(file.name, /\.json$/i);
    assert.deepEqual(JSON.parse(file.bytes.toString('utf8')), saved);
    assert.equal(requests.get(page).some((url) => /\/pdf-[^/]+\.js(?:\?|$)/.test(url)), false);
    await replaceName(page, 'Temporary JSON captain');
    await restoreFile(page, file, 'application/json');
    await until(async () => assert.deepEqual(await read(page), saved));
    assert.equal(requests.get(page).some((url) => /\/pdf-[^/]+\.js(?:\?|$)/.test(url)), false);
    await page.reload(); await ratesForm(page).waitFor();
    assert.deepEqual(await read(page), saved);
  }, { data: seed({ rates: manual }) });

  const csvData = seed({ rates: manual });
  csvData.transactions = [{ ...expense('=2+2', 10.25, 'EUR'), title: '=SUM(1,2)', note: '@mention\n"Quoted"',
    items: [{ id: 'item', title: '=HYPERLINK("example")', amount: 2 }] },
  { ...expense('unicode', 1234.56, 'KZT'), title: 'Батон 🍞', note: 'Две, "кавычки"\nстроки' }];
  await check('CSV preserves UTF-8, quoting and original currencies while neutralizing formula-like text', async (page) => {
    const saved = await read(page);
    const { bytes, name } = await downloadBytes(page, 'Expenses as CSV');
    assert.match(name, /\.csv$/i);
    assert.equal(bytes.subarray(0, 3).toString('hex'), 'efbbbf');
    const rows = parseCsv(new TextDecoder().decode(bytes));
    assert.deepEqual(rows[0], ['id', 'date', 'created_at', 'title', 'category', 'amount', 'currency', 'note', 'items']);
    assert.equal(rows.length, 3);
    assert.equal(rows[1][0], "'=2+2");
    assert.equal(rows[1][3], "'=SUM(1,2)");
    assert.equal(rows[1][5], '10.25'); assert.equal(rows[1][6], 'EUR');
    assert.equal(rows[1][7], `'${saved.transactions[0].note}`);
    assert.ok(rows[1][7].startsWith("'@"), 'Formula-like note must remain inert in the spreadsheet');
    assert.deepEqual(JSON.parse(rows[1][8]), saved.transactions[0].items);
    assert.equal(rows[2][3], 'Батон 🍞');
    assert.equal(rows[2][5], '1234.56'); assert.equal(rows[2][6], 'KZT');
    assert.equal(rows[2][7], 'Две, "кавычки"\nстроки');
    assert.deepEqual(await read(page), saved);
  }, { data: csvData });

  await check('full PDF uses manual totals and restores the complete version-four payload', async (page) => {
    const saved = await read(page);
    const file = await downloadBytes(page, 'PDF backup with all your data');
    assert.equal(file.bytes.subarray(0, 5).toString(), '%PDF-');
    const text = await pdfText(file.bytes);
    assert.ok(text.includes('$32.00 USD'), `Converted total must use the saved rates:\n${text}`);
    assert.ok(text.includes('Your rates: 1 USD = 0.5 EUR = 500 KZT'), text);
    await replaceName(page, 'Temporary PDF captain');
    await restoreFile(page, file, 'application/pdf');
    await until(async () => assert.deepEqual(await read(page), saved));
    await navigate(page, 'overview');
    assert.equal(await page.locator('.stat-card-featured .stat-value').innerText(), money(32));
  }, { data: seed({ rates: manual }) });

  const empty = seed({ empty: true });
  empty.profile = { ...empty.profile, name: 'Пользователь', email: '', monthlyBudget: 0 };
  empty.shoppingList = []; empty.categoryBudgets = []; empty.shoppingTemplates = [];
  await check('the empty mobile overview exposes demo before its tall streak section', async (page) => {
    const demo = await page.locator('.demo-banner').boundingBox();
    const streak = await page.locator('.streak-bounty').boundingBox();
    assert.ok(demo && demo.y >= 0 && demo.y + demo.height <= 950, JSON.stringify(demo));
    assert.ok(streak && demo.y + demo.height <= streak.y + 1, JSON.stringify({ demo, streak }));
    await noOverflow(page);
    await page.locator('.demo-link').click();
    await until(async () => assert.ok((await read(page)).transactions.length > 0));
  }, { data: empty, route: 'overview', width: 360 });

  for (const language of ['ru', 'en']) for (const theme of ['light', 'dark']) {
    await check(`rate settings and portability controls stay accessible at 360px: ${language}/${theme}`, async (page) => {
      await noOverflow(page); await accessible(page);
      await rate(page, 'EUR', language).fill('0');
      await saveRates(page, language);
      assert.equal(await ratesForm(page).getByRole('alert').count(), 1);
      await noOverflow(page); await accessible(page);
      await rate(page, 'EUR', language).fill('0.5');
      await rate(page, 'KZT', language).fill('500');
      await rate(page, 'KZT', language).press('Enter');
      await until(async () => assert.deepEqual((await read(page)).profile.exchangeRates, manual));
      await noOverflow(page);
    }, { data: seed({ language, theme }), width: 360 });
  }
} finally {
  await browser.close();
  console.log(`${passed}/${total} portability regressions passed`);
  if (errors.length) { process.exitCode = 1; console.error(errors.join('\n')); }
}
