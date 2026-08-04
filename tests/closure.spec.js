/**
 * The closure path and the email channel — the last two implemented areas with no
 * behavioural test.
 *
 * Everything from triage onward was proven only to *mount*. What happens when an officer
 * actually approves something, dispatches it, or closes it was untested, and those are the
 * steps that change a record's fate.
 *
 * These drive the real workspaces against seeded state and assert the OUTCOME — what the
 * record became, and whether the audit trail says so — rather than which functions ran.
 * A governance layer that records the wrong thing is worse than one that records nothing,
 * because it looks like evidence.
 *
 * The seeds below mirror the field names the modules actually read (`ref`/`title` on an
 * approval, `tracking` rather than `dispatches` for the dispatch queue, lowercase statuses).
 * A test that seeds a shape the module never reads passes or fails for reasons unrelated to
 * the behaviour it names.
 */

import { test, expect } from '@playwright/test';

async function boot(page) {
  await page.goto('/index.html?skipWelcome=1', { waitUntil: 'networkidle' });
  await expect.poll(() => page.evaluate(() => window.__DGO_BOOTED__ === true), { timeout: 15_000 }).toBe(true);
}

/**
 * Provision deploy-time endpoints by serving `config/config.local.js`, which is the file
 * index.html loads and a deployment fills in.
 *
 * A governed write only raises the flow-execution gate when there is a flow to execute, so
 * a test that asserts the gate must provision the endpoint that produces it. Without this
 * the dispatch test passed or failed according to whether the machine running it happened
 * to have a local config on disk — which is not a test result. Serving the file (rather
 * than addInitScript) is required because config.local.js ASSIGNS `window.DGO_CONFIG`
 * and would discard anything injected earlier.
 */
const serveConfig = (page, cfg) =>
  page.route('**/config/config.local.js', route => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: `window.DGO_CONFIG = ${JSON.stringify(cfg)};`,
  }));

/* Dispatch is governed through the DYNAMIC_ACTIONS flow (config/endpoints.config.js), so
   that is the URL to provision. The gate is DECLINED in the test, so nothing is ever sent
   to it — the route below exists to make an accidental send fail loudly rather than reach
   the network. */
const DYNAMIC_ACTIONS_URL = 'https://dispatch.test.invalid/dynamic-actions';
const withDispatchEndpoint = async page => {
  await serveConfig(page, { endpoints: { DYNAMIC_ACTIONS: DYNAMIC_ACTIONS_URL } });
  await page.route(DYNAMIC_ACTIONS_URL, route => route.abort('failed'));
};

const open = async (page, route, sel = '.workspace') => {
  await page.evaluate(r => { location.hash = '#/' + r; }, route);
  await page.waitForSelector(`[data-outlet] .route-stage ${sel}`);
};

/** Seed the collections a test needs, then enter the route so it renders against them. */
const seed = (page, patch) => page.evaluate(async p => {
  const { State } = await import('./core/state.js');
  State.patch(p, { module: 'test', action: 'seed' });
}, patch);

const stateOf = (page, key) => page.evaluate(async k => {
  const { State } = await import('./core/state.js');
  return State.get()[k];
}, key);

/**
 * Audit entries mentioning `needle`.
 *
 * The trail lives in the AuditLog singleton, not in `state.audit` — reading state would
 * report an empty trail for every governed action and the assertions would be worthless.
 */
const auditFor = (page, needle) => page.evaluate(async n => {
  const { AuditLog } = await import('./core/audit-log.js');
  return AuditLog.snapshot().events
    .filter(e => JSON.stringify(e).toLowerCase().includes(n.toLowerCase()))
    .map(e => ({ event: e.event, ref: e.ref, stage: e.meta?.stage || '' }));
}, needle);

/**
 * Answer the topmost confirmation and wait for THAT dialog to go.
 *
 * Confirmations stack: a governed write that reaches the network raises the module's own
 * dialog and then the flow-execution gate, both `[data-dialog="confirm"]`. Waiting on the
 * selector to detach would hang forever the moment a second one opened, so the wait is on
 * the specific element that was answered.
 */
