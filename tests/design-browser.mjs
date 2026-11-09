// Visual-only regression gates. Existing behavior and contrast suites remain unchanged.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const baseUrl = process.env.BELILOG_URL ?? 'http://127.0.0.1:5175/FinanceControl/';
const key = 'finance-control:data:v1';
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const ready = { overview: '.overview-stats', tracker: '.tracker-panel', shopping: '.shopping-add-form', profile: '.profile-form' };
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const errors = [];
let passed = 0;
let total = 0;

function seed(language = 'en', theme = 'light', empty = false) {
  return {
    version: 2,
    profile: { name: 'W'.repeat(80), email: '', monthlyBudget: 100, currency: 'EUR', language, theme },
    transactions: empty ? [] : [{ id: 'food', title: language === 'en' ? 'Weekly groceries and fresh vegetables' : 'Продукты на неделю и свежие овощи',
      amount: 80, currency: 'EUR', category: 'food', date: today, createdAt: today },
    { id: 'home', title: 'Home essentials', amount: 120, currency: 'EUR', category: 'home', date: today, createdAt: today }],
    shoppingList: empty ? [] : [{ id: 'bread', title: language === 'en' ? 'Wholegrain bread from the bakery' : 'Цельнозерновой хлеб из пекарни', currency: 'EUR', createdAt: today }],
    categoryBudgets: empty ? [] : [{ id: 'food', amount: 100, currency: 'EUR' }, { id: 'home', amount: 100, currency: 'EUR' },
      { id: 'transport', amount: 100, currency: 'EUR' }],
    shoppingTemplates: empty ? [] : [{ id: 'weekly', name: language === 'en' ? 'Groceries for the whole family this week' : 'Продукты на всю семью на эту неделю',
      items: [{ title: 'Bread', currency: 'EUR' }] }],
  };
}

