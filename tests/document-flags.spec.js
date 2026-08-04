/**
 * Document flagging, end to end.
 *
 * The defect: `lookup` rendered four flag controls, `action-ownership` registered
 * `flag-document` with `lookup` as an allowed invoker, and the detail view rendered
 * `record.flags` as chips — but the handler wrote nothing. It raised a dialog reading
 * "Complete this in Activities" and navigated away, to a workspace with no flag control.
 * The officer saw a confirmation and left believing the document was flagged.
 *
 * So the assertion that matters is the dullest one available: after flagging, the record
 * carries the flag. A test that only checked for a dialog would have passed against the
 * broken build.
 */
import { test, expect } from '@playwright/test';

async function boot(page) {
  await page.goto('/index.html?skipWelcome=1', { waitUntil: 'networkidle' });
  await expect.poll(() => page.evaluate(() => window.__DGO_BOOTED__ === true), { timeout: 15_000 }).toBe(true);
}

const seed = (page, patch) => page.evaluate(async p => {
  const { State } = await import('./core/state.js');
  State.patch(p, { module: 'test', action: 'seed' });
}, patch);

const activities = page => page.evaluate(async () => {
  const { State } = await import('./core/state.js');
  return State.get().activities;
});

const auditEvents = page => page.evaluate(async () => {
  const { AuditLog } = await import('./core/audit-log.js');
  return AuditLog.snapshot().events.map(e => e.event);
});

/** Answer the topmost confirmation and wait for it to go. */
async function confirmYes(page) {
  const yes = page.locator('[data-dialog="confirm"] [data-yes]').last();
  await yes.waitFor({ state: 'visible', timeout: 5_000 });
  await yes.click();
  await expect.poll(async () => page.locator('[data-dialog="confirm"] [data-yes]').count())
    .toBeLessThanOrEqual(1);
}

const DOC = {
  id: 'ACT-1', referenceId: 'NITDA-2026-217', title: 'Ministerial directive on data policy',
  category: 'Policy / Regulation', assignedTo: 'policy@nitda.gov.ng',
  created: '2026-08-01T09:00:00Z', flags: [],
};

/** Open lookup with the seeded document selected. */
async function openFlaggableDocument(page) {
  await boot(page);
  await seed(page, { activities: [DOC] });
  await page.evaluate(async () => {
    const { UIState } = await import('./core/ui-state.js');
    UIState.set('lookup', { selType: 'activities', selId: 'ACT-1', md: 'detail' });
    location.hash = '#/lookup';
  });
  await page.waitForSelector('[data-outlet] .route-stage [data-flag]');
}

test.describe('document flagging', () => {
  test('flagging a document actually writes the flag', async ({ page }) => {
    await openFlaggableDocument(page);

    await page.click('[data-flag="dg"]');
    await confirmYes(page);

    await expect
      .poll(async () => (await activities(page))[0].flags?.map(f => f.flag),
            { message: 'the whole defect was that this stayed empty' })
      .toEqual(['dg']);
  });

  test('the flag records who applied it and when', async ({ page }) => {
    await openFlaggableDocument(page);
    await page.click('[data-flag="dg"]');
    await confirmYes(page);

    await expect.poll(async () => (await activities(page))[0].flags?.length).toBe(1);
    const [flag] = (await activities(page))[0].flags;
    expect(flag.at, 'a mark with no time cannot be evidenced').toBeTruthy();
    expect(flag).toHaveProperty('by');
  });

  test('flagging is audited under the registered event', async ({ page }) => {
    await openFlaggableDocument(page);
    await page.click('[data-flag="dg"]');
    await confirmYes(page);

    await expect.poll(async () => (await activities(page))[0].flags?.length).toBe(1);
    // config/action-ownership.config.js declares audit:document-flagged for this action.
    expect(await auditEvents(page)).toContain('audit:document-flagged');
  });

  test('the officer stays in Lookup — no redirect to a workspace that cannot finish the act', async ({ page }) => {
    await openFlaggableDocument(page);
    await page.click('[data-flag="dg"]');
    await confirmYes(page);

    await expect.poll(async () => (await activities(page))[0].flags?.length).toBe(1);
    expect(page.url(), 'the old handler navigated to #/activities and abandoned the officer')
      .toContain('#/lookup');
  });

  test('the control reflects state, so "is this already flagged?" is answerable', async ({ page }) => {
    await openFlaggableDocument(page);
    await expect(page.locator('[data-flag="dg"]')).toHaveAttribute('aria-pressed', 'false');

    await page.click('[data-flag="dg"]');
    await confirmYes(page);

    await expect(page.locator('[data-flag="dg"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a flag can be lifted — a watchlist nobody can leave stops being read', async ({ page }) => {
    await openFlaggableDocument(page);
    await page.click('[data-flag="dg"]');
    await confirmYes(page);
    await expect.poll(async () => (await activities(page))[0].flags?.length).toBe(1);

    await page.click('[data-flag="dg"]');            // now reads as "Lift DG Attention"
    await confirmYes(page);
    await expect.poll(async () => (await activities(page))[0].flags?.length).toBe(0);
  });

  test('two different flags coexist on one document', async ({ page }) => {
    await openFlaggableDocument(page);
    await page.click('[data-flag="dg"]');
    await confirmYes(page);
    await expect.poll(async () => (await activities(page))[0].flags?.length).toBe(1);

    await page.click('[data-flag="followup"]');
    await confirmYes(page);
    await expect
      .poll(async () => (await activities(page))[0].flags?.map(f => f.flag).sort())
      .toEqual(['dg', 'followup']);
  });

  test('the applied flag is rendered back as a chip', async ({ page }) => {
    await openFlaggableDocument(page);
    await page.click('[data-flag="dg"]');
    await confirmYes(page);

    await expect.poll(async () => (await activities(page))[0].flags?.length).toBe(1);
    // The chip renderer existed all along with nothing to render. This is the proof that
    // the read path and the write path finally meet.
    await expect(page.locator('.chip', { hasText: 'DG Attention' })).toBeVisible();
  });

  test('the OWNING module can flag too, not only its allowed invoker', async ({ page }) => {
    // module-boundaries declares `activities` owns flag-document; `lookup` is merely an
    // allowed invoker. An owner that cannot perform its own owned action is the same
    // inconsistency in a milder form.
    await boot(page);
    await seed(page, { activities: [DOC] });
    await page.evaluate(async () => {
      const { UIState } = await import('./core/ui-state.js');
      UIState.set('operations', { lens: 'records' });
      UIState.set('activity-records', { selected: 'ACT-1', mode: 'details' });
      location.hash = '#/activities';
    });
    await page.waitForSelector('[data-outlet] .route-stage [data-doc-flag]');

    await page.click('[data-doc-flag="dg"]');
    await confirmYes(page);

    await expect.poll(async () => (await activities(page))[0].flags?.map(f => f.flag))
      .toEqual(['dg']);
  });

  test('declining the confirmation leaves the document unflagged', async ({ page }) => {
    await openFlaggableDocument(page);
    await page.click('[data-flag="dg"]');

    const no = page.locator('[data-dialog="confirm"] [data-no]').last();
    await no.waitFor({ state: 'visible', timeout: 5_000 });
    await no.click();

    await page.waitForTimeout(300);
    expect((await activities(page))[0].flags || []).toHaveLength(0);
  });
});