async function answerConfirm(page, choice) {
  const dlg = await page.waitForSelector('[data-dialog="confirm"]', { state: 'visible', timeout: 5_000 });
  await dlg.$eval(choice === 'yes' ? '[data-yes]' : '[data-no]', b => b.click());
  await page.waitForFunction(el => !el.isConnected, dlg, { timeout: 5_000 });
  return dlg;
}
const confirmYes = page => answerConfirm(page, 'yes');
const confirmNo = page => answerConfirm(page, 'no');

const REF = 'NITDA-2026-000901';

const approval = (over = {}) => ({
  id: 'APR-1', ref: REF, title: 'Clearance for the records platform',
  from: 'officer@nitda.gov.ng', summary: 'Requesting sign-off before dispatch.',
  ts: new Date().toISOString(), status: 'pending', ...over,
});

/** Open an approval's detail pane — the decision controls do not exist until one is selected. */
async function selectApproval(page, id) {
  await page.click(`[data-ref="${id}"]`);
  await page.waitForSelector('[data-approve]');
}

test.describe('review and approval', () => {
  test('approving records the decision, the minute and the deciding officer', async ({ page }) => {
    await boot(page);
    await seed(page, { approvals: [approval()] });
    await open(page, 'approvals');
    await selectApproval(page, 'APR-1');

    await page.fill('#ap-comment', 'Cleared for onward dispatch.');
    await page.click('[data-approve]');
    await confirmYes(page);

    await expect.poll(async () => (await stateOf(page, 'approvals'))[0].status).toBe('approved');
    const [a] = await stateOf(page, 'approvals');
    expect(a.minute, 'the minute is the reason of record and must survive').toBe('Cleared for onward dispatch.');
    expect(a.decidedBy, 'a decision with no decider cannot be audited').toBeTruthy();
    expect(a.decidedAt, 'a decision with no timestamp cannot be sequenced').toBeTruthy();

    const trail = await auditFor(page, 'audit:approved');
    expect(trail.length, 'a decision with no audit entry is not a governed decision').toBeGreaterThan(0);
    expect(trail.some(e => e.ref === REF), 'the entry must name the reference it decided').toBe(true);
  });

  test('rejecting is a distinct outcome, not an absence of approval', async ({ page }) => {
    await boot(page);
    await seed(page, { approvals: [approval({ id: 'APR-2', title: 'Rejectable request' })] });
    await open(page, 'approvals');
    await selectApproval(page, 'APR-2');

    await page.fill('#ap-comment', 'Incomplete supporting documents.');
    await page.click('[data-reject]');
    await confirmYes(page);

    await expect.poll(async () => (await stateOf(page, 'approvals'))[0].status).toBe('rejected');
    const [a] = await stateOf(page, 'approvals');
    expect(a.status, 'reject must not be recorded as approve').not.toBe('approved');
    const trail = await auditFor(page, 'audit:rejected');
    expect(trail.length, 'a rejection must be as auditable as an approval').toBeGreaterThan(0);
  });

  test('rejecting without a reason is refused before any confirmation is raised', async ({ page }) => {
    // A rejection with no reason is unappealable — the requester cannot answer an objection
    // that was never stated. The module must stop at the button, not at the dialog.
    await boot(page);
    await seed(page, { approvals: [approval({ id: 'APR-4', title: 'Reasonless rejection' })] });
    await open(page, 'approvals');
    await selectApproval(page, 'APR-4');

    await page.click('[data-reject]');
    await page.waitForTimeout(400);
    expect(await page.locator('[data-dialog="confirm"]').count(),
      'no confirmation should be offered for a rejection that cannot be recorded').toBe(0);

    const [a] = await stateOf(page, 'approvals');
    expect(a.status, 'the request must remain pending').toBe('pending');
  });

  test('a decision cancelled at the dialog changes nothing', async ({ page }) => {
    // The confirm is the last point at which an officer can stop. If declining it still
    // mutated the record, the dialog would be decoration.
    await boot(page);
    await seed(page, { approvals: [approval({ id: 'APR-3', title: 'Untouched request' })] });
    await open(page, 'approvals');
    await selectApproval(page, 'APR-3');

    await page.fill('#ap-comment', 'Considered, then reconsidered.');
    await page.click('[data-approve]');
    await confirmNo(page);
    await page.waitForTimeout(300);

    const [a] = await stateOf(page, 'approvals');
    expect(a.status, 'declining the confirmation must leave the record alone').toBe('pending');
    expect(a.minute, 'an abandoned minute must not be written').toBeFalsy();
  });
});