async function open(context, route = 'overview') {
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') errors.push(`Console ${message.type()}: ${message.text()}`);
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== new URL(baseUrl).origin) errors.push(`Unexpected external request: ${url.href}`);
  });
  await page.goto(`${baseUrl}#${route}`);
  await page.locator(ready[route]).waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function navigate(page, route) {
  await page.locator(`a[href="#${route}"]:visible`).first().click();
  await page.locator(ready[route]).waitFor();
}
async function check(name, run, { data = seed(), raw, lastGood, colorScheme = data.profile.theme === 'dark' ? 'dark' : 'light' } = {}) {
  if (process.env.DESIGN_CASE && !name.includes(process.env.DESIGN_CASE)) return;
  total++;
  const errorCount = errors.length;
  const context = await browser.newContext({ viewport: { width: 360, height: 950 }, isMobile: true,
    hasTouch: true, timezoneId: 'Europe/Berlin', reducedMotion: 'reduce', colorScheme });
  await context.addInitScript(({ key, data, raw, lastGood }) => {
    if (localStorage.getItem('__belilogDesignSeed')) return;
    localStorage.setItem(key, raw ?? JSON.stringify(data));
    if (lastGood) localStorage.setItem(`${key}:last-good`, lastGood);
    localStorage.setItem('__belilogDesignSeed', '1');
    window.__belilogThemeBeforeReact = [];
    const observe = () => {
      if (document.documentElement && !document.getElementById('root')) {
        window.__belilogThemeBeforeReact.push(document.documentElement.dataset.theme);
      }
    };
    new MutationObserver(observe).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme'] });
  }, { key, data, raw, lastGood });
  try {
    await run(context);
    assert.equal(errors.length, errorCount, errors.slice(errorCount).join('\n'));
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    process.exitCode = 1;
    console.error(`FAIL ${name}\n${error.stack ?? error}`);
  } finally { await context.close(); }
}
async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  const viewport = page.viewportSize();
  assert.equal(dimensions.width, viewport.width, `Layout viewport must not expand and auto-zoom: ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.content <= viewport.width + 1, JSON.stringify(dimensions));
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    const box = await dialog.boundingBox();
    assert.ok(box && box.x >= -1 && box.x + box.width <= dimensions.width + 1, JSON.stringify(box));
    assert.equal(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true);
  }
}
async function touchTargets(page, selector = 'body') {
  const failures = await page.locator(selector).evaluate((root) => [...root.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].flatMap((element) => {
    const style = getComputedStyle(element);
    if (element.disabled || element.closest('[inert]') || element.getAttribute('aria-hidden') === 'true' ||
      style.display === 'none' || style.visibility === 'hidden' || style.clipPath !== 'none' ||
      (style.clip !== 'auto' && style.clip !== '')) return [];
    let box = element.getBoundingClientRect();
    if (!box.width || !box.height || !element.getClientRects().length) return [];
    // A native checkbox/radio and its associated label form a single clickable target.
    if (element.matches('input[type="checkbox"],input[type="radio"]')) box = (element.closest('label') ?? element).getBoundingClientRect();
    if (box.width >= 43.5 && box.height >= 43.5) return [];
    return [{ element: element.tagName, class: element.className?.baseVal ?? element.className,
      name: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 70), width: box.width, height: box.height }];
  }));
  assert.deepEqual(failures, [], `Mobile targets must be at least 44×44px: ${JSON.stringify(failures, null, 2)}`);
}
async function accessible(page, selector) {
  if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async (selector) => {
    const report = await window.axe.run(document.querySelector(selector), { runOnly: { type: 'rule',
      values: ['color-contrast', 'button-name', 'label', 'aria-dialog-name', 'aria-progressbar-name'] } });
    return report.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
  }, selector);
  assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
}

try {
  for (const theme of ['light', 'dark']) {
    await check(`semantic text, state, control, focus and chart token contrast: ${theme}`, async (context) => {
      const page = await open(context);
      const failures = await page.evaluate(() => {
        const probe = document.createElement('span'); document.body.append(probe);
        const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas color normalization is unavailable');
        const color = (token) => {
          if (token === 'white') return 'white';
          const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
          if (!raw) throw new Error(`Missing semantic token ${token}`);
          probe.style.color = ''; probe.style.color = `var(${token})`;
          return getComputedStyle(probe).color;
        };
        const rgb = (token, underlay) => {
          const value = color(token);
          // Modern CSS may serialize color-mix as color(srgb ...). Canvas resolves
          // either representation to the same rendered sRGB pixel used by contrast.
          context.clearRect(0, 0, 1, 1);
          if (underlay) { context.fillStyle = color(underlay); context.fillRect(0, 0, 1, 1); }
          context.fillStyle = value; context.fillRect(0, 0, 1, 1);
          const pixel = context.getImageData(0, 0, 1, 1).data;
          if (pixel[3] !== 255) throw new Error(`Contrast token must be opaque: ${token}=${value}`);
          return [...pixel].slice(0, 3).map((channel) => channel / 255);
        };
        const lum = (color) => color.map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
          .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
        const pairs = [];
        const surfaces = ['--bg', '--surface', '--surface-raised'];
        for (const foreground of ['--text', '--text-muted', '--accent-text', '--success', '--warning', '--danger']) {
          for (const background of surfaces) pairs.push([foreground, background, 4.5]);
        }
        for (const background of ['--surface-muted', '--surface-hover', '--accent-soft']) {
          for (const foreground of ['--text', '--text-muted']) pairs.push([foreground, background, 4.5]);
        }
        pairs.push(['--on-accent', '--accent', 4.5], ['--on-accent', '--accent-hover', 4.5], ['--success', '--success-soft', 4.5],
          ['--warning', '--warning-soft', 4.5], ['--danger', '--danger-soft', 4.5],
          ['--avatar-text', '--avatar-bg', 4.5], ['--poster-ink', '--poster-paper', 4.5],
          ['--poster-ink-muted', '--poster-paper', 4.5], ['--poster-seal-rookie', '--poster-paper', 4.5],
          ['--poster-seal-rising', '--poster-seal-rising-fill', 3],
          ['--poster-seal-supernova', '--poster-seal-supernova-fill', 3],
          ['--poster-seal-legend', '--poster-seal-legend-fill', 3, '--brand-navy']);
        for (const foreground of ['--featured-text', '--featured-muted', '--featured-accent', '--featured-success', '--featured-danger']) {
          pairs.push([foreground, '--featured-bg', 4.5]);
        }
        for (const foreground of ['--voyage-text', '--voyage-muted', '--voyage-accent']) pairs.push([foreground, '--voyage-bg', 4.5]);
        pairs.push(['--voyage-meta-text', '--voyage-meta-bg', 4.5, '--voyage-bg'],
          // A white image is the lowest-contrast case for the dark translucent avatar overlay.
          ['--brand-parchment', '--avatar-overlay', 4.5, 'white']);
        for (const foreground of ['--control-border', '--control-border-hover', '--focus-ring', '--chart-outline']) {
          for (const background of surfaces) pairs.push([foreground, background, 3]);
        }
        for (const foreground of ['--chart-food', '--chart-transport', '--chart-home', '--chart-entertainment',
          '--chart-health', '--chart-shopping', '--chart-other', '--chart-bar', '--chart-bar-active']) pairs.push([foreground, '--surface', 3]);
        for (let level = 0; level <= 4; level++) pairs.push([`--activity-border-${level}`, '--surface', 3]);
        // The zero/empty tones are decorative; active controls must still have contrasting borders.
        for (const token of ['--border', '--chart-empty', '--activity-0', '--activity-1', '--activity-2', '--activity-3', '--activity-4']) rgb(token);
        const failures = pairs.flatMap(([foreground, background, minimum, underlay]) => {
          const [low, high] = [lum(rgb(foreground)), lum(rgb(background, underlay))].sort((a, b) => a - b);
          const ratio = (high + .05) / (low + .05);
          return ratio + .001 >= minimum ? [] : [{ foreground, background, ratio: Number(ratio.toFixed(2)), minimum }];
        });
        probe.remove(); return failures;
      });
      assert.deepEqual(failures, [], JSON.stringify(failures, null, 2));
    }, { data: seed('en', theme) });
  }

  for (const language of ['ru', 'en']) for (const theme of ['light', 'dark']) {
    await check(`mobile pages, calendar and editors remain accessible: ${language}/${theme}/360`, async (context) => {
      const page = await open(context);
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement);
        return { width: parseFloat(style.outlineWidth), offset: parseFloat(style.outlineOffset), visible: document.activeElement.matches(':focus-visible') };
      });
      assert.ok(focus.visible && focus.width >= 2 && focus.offset >= 2, JSON.stringify(focus));
      await noOverflow(page); await touchTargets(page); await accessible(page, 'main');
      for (const state of ['normal', 'warning', 'over']) {
        const label = page.locator(`.category-budget-${state} .budget-state`).first();
        assert.equal(await label.isVisible(), true);
        assert.ok((await label.innerText()).trim().length > 0);
        assert.equal(await label.locator('svg').count(), 1, 'Limit state must have a visible symbol as well as text');
      }
      const patterns = await page.locator('.donut pattern path').evaluateAll((paths) => paths.map((path) => path.getAttribute('d')));
      assert.equal(patterns.length, 7);
      assert.equal(new Set(patterns).size, 7, 'Category series need distinct non-color patterns');
      await page.locator('.category-limits-button').click();
      await page.locator('.category-budgets-form').waitFor();
      await noOverflow(page); await touchTargets(page, '.modal'); await accessible(page, '.modal');
      await page.locator('.category-budgets-form button[type="submit"]').click();
      await page.locator('.toast').waitFor(); await accessible(page, '.toast');
      await navigate(page, 'tracker');
      await noOverflow(page); await touchTargets(page); await accessible(page, 'main');
      await page.getByRole('button', { name: /^(Add expense|Добавить расход)$/ }).first().click();
      await page.locator('.modal .form-grid').waitFor();
      await page.locator('.modal .form-grid input').first().fill('Validation');
      await page.locator('.amount-input').fill('0');
      await page.locator('.dialog-footer button[type="submit"]').click();
      await page.locator('.form-error').waitFor();
      await noOverflow(page); await touchTargets(page, '.modal'); await accessible(page, '.modal');
      await page.keyboard.press('Escape');
      await page.locator('.transaction-open').first().click();
      await page.locator('.entry-details').waitFor();
      await noOverflow(page); await touchTargets(page, '.modal'); await accessible(page, '.modal');
      await page.keyboard.press('Escape');
      await navigate(page, 'shopping');
      await noOverflow(page); await touchTargets(page); await accessible(page, 'main');
      await page.locator('.shopping-templates-button').click();
      await page.locator('.shopping-template-form').waitFor();
      await noOverflow(page); await touchTargets(page, '.modal'); await accessible(page, '.modal');
      await page.keyboard.press('Escape');
      await navigate(page, 'profile');
      await noOverflow(page); await touchTargets(page); await accessible(page, 'main');
      assert.ok(await page.locator('.activity-day:not(:disabled)').count() > 0);
      const dayBox = await page.locator('.activity-day[tabindex="0"]').boundingBox();
      assert.ok(dayBox && dayBox.width >= 43.5 && dayBox.height >= 43.5, JSON.stringify(dayBox));
      await page.locator('.activity-day[tabindex="0"]').focus();
      await page.locator('.activity-day[tabindex="0"]').press('Control+Home');
      assert.equal(await page.locator('.activity-day[tabindex="0"]').count(), 1);
      assert.ok((await page.locator('.activity-day[tabindex="0"]').getAttribute('data-date')).endsWith('-01-01'));
      const revealed = await page.locator('.activity-scroll').evaluate((container) => {
        const day = container.querySelector('.activity-day[tabindex="0"]').getBoundingClientRect();
        const bounds = container.getBoundingClientRect();
        return day.left >= bounds.left - 1 && day.right <= bounds.right + 1;
      });
      assert.equal(revealed, true, 'Keyboard navigation must reveal large mobile calendar cells');
      await page.locator('input[accept="image/png,image/jpeg,image/webp"]').setInputFiles('public/belilog-icon-512.png');
      await page.locator('.avatar-crop-viewport').waitFor();
      await noOverflow(page); await touchTargets(page, '.modal'); await accessible(page, '.modal');
      for (const selector of ['.avatar-crop-save', '.avatar-crop-cancel']) {
        const contrast = await page.locator(selector).evaluate((element) => {
          const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          const luminance = () => {
            return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((value) => {
              const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
            }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
          };
          // Render the actual ancestry so a transparent button is tested against
          // its modal surface, rather than accidentally against transparent black.
          const backgrounds = [];
          for (let node = element; node; node = node.parentElement) backgrounds.unshift(getComputedStyle(node).backgroundColor);
          context.fillStyle = 'white'; context.fillRect(0, 0, 1, 1);
          for (const background of backgrounds) { context.fillStyle = background; context.fillRect(0, 0, 1, 1); }
          const backgroundLuminance = luminance();
          const style = getComputedStyle(element);
          context.fillStyle = style.color; context.fillRect(0, 0, 1, 1);
          const [low, high] = [luminance(), backgroundLuminance].sort((a, b) => a - b);
          return (high + .05) / (low + .05);
        });
        assert.ok(contrast >= 4.5, `${selector} text contrast is ${contrast.toFixed(2)}`);
      }
    }, { data: seed(language, theme) });

    await check(`empty and 1000-item shopping layouts fit mobile: ${language}/${theme}/360`, async (context) => {
      const page = await open(context);
      for (const route of ['overview', 'tracker', 'shopping', 'profile']) {
        if (route !== 'overview') await navigate(page, route);
        await noOverflow(page); await touchTargets(page); await accessible(page, 'main');
      }
      const full = seed(language, theme);
      full.shoppingList = Array.from({ length: 1000 }, (_, index) => ({ id: `full-${index}`, title: 'W'.repeat(160), currency: 'EUR', createdAt: today }));
      await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key, data: full });
      await page.goto(`${baseUrl}#shopping`);
      // A hash-only navigation keeps the current tab's React state. Reload to
      // read this independent fixture from storage, without faking a storage event.
      await page.reload(); await page.locator('.shopping-add-form').waitFor();
      assert.equal(await page.locator('[data-shopping-item]').count(), 50);
      await noOverflow(page); await touchTargets(page); await accessible(page, 'main');
    }, { data: seed(language, theme, true) });

    await check(`corrupted-storage recovery panel retains readable actions: ${language}/${theme}/360`, async (context) => {
      const page = await open(context);
      await page.locator('.storage-warning').waitFor();
      await noOverflow(page); await touchTargets(page); await accessible(page, '.storage-warning');
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), '{broken');
    }, { data: seed(language, theme), raw: '{broken', lastGood: JSON.stringify(seed(language, theme)) });

    await check(`quota errors and toast remain accessible without overflow: ${language}/${theme}/360`, async (context) => {
      const page = await open(context, 'profile');
      await page.evaluate((key) => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (name === key) throw new DOMException('Storage is full', 'QuotaExceededError');
          return original.call(this, name, value);
        };
      }, key);
      await page.locator('.profile-form input[required]').first().fill('Quota draft');
      await page.locator('h1').click();
      await page.locator('.storage-warning').waitFor();
      await noOverflow(page); await touchTargets(page); await accessible(page, '.storage-warning');
      if (await page.locator('.toast').count()) await accessible(page, '.toast');
    }, { data: seed(language, theme) });

    const exact = seed(language, theme);
    exact.transactions = [{ ...exact.transactions[0], amount: 100 }];
    exact.categoryBudgets = [{ id: 'food', amount: 100, currency: 'EUR' }];
    await check(`exactly 100% budget has reached presentation without claiming overspend: ${language}/${theme}`, async (context) => {
      const page = await open(context);
      assert.equal(await page.locator('.category-budget-track').getAttribute('aria-valuenow'), '100');
      assert.equal(await page.locator('.category-budget-warning').count(), 1, 'Existing 100% category threshold must stay unchanged');
      assert.equal(await page.locator('.category-budget-over').count(), 0);
      assert.notEqual(await page.locator('.stat-card-budget').getAttribute('data-state'), 'over');
      const labels = await page.locator('.budget-state').allTextContents();
      assert.ok(labels.length >= 3);
      for (const label of labels) {
        assert.match(label, /used|reached|использован|достигнут|исчерпан/i);
        assert.doesNotMatch(label, /over limit|near limit|перерасход|близко к лимиту/i);
      }
      const caption = await page.locator('.budget-caption').innerText();
      assert.match(caption, /used|reached|использован|достигнут|исчерпан/i);
      assert.doesNotMatch(caption, /exceeded|over by|превышен|сверх/i);
      // Daily tracking deliberately migrates legacy data; all financial fields
      // must remain byte-for-byte equivalent while the confirmed day is added.
      assert.deepEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key), {
        ...exact, version: 3,
        streak: { version: 1, startedOn: today, confirmedDays: [{ date: today, status: 'LOGGED' }] },
      });
      await noOverflow(page); await accessible(page, 'main');
    }, { data: exact });
  }

  for (const theme of ['light', 'dark']) {
    await check(`persisted ${theme} theme is applied before React even against opposite system preference`, async (context) => {
      const page = await open(context);
      const initialThemes = await page.evaluate(() => window.__belilogThemeBeforeReact);
      assert.ok(initialThemes.includes(theme), `No pre-React ${theme} theme was observed: ${JSON.stringify(initialThemes)}`);
      assert.ok(initialThemes.filter(Boolean).every((value) => value === theme), JSON.stringify(initialThemes));
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).profile.theme, key), theme);
    }, { data: seed('en', theme), colorScheme: theme === 'dark' ? 'light' : 'dark' });

    await check(`system ${theme} theme is applied before React and follows media changes`, async (context) => {
      const page = await open(context);
      const initialThemes = await page.evaluate(() => window.__belilogThemeBeforeReact);
      assert.ok(initialThemes.includes(theme), `No pre-React ${theme} system theme was observed: ${JSON.stringify(initialThemes)}`);
      assert.ok(initialThemes.filter(Boolean).every((value) => value === theme), JSON.stringify(initialThemes));
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      const opposite = theme === 'dark' ? 'light' : 'dark';
      await page.emulateMedia({ colorScheme: opposite });
      await page.waitForFunction((value) => document.documentElement.dataset.theme === value, opposite);
      assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).profile.theme, key), 'system');
    }, { data: seed('en', 'system'), colorScheme: theme });

    const legend = seed('en', theme);
    legend.transactions = Array.from({ length: 100 }, (_, index) => {
      const day = new Date(`${today}T12:00:00`); day.setDate(day.getDate() - index - 1);
      const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      return { id: `legend-${index}`, title: 'Daily record', amount: 1, currency: 'EUR', category: 'food', date, createdAt: date };
    });
    await check(`reduced motion disables Legend glow and new-bounty particles: ${theme}`, async (context) => {
      const page = await open(context);
      assert.equal(await page.locator('.bounty-poster').getAttribute('data-rank'), 'legend');
      const assertStill = async () => {
        const motion = await page.evaluate(() => ({
          animations: document.getAnimations().filter((animation) => animation.playState === 'running').map((animation) => animation.effect?.target?.className),
          particles: [...document.querySelectorAll('.bounty-flame,.bounty-ember,.bounty-ash,.bounty-gold-spark')].filter((element) => {
            const style = getComputedStyle(element);
            return element.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
          }).map((element) => element.className),
        }));
        assert.deepEqual(motion.animations, []); assert.deepEqual(motion.particles, []);
      };
      await assertStill();
      await page.getByRole('button', { name: 'Add expense', exact: true }).first().click();
      await page.locator('.modal .form-grid input').first().fill('Today’s record');
      await page.locator('.amount-input').fill('1');
      await page.locator('.dialog-footer button[type="submit"]').click();
      await page.locator('.bounty-poster--increased').waitFor();
      assert.equal(await page.locator('.bounty-poster').getAttribute('data-bounty'), '50500000');
      await assertStill();
    }, { data: legend });
  }
} finally {
  await browser.close();
  console.log(`${passed}/${total} visual design regressions passed`);
  if (errors.length) { process.exitCode = 1; console.error(errors.join('\n')); }
}
