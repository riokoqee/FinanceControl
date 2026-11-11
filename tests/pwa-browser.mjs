// Real service workers on a versioned local proxy: no build changes while browsers are running.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

const source = new URL(process.env.BELILOG_URL ?? 'http://127.0.0.1:5175/belilog/');
const base = source.pathname.endsWith('/') ? source.pathname : `${source.pathname}/`;
const originalWorker = await fetch(new URL('belilog-sw.js', source)).then(async response => {
  assert.equal(response.status, 200, 'Production build must emit belilog-sw.js');
  return response.text();
});
assert.match(originalWorker, /const CACHE = PREFIX/);
let version = 1;
let failFont = false;
let denyAssets = false;
let networkAssets = 0;
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, source).pathname;
    if (path === `${base}belilog-sw.js`) {
      response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
      response.end(originalWorker.replace(/const CACHE = PREFIX \+ "([^"]+)";/,
        (_, revision) => `const CACHE = PREFIX + "${revision}-test-${version}";`));
      return;
    }
    if (path.startsWith(`${base}assets/`) || path.startsWith(`${base}fonts/`)) {
      networkAssets++;
      if (denyAssets || (failFont && path.endsWith('report-font.ttf'))) {
        response.writeHead(503); response.end('Deliberately unavailable test asset'); return;
      }
    }
    const upstream = await fetch(new URL(request.url, source.origin), { redirect: 'manual' });
    const headers = Object.fromEntries([...upstream.headers].filter(([name]) =>
      !['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(name)));
    response.writeHead(upstream.status, headers);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) { response.writeHead(502); response.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${base}`;
async function closeProxy() {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
} catch (error) {
  await closeProxy();
  throw error;
}
const key = 'finance-control:data:v1';
const today = '2026-11-09';
const data = {
  version: 2,
  profile: { name: 'Offline captain', email: '', currency: 'USD', monthlyBudget: 100,
    theme: 'light', language: 'en' },
  transactions: [{ id: 'offline-food', title: 'Offline bread', amount: 12, currency: 'USD',
    category: 'food', date: today, createdAt: today }],
  shoppingList: [{ id: 'offline-milk', title: 'Milk', currency: 'USD', createdAt: today }],
  categoryBudgets: [], shoppingTemplates: [],
};
const ready = { overview: '.overview-stats', tracker: '.tracker-panel', shopping: '.shopping-add-form', profile: '.profile-form' };
const results = [];
async function until(check, message = 'Expected PWA state was not observed') {
  const deadline = Date.now() + 20_000;
  let cause;
  do { try { return await check(); } catch (error) { cause = error; } await delay(50); } while (Date.now() < deadline);
  throw new Error(message, { cause });
}
async function context(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 1000 },
    timezoneId: 'Europe/Berlin', reducedMotion: 'reduce', ...options });
  await context.addInitScript(({ data, key }) => {
    if (location.origin === 'null') return;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem('unrelated-app-data', 'keep me');
    window.__pwaDocumentId = Math.random();
  }, { data, key });
  context.__pwaErrors = [];
  context.on('page', page => {
    page.on('pageerror', error => context.__pwaErrors.push(error.message));
    page.on('requestfailed', request => context.__pwaErrors.push(`${request.failure()?.errorText}: ${request.url()}`));
  });
  return context;
}
async function open(context, route = 'overview') {
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.goto(`${url}#${route}`);
  await page.locator(ready[route]).waitFor();
  return page;
}
async function navigate(page, route) {
  await page.locator(`a[href="#${route}"]:visible`).first().click();
  await page.locator(ready[route]).waitFor();
}
async function controlled(page) {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 30_000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
}
async function cacheNames(page) { return page.evaluate(() => caches.keys()); }
async function check(name, run) {
  if (process.env.PWA_CASE && !name.includes(process.env.PWA_CASE)) return;
  version = 1; failFont = false; denyAssets = false; networkAssets = 0;
  let current;
  try {
    current = await context();
    await run(current);
    results.push({ name, passed: true }); console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false }); process.exitCode = 1;
    console.error(`FAIL ${name}\n${error.stack ?? error}`);
    if (error.cause) console.error(`Caused by: ${error.cause.stack ?? error.cause}`);
    if (current) {
      console.error('PWA failed requests/errors:', current.__pwaErrors);
      for (const page of current.pages()) console.error('PWA diagnostic:', await page.evaluate(async () => ({
        text: document.querySelector('.pwa-settings')?.textContent, body: document.querySelector('main')?.textContent?.slice(-600),
        registration: await navigator.serviceWorker.getRegistration().then(reg => ({ active: reg?.active?.state, waiting: reg?.waiting?.state, installing: reg?.installing?.state })),
      })).catch(() => 'Page closed'));
    }
  } finally { if (current) await current.close(); }
}
async function waiting(page) {
  await until(async () => assert.equal(await page.evaluate(async () =>
    Boolean((await navigator.serviceWorker.getRegistration()).waiting)), true));
}
async function downloadPdf(page) {
  const pending = page.waitForEvent('download', { timeout: 40_000 });
  await page.getByRole('button', { name: 'PDF backup with all your data', exact: true }).click();
  const download = await pending;
  const bytes = await readFile(await download.path());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() > 0);
  return bytes;
}

