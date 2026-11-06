// Run against a production preview; this script never edits the app's real browser data.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

const baseUrl = process.env.BELILOG_URL ?? process.env.BENCH_URL ?? 'http://127.0.0.1:5175/FinanceControl/';
const output = path.resolve(process.env.BENCH_OUTPUT ?? './performance-results.json');
const dist = path.resolve(process.env.BENCH_DIST ?? './dist');
const storageKey = 'finance-control:data:v1';
const timezone = 'Europe/Berlin';
const day = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(new Date());
const month = day.slice(0, 7);
const recordDays = Math.min(Number(day.slice(8)), 6);

function seed(count, shopping = 0) {
  return {
    version: 1,
    profile: { name: 'Benchmark', email: '', currency: 'USD', monthlyBudget: 10_000, theme: 'light', language: 'en' },
    transactions: Array.from({ length: count }, (_, index) => {
      const date = `${month}-${String(index % recordDays + 1).padStart(2, '0')}`;
      return {
        id: `t${index.toString(36)}`, title: `Product ${index}`, amount: (index % 10_000 + 1) / 100,
        currency: ['USD', 'EUR', 'KZT'][index % 3],
        category: ['food', 'shopping', 'transport', 'home', 'entertainment', 'health', 'other'][index % 7],
        date, createdAt: date, note: index % 5 ? '' : 'benchmark note',
      };
    }),
    ...(shopping ? { shoppingList: Array.from({ length: shopping }, (_, index) => ({
      id: `s${index}`, title: `Planned product ${index}`, currency: 'USD', createdAt: day,
    })) } : {}),
  };
}

const result = {
  kind: 'Production browser benchmark; isolated in-memory storage avoids localStorage quota; no CPU throttling.',
  timing: 'Wall-clock interactions include browser automation and two animation frames. Compare runs on the same machine.',
  profilePersistence: 'Keypress samples do not wait for debounce; blur flush is separate and the final persisted name is checked. Storage counters show if autosave happened during a slow keypress.',
  storageUnits: 'readBytes/writeBytes count UTF-16 string code units; fixture dataBytes uses UTF-8 bytes.',
  date: day, timezone, node: process.version, browser: '', url: baseUrl, assets: [], cases: [],
};
const assets = path.join(dist, 'assets');
if (fs.existsSync(assets)) {
  for (const filename of fs.readdirSync(assets).sort()) {
    if (!/\.(?:js|css|woff2)$/.test(filename)) continue;
    const bytes = fs.readFileSync(path.join(assets, filename));
    result.assets.push({ filename, bytes: bytes.length, gzip: zlib.gzipSync(bytes).length });
  }
} else {
  result.assetsWarning = `No local assets found at ${assets}; build the app or set BENCH_DIST to include bundle sizes.`;
}
function saveReport() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
}