test.describe('dispatch and closure', () => {
  /* The dispatch queue is drawn from `tracking`, not from `dispatches`: a task becomes
     dispatchable by being Completed, and the dispatch record is the *result* of the act. */
  const task = (over = {}) => ({
    id: 'TRK-1', referenceId: REF, title: 'Outward letter to the Ministry',
    status: 'Completed', assignedTo: 'registry@nitda.gov.ng',
    createdAt: new Date().toISOString(), ...over,
  });

  const selectTask = async (page, id) => {
    await page.click(`[data-ref="${id}"]`);
    await page.waitForSelector('.detail-col .panel');
  };

  test('dispatching records the act and previews the outbound flow before anything leaves', async ({ page }) => {
    await withDispatchEndpoint(page);
    await boot(page);
    await seed(page, { tracking: [task()], dispatches: [] });
    await open(page, 'dispatch');
    await selectTask(page, 'TRK-1');

    await page.selectOption('[data-channel]', 'Email');
    await page.fill('[data-recipient]', 'registry@health.gov.ng');
    await page.click('[data-dispatch]');
    await confirmYes(page);                       // the module's own "Confirm dispatch"

    /* Second gate: the outbound call is a governed flow, so the officer sees the endpoint
       and the exact payload before it leaves the browser. Declining it is how this suite
       stays off the network — and it doubles as the assertion that follows, because a
       dispatch whose backend call never completes must still be recorded and queued, never
       silently dropped. */
    const gate = await page.waitForSelector('[data-dialog="confirm"]', { state: 'visible', timeout: 5_000 });
    const gateText = await gate.textContent();
    expect(gateText, 'the gate must name the flow being executed').toMatch(/execution/i);
    expect(gateText, 'the gate must show what is being sent, not just that something is')
      .toMatch(/recipient/i);
    await gate.$eval('[data-no]', b => b.click());

    await expect.poll(async () => (await stateOf(page, 'tracking'))[0].dispatchStatus).toBe('dispatched');
    const [t] = await stateOf(page, 'tracking');
    expect(t.dispatchChannel).toBe('Email');
    expect(t.dispatchRecipient).toBe('registry@health.gov.ng');
    expect(t.dispatchedAt, 'a dispatch with no time cannot be evidenced').toBeTruthy();

    const records = await stateOf(page, 'dispatches');
    expect(records.length, 'the dispatch record is the evidence; without it the act is unproven').toBe(1);
    expect(records[0].taskId).toBe('TRK-1');
    expect(records[0].referenceId).toBe(REF);

    await expect
      .poll(async () => (await stateOf(page, 'dispatches'))[0].sync,
            { message: 'an incomplete backend call must leave the dispatch queued, not dropped' })
      .toBe('queued');

    const trail = await auditFor(page, 'audit:dispatch-started');
    expect(trail.length).toBeGreaterThan(0);
  });

  test('dispatching without a recipient is refused before confirmation', async ({ page }) => {
    // "Sent" with nobody to send it to is the worst possible record: it closes the file
    // while leaving the correspondence undelivered.
    await boot(page);
    await seed(page, { tracking: [task({ assignedTo: '' })], dispatches: [] });
    await open(page, 'dispatch');
    await selectTask(page, 'TRK-1');

    await page.fill('[data-recipient]', '');
    await page.click('[data-dispatch]');
    await page.waitForTimeout(400);
    expect(await page.locator('[data-dialog="confirm"]').count()).toBe(0);
    expect((await stateOf(page, 'tracking'))[0].dispatchStatus, 'the task must stay undispatched')
      .toBeFalsy();
    expect((await stateOf(page, 'dispatches')).length).toBe(0);
  });

  test('no-dispatch requires a reason and records it on the task', async ({ page }) => {
    // "We decided not to send this" is a different outcome from "we forgot", and only the
    // reason distinguishes them afterwards.
    await boot(page);
    await seed(page, { tracking: [task()], dispatches: [] });
    await open(page, 'dispatch');
    await selectTask(page, 'TRK-1');

    await page.click('[data-no-dispatch]');
    await page.waitForTimeout(300);
    expect(await page.locator('[data-dialog="confirm"]').count(),
      'a reasonless no-dispatch must not reach a confirmation').toBe(0);

    await page.fill('[data-nd-reason]', 'Superseded by a corrected draft.');
    await page.click('[data-no-dispatch]');
    await confirmYes(page);

    await expect.poll(async () => (await stateOf(page, 'tracking'))[0].dispatchStatus).toBe('no-dispatch');
    const [t] = await stateOf(page, 'tracking');
    expect(t.noDispatchReason, 'the reason must survive onto the record')
      .toBe('Superseded by a corrected draft.');
    expect((await auditFor(page, 'audit:no-dispatch')).length).toBeGreaterThan(0);
  });

  test('closing ends the lifecycle on both the task and its dispatch record', async ({ page }) => {
    await boot(page);
    await seed(page, {
      tracking: [task({ dispatchStatus: 'dispatched', dispatchedAt: new Date().toISOString() })],
      dispatches: [{ id: 'DSP-1', taskId: 'TRK-1', referenceId: REF, title: 'Outward letter to the Ministry',
                     channel: 'Email', recipient: 'registry@health.gov.ng', status: 'dispatched',
                     at: new Date().toISOString(), by: 'registry@nitda.gov.ng' }],
    });
    await open(page, 'dispatch');
    await selectTask(page, 'TRK-1');

    await page.click('[data-close-item]');
    await confirmYes(page);

    await expect.poll(async () => (await stateOf(page, 'tracking'))[0].dispatchStatus).toBe('closed');
    const [d] = await stateOf(page, 'dispatches');
    expect(d.status, 'the dispatch record must close with the task, not drift from it').toBe('closed');
    expect(d.receiptAt, 'closure asserts receipt and must timestamp it').toBeTruthy();
    expect((await auditFor(page, 'audit:dispatch-closed')).length).toBeGreaterThan(0);
  });

  test('a closed record leaves the active queue', async ({ page }) => {
    await boot(page);
    await seed(page, { tracking: [task({ dispatchStatus: 'closed' })], dispatches: [] });
    await open(page, 'dispatch');
    await expect(page.locator('.list-col .empty')).toBeVisible();
  });
});

