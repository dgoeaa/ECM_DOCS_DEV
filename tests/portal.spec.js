/**
 * Document portal — page-load and correspondence-model coverage.
 *
 * The portal had NO behavioural test of any kind (F-021): 41 files, five pages, a service
 * worker and a client-side console, and the only thing in the test surface that mentioned
 * it was a credential-suppression entry and one read of its source as text.
 *
 * These tests also pin the Step 2 model correction — the portal classifies incoming
 * correspondence, it does not sell services — so a revert to the service catalogue fails
 * here rather than silently reappearing.
 */

import { test, expect } from '@playwright/test';

/** Hosts we do not control; their failure must not redden the suite. */
const EXTERNAL = [/fonts\.googleapis\.com/, /fonts\.gstatic\.com/, /cdn\.tailwindcss\.com/, /unpkg\.com/];
const isExternal = url => EXTERNAL.some(re => re.test(url));

/** Git-ignored deployment config. A 404 on a clean checkout is expected and is why the
 *  tag carries onerror="void 0" — the portal falls back to demo mode. */
const OPTIONAL_404 = [/\/document-portal\/config\.local\.js$/];
const isOptional = url => OPTIONAL_404.some(re => re.test(url));

/** Same-origin failures only, and never the unattributable bare console line. */
function watch(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (isExternal(t)) return;
    // Chromium logs "Failed to load resource: …" with no URL, so it cannot be attributed.
    // The response handler below asserts subresource failures precisely instead.
    if (/^Failed to load resource:/.test(t)) return;
    errs.push(`console: ${t}`);
  });
  page.on('response', r => {
    const url = r.url();
    if (r.status() < 400 || isExternal(url) || isOptional(url)) return;
    if (new URL(url).origin !== 'http://localhost:8080') return;
    errs.push(`${r.status()} ${url}`);
  });
  return errs;
}

const PAGES = ['index.html', 'submit.html', 'track.html', 'support.html', '404.html'];