async function instrument(context, raw) {
  await context.addInitScript(({ key, raw }) => {
    const values = new Map([[key, raw]]);
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    const originalRemove = Storage.prototype.removeItem;
    const isAppKey = (value) => value === key || value.startsWith(`${key}:`);
    window.__storageStats = { reads: 0, writes: 0, readBytes: 0, writeBytes: 0, readMs: 0, writeMs: 0 };
    window.__jsonStats = { parses: 0, stringifies: 0, parseMs: 0, stringifyMs: 0 };
    Storage.prototype.getItem = function (key) {
      if (!isAppKey(key)) return originalGet.call(this, key);
      const at = performance.now(), value = values.get(key) ?? null;
      window.__storageStats.reads++;
      window.__storageStats.readBytes += value?.length ?? 0;
      window.__storageStats.readMs += performance.now() - at;
      return value;
    };
    Storage.prototype.setItem = function (key, value) {
      if (!isAppKey(key)) return originalSet.call(this, key, value);
      const at = performance.now();
      value = String(value);
      values.set(key, value);
      window.__storageStats.writes++;
      window.__storageStats.writeBytes += value.length;
      window.__storageStats.writeMs += performance.now() - at;
    };
    Storage.prototype.removeItem = function (key) {
      if (isAppKey(key)) values.delete(key);
      else originalRemove.call(this, key);
    };
    const parse = JSON.parse, stringify = JSON.stringify;
    JSON.parse = function (...args) {
      const at = performance.now();
      try { return parse.apply(this, args); }
      finally { window.__jsonStats.parses++; window.__jsonStats.parseMs += performance.now() - at; }
    };
    JSON.stringify = function (...args) {
      const at = performance.now();
      try { return stringify.apply(this, args); }
      finally { window.__jsonStats.stringifies++; window.__jsonStats.stringifyMs += performance.now() - at; }
    };
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      window.__longTasks.push(...list.getEntries().map(({ startTime, duration }) => ({ startTime, duration })));
    }).observe({ type: 'longtask', buffered: true });
  }, { key: storageKey, raw });
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function sample(page, name, action) {
  await page.evaluate(() => {
    window.__probe = {
      at: performance.now(), storage: structuredClone(window.__storageStats), json: structuredClone(window.__jsonStats),
    };
  });
  await action();
  await settle(page);
  return page.evaluate((name) => {
    const delta = (a, b) => Object.fromEntries(Object.keys(a).map((key) => [key, a[key] - b[key]]));
    return {
      name, ms: performance.now() - window.__probe.at,
      storage: delta(window.__storageStats, window.__probe.storage), json: delta(window.__jsonStats, window.__probe.json),
    };
  }, name);
}
async function resources(page) {
  return page.evaluate(() => performance.getEntriesByType('resource').map((resource) => ({
    name: resource.name, bytes: resource.decodedBodySize, transfer: resource.transferSize, initiator: resource.initiatorType,
  })));
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
result.browser = browser.version();
try {
  for (const config of [
    { count: 0, route: 'tracker' }, { count: 1_000, route: 'tracker' },
    { count: 10_000, route: 'tracker' }, { count: 50_000, route: 'tracker' },
    { count: 0, shopping: 1_000, route: 'shopping' },
  ]) {
    const raw = JSON.stringify(seed(config.count, config.shopping));
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: timezone, reducedMotion: 'reduce' });
    try {
      await instrument(context, raw);
      const page = await context.newPage();
      page.setDefaultTimeout(90_000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      const target = new URL(baseUrl);
      target.hash = config.route;
      await page.goto(target.href);
      // The app shell's h1 appears before its lazy page; wait for real controls.
      if (config.route === 'shopping') await page.locator('.shopping-add-name input').waitFor();
      else {
        await page.getByRole('textbox', { name: 'Search expenses' }).waitFor();
        if (config.count) await page.locator('.transaction-open').first().waitFor();
      }
      await settle(page);
      const load = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
          readyMs: performance.now(), nodes: document.querySelectorAll('*').length,
          navigation: { domContentLoaded: navigation.domContentLoadedEventEnd, load: navigation.loadEventEnd, transferSize: navigation.transferSize },
          storage: structuredClone(window.__storageStats), json: structuredClone(window.__jsonStats), longTasks: [...window.__longTasks],
        };
      });
      load.resources = await resources(page);
      const { metrics } = await cdp.send('Performance.getMetrics');
      const metric = (name) => metrics.find((item) => item.name === name)?.value ?? null;
      const milliseconds = (name) => metric(name) === null ? null : metric(name) * 1_000;
      load.cpu = { taskMs: milliseconds('TaskDuration'), scriptMs: milliseconds('ScriptDuration'), layoutMs: milliseconds('LayoutDuration'), jsHeap: metric('JSHeapUsedSize') };
      const item = { ...config, dataBytes: Buffer.byteLength(raw), load, interactions: [], errors };
      if (config.route === 'tracker') {
        item.renderedRows = await page.locator('.transaction-open').count();
        for (const value of ['Product 1', 'Product 12', '']) {
          item.interactions.push(await sample(page, `search ${JSON.stringify(value)}`, async () => {
            await page.getByRole('textbox', { name: 'Search expenses' }).fill(value);
            await page.locator('.tracker-panel[aria-busy="true"]').waitFor({ state: 'hidden' });
          }));
        }
        if (config.count) {
          item.interactions.push(await sample(page, 'open edit dialog', async () => {
            await page.locator('.row-actions button').first().click();
            await page.locator('.modal .form-grid input').first().waitFor();
          }));
          item.interactions.push(await sample(page, 'edit title one character', () => page.locator('.modal .form-grid input').first().press('X')));
          await page.keyboard.press('Escape');
          await settle(page);
        }
        item.interactions.push(await sample(page, 'open profile', async () => {
          await page.locator('a[href="#profile"]:visible').first().click();
          await page.locator('.profile-form input[required]').waitFor();
        }));
        const input = page.locator('.profile-form input[required]');
        for (let index = 0; index < 3; index++) {
          item.interactions.push(await sample(page, 'profile name one character', () => input.press('x')));
        }
        item.interactions.push(await sample(page, 'profile flush on blur', () => page.locator('.topbar .avatar').focus()));
        const expectedName = (await input.inputValue()).trim();
        const persistedName = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).profile.name, storageKey);
        if (persistedName !== expectedName) throw new Error(`Profile was not persisted: expected ${expectedName}, got ${persistedName}`);
        item.profilePersisted = true;
      } else {
        item.renderedRows = await page.locator('.shopping-item').count();
        item.interactions.push(await sample(page, 'type shopping price digit', () => page.locator('.shopping-price-input').first().fill('2')));
      }
      item.resources = await resources(page);
      result.cases.push(item);
      saveReport();
      console.log(JSON.stringify({
        config, readyMs: load.readyMs, cpu: load.cpu, nodes: load.nodes, rows: item.renderedRows,
        interactions: item.interactions.map((interaction) => ({
          name: interaction.name, ms: interaction.ms, reads: interaction.storage.reads,
          writes: interaction.storage.writes, jsonMs: interaction.json.parseMs + interaction.json.stringifyMs,
        })), errors,
      }));
      if (errors.length) throw new Error(`Browser errors in ${config.route} benchmark; see ${output}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  saveReport();
}
console.log(`Saved ${output}`);