test.describe('archive — closure evidence', () => {
  test('the archive workspace mounts and offers the closure control', async ({ page }) => {
    await boot(page);
    await open(page, 'archive');
    const text = await page.textContent('[data-outlet]');
    expect(text).not.toMatch(/Workspace not found|Module failed|Access denied/);
    await expect(page.locator('[data-archive]')).toBeVisible();
  });

  test('a reference the register does not hold cannot be archived', async ({ page }) => {
    /* Archiving mints immutable closure evidence. The closure gate is a series of "is
       anything still open?" checks, and an empty bundle passes every one of them vacuously
       — so before the guard in canClose(), ANY string could be archived, producing a frozen
       bundle with no records and an empty audit thread. A fabricated archive in a government
       file is worse than no archive, because it reads as proof. */
    await boot(page);
    await open(page, 'archive');

    await page.fill('#archive-form [name="ref"]', 'NITDA-2026-999999');
    await page.click('[data-archive]');
    await page.waitForTimeout(600);

    const archived = await page.evaluate(async () => {
      const { Entities } = await import('./core/entity-store.js');
      return !!Entities.getArchive('NITDA-2026-999999');
    });
    expect(archived, 'no archive may exist for a reference with no records').toBe(false);

    // Two error toasts land: executeOwnedAction toasts the failure and the module's own
    // catch toasts it again. Cosmetic, and shared by every governed action — not this
    // test's subject, so it asserts on the first rather than papering over the count.
    const toast = page.locator('.dgo-toast--error').first();
    await expect(toast).toBeVisible({ timeout: 3_000 });
    await expect(toast, 'the refusal must say the reference is unknown, not that work is outstanding')
      .toContainText('NITDA-2026-999999');
  });

  test('the gate reports an unknown reference distinctly from an unfinished one', async ({ page }) => {
    // Asserted at the service, because the two refusals send an officer to different places:
    // one to finish outstanding work, the other to correct the reference they typed.
    await boot(page);
    const out = await page.evaluate(async () => {
      const { ArchiveService } = await import('./core/archive.js');
      const { Entities } = await import('./core/entity-store.js');
      Entities.createReference({ __ref: 'NITDA-2026-000903', __status: 'arrival' });
      Entities.createDispatch({ __ref: 'NITDA-2026-000903', id: 'D1' });   // left open
      return {
        unknown: await ArchiveService.canArchive('NITDA-2026-999998'),
        open: await ArchiveService.canArchive('NITDA-2026-000903'),
      };
    });
    expect(out.unknown.reason).toBe('UNKNOWN_REFERENCE');
    expect(out.unknown.details.unknownReference).toBe(true);
    expect(out.open.reason, 'a known reference with open work is a different refusal')
      .toBe('CLOSURE_GATE_FAILED');
    expect(out.open.details.unknownReference).toBe(false);
  });
});

