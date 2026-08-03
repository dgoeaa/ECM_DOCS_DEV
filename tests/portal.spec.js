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
    if (r.status() < 400 || isExternal(url)) return;
    if (new URL(url).origin !== 'http://localhost:8080') return;
    errs.push(`${r.status()} ${url}`);
  });
  return errs;
}

const PAGES = ['index.html', 'submit.html', 'track.html', 'support.html', 'admin.html', '404.html'];

test.describe('document portal', () => {
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
