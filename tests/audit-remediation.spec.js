/**
 * Design-audit remediation — one assertion per finding that was fixed by measurement.
 *
 * Every test here fails on the pre-fix source. They are written against the numbers in
 * docs/audits/DESIGN_AUDIT_BRIEF_ASSESSMENT.md so a regression reads as the finding
 * returning, not as an anonymous layout failure.
 *
 * The portal is served from the repository root by the shared webServer, so its pages are
 * under /document-portal/. The internal platform is entered through its own single sign-on
 * control, which is what the audit did and is finding I-12.
 */

import { test, expect } from '@playwright/test';

/* The portal registers a service worker. Left active it survives between navigations in a
   worker's context and serves cached copies of exactly the files these tests measure, so a
   fix would pass or fail depending on what a previous test happened to cache. Blocked here:
   this suite measures the source on disk. */
test.use({ serviceWorkers: 'block' });

const PORTAL = '/document-portal/';

/* An optional, git-ignored config file is fetched with onerror="void 0", so 'load' can sit
   waiting on a request that will never settle. Every navigation here waits for the document
   instead, then for the page script that renders into it. */
async function open(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
}
const PAGES = ['index.html', 'submit.html', 'track.html', 'support.html', '404.html'];
const PHONE = [414, 360, 320];
const ALL_WIDTHS = [1440, 1280, 1200, 900, 640, ...PHONE];

/* ============================================================
   Document portal
   ============================================================ */