test.describe('email channel (channel B)', () => {
  const source = () => ({
    id: 'CORR-1', referenceId: REF, subject: 'Request for policy clarification',
    sender: 'Director, Ministry of Health', senderEmail: 'registry@health.gov.ng',
    channel: 'Email', correspondenceType: 'Incoming', status: 'Registered',
    confidentiality: 'Official', createdAt: new Date().toISOString(),
  });

  test('the desk composes against a real correspondence, not a blank form', async ({ page }) => {
    /* The compose form is seeded from a source record. Composing from nothing is how an
       outward letter ends up with no reference and no thread to attach to. */
    await boot(page);
    await seed(page, { correspondence: [source()] });
    await open(page, 'correspondence-email');

    const text = await page.textContent('[data-outlet]');
    expect(text).not.toMatch(/Workspace not found|Module failed/);
    await expect(page.locator('[data-compose]')).toBeVisible({ timeout: 5_000 });

    await expect(page.locator('[data-compose] [name="referenceId"]')).toHaveValue(REF);
    await expect(page.locator('[data-compose] [name="recipientEmail"]'))
      .toHaveValue('registry@health.gov.ng');
  });

  test('saving a composed email holds it as a draft and does not send it', async ({ page }) => {
    // Drafting and sending are different acts. A compose form that dispatched on save would
    // remove the review step the closure path exists to provide.
    await boot(page);
    await seed(page, { correspondence: [source()], correspondenceEmails: [] });
    await open(page, 'correspondence-email');

    await page.fill('[data-compose] [name="body"]', 'Your correspondence refers. Please find our response attached.');
    await page.click('[data-compose] button.btn');

    await expect.poll(async () => (await stateOf(page, 'correspondenceEmails')).length).toBe(1);
    const [m] = await stateOf(page, 'correspondenceEmails');
    expect(m.status, 'a saved composition must be a draft, never a sent message').toBe('draft');
    expect(m.sentAt, 'nothing may be stamped as sent by being written').toBeFalsy();
    expect(m.referenceId, 'an outward email must stay attached to its reference').toBe(REF);

    // The register is the record of what actually left. A draft must not appear in it.
    await page.click('[data-tab="register"]');
    await expect(page.locator('.detail-col, .panel').first()).toBeVisible();
    expect(await page.textContent('[data-outlet]')).toMatch(/No sent email correspondences yet/);
  });

  test('a draft is listed in the outbox and opens to a send control', async ({ page }) => {
    await boot(page);
    await seed(page, {
      correspondenceEmails: [{ id: 'CMAIL-1', referenceId: REF, subject: 'Draft reply',
        subjectLine: 'Draft reply', recipientEmail: 'registry@health.gov.ng', status: 'draft',
        classification: 'Official', priority: 'normal', body: 'For your attention.',
        html: '<p>For your attention.</p>', plain: 'For your attention.',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    });
    await open(page, 'correspondence-email');

    await page.click('[data-tab="drafts"]');
    await page.waitForSelector('[data-draft="CMAIL-1"]');
    expect(await page.textContent('[data-outlet]')).toMatch(/Draft reply/);

    await page.click('[data-draft="CMAIL-1"]');
    await expect(page.locator('[data-send]'), 'a draft must be sendable from its own record')
      .toBeVisible();

    const [m] = await stateOf(page, 'correspondenceEmails');
    expect(m.status, 'opening a draft must not send it').toBe('draft');
  });

  test('archiving a draft removes it from the outbox without sending it', async ({ page }) => {
    await boot(page);
    await seed(page, {
      correspondenceEmails: [{ id: 'CMAIL-2', referenceId: REF, subject: 'Abandoned draft',
        subjectLine: 'Abandoned draft', recipientEmail: 'registry@health.gov.ng', status: 'draft',
        classification: 'Official', priority: 'normal', body: 'Superseded.',
        html: '<p>Superseded.</p>', plain: 'Superseded.',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    });
    await open(page, 'correspondence-email');

    await page.click('[data-tab="drafts"]');
    await page.click('[data-draft="CMAIL-2"]');
    await page.click('[data-archive]');
    await confirmYes(page);

    await expect.poll(async () => (await stateOf(page, 'correspondenceEmails'))[0].status).toBe('archived');
    const [m] = await stateOf(page, 'correspondenceEmails');
    expect(m.sentAt, 'an abandoned draft must never acquire a sent stamp').toBeFalsy();
    expect((await auditFor(page, 'audit:correspondence-email-archived')).length).toBeGreaterThan(0);
  });

  test('outward mail is attributable to NITDA rather than a generic sender', async ({ page }) => {
    await boot(page);
    const tpl = await page.evaluate(async () => {
      const m = await import('./config/correspondence-email-templates.config.js');
      return JSON.stringify(m);
    });
    expect(tpl, 'a government letter with no agency reply address is unanswerable')
      .toMatch(/nitda\.gov\.ng/i);
  });
});

test.describe('governance holds across the closure path', () => {
  test('a module cannot perform an action it does not own', async ({ page }) => {
    /* The boundary that makes the audit trail meaningful: if any module could perform any
     * action, "owner" in the trail would be decoration. Asserted directly against the
     * authority layer rather than through a UI that simply never offers the button. */
    await boot(page);
    const result = await page.evaluate(async () => {
      const { assertModuleAction } = await import('./core/action-authority.js');
      const out = { legal: null, illegal: null };
      try { assertModuleAction('approvals', 'approve'); out.legal = 'allowed'; }
      catch (e) { out.legal = 'REFUSED: ' + e.message; }
      // dispatch does not own approve; approvals does.
      try { assertModuleAction('dispatch', 'approve'); out.illegal = 'ALLOWED'; }
      catch { out.illegal = 'refused'; }
      return out;
    });
    expect(result.legal, 'the owner must be able to act').toBe('allowed');
    expect(result.illegal, 'a non-owner must be refused').toBe('refused');
  });

  test('every closure action is declared with an owner and an audit event', async ({ page }) => {
    await boot(page);
    const specs = await page.evaluate(async () => {
      const { actionSpec } = await import('./config/action-ownership.config.js');
      return ['approve', 'reject', 'send-dispatch', 'no-dispatch', 'close-dispatch',
              'archive-reference', 'create-correspondence-email-draft',
              'send-correspondence-email', 'archive-correspondence-email']
        .map(a => ({ action: a, spec: actionSpec(a) || null }));
    });
    for (const { action, spec } of specs) {
      expect(spec, `${action} is not declared`).toBeTruthy();
      expect(spec.owner, `${action} has no owner`).toBeTruthy();
      expect(spec.audit, `${action} writes no audit event`).toBeTruthy();
    }
  });

  test('a failed governed action is audited as failed, not left silent', async ({ page }) => {
    /* Half the value of the trail is in the attempts that did not succeed. An action that
       throws and leaves no trace is indistinguishable from one that was never attempted. */
    await boot(page);
    const events = await page.evaluate(async () => {
      const { executeOwnedAction } = await import('./core/action-authority.js');
      const { AuditLog } = await import('./core/audit-log.js');
      try {
        await executeOwnedAction('dispatch', 'close-dispatch', () => {
          throw new Error('backend refused');
        }, { ref: 'NITDA-2026-000902' });
      } catch { /* expected */ }
      return AuditLog.snapshot().events
        .filter(e => e.ref === 'NITDA-2026-000902')
        .map(e => e.meta?.stage);
    });
    expect(events, 'the attempt must be recorded').toContain('started');
    expect(events, 'the failure must be recorded').toContain('failed');
  });
});
