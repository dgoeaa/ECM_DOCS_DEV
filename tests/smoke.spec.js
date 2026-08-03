import { test, expect } from '@playwright/test';

/**
 * Smoke suite — "does each app boot, and does it stay booted".
 *
 * These assertions are deliberately shallow but unforgiving. The runtime once shipped
 * with 12 config modules missing: it hung on its boot spinner with no thrown error and
 * no console exception, because static module resolution fails before core/boot.js can
 * run its try/catch. `__DGO_BOOTED__` and the "no 4xx" assertion are what catch that.
 */

/** Hosts we do not control; their failure must not redden the suite. */
const EXTERNAL = [/fonts\.googleapis\.com/, /fonts\.gstatic\.com/, /cdn\.tailwindcss\.com/, /unpkg\.com/];

/** Optional, git-ignored, expected to 404 on a clean checkout. */
const OPTIONAL_404 = [/\/config\/config\.local\.js$/];

const isExternal = url => EXTERNAL.some(re => re.test(url));
const isOptional = url => OPTIONAL_404.some(re => re.test(url));

/** Collect page errors, console errors and same-origin 4xx/5xx for a page. */
function watch(page) {
  const pageErrors = [];
  const consoleErrors = [];
  const badResponses = [];
  page.on('pageerror', e => pageErrors.push(String(e.message)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (isExternal(text) || isOptional(text)) return;
    // Chromium logs a bare "Failed to load resource: …" with no URL attached, so it cannot
    // be attributed here. Subresource failures are asserted precisely — with URL and status
    // — by the response handler below, so drop the unattributable duplicate rather than
    // loosening that check. Genuine console.error() calls from app code still land here.
    if (/^Failed to load resource:/.test(text)) return;
    consoleErrors.push(text);
  });
  page.on('response', r => {
    const url = r.url();
    if (r.status() < 400) return;
    if (isExternal(url) || isOptional(url)) return;
    if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) return;
    badResponses.push(`${r.status()} ${new URL(url).pathname}`);
  });
  return { pageErrors, consoleErrors, badResponses };
}

