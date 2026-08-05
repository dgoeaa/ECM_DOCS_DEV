/**
 * The dual-spine triage surface (D2) and the feed inventory (D4), in a real browser.
 *
 * The unit tests prove the rules. These prove the WIRING obeys them — which is where a
 * "human in the loop" design usually fails: the logic refuses to let AI commit, and then a
 * button somewhere quietly does it anyway.
 *
 * The heaviest coverage is on the AI being absent, because that is the failure that arrives
 * unannounced in production. Every test here that requests AI classification does so with no
 * endpoint configured — which is precisely the state this environment is in, and precisely
 * the state D2 says must not cripple anything.
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

const stateOf = (page, key) => page.evaluate(async k => {
  const { State } = await import('./core/state.js');
  return State.get()[k];
}, key);

const REC = {
  id: 'CORR-1', referenceId: 'NITDA-2026-217', subject: 'Ministerial directive on data policy',
  sender: 'Federal Ministry', category: 'Policy / Regulation', status: 'Received',
  priority: 'normal', remarks: 'For review', receivedDate: '2026-08-01', channel: 'Document',
};

/** Open the correspondence tracker with the record selected and triage open. */
async function openTriage(page) {
  await boot(page);
  await seed(page, { correspondence: [REC] });
  await page.evaluate(async () => {
    const { UIState } = await import('./core/ui-state.js');
    UIState.set('correspondence', { selected: 'CORR-1', md: 'detail', tab: 'tracker', triage: true });
    location.hash = '#/correspondence';
  });
  await page.waitForSelector('[data-outlet] .route-stage [data-triage]');
}


/**
 * Seed the feed inventory and open the HUD.
 *
 * Waits for boot's deferred data load to settle first. That load ends by patching `runtime`
 * from a snapshot it took earlier, so a patch written while it is still in flight is
 * overwritten by it — the seed lands, then vanishes, and the panel renders empty for reasons
 * that have nothing to do with the panel.
 */
async function seedFeeds(page, feeds) {
  await boot(page);
  await expect.poll(() => page.evaluate(async () => {
    const { State } = await import('./core/state.js');
    return !!State.get().runtime?.lastLoad;
  }), { timeout: 15_000 }).toBe(true);

  await page.evaluate(async f => {
    const { State } = await import('./core/state.js');
    State.patch({ runtime: { ...State.get().runtime, feeds: f } }, { module: 'test', action: 'seed' });
  }, feeds);
  await page.evaluate(() => { location.hash = '#/operator-hud'; });
}


/**
 * Ask for an AI classification, and decline the flow-execution gate if one appears.
 *
 * The two platform variants differ here and the test has to work on both. With no endpoint
 * configured the call fails before any gate is raised. With one configured — the proxy
 * variant — AI_DOC_ANALYSIS is a governed contract, so core/flow-confirmation.js asks before
 * anything leaves the browser, and an unanswered dialog leaves the panel on "Analysing…"
 * forever.
 *
 * Declining is the realistic path anyway: an officer who says no to sending the document for
 * analysis is in exactly the state D2 is about — no AI proposal, and triage carrying on
 * regardless.
 */
async function requestAi(page) {
  await page.click('[data-ai-triage]');
  const no = page.locator('[data-dialog="confirm"] [data-no]');
  try {
    await no.first().waitFor({ state: 'visible', timeout: 3_000 });
    await no.first().click();
  } catch { /* no gate on this variant — the call failed before one was needed */ }
}