test.describe('document portal', () => {
  /* Step 6 retired the staff console. It shipped three username/password pairs in a
   * public JavaScript file and checked them in the browser. These assert the deletion,
   * because "we removed the console" is only true while nothing links it back in.
   *
   * These fetch the markup rather than navigating: every page carries a render-blocking
   * stylesheet from fonts.googleapis.com, and where egress is blocked each navigation
   * stalls until that request gives up. A per-page navigation loop cannot fit inside one
   * test timeout, and what is being asserted here is a property of the served bytes. */
  const linksIn = html => [...html.matchAll(/<a[^>]+href="([^"]*)"/g)].map(m => m[1]);

  test('the staff console is gone, not merely unlinked', async ({ request }) => {
    const res = await request.get('/document-portal/admin.html');
    expect(res.status(), 'admin.html must not be served').toBe(404);
    for (const js of ['admin.js', 'admin-panels.js']) {
      const r = await request.get(`/document-portal/js/${js}`);
      expect(r.status(), `${js} must not be served`).toBe(404);
    }
  });

  test('no page links to the retired console, and none to the retired service keys', async ({ request }) => {
    // Step 2 converted submit.html's footer and missed the other three, which went on
    // advertising "IT project clearance" and "Accreditation" to the public.
    for (const p of PAGES) {
      const html = await (await request.get(`/document-portal/${p}`)).text();
      const hrefs = linksIn(html);
      expect(hrefs, `${p} still links to the console`).not.toContain('admin.html');
      expect(hrefs.filter(h => /[?&]service=/.test(h)), `${p} links to retired service keys`).toEqual([]);
    }
  });

  test('the console\'s credentials and session helper are deleted from the runtime', async ({ page }) => {
    await page.goto('/document-portal/index.html', { waitUntil: 'domcontentloaded' });
    const state = await page.evaluate(() => ({
      staff: window.PF.STAFF,
      adminStore: !!(window.PF.store && window.PF.store.admin),
      staleSession: sessionStorage.getItem('nitda.portal.admin'),
    }));
    expect(state.staff, 'PF.STAFF must be deleted, not emptied').toBeUndefined();
    expect(state.adminStore, 'PF.store.admin must be gone with it').toBe(false);
    expect(state.staleSession, 'a session left by the retired console must be cleared on load').toBeNull();
  });

  for (const p of PAGES) {
    test(`${p} loads with no same-origin failure`, async ({ page }) => {
      const errs = watch(page);
      await page.goto(`/document-portal/${p}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      expect(errs, `${p}:\n${errs.join('\n')}`).toEqual([]);
    });
  }

  test('the wizard offers correspondence types, not a service catalogue', async ({ page }) => {
    await page.goto('/document-portal/submit.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#serviceList .pf-choice__t');
    const labels = await page.$$eval('#serviceList .pf-choice__t', ns => ns.map(n => n.textContent.trim()));

    expect(labels.length).toBeGreaterThan(3);

    // Assert against the retired catalogue's actual entries, not against generic words.
    // "Regulatory or compliance filing" is a legitimate correspondence type; matching a
    // loose /compliance filing/ would fail on correct content, which is a worse test than
    // none at all.
    const RETIRED = [
      'IT Project Clearance', 'Data Protection Compliance Filing',
      'Digital Economy Strategy Submission', 'Policy Document Review',
      'Startup Act Labelling Support', 'Accreditation & Licensing',
    ];
    for (const name of RETIRED) {
      expect(labels, `"${name}" is a retired service, not a correspondence type`).not.toContain(name);
    }
    expect(labels.join(' ')).toMatch(/letter|correspondence/i);
  });

  test('guidance promises acknowledgement of receipt, not a decision date', async ({ page }) => {
    await page.goto('/document-portal/submit.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#serviceList label');
    await page.click('#serviceList label:first-child');
    const req = await page.textContent('#serviceReq');
    expect(req).toMatch(/acknowledges receipt/i);
    expect(req).not.toMatch(/decision is due/i);
  });

  test('registry records carry the correspondence shape', async ({ page }) => {
    await page.goto('/document-portal/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.PF && PF.store && PF.store.all().length);
    const rec = await page.evaluate(() => PF.store.all()[0]);

    expect(rec.correspondenceType, 'external submissions are Incoming').toBe('Incoming');
    expect(rec.channel, 'the channel that distinguishes portal intake').toBe('Portal');
    expect(rec.category, 'every submission lands on an internal registry category').toBeTruthy();
    expect(rec.typeLabel).toBeTruthy();

    // The service-desk fields must be gone, not merely unused.
    expect(rec.serviceName, 'serviceName belongs to the retired model').toBeUndefined();
    expect(rec.serviceCode, 'serviceCode belongs to the retired model').toBeUndefined();
    expect(rec.dueAt, 'dueAt was a decision deadline; the portal commits to acknowledgement').toBeUndefined();
    expect(rec.ackDueAt, 'acknowledgement target replaces the per-service SLA').toBeTruthy();
  });

  /* Step 2 renamed the model's fields (name/code/sla -> label/category) but two render
   * paths kept reading the old ones, so they interpolated `undefined` into the page. No
   * console error, no failed request, no failing test — it just silently said "undefined"
   * to the public. These assert the rendered text, which is the only thing that catches it. */
  test('the home page category cards render their labels, not undefined', async ({ page }) => {
    await page.goto('/document-portal/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#catalogue .pf-cat__t');
    const titles = await page.$$eval('#catalogue .pf-cat__t', ns => ns.map(n => n.textContent.trim()));
    expect(titles.length).toBeGreaterThan(3);
    for (const t of titles) expect(t, 'a card title must be a real label').toBeTruthy();

    const html = await page.innerHTML('#catalogue');
    expect(html, 'no field may interpolate as undefined').not.toMatch(/undefined/);
  });

  test('the tracked record view renders its correspondence type, not undefined', async ({ page }) => {
    await page.goto('/document-portal/track.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.PF && PF.store && PF.store.all().length);
    const seed = await page.evaluate(() => {
      const r = PF.store.all().find(x => x.seeded);
      return { id: r.id, email: r.email };
    });
    await page.fill('#trackId', seed.id);
    await page.fill('#trackEmail', seed.email);
    await page.click('#lookupBtn');
    await page.waitForSelector('#trackOut .pf-kv');

    const out = await page.innerHTML('#trackOut');
    expect(out, 'no field may interpolate as undefined').not.toMatch(/undefined/);
    expect(out, 'the retired service vocabulary must not be back').not.toMatch(/<dt>Service<\/dt>/);
  });

  /* Step 6: the tracking page reads status back from the registry.
   * Before this it read localStorage and nothing else, so it could not report a decision
   * the registry had taken, and a submission made on a phone did not exist on a laptop.
   *
   * The status flow is stubbed at the network boundary — the portal calls it directly, so
   * the stub is the configured endpoint itself. What is under test is the client's three
   * resolutions and — the part that matters — that device data is never presented as
   * though it came from the registry. */
  const STATUS_ENDPOINT = 'http://flow.test/intake-status';
  async function withStatusEndpoint(page, fulfil) {
    await page.addInitScript(url => { window.PF_CONFIG = { endpoints: { STATUS: url } }; }, STATUS_ENDPOINT);
    await page.route(STATUS_ENDPOINT, fulfil);
  }
  const seedOf = page => page.evaluate(() => {
    const r = PF.store.all().find(x => x.seeded);
    return { id: r.id, email: r.email };
  });

  test('a match is rendered from the registry and labelled as such', async ({ page }) => {
    await withStatusEndpoint(page, route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, record: {
        referenceId: 'NITDA-2026-000318', status: 'review', statusLabel: 'Under review by the registry',
        category: 'Application', subject: 'Clearance for the national records platform',
        receivedAt: '2026-07-20T09:00:00Z', acknowledgedAt: '2026-07-21T10:00:00Z',
        updatedAt: '2026-07-30T09:00:00Z', actionRequired: false,
        timeline: [{ at: '2026-07-21T10:00:00Z', status: 'received', label: 'Receipt acknowledged.', note: 'Logged by the registry.' }],
      } }),
    }));
    await page.goto('/document-portal/track.html', { waitUntil: 'domcontentloaded' });
    await page.fill('#trackId', 'NITDA-2026-000318');
    await page.fill('#trackEmail', 'someone@example.org');
    await page.click('#lookupBtn');
    await page.waitForSelector('#trackOut .pf-kv');

    const out = await page.innerHTML('#trackOut');
    expect(out).toMatch(/Clearance for the national records platform/);
    expect(out).toMatch(/Under review by the registry/);
    expect(out, 'the source must be stated').toMatch(/Read from the NITDA registry/);
    expect(out, 'device data must not be claimed').not.toMatch(/Shown from this device/);
    expect(out).not.toMatch(/undefined/);
    // The projection carries no officer or attachment list, so those rows must be absent
    // rather than rendered empty.
    expect(out).not.toMatch(/<dt>Reviewing officer<\/dt>/);
    expect(out).not.toMatch(/<dt>Attachments<\/dt>/);
  });

  test('a denial is one message that does not say which half was wrong', async ({ page }) => {
    await withStatusEndpoint(page, route => route.fulfill({
      status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'not_found' }),
    }));
    await page.goto('/document-portal/track.html', { waitUntil: 'domcontentloaded' });
    const seed = await seedOf(page);

    // The reference exists in the device store and the email matches. A denial from the
    // registry is still authoritative — falling back here would resurrect the local echo.
    await page.fill('#trackId', seed.id);
    await page.fill('#trackEmail', seed.email);
    await page.click('#lookupBtn');
    await page.waitForSelector('#trackOut .dgo-alert');

    const out = await page.innerText('#trackOut');
    expect(out).toMatch(/No request matches that tracking ID and email/);
    expect(out, 'the reference must not be confirmed to exist').not.toMatch(/exists/i);
    expect(out, 'nothing may distinguish an unknown reference from a wrong email')
      .not.toMatch(/does not match this request|registered to a different address/i);
  });

  test('an unreachable registry falls back to device data and says so', async ({ page }) => {
    await withStatusEndpoint(page, route => route.abort('connectionrefused'));
    await page.goto('/document-portal/track.html', { waitUntil: 'domcontentloaded' });
    const seed = await seedOf(page);
    await page.fill('#trackId', seed.id);
    await page.fill('#trackEmail', seed.email);
    await page.click('#lookupBtn');
    await page.waitForSelector('#trackOut .pf-kv');

    const out = await page.innerHTML('#trackOut');
    expect(out, 'the fallback must be declared, never silent').toMatch(/Shown from this device/);
    expect(out).not.toMatch(/Read from the NITDA registry/);
    expect(out).not.toMatch(/undefined/);
  });

  test('an unreachable registry with no device copy reports unavailable, not not-found', async ({ page }) => {
    await withStatusEndpoint(page, route => route.abort('connectionrefused'));
    await page.goto('/document-portal/track.html', { waitUntil: 'domcontentloaded' });
    await page.fill('#trackId', 'NITDA-2026-000999');
    await page.fill('#trackEmail', 'nobody@example.org');
    await page.click('#lookupBtn');
    await page.waitForSelector('#trackOut .dgo-alert');

    const out = await page.innerText('#trackOut');
    expect(out).toMatch(/Status is unavailable right now/);
    expect(out, 'an unreachable registry is not evidence the request was never received')
      .not.toMatch(/No request matches/);
  });

  test('every correspondence type maps to an internal category', async ({ page }) => {
    await page.goto('/document-portal/index.html', { waitUntil: 'domcontentloaded' });
    const types = await page.evaluate(() => PF.CORRESPONDENCE_TYPES);
    expect(types.length).toBeGreaterThan(3);
    for (const t of types) {
      expect(t.category, `${t.key} must map to a registry category`).toBeTruthy();
      expect(t.sla, `${t.key} must not carry a per-service SLA`).toBeUndefined();
    }
    // An unknown key must fall back to the catch-all, never to whatever is last in the list.
    const fallback = await page.evaluate(() => PF.correspondenceType('no-such-key').key);
    expect(fallback).toBe('other');
  });
});
