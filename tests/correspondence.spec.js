/**
 * Manual correspondence logging — the reference it mints. F-031.
 *
 * `modules/correspondence.js` used `NITDA-${Date.now().toString().slice(-6)}`. The last six
 * digits of a millisecond timestamp cycle every ~16.7 minutes, so it collided, and it was a
 * different shape from the reference the intake flow issues — so after step 7 the registry held
 * `NITDA-2026-000318` from the portal and the counter alongside `NITDA-483920` from manual
 * logging. These exercise the real form, because the unit tests cover the minter and not
 * the wiring.
 */

import { test, expect } from '@playwright/test';

async function openWorkspace(page) {
  await page.goto('/index.html?skipWelcome=1', { waitUntil: 'networkidle' });
  await expect.poll(() => page.evaluate(() => window.__DGO_BOOTED__ === true), { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => { location.hash = '#/correspondence'; });
  await page.waitForSelector('[data-outlet] .route-stage .workspace');
}

/**
 * Clear whatever confirmation is on screen.
 *
 * Saving a record raises TWO dialogs in sequence, and both are real product behaviour:
 * "Confirm new correspondence" from the module, then "Confirm DYNAMIC_ACTIONS execution"
 * from core/flow-confirmation.js, which gates every write-contract invocation. The second
 * is not what these tests are about, but its backdrop swallows pointer events — so leaving
 * it up means the next click is intercepted rather than delivered.
 */
async function clearDialogs(page) {
  for (let i = 0; i < 4; i++) {
    const open = page.locator('[data-dialog]');
    if (!(await open.count())) return;
    const dismiss = open.first().locator('[data-no]');
    if (!(await dismiss.count())) return;
    await dismiss.click();
    await page.waitForTimeout(120);
  }
}

/** Fill and submit the log form once. Returns nothing; read state afterwards. */
async function logOne(page, subject) {
  await page.click('[data-create]');
  await page.waitForSelector('[data-create-form]');
  await page.evaluate(s => {
    const f = document.querySelector('[data-create-form]');
    f.sender.value = 'Federal Ministry of Health';
    f.contact.value = 'registry@health.gov.ng';
    f.subject.value = s;
    f.remarks.value = 'Logged at the desk.';
  }, subject);
  await page.click('[data-create-form] button.btn:not(.ghost)');
  await page.click('[data-dialog="confirm"] [data-yes]');
  await page.waitForSelector('[data-create-form]', { state: 'detached' });
  // Declining the flow invocation does not affect the record — it is already in State and
  // in the audit trail, and no endpoint is configured here in any case.
  await clearDialogs(page);
}

const logged = page => page.evaluate(async () => {
  const { State } = await import('./core/state.js');
  return (State.get().correspondence || [])
    .filter(c => c.channel === 'Document' && /Counter test/.test(c.subject || ''))
    .map(c => ({ id: c.id, referenceId: c.referenceId, provisional: c.referenceProvisional }));
});

test.describe('manual correspondence logging', () => {
  test('the reference has the registry shape, not the timestamp shape', async ({ page }) => {
    await openWorkspace(page);
    await logOne(page, 'Counter test one');

    const recs = await logged(page);
    expect(recs.length).toBe(1);
    // Unpadded, per D1. The SUBMISSION flow issues `NITDA-2026-217`; this test used to
    // demand six padded digits, which is what the platform emitted before the register was
    // consulted rather than what the register actually does.
    expect(recs[0].referenceId, 'NITDA-YYYY-<sequence>, as the intake flow issues')
      .toMatch(/^NITDA-\d{4}-\d{1,6}$/);
    expect(recs[0].referenceId, 'the retired six-digit timestamp form must not return')
      .not.toMatch(/^NITDA-\d{6}$/);
    expect(recs[0].referenceId, 'the register does not zero-pad; the platform must not either')
      .not.toMatch(/^NITDA-\d{4}-0\d+$/);
    expect(recs[0].id).toBe(recs[0].referenceId);
  });

  test('it matches the format the intake flow mints, exactly', async ({ page }) => {
    await openWorkspace(page);
    await logOne(page, 'Counter test format');
    const [rec] = await logged(page);

    // The same shape document-portal/README.md requires of the SUBMISSION flow. If the two
    // drift apart the registry goes back to holding two key formats, which is half of F-031.
    // The authority is the flow definition itself, which mints `NITDA-2026-217` — see
    // docs/reference/foundational/flows/DOCUMENT SUBMISSION PORTAL POWER AU.txt.
    const year = new Date().getFullYear();
    expect(rec.referenceId).toMatch(new RegExp(`^NITDA-${year}-[1-9]\\d{0,5}$`));
  });

  test('logging several in quick succession does not repeat a reference', async ({ page }) => {
    // The original expression produced the same value for anything logged inside one
    // millisecond, and repeated every ~16.7 minutes besides.
    await openWorkspace(page);
    for (const n of ['Counter test A', 'Counter test B', 'Counter test C', 'Counter test D']) {
      await logOne(page, n);
    }
    const recs = await logged(page);
    expect(recs.length).toBe(4);
    expect(new Set(recs.map(r => r.referenceId)).size, 'every reference must be distinct').toBe(4);
  });

  test('the new reference does not collide with one already in the registry', async ({ page }) => {
    await openWorkspace(page);
    const before = await page.evaluate(async () => {
      const { State } = await import('./core/state.js');
      return (State.get().correspondence || []).map(c => c.referenceId).filter(Boolean);
    });
    await logOne(page, 'Counter test unique');
    const [rec] = await logged(page);
    expect(before, 'the minted reference must not already exist').not.toContain(rec.referenceId);
  });

  test('a locally minted reference is marked provisional', async ({ page }) => {
    // A browser sees only the records it has loaded, so it cannot issue an authoritative
    // registry reference. The flag is what lets a later reconciliation find these, and is
    // what distinguishes them from the server-issued references scan intake produces.
    await openWorkspace(page);
    await logOne(page, 'Counter test provisional');
    const [rec] = await logged(page);
    expect(rec.provisional).toBe(true);
  });
});