test.describe('DGO R11.6 root runtime', () => {
  test('boots, mounts the shell and loads every same-origin asset', async ({ page }) => {
    const w = watch(page);

    const response = await page.goto('/index.html?skipWelcome=1', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);

    // The boot flag is the real gate: it is only set after the module graph resolved,
    // the router registered every module and the shell replaced the spinner.
    await expect.poll(() => page.evaluate(() => window.__DGO_BOOTED__ === true), {
      timeout: 15_000,
      message: 'runtime never set window.__DGO_BOOTED__ — the module graph likely failed to resolve',
    }).toBe(true);

    await expect(page.locator('dgo-shell')).toHaveCount(1);
    await expect(page.locator('#app .boot')).toHaveCount(0); // spinner replaced
    await expect(page.locator('#app .fatal')).toHaveCount(0); // watchdog did not fire

    expect(w.badResponses, 'same-origin 4xx/5xx').toEqual([]);
    expect(w.pageErrors, 'uncaught page errors').toEqual([]);
    expect(w.consoleErrors, 'console errors').toEqual([]);
  });

  test('exposes the accessibility entry points', async ({ page }) => {
    await page.goto('/index.html?skipWelcome=1', { waitUntil: 'networkidle' });
    await expect(page.locator('a.skip[href="#main"]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    await expect.poll(() => page.evaluate(() => !!document.querySelector('#main'))).toBe(true);
  });

  test('every declared route mounts without error', async ({ page }) => {
    const w = watch(page);
    await page.goto('/index.html?skipWelcome=1', { waitUntil: 'networkidle' });
    await expect.poll(() => page.evaluate(() => window.__DGO_BOOTED__ === true), { timeout: 15_000 }).toBe(true);

    const routes = await page.evaluate(async () => {
      const m = await import('./config/routes.config.js');
      return m.Routes.map(r => r.path);
    });
    expect(routes.length).toBeGreaterThan(0);

    const failures = [];
    for (const route of routes) {
      await page.evaluate(r => { location.hash = '#/' + r; }, route);
      await expect
        .poll(() => page.evaluate(() => !!document.querySelector('[data-outlet] .route-stage')), { timeout: 8_000 })
        .toBe(true);
      const denied = await page.evaluate(() =>
        /Workspace not found|Module failed/.test(document.querySelector('[data-outlet]')?.textContent || '')
      );
      if (denied) failures.push(route);
    }
    expect(failures, 'routes that failed to mount').toEqual([]);
    expect(w.pageErrors, 'uncaught page errors while routing').toEqual([]);
  });

  // Regression guard for the stale data-theme mirrors that made dark mode unreadable
  // and left the high-contrast theme inert.
  test('themes actually repaint the page surfaces', async ({ page }) => {
    await page.goto('/index.html?skipWelcome=1', { waitUntil: 'networkidle' });
    await expect.poll(() => page.evaluate(() => window.__DGO_BOOTED__ === true), { timeout: 15_000 }).toBe(true);

    const sample = async theme =>
      page.evaluate(t => {
        document.documentElement.dataset.theme = t;
        const b = getComputedStyle(document.body);
        return { bg: b.backgroundColor, fg: b.color };
      }, theme);

    const light = await sample('light');
    const dark = await sample('dark');
    const hc = await sample('hc');

    expect(dark.bg, 'dark theme must not reuse the light background').not.toBe(light.bg);
    expect(dark.fg, 'dark theme must not reuse the light foreground').not.toBe(light.fg);
    expect(hc.fg, 'high-contrast theme must not reuse the light foreground').not.toBe(light.fg);

    // The attributes belong on <html> only; mirrors on body/shell shadow inherited tokens.
    const mirrors = await page.evaluate(() => ({
      body: document.body.getAttribute('data-theme'),
      shell: document.querySelector('dgo-shell')?.getAttribute('data-theme') ?? null,
    }));
    expect(mirrors.body, 'data-theme must not be mirrored onto <body>').toBeNull();
    expect(mirrors.shell, 'data-theme must not be mirrored onto <dgo-shell>').toBeNull();
  });

  test('the welcome overlay is driven by design tokens, not hardcoded literals', async ({ page }) => {
    // The overlay is the first surface a user sees and used to be the only one that
    // ignored the active theme: its eight --wel-* names were literals, so light, dark
    // and high-contrast all painted identically. They now resolve from platform tokens.
    await page.goto('/index.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('.dgo-wel', { timeout: 15_000 });

    const sample = async theme =>
      page.evaluate(t => {
        document.documentElement.dataset.theme = t;
        const el = document.querySelector('.dgo-wel');
        const root = getComputedStyle(document.documentElement);
        return {
          bg: getComputedStyle(el).backgroundColor,
          token: root.getPropertyValue('--dgo-color-surface-brand').trim(),
        };
      }, theme);

    const light = await sample('light');
    const hc = await sample('hc');

    // High contrast overrides --dgo-color-surface-brand, so the overlay must move with it.
    // Dark deliberately keeps green-700, so light and dark are expected to match — asserting
    // they differ would encode a design decision the platform never made.
    expect(hc.bg, 'high-contrast must repaint the welcome overlay').not.toBe(light.bg);
    expect(hc.token, 'high-contrast must override the brand surface token').not.toBe(light.token);
  });

  test('?skipWelcome=1 reaches the shell without the welcome overlay', async ({ page }) => {
    await page.goto('/index.html?skipWelcome=1', { waitUntil: 'networkidle' });
    await expect.poll(() => page.evaluate(() => window.__DGO_BOOTED__ === true), { timeout: 15_000 }).toBe(true);
    await expect(page.locator('.dgo-welcome')).toHaveCount(0);
  });
});

test.describe('ECM Activity Hub retirement (D6(b))', () => {
  /* The Hub was a second internal application: 15 of its 19 pages duplicated root routes,
   * it shared no backend, state, identity or code with this platform, and it had no backend
   * at all. Its three unique capabilities — briefs, meetings, projects — were ported to
   * root modules; the shell was retired. These assert the retirement is real, because
   * "we removed it" stays true only while nothing serves it again. */
  test('the tree is not served', async ({ request }) => {
    for (const p of ['/ECM_ActivityHub_Portal/index.html',
                     '/ECM_ActivityHub_Portal/js/core/auth.js',
                     '/ECM_ActivityHub_Portal/js/core/store.js']) {
      expect((await request.get(p)).status(), `${p} must not be served`).toBe(404);
    }
  });

  test('its three unique capabilities live in the root platform', async ({ page }) => {
    await page.goto('/index.html?skipWelcome=1', { waitUntil: 'networkidle' });
    await expect.poll(() => page.evaluate(() => window.__DGO_BOOTED__ === true), { timeout: 15_000 }).toBe(true);

    for (const [route, heading] of [['briefs', /Briefs & Submissions/], ['meetings', /Meetings/], ['projects', /Projects/]]) {
      const w = watch(page);
      await page.evaluate(r => { location.hash = '#/' + r; }, route);
      await page.waitForSelector('[data-outlet] .route-stage .workspace');
      const text = await page.textContent('[data-outlet]');
      expect(text, `${route} did not mount`).not.toMatch(/Workspace not found|Module failed|Access denied/);
      expect(text).toMatch(heading);
      expect(w.pageErrors, `uncaught errors on ${route}`).toEqual([]);
    }
  });
});