test.describe('dual-spine triage (D2)', () => {
  test('the human form and the AI panel are both present, and the AI one is advisory', async ({ page }) => {
    await openTriage(page);
    await expect(page.locator('[data-triage]')).toBeVisible();
    const panel = page.locator('.ai-spine');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/advisory/i);
  });

  test('AI is not consulted unless asked, and triage does not require it', async ({ page }) => {
    await openTriage(page);
    await expect(page.locator('.ai-spine')).toContainText(/Not consulted/i);
    await expect(page.locator('.ai-spine')).toContainText(/does not require it/i);
    // The thing that commits is in the human form, and it is available right now.
    await expect(page.locator('[data-triage] button.btn').first()).toBeEnabled();
  });

  test('THE PROPERTY: an unreachable AI says so and leaves the form usable', async ({ page }) => {
    await openTriage(page);
    await requestAi(page);

    await expect(page.locator('.ai-spine')).toContainText(/Unavailable/i, { timeout: 15_000 });
    await expect(page.locator('.ai-spine')).toContainText(/Triage continues without it/i);

    // The whole decision in one assertion: the save control is still there and still enabled.
    const save = page.locator('[data-triage] button.btn').first();
    await expect(save).toBeVisible();
    await expect(save).toBeEnabled();
  });

  test('a failed AI call does not alter the record', async ({ page }) => {
    await openTriage(page);
    const before = JSON.stringify(await stateOf(page, 'correspondence'));
    await requestAi(page);
    await expect(page.locator('.ai-spine')).toContainText(/Unavailable/i, { timeout: 15_000 });
    expect(JSON.stringify(await stateOf(page, 'correspondence'))).toBe(before);
  });

  test('the AI panel cannot disable or replace the human submit control', async ({ page }) => {
    await openTriage(page);
    await requestAi(page);
    await expect(page.locator('.ai-spine')).toContainText(/Unavailable/i, { timeout: 15_000 });

    // No submit control lives inside the AI panel — it must not be able to commit anything.
    expect(await page.locator('.ai-spine button[type="submit"]').count()).toBe(0);
    expect(await page.locator('.ai-spine [data-triage]').count()).toBe(0);
  });

  test('the form still saves after the AI failed — end to end', async ({ page }) => {
    await openTriage(page);
    await requestAi(page);
    await expect(page.locator('.ai-spine')).toContainText(/Unavailable/i, { timeout: 15_000 });

    await page.selectOption('[data-triage] [name="priority"]', 'high');
    await page.locator('[data-triage] button.btn').first().click();

    const yes = page.locator('[data-dialog="confirm"] [data-yes]').last();
    await yes.waitFor({ state: 'visible', timeout: 5_000 });
    await yes.click();

    await expect
      .poll(async () => (await stateOf(page, 'correspondence'))[0].priority,
            { message: 'an AI failure must not stop a human committing triage' })
      .toBe('high');
  });
});

test.describe('intake feed inventory (D4)', () => {
  test('the operator HUD reports what each entry point admitted', async ({ page }) => {
    await seedFeeds(page, { activities: { unplaced: 0, conflicts: 0, byEntryPoint: {
      'public-portal': 3, email: 0, 'scan-counter': 12, 'internal-origination': 5 } } });
    await page.waitForSelector('[data-outlet] .route-stage .feed-group');

    const g = page.locator('.feed-group');
    await expect(g).toContainText('Scan / physical counter');
    await expect(g).toContainText('12');
    await expect(g).toContainText(/all records placed/i);
  });

  test('unplaced and conflicting records are surfaced, not hidden', async ({ page }) => {
    // The old inference defaulted undeclared records into the counter channel, so this
    // number did not exist. A rising count means a producer stopped stamping its channel.
    await seedFeeds(page, { activities: { unplaced: 7, conflicts: 2, byEntryPoint: {
      'public-portal': 1, email: 0, 'scan-counter': 4, 'internal-origination': 0 } } });
    await page.waitForSelector('[data-outlet] .route-stage .feed-group');

    const g = page.locator('.feed-group');
    await expect(g).toContainText(/declared no entry point/i);
    await expect(g).toContainText('7');
    await expect(g).toContainText(/disagree with their lane/i);
  });

  test('with no inventory yet it says so rather than rendering an empty panel', async ({ page }) => {
    /* Explicitly cleared rather than assumed absent. On a variant with a dev server
       configured the boot load succeeds and the inventory is genuinely populated — which is
       a fine thing for the panel to do and a poor thing for this test to trip over. */
    await boot(page);
    await expect.poll(() => page.evaluate(async () => {
      const { State } = await import('./core/state.js');
      return !!State.get().runtime?.lastLoad;
    }), { timeout: 15_000 }).toBe(true);
    await page.evaluate(async () => {
      const { State } = await import('./core/state.js');
      State.patch({ runtime: { ...State.get().runtime, feeds: {} } }, { module: 'test', action: 'seed' });
      location.hash = '#/operator-hud';
    });
    await page.waitForSelector('[data-outlet] .route-stage .workspace');
    await expect(page.locator('.workspace')).toContainText(/No feed inventory yet/i);
  });
});
