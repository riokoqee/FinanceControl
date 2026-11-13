import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const url = process.env.BELILOG_URL ?? 'http://127.0.0.1:5175/belilog/';
const key = 'finance-control:data:v1';
const pre = `${key}:pre-replace`;
const seed = {
  version: 3,
  profile: { name: 'Before replacement', email: '', currency: 'USD', monthlyBudget: 90, theme: 'light', language: 'en' },
  transactions: [{ id: 'before-expense', title: 'Original purchase', amount: 12, currency: 'USD', category: 'food', date: '2026-11-13', createdAt: '2026-11-13' }],
  streak: { version: 1, startedOn: '2026-11-13', confirmedDays: [{ date: '2026-11-13', status: 'LOGGED' }] },
};
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
let passed = 0;
async function until(check) {
  const deadline = Date.now() + 15_000;
  let latest;
  do { try { return await check(); } catch (error) { latest = error; } await delay(40); } while (Date.now() < deadline);
  throw latest;
}
const read = (page, name = key) => page.evaluate(name => JSON.parse(localStorage.getItem(name)), name);
const restore = page => page.locator('.storage-actions button').filter({ hasText: /Restore data from before replacement|Восстановить данные до замены/ });
async function check(name, run, { quota = '', estimate = 'valid' } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Berlin', reducedMotion: 'reduce' });
  const errors = [];
  await context.addInitScript(({ key, seed, quota, estimate }) => {
    if (location.origin === 'null') return;
    if (!localStorage.getItem('__storageSafetySeed')) {
      localStorage.setItem(key, JSON.stringify(seed));
      localStorage.setItem(`${key}:last-good`, JSON.stringify(seed));
      localStorage.setItem('unrelated-data', 'keep');
      localStorage.setItem('__storageSafetySeed', '1');
    }
    Object.defineProperty(navigator, 'storage', { configurable: true, value: estimate === 'unsupported' ? {} : {
      estimate: async () => {
        if (estimate === 'failed') throw new Error('Estimate denied');
        return { usage: 2 * 1024 ** 2, quota: 8 * 1024 ** 2 };
      },
    } });
    window.__primaryQuotaAttempts = 0;
    if (quota) {
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function(name, value) {
        if (name === key && JSON.parse(value).profile.name === 'Saved despite quota') {
          window.__primaryQuotaAttempts++;
          if (quota === 'always' || localStorage.getItem(`${key}:last-good`) !== null)
            throw new DOMException('Full storage', 'QuotaExceededError');
        }
        if (name === `${key}:last-good`) throw new DOMException('Full secondary copy', 'QuotaExceededError');
        return write.call(this, name, value);
      };
    }
  }, { key, seed, quota, estimate });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-11-13T12:00:00+01:00') });
  try {
    await page.goto(`${url}#profile`);
    await page.locator('.profile-form').waitFor();
    await run(page, context);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    passed++;
    console.log(`PASS ${name}`);
  } finally { await context.close(); }
}

try {
  await check('primary quota retry saves the profile while last-good cannot be recreated', async page => {
    await page.locator('.profile-form input[required]').fill('Saved despite quota');
    await page.locator('.profile-form input[required]').blur();
    await until(async () => assert.equal((await read(page)).profile.name, 'Saved despite quota'));
    assert.equal(await page.evaluate(() => window.__primaryQuotaAttempts), 2);
    assert.equal(await read(page, `${key}:last-good`), null);
    assert.deepEqual((await read(page)).transactions, seed.transactions);
    assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-data')), 'keep');
  }, { quota: 'once' });

  await check('failed quota retry preserves the original primary and the editable draft', async page => {
    const before = await read(page);
    await page.locator('.profile-form input[required]').fill('Saved despite quota');
    await page.locator('.profile-form input[required]').blur();
    await until(async () => assert.ok(await page.locator('.storage-error').count() > 0));
    assert.deepEqual(await read(page), before);
    assert.equal(await page.locator('.profile-form input[required]').inputValue(), 'Saved despite quota');
    assert.equal(await page.evaluate(() => window.__primaryQuotaAttempts >= 2), true);
  }, { quota: 'always' });

  for (const action of ['import', 'reset', 'demo']) {
    await check(`${action} keeps one recoverable pre-replacement snapshot across reload`, async page => {
      assert.equal(await restore(page).count(), 0);
      const before = await read(page);
      if (action === 'import') {
        const incoming = structuredClone(seed);
        incoming.profile.name = 'Imported profile';
        incoming.transactions[0].title = 'Imported purchase';
        await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({
          name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)),
        });
        await page.getByRole('button', { name: 'Restore everything', exact: true }).click();
      } else if (action === 'reset') {
        await page.locator('.data-danger-zone button').click();
        await page.getByRole('dialog').getByRole('button', { name: 'Delete all data', exact: true }).click();
      } else {
        await page.locator('.demo-card button').click();
        await page.getByRole('dialog').getByRole('button', { name: 'Load demo', exact: true }).click();
      }
      await until(async () => assert.deepEqual(await read(page, pre), before));
      if (action === 'demo') await until(async () => assert.ok((await read(page)).streak));
      const replaced = await read(page);
      assert.notDeepEqual(replaced, before);
      await page.reload();
      await restore(page).waitFor();
      await restore(page).click();
      const confirmation = page.getByRole('dialog');
      await confirmation.getByRole('button', { name: /Restore data from before replacement|Восстановить данные до замены/, exact: true }).click();
      await until(async () => assert.deepEqual(await read(page), before));
      assert.deepEqual(await read(page, pre), replaced);
      assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-data')), 'keep');
    });
  }

  await check('site storage estimate displays usage, quota and percentage on mobile', async page => {
    await page.locator('.storage-estimate').waitFor();
    assert.match(await page.locator('.storage-estimate').innerText(), /Site storage[\s\S]*2 \/ 8 MB \(25%\)/);
  });
  for (const estimate of ['unsupported', 'failed']) {
    await check(`${estimate} storage estimate is omitted`, async page => {
      await delay(100);
      assert.equal(await page.locator('.storage-estimate').count(), 0);
    }, { estimate });
  }
  console.log(`${passed}/8 storage safety browser checks passed`);
} finally { await browser.close(); }