test.describe('P-01 · the header cluster no longer forces horizontal overflow', () => {
  for (const page_ of PAGES) {
    test(`${page_} has zero document overflow at every width`, async ({ page }) => {
      // One navigation, then resize. Overflow here is decided entirely by CSS, and a cold
      // page load in CI costs more than every measurement in this test put together.
      await open(page, PORTAL + page_);
      for (const w of ALL_WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(120);
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth);
        // Measured before the fix: 75px at 414 and 128px at 360 on the four content pages.
        expect(overflow, `${page_} at ${w}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('the action cluster and its flex children can compress', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await open(page, PORTAL + 'index.html');
    const acts = page.locator('.pf-top__acts');
    await expect(acts).toBeVisible();
    const right = await acts.evaluate(el => Math.round(el.getBoundingClientRect().right));
    // It used to sit at a fixed ~488px regardless of a 360px viewport.
    expect(right).toBeLessThanOrEqual(360);
  });
});

test.describe('P-07 · the sovereignty statement never truncates', () => {
  test('no truncation at any width', async ({ page }) => {
    await open(page, PORTAL + 'index.html');
    for (const w of [1440, 900, 640, 414, 360, 320]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(120);
      const clipped = await page.locator('.pf-ribbon__gov')
        .evaluate(el => el.scrollWidth > el.clientWidth + 0.5);
      expect(clipped, `a clipped national identity statement at ${w}px names a different country`).toBe(false);
    }
  });

  test('the short form replaces the long one below the phone breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await open(page, PORTAL + 'index.html');
    await expect(page.locator('.pf-gov-short')).toBeVisible();
    await expect(page.locator('.pf-gov-long')).toBeHidden();
  });
});

test.describe('P-02 · 404 keeps its navigation at every width', () => {
  test('wayfinding is reachable at every width', async ({ page }) => {
    await open(page, PORTAL + '404.html');
    for (const w of [1440, 900, 414, 360]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(120);
      const reachable = await page.evaluate(() => {
        const nav = [...document.querySelectorAll('.pf-nav a')].filter(a => a.offsetParent !== null).length;
        const burger = [...document.querySelectorAll('.pf-burger')].filter(a => a.offsetParent !== null).length;
        return nav + burger;
      });
      // Before: 0 nav links and 0 menu controls at and below 768px.
      expect(reachable, `the page a mistyped URL lands on had no header navigation at ${w}px`).toBeGreaterThan(0);
    }
  });

  test('404 carries the standard footer, not a reduced bar', async ({ page }) => {
    await open(page, PORTAL + '404.html');
    expect(await page.locator('.pf-foot__grid a').count()).toBeGreaterThan(8);
  });
});

test.describe('P-05 · one footer submit list, in the catalogue’s own names', () => {
  test('every page publishes an identical list', async ({ page }) => {
    test.setTimeout(180000); // five cold navigations
    const lists = [];
    for (const p of PAGES) {
      await open(page, PORTAL + p);
      lists.push(await page.locator('#footSubmit a').allTextContents());
    }
    expect(lists[0].length, 'the list is rendered from the catalogue').toBeGreaterThan(0);
    for (const l of lists) expect(l).toEqual(lists[0]);
    // submit.html used to abbreviate this one to "Proposal or EOI".
    expect(lists[0]).toContain('Proposal or expression of interest');
  });
});

test.describe('P-03 / V-07 · step 1 flags and focuses the control it rejected', () => {
  test('a failed Continue moves focus and marks the radiogroup invalid', async ({ page }) => {
    await open(page, PORTAL + 'submit.html');
    await page.click('#nextBtn');
    await expect(page.locator('#serviceList')).toHaveAttribute('aria-invalid', 'true');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('serviceList');
    await expect(page.locator('#service-err')).toBeVisible();
  });
});

test.describe('V-01 / V-03 / P-04 · the portal publishes only figures it can stand behind', () => {
  test('a configured deployment installs no demonstration records', async ({ page, context }) => {
    await context.addInitScript(() => {
      window.PF_CONFIG = { endpoints: { SUBMISSION: 'http://127.0.0.1:9/never' } };
    });
    await open(page, PORTAL + 'index.html');
    const r = await page.evaluate(() => ({
      demo: PF.demoMode(),
      records: PF.store.all().length,
      tickets: PF.store.tickets().length,
      onTimeRate: PF.metrics().onTimeRate,
      notice: !!document.querySelector('#demoNote')
    }));
    expect(r.demo).toBe(false);
    // Sixteen seed records used to install themselves into every visitor's browser and
    // every public figure on the front door was computed from them.
    expect(r.records).toBe(0);
    expect(r.tickets).toBe(0);
    // It used to fall back to 100 — a perfect on-time score on an empty register.
    expect(r.onTimeRate).toBeNull();
    expect(r.notice).toBe(false);
  });

  test('an unavailable figure is suppressed, not rendered as a number', async ({ page, context }) => {
    await context.addInitScript(() => {
      window.PF_CONFIG = { endpoints: { SUBMISSION: 'http://127.0.0.1:9/never' } };
    });
    await open(page, PORTAL + 'index.html');
    const labels = await page.locator('#heroStats .pf-stat__l').allTextContents();
    expect(labels).not.toContain('Closed within target');
    await open(page, PORTAL + 'support.html');
    expect((await page.locator('#supportStats').textContent()) || '').not.toContain('on time');
  });

  test('a demonstration build says so, and states its real figures before any scroll', async ({ page }) => {
    await open(page, PORTAL + 'index.html');
    await expect(page.locator('#demoNote')).toBeVisible();
    const shown = await page.locator('#heroStats .pf-stat__v').allTextContents();
    // The band used to render four literal zeros until an IntersectionObserver fired at 40%
    // visibility, so anyone who did not scroll read "0 requests in the registry".
    expect(shown.every(v => v === '0' || v === '0%')).toBe(false);
  });
});

test.describe('V-02 · a submission is never reported as received when it was not sent', () => {
  test('an unconnected registry produces a truthful receipt', async ({ page }) => {
    await open(page, PORTAL + 'submit.html');
    await page.click('#serviceList input[type=radio]');
    await page.click('#nextBtn');
    await page.fill('#name', 'Test Submitter');
    await page.fill('#email', 'test@example.gov.ng');
    await page.fill('#org', 'Test Organisation');
    await page.selectOption('#orgType', { index: 1 });
    await page.selectOption('#state', { index: 1 });
    await page.click('#nextBtn');
    await page.fill('#title', 'A test subject line');
    await page.fill('#description', 'A description comfortably over twenty characters long.');
    await page.setInputFiles('input[type=file]', {
      name: 'evidence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test')
    });
    await page.check('#declare');
    await page.click('#nextBtn');
    await page.click('#nextBtn');
    await page.click('[data-act="ok"]');
    await expect(page.locator('#result')).toBeVisible();
    // It used to read "Submission received" and fire a success toast on the local write
    // alone, then hand over a tracking ID for a document the registry never saw.
    await expect(page.locator('#resultTitle')).toHaveText('Saved on this device only');
    await expect(page.locator('#deliveryState')).toContainText('has not been sent');
  });
});

/* ============================================================
   Internal platform
   ============================================================ */

async function enterPlatform(page) {
  await open(page, '/index.html');
  await page.waitForSelector('[data-sso]');
  await page.click('[data-sso]');
  await page.waitForSelector('[data-enter]', { state: 'visible' });
  await page.click('[data-enter]');
  await page.waitForSelector('dgo-shell');
  await page.waitForTimeout(800);
}

const ROUTES = ['home', 'ecm-erp-charter', 'activities', 'correspondence', 'response-tracking',
  'orchestrator', 'single-assignment', 'bulk-assignment', 'fasttrack', 'approvals',
  'acknowledgment', 'dispatch', 'scan-intake', 'registry', 'briefs', 'meetings', 'projects',
  'comments', 'reports', 'statistics', 'executive', 'assistant', 'lookup', 'operator-hud',
  'settings', 'diagnostics', 'user-admin', 'archive', 'correspondence-email'];

test.describe('I-02 / I-17 · one name per screen', () => {
  test('every route’s heading matches its navigation label, and the title names the screen', async ({ page }) => {
    test.setTimeout(300000);
    await enterPlatform(page);
    const mismatches = [];
    for (const r of ROUTES) {
      await page.evaluate(h => { location.hash = '#/' + h; }, r);
      await page.waitForTimeout(500);
      const d = await page.evaluate(() => ({
        h1: document.querySelector('#main h1')?.textContent.trim(),
        nav: document.querySelector('[data-context]')?.textContent.trim(),
        title: document.title
      }));
      if (d.h1 !== d.nav) mismatches.push(`${r}: nav="${d.nav}" heading="${d.h1}"`);
      // The title was one static string on all 29 screens, naming a release codename.
      expect(d.title, r).toBe(`${d.nav} — DGO Digital Operations`);
      expect(d.title, r).not.toContain('R11.6');
      expect(d.title, r).not.toContain('Obsidian');
    }
    // Before: 13 of 29.
    expect(mismatches, mismatches.join('\n')).toEqual([]);
  });
});

test.describe('I-01 · every built screen is reachable by a link', () => {
  test('the guided routes are linked from the workspace that declares them', async ({ page }) => {
    test.setTimeout(300000);
    await enterPlatform(page);
    const reachable = new Set();
    for (const r of ROUTES) {
      await page.evaluate(h => { location.hash = '#/' + h; }, r);
      await page.waitForTimeout(400);
      for (const href of await page.locator('.dgo-sidebar__item, .dgo-related__link').evaluateAll(
        els => els.map(e => e.getAttribute('href')))) {
        if (href?.startsWith('#/')) reachable.add(href.slice(2));
      }
    }
    // Twenty routes rendered correctly but nothing in the shell linked to them.
    const unreachable = ROUTES.filter(r => !reachable.has(r));
    expect(unreachable, unreachable.join(', ')).toEqual([]);
  });
});

test.describe('I-03 · the KPI band never strands a tile beside dead space', () => {
  for (const w of [1440, 1280, 1024, 924]) {
    test(`Command Center at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await enterPlatform(page);
      await page.evaluate(() => { location.hash = '#/home'; });
      await page.waitForTimeout(700);
      const rows = await page.evaluate(() => {
        const byRow = {};
        document.querySelectorAll('.cc-kpi-band .kpi').forEach(k => {
          const r = k.getBoundingClientRect();
          (byRow[Math.round(r.y)] = byRow[Math.round(r.y)] || []).push(Math.round(r.width));
        });
        return Object.values(byRow);
      });
      expect(rows.length).toBeGreaterThan(0);
      const band = await page.evaluate(() =>
        Math.round(document.querySelector('.cc-kpi-band').getBoundingClientRect().width));
      // A wrapped tile fills the row it wraps onto. Before, the fifth tile sat at 168px
      // beside roughly 530px of empty row.
      for (const row of rows.slice(1)) {
        if (row.length === 1) expect(row[0]).toBeGreaterThan(band * 0.9);
      }
    });
  }

  test('the inert grid declaration is gone from the outer band', async ({ page }) => {
    await enterPlatform(page);
    await page.evaluate(() => { location.hash = '#/home'; });
    await page.waitForTimeout(600);
    const cs = await page.evaluate(() => {
      const b = getComputedStyle(document.querySelector('.cc-kpi-band'));
      return { display: b.display, cols: b.gridTemplateColumns };
    });
    // It declared grid-template-columns while computing display:block.
    if (cs.display === 'block') expect(cs.cols).toBe('none');
  });
});

test.describe('H-02 / V-06 · a real icon set, not typographic characters', () => {
  test('every navigation and top-bar icon is a resolved sprite symbol', async ({ page }) => {
    await enterPlatform(page);
    const r = await page.evaluate(() => ({
      sprite: !!document.getElementById('dgo-icon-sprite'),
      navSvgs: document.querySelectorAll('.dgo-nav-icon svg use').length,
      glyphText: [...document.querySelectorAll('.dgo-nav-icon')].map(n => n.textContent.trim()).filter(Boolean),
      unresolved: [...document.querySelectorAll('svg use')]
        .map(u => u.getAttribute('href'))
        .filter(h => h && !document.getElementById(h.slice(1)))
    }));
    expect(r.sprite).toBe(true);
    expect(r.navSvgs).toBe(9);
    // "Email Desk" used to be a bullet, because it had no entry in the glyph map at all.
    expect(r.glyphText).toEqual([]);
    expect(r.unresolved).toEqual([]);
  });

  test('no two routes share an icon', async ({ page }) => {
    await enterPlatform(page);
    await page.evaluate(() => document.querySelector('dgo-shell').openCommandPalette());
    await page.waitForTimeout(300);
    const syms = await page.locator('.dgo-cmdk__icon use').evaluateAll(
      els => els.map(e => e.getAttribute('href')));
    // The palette caps its result list at 20; single-assignment and registry are both in
    // that window, and they were the pair that shared ▣.
    expect(syms.length).toBeGreaterThanOrEqual(20);
    expect(new Set(syms).size, 'two routes drawn with the same icon').toBe(syms.length);
  });
});

test.describe('I-10 · the sidebar shows that navigation continues below the fold', () => {
  test('no item is sliced across the scroll boundary at a short viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 540 });
    await enterPlatform(page);
    const r = await page.evaluate(() => {
      const nav = document.querySelector('.dgo-sidebar__nav');
      const b = nav.getBoundingClientRect();
      return {
        scrollable: nav.dataset.scrollable,
        sliced: [...document.querySelectorAll('.dgo-sidebar__item')]
          .filter(a => { const r = a.getBoundingClientRect(); return r.top < b.bottom && r.bottom > b.bottom + 0.5; })
          .map(a => a.textContent.trim())
      };
    });
    expect(r.scrollable).toBe('true');
    expect(r.sliced, 'a half-cut row with no scroll affordance').toEqual([]);
  });
});

