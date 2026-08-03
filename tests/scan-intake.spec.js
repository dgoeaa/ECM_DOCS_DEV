/**
 * Registry Scan Intake — channel C behaviour. TARGET_ARCHITECTURE.md §3.2, step 7.
 *
 * The proxy is stubbed at the network boundary. What is under test is the workspace's two
 * governing rules, both written as negative controls:
 *
 *   1. NO RECORD WITHOUT A DEPOSIT. A correspondence record must not appear unless the
 *      document actually reached the library. A record pointing at an unfiled document is
 *      a broken custody record — the F-028 silent-loss failure, internally.
 *   2. CUSTODY IS ATTRIBUTED BY THE SERVER. `depositedBy` comes from the proxy's response,
 *      which read it from the verified token, never from anything the page supplies.
 */

import { test, expect } from '@playwright/test';

const PROXY = 'http://proxy.test';
const SCAN_URL = `${PROXY}/documents/scan`;

/**
 * Supply deploy-time config by serving `config/config.local.js`, which is what index.html
 * loads and what a deployment fills in.
 *
 * Not addInitScript: config.local.js ASSIGNS `window.DGO_CONFIG` rather than merging into
 * it, so anything injected earlier is discarded. Serving the file is also what makes these
 * tests independent of whether a developer happens to have a local one on disk.
 */
