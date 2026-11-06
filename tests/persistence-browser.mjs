import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.env.BELILOG_URL ?? 'http://127.0.0.1:5175/FinanceControl/';
const KEY = 'finance-control:data:v1';
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
let passed = 0, total = 0;
const seed = () => ({ version: 1, profile: { name: 'Audit', email: '', currency: 'USD', monthlyBudget: 100, theme: 'light', language: 'en' },
  transactions: [{ id: 'a', title: 'Original', amount: 10, currency: 'USD', category: 'food', date: today }] });
const read = (p) => p.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
async function open(context, route = 'tracker') {
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', (error) => { console.error(error); process.exitCode = 1; });
  await page.goto(`${url}#${route}`);
  await page.locator('h1').waitFor();
  await page.locator({ overview: '.overview-stats', tracker: '.tracker-panel', shopping: '.shopping-add-form', profile: '.profile-form' }[route]).waitFor();
  return page;
}
async function test(name, fn, { raw = JSON.stringify(seed()), lastGood, memory = false, route = 'tracker' } = {}) {
  total++;
  const context = await browser.newContext({ viewport: { width: 390, height: 950 }, reducedMotion: 'reduce', timezoneId: 'Europe/Berlin' });
  await context.addInitScript(({ KEY, raw, lastGood, memory }) => {
    if (memory) {
      let value = raw;
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key) { return key === KEY ? value : get.call(this, key); };
      Storage.prototype.setItem = function (key, next) { if (key === KEY) value = next; else set.call(this, key, next); };
    } else if (!localStorage.getItem('__persistence_seed')) {
      localStorage.setItem(KEY, raw);
      if (lastGood) localStorage.setItem(`${KEY}:last-good`, lastGood);
      localStorage.setItem('__persistence_seed', '1');
    }
  }, { KEY, raw, lastGood, memory });
  try { await fn(await open(context, route), context); passed++; console.log(`PASS ${name}`); }
  catch (error) { process.exitCode = 1; console.error(`FAIL ${name}\n${error.stack}`); }
  finally { await context.close(); }
}
async function addExpense(page, title = 'New expense', amount = '12') {
  await page.getByRole('button', { name: /^(Add expense|Добавить расход)$/ }).first().click();
  await page.locator('.modal .form-grid input').first().fill(title);
  await page.locator('.amount-input').fill(amount);
  await page.locator('.dialog-footer button[type="submit"]').click();
}