test.describe('I-20 / I-22 · controls carry names, prose is not styled as a link', () => {
  test('the intake filters are labelled and the overflow control is named', async ({ page }) => {
    await enterPlatform(page);
    await page.evaluate(() => { location.hash = '#/correspondence'; });
    await page.waitForTimeout(900);
    expect(await page.locator('.cc-filter > span').allTextContents()).toEqual(['Status', 'Category']);
    await expect(page.locator('.cc-more-btn')).toHaveText('More actions');
  });

  test('Assignment Desk source cards do not underline their body text', async ({ page }) => {
    await enterPlatform(page);
    await page.evaluate(() => { location.hash = '#/single-assignment'; });
    await page.waitForTimeout(900);
    const decos = await page.locator('.source-guidance-card').evaluateAll(
      els => els.map(e => getComputedStyle(e).textDecorationLine));
    expect(decos.length).toBeGreaterThan(0);
    expect(decos.every(d => d === 'none')).toBe(true);
  });
});

test.describe('I-05 / I-12 / I-19 · operator surfaces speak to operators', () => {
  test('the sign-in control does not advertise skipping verification', async ({ page }) => {
    await open(page, '/index.html');
    await page.waitForSelector('[data-sso]');
    const label = await page.textContent('[data-sso]');
    expect(label).not.toContain('skip');
    expect(label).not.toContain('OTP');
  });

  test('the identity block shows a role, not a stored slug', async ({ page }) => {
    await enterPlatform(page);
    await expect(page.locator('[data-role]')).toContainText('Administrator');
    expect(await page.locator('[data-role]').textContent()).not.toContain('admin ·');
  });

  test('Scan Intake gives a clerk an action, not a configuration key', async ({ page }) => {
    await enterPlatform(page);
    await page.evaluate(() => { location.hash = '#/scan-intake'; });
    await page.waitForTimeout(900);
    const body = await page.locator('#main').textContent();
    expect(body).not.toContain('config.local.js');
    expect(body).not.toContain('DGO_CONFIG');
    expect(body).not.toContain('Byte path');
  });
});