function serveConfig(page, cfg) {
  return page.route('**/config/config.local.js', route => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.DGO_CONFIG = ${JSON.stringify(cfg)};`,
  }));
}

async function withProxy(page, fulfil) {
  await serveConfig(page, { auth: { proxyBaseUrl: PROXY } });
  if (fulfil) await page.route(SCAN_URL, fulfil);
}

const withoutProxy = page => serveConfig(page, {});

const okDeposit = (over = {}) => route => route.fulfill({
  status: 201, contentType: 'application/json',
  body: JSON.stringify({
    ok: true,
    referenceId: 'NITDA-2026-000318',
    attachmentLink: 'https://sharepoint.invalid/library/counter-scan.pdf',
    stored: true,
    depositedBy: 'registry.clerk@nitda.gov.ng',
    depositedAt: '2026-08-03T09:00:00Z',
    sha256: 'a'.repeat(64),
    bytes: 12,
    ...over,
  }),
});

async function openWorkspace(page) {
  await page.goto('/index.html?skipWelcome=1', { waitUntil: 'networkidle' });
  await expect.poll(() => page.evaluate(() => window.__DGO_BOOTED__ === true), { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => { location.hash = '#/scan-intake'; });
  await page.waitForSelector('[data-outlet] .route-stage .workspace');
}

/** Put a file in the tray and wait for its digest to be computed. */
async function stageFile(page, name = 'counter-scan.pdf') {
  await page.setInputFiles('[data-files]', {
    name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 scan'),
  });
  await expect.poll(() => page.textContent('[data-tray]')).toContain('sha256');
}

const fillForm = page => page.evaluate(() => {
  const f = document.querySelector('[data-form]');
  f.sender.value = 'Federal Ministry of Health';
  f.senderEmail.value = 'registry@health.gov.ng';
  f.subject.value = 'Letter delivered to the registry counter';
  f.description.value = 'Hand-delivered, two enclosures.';
});

/** Records the platform holds, newest first. */
const records = page => page.evaluate(async () => {
  const { State } = await import('./core/state.js');
  return (State.get().correspondence || []).filter(c => c.channel === 'Registry');
});

/**
 * Submit the deposit and clear the confirmation.
 *
 * `confirmAction` is the shell's own modal, not `window.confirm`, so there is no native
 * dialog event to accept — the Continue button has to be clicked.
 */
async function submitDeposit(page) {
  await page.click('[data-form] button.btn:not(.ghost)');
  await page.click('[data-dialog="confirm"] [data-yes]');
  // A second confirmation follows from core/flow-confirmation.js once the deposit reaches
  // the DYNAMIC_ACTIONS mirror. Waiting for "no dialog" would race it; wait for THIS one to
  // go instead, which is what unblocks the page.
  await expect.poll(async () => page.locator('[data-dialog="confirm"] [data-yes]').count())
    .toBeLessThanOrEqual(1);
}

test.describe('registry scan intake', () => {
  test('without a proxy it says so and does not offer a deposit', async ({ page }) => {
    await withoutProxy(page);
    await openWorkspace(page);
    const text = await page.textContent('.workspace');
    expect(text).toMatch(/Deposit unavailable/);
    expect(text, 'the reason must be stated, not merely the symptom').toMatch(/nowhere to file a scan/);
    await expect(page.locator('[data-files]')).toBeDisabled();
  });

  test('a successful deposit creates a record carrying the link and the channel', async ({ page }) => {
    await withProxy(page, okDeposit());
    await openWorkspace(page);
    await stageFile(page);
    await fillForm(page);
    await submitDeposit(page);
    await page.waitForSelector('text=Deposited this session');

    const recs = await records(page);
    expect(recs.length).toBe(1);
    const r = recs[0];
    expect(r.referenceId, 'the reference is the one the proxy minted').toBe('NITDA-2026-000318');
    expect(r.channel, 'channel C is what distinguishes a counter deposit').toBe('Registry');
    expect(r.correspondenceType).toBe('Incoming');
    expect(r.attachmentLink).toBe('https://sharepoint.invalid/library/counter-scan.pdf');
    expect(r.subject).toBe('Letter delivered to the registry counter');
    expect(r.documentSha256, 'the digest makes the record checkable against the library').toBeTruthy();
  });

  test('the depositing officer comes from the server, not the page', async ({ page }) => {
    await withProxy(page, okDeposit({ depositedBy: 'the.actual.clerk@nitda.gov.ng' }));
    await openWorkspace(page);
    await stageFile(page);
    await fillForm(page);
    await submitDeposit(page);
    await page.waitForSelector('text=Deposited this session');

    const recs = await records(page);
    expect(recs[0].depositedBy).toBe('the.actual.clerk@nitda.gov.ng');
    const profile = await page.evaluate(async () => (await import('./core/state.js')).State.get().profile?.email);
    expect(recs[0].depositedBy, 'custody must not be attributed from local state')
      .not.toBe(profile);
  });

  /* ── rule 1, three ways it can be broken ─────────────────────────────────── */

  test('a refused deposit creates no record and says why', async ({ page }) => {
    await withProxy(page, route => route.fulfill({
      status: 403, contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'forbidden' }),
    }));
    await openWorkspace(page);
    await stageFile(page);
    await fillForm(page);
    await submitDeposit(page);
    await expect.poll(() => page.textContent('[data-tray]')).toContain('Failed');

    expect(await records(page), 'no document was filed, so no record may exist').toEqual([]);
    expect(await page.textContent('[data-tray]')).toMatch(/role may not deposit/);
  });

  test('an unreachable proxy creates no record', async ({ page }) => {
    await withProxy(page, route => route.abort('connectionrefused'));
    await openWorkspace(page);
    await stageFile(page);
    await fillForm(page);
    await submitDeposit(page);
    await expect.poll(() => page.textContent('[data-tray]')).toContain('Failed');

    expect(await records(page)).toEqual([]);
    expect(await page.textContent('[data-tray]')).toMatch(/could not be reached/);
  });

  test('accepted-but-not-filed creates no record — verified is not stored', async ({ page }) => {
    // The subtle one. The proxy verified the bytes and audited the deposit, but the
    // library did not confirm the write. ok:true is not enough; stored must also be true.
    await withProxy(page, okDeposit({ stored: false, attachmentLink: '' }));
    await openWorkspace(page);
    await stageFile(page);
    await fillForm(page);
    await submitDeposit(page);
    await expect.poll(() => page.textContent('[data-tray]')).toContain('Failed');

    expect(await records(page), 'a verified deposit that was not filed is still not a record').toEqual([]);
    expect(await page.textContent('[data-tray]')).toMatch(/did not confirm the write/);
  });

  test('a failed deposit stays in the tray for retry rather than vanishing', async ({ page }) => {
    await withProxy(page, route => route.abort('connectionrefused'));
    await openWorkspace(page);
    await stageFile(page);
    await fillForm(page);
    await submitDeposit(page);
    await expect.poll(() => page.textContent('[data-tray]')).toContain('Failed');

    // Still listed, still named, still removable — a lost deposit must be visible.
    const tray = await page.textContent('[data-tray]');
    expect(tray).toContain('counter-scan.pdf');
    await expect(page.locator('[data-drop]')).toHaveCount(1);
  });

  test('an oversize file is refused locally and never reaches the proxy', async ({ page }) => {
    let called = false;
    await withProxy(page, route => { called = true; return route.abort('connectionrefused'); });
    await openWorkspace(page);
    await page.setInputFiles('[data-files]', {
      name: 'huge.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(26 * 1024 * 1024),
    });
    await expect.poll(() => page.textContent('[data-tray]')).toContain('Rejected');
    expect(await page.textContent('[data-tray]')).toMatch(/limit is 25 MB/);
    expect(called, 'a file refused locally must not be sent').toBe(false);
    expect(await records(page)).toEqual([]);
  });
});