try {
  const broken = JSON.stringify({ ...seed(), transactions: [...seed().transactions, { ...seed().transactions[0], id: 'bad', amount: 0 }] });
  await test('corrupt primary survives startup and rejected edits; explicit reset archives it', async (page) => {
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), KEY), broken);
    await addExpense(page);
    assert.equal(await page.getByRole('dialog').count(), 1);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), KEY), broken);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Начать заново', exact: true }).click();
    await page.getByRole('button', { name: 'Удалить все данные', exact: true }).click();
    assert.deepEqual((await read(page)).transactions, []);
    assert.equal(await page.evaluate((key) => localStorage.getItem(`${key}:recovery`), KEY), broken);
    await page.reload();
    assert.equal(await page.locator('.storage-warning').count(), 0);
  }, { raw: broken });

  await test('last-good recovery requires confirmation and preserves damaged raw data', async (page) => {
    assert.equal(await page.locator('.transaction-open').count(), 1);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), KEY), '{broken');
    await page.getByRole('button', { name: 'Restore last good copy', exact: true }).click();
    await page.getByRole('button', { name: 'Restore backup', exact: true }).click();
    assert.equal((await read(page)).transactions[0].title, 'Original');
    assert.equal(await page.evaluate((key) => localStorage.getItem(`${key}:recovery`), KEY), '{broken');
    await page.reload();
    assert.equal(await page.locator('.storage-warning').count(), 0);
  }, { raw: '{broken', lastGood: JSON.stringify(seed()) });

  await test('failed primary writes keep the dialog and previous data', async (page) => {
    await page.evaluate((key) => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('Storage is full', 'QuotaExceededError'); return set.call(this, name, value); };
    }, KEY);
    await addExpense(page);
    assert.equal(await page.getByRole('dialog').count(), 1);
    assert.equal((await read(page)).transactions.length, 1);
    assert.ok((await page.locator('.modal .form-error').innerText()).length > 0);
    assert.equal(await page.getByText('Expense added. Everything is under control!', { exact: true }).count(), 0);
  });

  await test('same-field manual conflict rejects overwrite and allows loading latest', async (a, context) => {
    const b = await open(context);
    await a.locator('.row-actions button').first().click();
    await a.locator('.amount-input').fill('12');
    await b.locator('.row-actions button').first().click();
    await b.locator('.amount-input').fill('20');
    await b.locator('.dialog-footer button[type="submit"]').click();
    await a.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).transactions[0].amount === 20, KEY);
    await a.locator('.dialog-footer button[type="submit"]').click();
    assert.equal((await read(a)).transactions[0].amount, 20);
    assert.equal(await a.getByRole('dialog').count(), 1);
    await a.getByRole('button', { name: 'Load current entry', exact: true }).click();
    assert.equal(await a.locator('.amount-input').inputValue(), '20');
  });

  await test('deleted record is not resurrected by a stale manual dialog', async (a, context) => {
    const b = await open(context);
    await a.locator('.row-actions button').first().click();
    await a.locator('.modal .form-grid input').first().fill('Stale title');
    await b.locator('.delete-action').first().click();
    await a.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).transactions.length === 0, KEY);
    await a.locator('.dialog-footer button[type="submit"]').click();
    assert.equal((await read(a)).transactions.length, 0);
    assert.equal(await a.getByRole('dialog').count(), 1);
  });

  await test('profile conflict preserves remote changes and can be resolved without leaving the form', async (a, context) => {
    const b = await open(context, 'profile');
    const nameA = a.locator('.profile-form input[required]');
    const nameB = b.locator('.profile-form input[required]');
    await nameA.fill('');
    await nameB.fill('Remote name');
    await a.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).profile.name === 'Remote name', KEY);
    await nameA.fill('My name');
    assert.equal((await read(a)).profile.name, 'Remote name');
    await a.getByRole('button', { name: 'Load current profile', exact: true }).click();
    assert.equal(await nameA.inputValue(), 'Remote name');
    await nameA.fill('Resolved name');
    await a.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).profile.name === 'Resolved name', KEY);
    assert.equal((await read(a)).profile.name, 'Resolved name');
  }, { route: 'profile' });

  await test('changing currency rejects a competing budget edit and retains the local draft', async (a, context) => {
    const b = await open(context, 'profile');
    const budgetA = a.locator('.profile-form input[type="number"]');
    // An unfinished email keeps the budget draft pending without relying on a
    // narrow debounce race between the two tabs.
    await a.locator('.profile-form input[type="email"]').fill('unfinished@');
    await budgetA.fill('150');
    await b.locator('.profile-form input[required]').fill('Remote captain');
    await b.locator('.profile-form input[type="number"]').fill('200');
    await b.locator('.profile-form button[type="submit"]').click();
    await a.waitForFunction(() => document.querySelector('.profile-form input[required]').value === 'Remote captain');
    await a.locator('.profile-form select').first().selectOption('EUR');
    assert.equal((await read(a)).profile.currency, 'USD');
    assert.equal((await read(a)).profile.monthlyBudget, 200);
    assert.equal(await budgetA.inputValue(), '150');
    assert.equal(await a.locator('.profile-form input[type="email"]').inputValue(), 'unfinished@');
    assert.equal(await a.locator('.profile-form select').first().inputValue(), 'USD');
    await a.getByRole('button', { name: 'Load current profile', exact: true }).waitFor();
  }, { route: 'profile' });

  await test('instant theme and currency changes preserve an unfinished text draft without duplicate commits', async (page) => {
    await page.evaluate((key) => {
      window.__profileWrites = 0;
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) window.__profileWrites++;
        return set.call(this, name, value);
      };
    }, KEY);
    await page.locator('.profile-form input[type="email"]').fill('unfinished@');
    await page.locator('.profile-form input[required]').fill('Pending captain');
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    assert.equal((await read(page)).profile.theme, 'dark');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.locator('.profile-form select').first().selectOption('EUR');
    const saved = await read(page);
    assert.equal(saved.profile.currency, 'EUR');
    assert.equal(saved.profile.monthlyBudget, 92);
    assert.equal(saved.profile.name, 'Audit');
    assert.equal(saved.profile.email, '');
    assert.equal(await page.locator('.profile-form input[required]').inputValue(), 'Pending captain');
    assert.equal(await page.locator('.profile-form input[type="email"]').inputValue(), 'unfinished@');
    await page.waitForTimeout(450);
    assert.equal(await page.evaluate(() => window.__profileWrites), 2);
    // Finishing the unrelated draft still saves against the original text baseline.
    await page.locator('.profile-form input[type="email"]').fill('captain@example.com');
    await page.locator('.profile-form button[type="submit"]').click();
    assert.equal((await read(page)).profile.name, 'Pending captain');
    assert.equal((await read(page)).profile.email, 'captain@example.com');
    assert.equal((await read(page)).profile.currency, 'EUR');
  }, { route: 'profile' });

  await test('clicking the selected theme preserves a queued text autosave', async (page) => {
    await page.locator('.profile-form input[required]').fill('Still saves automatically');
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).profile.name === 'Still saves automatically', KEY);
    assert.equal((await read(page)).profile.theme, 'light');
  }, { route: 'profile' });

  for (const replacement of ['import', 'demo', 'reset']) {
    await test(`profile editing immediately after ${replacement} uses the replacement baseline`, async (page) => {
      if (replacement === 'import') {
        const incoming = seed();
        incoming.profile = { ...incoming.profile, name: 'Imported captain', currency: 'EUR', monthlyBudget: 92, theme: 'dark' };
        await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({
          name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)),
        });
        await page.getByRole('button', { name: 'Restore everything', exact: true }).click();
      } else if (replacement === 'demo') {
        await page.locator('.demo-card button').click();
        await page.getByRole('dialog').getByRole('button', { name: 'Load demo', exact: true }).click();
      } else {
        await page.locator('.data-danger-zone button').click();
        await page.getByRole('dialog').getByRole('button', { name: 'Delete all data', exact: true }).click();
      }
      const expected = `${replacement} edited captain`;
      await page.locator('.profile-form input[required]').fill(expected);
      await page.locator('.profile-form button[type="submit"]').click();
      assert.equal((await read(page)).profile.name, expected);
      assert.equal(await page.getByRole('button', { name: /^(Load current profile|Загрузить актуальный профиль)$/ }).count(), 0);
    }, { route: 'profile' });
  }

  const highBudget = seed(); highBudget.profile.monthlyBudget = 3_000_000_000;
  await test('currency conversion above budget limit is rejected before mutation', async (page) => {
    await page.locator('a[href="#profile"]:visible').first().click();
    await page.locator('.profile-form select').first().selectOption('KZT');
    assert.equal((await read(page)).profile.currency, 'USD');
    assert.equal((await read(page)).profile.monthlyBudget, 3_000_000_000);
    assert.equal(await page.locator('.profile-form select').first().inputValue(), 'USD');
  }, { raw: JSON.stringify(highBudget) });

  await test('import merge uses winning transaction metadata and keeps currency on title edits', async (page) => {
    const incoming = seed();
    incoming.transactions[0].title = 'Old title';
    incoming.shoppingList = [{ id: 's', title: 'Old title', currency: 'USD', createdAt: today, transactionId: 'a' }];
    await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
    await page.getByRole('button', { name: 'Add records', exact: true }).click();
    await page.locator('a[href="#shopping"]:visible').first().click();
    assert.equal((await read(page)).shoppingList[0].currency, 'EUR');
    assert.equal(await page.locator('.shopping-title-input').inputValue(), 'Current title');
    await page.locator('.shopping-title-input').fill('Title only changed');
    await page.locator('.shopping-title-input').press('Enter');
    assert.equal((await read(page)).transactions[0].amount, 25);
    assert.equal((await read(page)).transactions[0].currency, 'EUR');
  }, { route: 'profile', raw: JSON.stringify({ ...seed(), transactions: [{ ...seed().transactions[0], title: 'Current title', amount: 25, currency: 'EUR' }] }) });

  const full = seed(); full.transactions = Array.from({ length: 50_000 }, (_, i) => ({ ...full.transactions[0], id: i.toString(36), title: 'x' }));
  await test('manual record limit rejects the 50001st expense and history renders only one page', async (page) => {
    assert.equal(await page.locator('.transaction-open').count(), 50);
    await addExpense(page);
    assert.equal(await page.getByRole('dialog').count(), 1);
    assert.equal((await read(page)).transactions.length, 50_000);
    assert.ok((await page.locator('.modal .form-error').innerText()).includes('50,000'));
  }, { raw: JSON.stringify(full), memory: true });
} finally {
  await browser.close();
  console.log(`${passed}/${total} persistence browser regressions passed`);
}