try {
  await check('installable manifest and correctly sized icons stay inside deployment base', async context => {
    const page = await open(context);
    const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await page.evaluate(async href => (await fetch(href)).json(), manifestUrl);
    assert.equal(manifest.scope, base); assert.equal(manifest.start_url, base); assert.equal(manifest.id, base);
    assert.equal(manifest.display, 'standalone');
    assert.deepEqual(await page.evaluate(async icons => Promise.all(icons.map(icon => new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => reject(new Error(`Icon load timed out: ${icon.src}`)), 10_000);
      image.onload = () => { clearTimeout(timer); resolve([image.naturalWidth, image.naturalHeight]); };
      image.onerror = () => { clearTimeout(timer); reject(new Error(`Icon failed to load: ${icon.src}`)); };
      image.src = icon.src;
    }))), manifest.icons), [[192, 192], [512, 512]]);
    await controlled(page);
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope);
    assert.equal(new URL(scope).pathname, base);
  });
  await check('first complete install covers unvisited pages, lazy expense dialog and PDF export offline', async context => {
    const page = await open(context);
    await controlled(page);
    await context.setOffline(true);
    await navigate(page, 'shopping');
    assert.equal(await page.locator('.shopping-item').count() > 0 || await page.getByText('Milk', { exact: true }).count() > 0, true);
    await navigate(page, 'tracker');
    await page.getByRole('button', { name: 'Add expense', exact: true }).first().click();
    await page.getByRole('dialog').getByRole('textbox', { name: 'What did you spend on?', exact: true }).fill('Offline draft');
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await navigate(page, 'profile');
    await page.locator('.pwa-settings').getByText('Offline ready', { exact: false }).waitFor();
    await downloadPdf(page);
    await page.reload();
    await page.locator('.profile-form').waitFor();
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).transactions[0].title, key), 'Offline bread');
  });
  await check('native install offer is retained before Profile is opened and prompts only by action', async context => {
    const page = await open(context);
    await controlled(page);
    await page.evaluate(() => {
      window.__installPromptCount = 0;
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, { prompt: async () => { window.__installPromptCount++; },
        userChoice: Promise.resolve({ outcome: 'accepted' }) });
      window.dispatchEvent(event);
    });
    assert.equal(await page.evaluate(() => window.__installPromptCount), 0);
    await navigate(page, 'profile');
    await page.getByRole('button', { name: 'Install BeliLog', exact: true }).click();
    await page.locator('.pwa-settings').getByText('App installed', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__installPromptCount), 1);
  });
  await check('failed initial asset cache never claims offline readiness or leaves a partial app cache', async context => {
    failFont = true;
    const page = await open(context, 'profile');
    await page.locator('.pwa-settings').getByText('Offline copy is not ready.', { exact: false }).waitFor({ timeout: 30_000 });
    assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), false);
    assert.deepEqual((await cacheNames(page)).filter(name => name.startsWith('belilog-pwa:')), []);
  });
  await check('checking an unchanged release and offline checking preserve stored expenses', async context => {
    const page = await open(context, 'profile');
    await controlled(page);
    await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await page.locator('.pwa-settings').getByText('You have the latest version', { exact: true }).waitFor();
    await context.setOffline(true);
    await until(async () => assert.equal(
      await page.getByRole('button', { name: 'Check for updates', exact: true }).isDisabled(), true),
    'Offline connectivity must disable update checks after the browser event and React render');
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).transactions.length, key), 1);
  });
  await check('waiting update preserves both old tabs, unsaved draft, old lazy modules and all unrelated data', async context => {
    const first = await open(context);
    await controlled(first);
    const second = await open(context);
    await controlled(second);
    await first.evaluate(async () => {
      const cache = await caches.open('another-pages-app');
      await cache.put('/foreign-cache-entry', new Response('keep foreign cache'));
    });
    const originalNames = await cacheNames(first);
    const oldName = originalNames.find(name => name.startsWith('belilog-pwa:'));
    assert.ok(oldName?.endsWith('-test-1'));
    await navigate(first, 'profile');
    version = 2;
    const documents = [await first.evaluate(() => window.__pwaDocumentId), await second.evaluate(() => window.__pwaDocumentId)];
    await first.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await waiting(first);
    await first.locator('.pwa-settings').getByText('Update ready. Close all BeliLog tabs', { exact: false }).waitFor();
    assert.equal((await cacheNames(first)).includes(oldName), true);
    assert.equal((await cacheNames(first)).some(name => name.endsWith('-test-2')), true);
    denyAssets = true;
    networkAssets = 0;
    await navigate(second, 'shopping');
    await navigate(second, 'tracker');
    await second.getByRole('button', { name: 'Add expense', exact: true }).first().click();
    const title = second.getByRole('dialog').getByRole('textbox', { name: 'What did you spend on?', exact: true });
    await title.fill('Keep my unsaved draft');
    await delay(250);
    assert.equal(await title.inputValue(), 'Keep my unsaved draft');
    assert.deepEqual([await first.evaluate(() => window.__pwaDocumentId), await second.evaluate(() => window.__pwaDocumentId)], documents);
    assert.equal(networkAssets, 0, 'Old worker must retain unvisited lazy chunks while a new worker waits');
    await first.close();
    await waiting(second);
    assert.equal(await title.inputValue(), 'Keep my unsaved draft');
    await second.close();
    await until(async () => {
      const workers = context.serviceWorkers();
      const names = (await Promise.all(workers.map(worker => worker.evaluate(() => caches.keys()).catch(() => [])))).flat();
      assert.equal(names.includes(oldName), false);
      assert.equal(names.some(name => name.endsWith('-test-2')), true);
    }, 'Update should activate naturally after every old BeliLog tab closes');
    denyAssets = false;
    const next = await open(context, 'profile');
    await controlled(next);
    await until(async () => {
      const names = await cacheNames(next);
      assert.equal(names.includes(oldName), false);
      assert.equal(names.some(name => name.endsWith('-test-2')), true);
      assert.equal(names.includes('another-pages-app'), true);
    });
    assert.equal(await next.evaluate(() => localStorage.getItem('unrelated-app-data')), 'keep me');
    assert.equal(await next.evaluate(key => JSON.parse(localStorage.getItem(key)).transactions[0].title, key), 'Offline bread');
  });
  await check('failed new release retains active old offline copy and financial data', async context => {
    const page = await open(context, 'profile');
    await controlled(page);
    const oldName = (await cacheNames(page)).find(name => name.startsWith('belilog-pwa:'));
    version = 2; failFont = true;
    await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await page.locator('.pwa-settings').getByText('Could not check for updates.', { exact: false }).waitFor({ timeout: 30_000 });
    assert.deepEqual((await cacheNames(page)).filter(name => name.startsWith('belilog-pwa:')), [oldName]);
    await context.setOffline(true);
    await page.reload();
    await page.locator('.profile-form').waitFor();
    await downloadPdf(page);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).transactions.length, key), 1);
  });
  await check('iPhone installation hint and Russian compact settings remain usable on mobile', async () => {
    const mobile = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
    try {
      const page = await open(mobile, 'profile');
      await controlled(page);
      await page.locator('.pwa-settings').getByText('On iPhone and iPad:', { exact: false }).waitFor();
      await page.getByRole('combobox', { name: 'Interface language', exact: true }).selectOption('ru');
      await page.locator('.pwa-settings').getByRole('heading', { name: 'Приложение', exact: true }).waitFor();
      await page.locator('.pwa-settings').getByText('Готово офлайн', { exact: true }).waitFor();
      await page.locator('.pwa-settings').getByText('На iPhone и iPad:', { exact: false }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const targets = await page.locator('.pwa-settings button').evaluateAll(buttons => buttons.map(button => {
        const rect = button.getBoundingClientRect(); return { width: rect.width, height: rect.height };
      }));
      assert.ok(targets.every(rect => rect.width >= 44 && rect.height >= 44));
      await mkdir('test-results/pwa-rates', { recursive: true });
      await page.locator('.pwa-settings').scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'test-results/pwa-rates/mobile-pwa.png' });
    } finally { await mobile.close(); }
  });
  await check('external currency calls and unknown same-origin data never enter the app cache', async context => {
    const page = await open(context, 'profile');
    await controlled(page);
    await page.route('https://pwa-test.example/**', route => route.fulfill({ status: 200,
      contentType: 'application/json', body: '{"private":"outside"}', headers: { 'Access-Control-Allow-Origin': '*' } }));
    await page.evaluate(async base => {
      await fetch('https://pwa-test.example/rates');
      await fetch(`${base}unknown-financial-data.json`).catch(() => {});
    }, base);
    const urls = await page.evaluate(async () => {
      const names = (await caches.keys()).filter(name => name.startsWith('belilog-pwa:'));
      return (await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).map(request => request.url)))).flat();
    });
    assert.ok(urls.length > 10);
    assert.ok(urls.some(url => url.endsWith('/fonts/report-font.ttf')));
    assert.equal(urls.some(url => url.includes('pwa-test.example') || url.includes('unknown-financial-data') || url.includes('finance-control')), false);
  });
  console.log(`\n${results.filter(result => result.passed).length}/${results.length} PWA browser checks passed`);
} finally {
  try { await browser.close(); }
  finally { await closeProxy(); }
}
