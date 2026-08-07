// The 19 authenticated endpoint contracts, implemented locally.
//
// Each Power Automate flow is replaced by one function here. The response envelope is the
// shape core/contracts.js `assertEnvelope` expects, so the client cannot tell the
// difference — which is the point: no second code path, no "dev mode" branch in the app.
//
// Dispatch is on the ACTION in the body, not the URL. That mirrors how the real flows work
// (one HTTP trigger, a switch on `action`) and it is why DISPATCH_OUTBOUND and
// ARCHIVE_REFERENCE — which both resolve to the DYNAMIC_ACTIONS url — land correctly.

import { EndpointContracts } from '../../config/endpoints.config.js';

const now = () => new Date().toISOString();
const str = v => String(v ?? '').trim();

/**
 * Every contract action string → the contract keys that declare it.
 *
 * Not one-to-one in either direction. `bulkassignment` is claimed by both BULK_ASSIGNMENT
 * and BULK_ASSIGNMENT_DIRECT, while DISPATCH_OUTBOUND and ARCHIVE_REFERENCE have distinct
 * actions but share the DYNAMIC_ACTIONS url. So neither the action nor the path can decide
 * alone — see resolveKey().
 */
const ACTION_TO_KEYS = Object.entries(EndpointContracts).reduce((acc, [key, c]) => {
  (acc[String(c.action).toLowerCase()] ??= []).push(key);
  return acc;
}, {});

/** Back-compat single-key view, for callers that only need the common case. */
const ACTION_TO_KEY = Object.fromEntries(
  Object.entries(ACTION_TO_KEYS).map(([action, keys]) => [action, keys[0]])
);

/**
 * Which contract a request is for.
 *
 * The action decides, because that is what distinguishes two contracts sharing a url. When
 * an action is claimed by more than one key, the path breaks the tie — otherwise the choice
 * would be whichever key happened to be declared last, which is a coin toss that stays
 * harmless only for as long as the claimants behave identically.
 */
export function resolveKey(action, urlKey) {
  const claimants = ACTION_TO_KEYS[String(action).toLowerCase()];
  if (!claimants) return urlKey;
  if (claimants.length === 1) return claimants[0];
  return claimants.includes(urlKey) ? urlKey : claimants[0];
}

/**
 * Unwrap the two body shapes core/data-client.js sends.
 *   default:      { action, payload, userEmail, requestId, timestamp }
 *   flatPayload:  { action, ...payload, userEmail, correlationId }
 */
export function readRequest(body = {}) {
  const action = str(body.action);
  const nested = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload);
  const { action: _a, payload: _p, requestId: _r, correlationId: _c, timestamp: _t, userEmail: _u, ...rest } = body;
  return {
    action,
    payload: nested ? body.payload : rest,
    actor: str(body.userEmail) || 'dgsregistry@nitda.gov.ng',
    requestId: str(body.requestId) || str(body.correlationId) || crypto.randomUUID(),
  };
}

/** The success envelope. `data` is what assertEnvelope hands back to the caller. */
export function envelope({ action, requestId, data, startedAt }) {
  const completed = now();
  return {
    ok: true,
    status: { http: 200, message: 'OK' },
    request: { action, requestId, trackingId: requestId },
    timing: {
      receivedAtUtc: startedAt,
      completedAtUtc: completed,
      durationMs: Date.parse(completed) - Date.parse(startedAt),
    },
    meta: {
      runId: `dev-${requestId.slice(0, 8)}`,
      flowName: `local-dev:${action}`,
      contractVersion: 'dev-1',
      // Unmistakable in any captured response: this did not come from Power Automate.
      devServer: true,
    },
    data,
  };
}

/** The failure envelope. assertEnvelope throws on `ok:false`, carrying `errors[].message`. */
export function failure({ action, requestId, http = 400, message, startedAt }) {
  return {
    ok: false,
    status: { http, message },
    request: { action, requestId, trackingId: requestId },
    timing: { receivedAtUtc: startedAt, completedAtUtc: now(), durationMs: 0 },
    meta: { flowName: `local-dev:${action}`, contractVersion: 'dev-1', devServer: true },
    errors: [{ code: 'dev_server_error', message }],
    data: null,
  };
}

// ---------------------------------------------------------------------------
// Read contracts
// ---------------------------------------------------------------------------

/** Everything the runtime hydrates from in one response — the platform's boot payload. */
function fetchAll(store) {
  const d = store.get();
  return {
    docs: d.activities,
    tasks: d.tracking,
    taskComments: d.comments,
    users: d.users,
    categories: d.categories,
    departments: d.departments,
    emails: d.emails,
    approvals: d.approvals,
  };
}

function referenceData(store) {
  const d = store.get();
  return { categories: d.categories, departments: d.departments, users: d.users };
}

function getDocs(store, payload) {
  const ref = str(payload.referenceId || payload.ref || payload.RefIDD);
  const d = store.get();
  const docs = ref
    ? d.activities.filter(a => str(a.RefIDD) === ref || String(a.ID) === ref)
    : d.activities;
  // Attachments deposited through the byte paths belong to the record too.
  const attachments = d.attachments.filter(a => !ref || str(a.referenceId) === ref);
  return { docs, attachments };
}

function fetchEmailAttachments(store, payload) {
  const id = str(payload.id);
  const ref = str(payload.referenceId);
  const d = store.get();
  const email = d.emails.find(e => str(e.id) === id);
  const attachments = d.attachments.filter(a => str(a.referenceId) === ref);
  // Seeded emails declare `hasAttachments` but carry no bytes; describe that honestly
  // rather than inventing a file the dev server cannot serve.
  if (email?.hasAttachments && !attachments.length) {
    return {
      attachments: [{
        id: `${email.id}-att-1`,
        name: `${email.subject.slice(0, 40).replace(/[^\w -]/g, '')}.pdf`,
        contentType: 'application/pdf',
        size: 0,
        url: '',
        note: 'Seeded email attachment — metadata only, no bytes in the dev store.',
      }],
    };
  }
  return { attachments };
}

function listActivities(store, payload) {
  const d = store.get();
  const dsu = str(payload.dsu || payload.routedTo);
  const activities = dsu ? d.activities.filter(a => str(a.RoutedToDSU) === dsu) : d.activities;
  return { activities };
}

// ---------------------------------------------------------------------------
// Write contracts
// ---------------------------------------------------------------------------

function assignOne(store, payload, actor) {
  const ref = str(payload.referenceId || payload.ref || payload.RefIDD || payload.id);
  const assignee = str(payload.assignedTo || payload.AssignedTo || payload.assignee);
  const dsu = str(payload.assignedToDsu || payload.AssignedToDSU || payload.routedTo || payload.RoutedToDSU);

  return store.mutate(d => {
    const doc = d.activities.find(a => str(a.RefIDD) === ref || String(a.ID) === ref);
    if (!doc) return { assigned: false, reason: 'reference_not_found', referenceId: ref };

    if (assignee) doc.AssignedTo = assignee;
    if (dsu) doc.RoutedToDSU = dsu;
    doc.AssignmentStatus = 'Assigned';
    if (doc.Status === 'Not Treated') doc.Status = 'Pending';

    // An assignment raises the task that carries the work, which is what makes the
    // record show up in Response Tracking rather than only changing a field.
    const taskId = Math.max(0, ...d.tracking.map(t => Number(t.ID) || 0)) + 1;
    d.tracking.unshift({
      ID: taskId,
      Title: str(payload.title || payload.Title) || `Action: ${doc.Title}`,
      RefIDD: str(doc.RefIDD),
      AssignedTo: assignee,
      AssignedToDSU: dsu || str(doc.RoutedToDSU),
      CoAssigneeDSU: str(payload.supportingDsu || payload.CoAssigneeDSU),
      Priority: str(payload.priority || payload.Priority) || 'Medium',
      Status: 'Assigned',
      Progress: 'Not Started',
      Classification: str(payload.classification || payload.Classification),
      Description: str(payload.instruction || payload.minute || payload.Description),
      Created: now(),
      StartDate: now(),
      DueDate: str(payload.due || payload.DueDate),
      AuthorTitle: actor,
    });

    return { assigned: true, referenceId: doc.RefIDD, taskId, assignedTo: assignee, assignedToDsu: dsu };
  });
}

function assignBulk(store, payload, actor) {
  const rows = Array.isArray(payload.items) ? payload.items
    : Array.isArray(payload.assignments) ? payload.assignments
    : Array.isArray(payload.refs) ? payload.refs.map(r => ({ referenceId: r, ...payload }))
    : [];
  if (!rows.length) return { assigned: 0, results: [], reason: 'no_items' };

  const results = rows.map(row => assignOne(store, { ...payload, ...row }, actor));
  return {
    assigned: results.filter(r => r.assigned).length,
    failed: results.filter(r => !r.assigned).length,
    results,
  };
}

function emailToTask(store, payload, actor) {
  const d = store.get();
  const emailId = str(payload.emailId || payload.id);
  const email = d.emails.find(e => str(e.id) === emailId);

  return store.mutate(data => {
    // An email that has no registry record yet becomes one, so the task has something
    // to hang off — the same thing the real flow does on first triage.
    let ref = str(payload.referenceId);
    if (!ref) {
      ref = store.mintReference();
      const docId = Math.max(0, ...data.activities.map(a => Number(a.ID) || 0)) + 1;
      data.activities.unshift({
        ID: docId,
        Title: str(payload.title) || email?.subject || 'Correspondence from email',
        RefIDD: ref,
        Category: str(payload.category) || 'General Correspondence',
        Status: 'Pending',
        AssignmentStatus: 'Assigned',
        AssignedTo: str(payload.assignedTo),
        RoutedToDSU: str(payload.assignedToDsu || payload.routedTo),
        Created: now(),
        Description: email?.bodyPreview || '',
      });
    }
    const taskId = Math.max(0, ...data.tracking.map(t => Number(t.ID) || 0)) + 1;
    data.tracking.unshift({
      ID: taskId,
      Title: str(payload.title) || email?.subject || 'Task from email',
      RefIDD: ref,
      AssignedTo: str(payload.assignedTo),
      AssignedToDSU: str(payload.assignedToDsu || payload.routedTo),
      Priority: str(payload.priority) || 'Medium',
      Status: 'Assigned',
      Progress: 'Not Started',
      Description: str(payload.instruction) || email?.bodyPreview || '',
      Created: now(),
      StartDate: now(),
      DueDate: str(payload.due),
      AuthorTitle: actor,
    });
    return { created: true, referenceId: ref, taskId, emailId };
  });
}

function dispatchEmail(store, payload, actor) {
  const id = `OUT-${Date.now().toString(36).toUpperCase()}`;
  store.mutate(d => {
    d.outbox.unshift({
      id,
      kind: 'email',
      to: payload.to || payload.recipients || [],
      cc: payload.cc || [],
      subject: str(payload.subject),
      body: str(payload.body || payload.summary || payload.message),
      referenceId: str(payload.referenceId || payload.ref),
      sentBy: actor,
      at: now(),
      // Nothing leaves this machine. Saying "sent" would be a lie the operator
      // would only discover when the recipient says they got nothing.
      delivered: false,
    });
  });
  return { queued: true, messageId: id, delivered: false, note: 'Recorded in the dev outbox; no mail is transmitted.' };
}

/**
 * The catch-all governed write. The real flow switches on an inner action; so does this.
 * Operations that map onto stored state are applied; everything else is recorded in the
 * outbox and acknowledged, so a module never silently loses a write.
 */
function dynamicAction(store, payload, actor) {
  const op = str(payload.action || payload.operation).toLowerCase();
  const ref = str(payload.ref || payload.referenceId);

  const findDoc = d => d.activities.find(a => str(a.RefIDD) === ref || String(a.ID) === ref);
  const findTask = d => d.tracking.find(t => str(t.RefIDD) === ref || String(t.ID) === ref);

  switch (op) {
    case 'transition':
    case 'transition_status':
    case 'transitionstatus':
    case 'update_status': {
      const status = str(payload.status || payload.data?.status);
      const target = str(payload.id || payload.data?.id) || ref;
      return store.mutate(d => {
        const doc = d.activities.find(a => str(a.RefIDD) === target || String(a.ID) === target);
        const task = d.tracking.find(t => str(t.RefIDD) === target || String(t.ID) === target);
        if (doc) doc.Status = status;
        if (task) { task.Status = status; task.Progress = status; }
        if (!doc && !task) return { applied: false, reason: 'reference_not_found', ref: target };
        return { applied: true, ref: target, status };
      });
    }

    case 'route': {
      const to = str(payload.to);
      return store.mutate(d => {
        const doc = findDoc(d);
        if (!doc) return { applied: false, reason: 'reference_not_found', ref };
        doc.RoutedToDSU = to || doc.RoutedToDSU;
        doc.AssignmentStatus = 'Assigned';
        d.auditLog.unshift({ at: now(), event: 'route', ref, to, minute: str(payload.minute), by: actor });
        return { applied: true, ref, routedTo: doc.RoutedToDSU };
      });
    }

    case 'appendminute': {
      return store.mutate(d => {
        const id = Math.max(0, ...d.comments.map(c => Number(c.ID) || 0)) + 1;
        d.comments.unshift({
          ID: id, RefIDD: ref, Title: ref,
          Description: str(payload.note || payload.minute),
          AuthorTitle: actor, EditorEmail: actor, Created: now(),
        });
        return { applied: true, ref, commentId: id };
      });
    }

    case 'archivereference': {
      return store.mutate(d => {
        const doc = findDoc(d);
        if (!doc) return { applied: false, reason: 'reference_not_found', ref };
        doc.Status = 'Archived';
        return { applied: true, ref, archivedAt: now() };
      });
    }

    case 'dispatchoutbound': {
      const id = `DSP-${Date.now().toString(36).toUpperCase()}`;
      store.mutate(d => {
        d.outbox.unshift({ id, kind: 'dispatch', referenceId: ref, channel: str(payload.channel) || 'email',
                           to: payload.to || payload.recipients || [], subject: str(payload.subject),
                           body: str(payload.body), sentBy: actor, at: now(), delivered: false });
        const doc = findDoc(d);
        if (doc) doc.Status = 'Dispatched';
      });
      return { dispatched: true, dispatchId: id, delivered: false, note: 'Recorded in the dev outbox; nothing is transmitted.' };
    }

    case 'upsert_record': {
      const module = str(payload.module) || 'records';
      const record = payload.data && typeof payload.data === 'object' ? payload.data : {};
      return store.mutate(d => {
        d[module] = Array.isArray(d[module]) ? d[module] : [];
        const id = str(record.id) || `${module}-${Date.now().toString(36)}`;
        const idx = d[module].findIndex(x => str(x.id) === id);
        const next = { ...record, id, updatedAt: now(), updatedBy: actor };
        if (idx >= 0) d[module][idx] = { ...d[module][idx], ...next };
        else d[module].unshift(next);
        return { applied: true, module, id, created: idx < 0 };
      });
    }

    case 'delete_record': {
      const module = str(payload.module) || 'records';
      const id = str(payload.data?.id || payload.id);
      return store.mutate(d => {
        if (!Array.isArray(d[module])) return { applied: false, reason: 'unknown_module', module };
        const before = d[module].length;
        d[module] = d[module].filter(x => str(x.id) !== id);
        return { applied: before !== d[module].length, module, id };
      });
    }

    case 'logauditevent': {
      store.audit({ event: 'audit:client', ref, by: actor, meta: payload });
      return { recorded: true, ref };
    }

    default: {
      // Unknown operation. Acknowledged and recorded rather than refused: refusing would
      // fail a module for using an operation the real flow supports and this file has not
      // caught up with, and the recording is what makes the gap findable.
      const id = `ACT-${Date.now().toString(36).toUpperCase()}`;
      store.mutate(d => {
        d.outbox.unshift({ id, kind: 'dynamic-action', operation: op || '(unnamed)', payload, by: actor, at: now() });
      });
      return {
        applied: false, acknowledged: true, actionId: id, operation: op,
        note: 'The dev server has no specific handler for this operation; it is recorded in the dev outbox.',
      };
    }
  }
}

// ---------------------------------------------------------------------------
// OTP — step-up confirmation for high-authority actions
// ---------------------------------------------------------------------------

// A fixed code, printed in the server banner. Emailing one is the whole reason the real
// flow exists; generating a random one nobody can read would just block the operator.
export const DEV_OTP = '000000';
const otpRequests = new Map();

function otpGenerate(store, payload, actor) {
  const requestId = `OTP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + (Number(payload.ttlSeconds) || 300) * 1000).toISOString();
  otpRequests.set(requestId, {
    actor, expiresAt,
    operation: str(payload.operation),
    payloadDigest: str(payload.payloadDigest),
  });
  store.audit({ event: 'otp:requested', requestId, by: actor, operation: str(payload.operation) });
  return {
    result: {
      ok: true, requestId, expiresAt, sent: false, channel: 'dev-console',
      devCode: DEV_OTP,
      note: `Development OTP. Enter ${DEV_OTP}. No message is sent.`,
    },
  };
}

function otpVerify(store, payload, actor) {
  const requestId = str(payload.requestId);
  const entry = otpRequests.get(requestId);
  const code = str(payload.otp || payload.code);

  if (!entry) return { result: { ok: false, verified: false, reason: 'unknown_request' } };
  if (Date.parse(entry.expiresAt) < Date.now()) {
    otpRequests.delete(requestId);
    return { result: { ok: false, verified: false, reason: 'expired' } };
  }
  if (code !== DEV_OTP) return { result: { ok: false, verified: false, reason: 'wrong_code' } };

  otpRequests.delete(requestId);
  store.audit({ event: 'otp:verified', requestId, by: actor, operation: entry.operation });
  return { result: { ok: true, verified: true, requestId, verifiedAt: now() } };
}

// ---------------------------------------------------------------------------
// AI contracts
// ---------------------------------------------------------------------------
//
// These call a model in production. There is no model here, and there is no honest way to
// fake one, so each returns a clearly-labelled deterministic summary built from the record
// it was given. A module that renders the result works; nobody mistakes it for analysis.

function aiEmailAnalysis(store, payload) {
  const d = store.get();
  const email = d.emails.find(e => str(e.id) === str(payload.id || payload.emailId));
  const subject = email?.subject || str(payload.subject) || 'the message';
  return {
    result: {
      summary: `[dev server — not a real analysis] "${subject}" from ${email?.fromName || 'an external sender'}.`,
      suggestedCategory: 'General Correspondence',
      suggestedDsu: 'Registry',
      priority: email?.importance === 'high' ? 'High' : 'Medium',
      entities: [],
      confidence: 0,
      devServer: true,
    },
  };
}

function aiDocAnalysis(store, payload) {
  const ref = str(payload.referenceId || payload.ref);
  const d = store.get();
  const doc = d.activities.find(a => str(a.RefIDD) === ref);
  return {
    result: {
      summary: `[dev server — not a real analysis] ${doc ? doc.Title : 'No record matched ' + ref}.`,
      keyPoints: doc ? [doc.Description].filter(Boolean) : [],
      recommendedAction: 'Route to the responsible unit for assessment.',
      confidence: 0,
      devServer: true,
    },
  };
}

/*
 * The reply the assistant actually reads.
 *
 * This returned `{ result: { message } }`, and modules/assistant.js reads
 * `res?.reply || res?.message` off the unwrapped envelope — so `reply` was undefined,
 * `message` was undefined (it was `result.message`, one level down), and the assistant
 * rendered its own fallback: "No reply was returned by the AI flow." Every local run of the
 * Assistant reported failure against an endpoint that had answered correctly.
 *
 * Nothing caught it because nothing had ever called this endpoint and compared the answer
 * with what the client reads. `npm run verify:endpoints -- --include-writes` does, and this
 * is the defect that run produced.
 *
 * `message` is kept alongside `reply` because the client accepts either and a real flow may
 * well send the other; dropping it would make this stand-in stricter than the contract.
 */
function aiChat(store, payload) {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const last = str(messages[messages.length - 1]?.content || payload.message);
  const d = store.get();
  const reply =
    `[dev server — no model is connected] You asked: "${last.slice(0, 200)}". ` +
    `The local registry currently holds ${d.activities.length} correspondence records, ` +
    `${d.tracking.length} tasks and ${d.approvals.length} approvals. ` +
    `Connect a real AI_CHAT endpoint for substantive answers.`;
  return {
    reply,
    message: reply,
    citations: [],
    devServer: true,
    result: { message: reply, citations: [], devServer: true },
  };
}

// ---------------------------------------------------------------------------
// SUBSIDIARY_ACTIONS — the multi-route flow
// ---------------------------------------------------------------------------

function subsidiaryActions(store, payload, actor, requestedRoute) {
  const route = str(requestedRoute || payload.route || payload.routeKey || 'INIT').toUpperCase();
  const d = store.get();

  switch (route) {
    case 'INIT':
    case 'GET_BOOTSTRAP':
      return { route, ...fetchAll(store), profile: { email: actor, role: 'systemAdmin' } };
    case 'GET_ALL':
      return { route, ...fetchAll(store) };
    case 'LIST-ACTIVITIES':
      return { route, ...listActivities(store, payload) };
    case 'GETREFERENCES':
      return { route, references: d.activities.map(a => ({ referenceId: a.RefIDD, title: a.Title, status: a.Status })) };
    case 'REFRESH_EMAILS':
      return { route, emails: d.emails };
    case 'LOAD_EMAIL_DETAILS': {
      const email = d.emails.find(e => str(e.id) === str(payload.id));
      return { route, email: email || null };
    }
    case 'LISTDOCS':
    case 'GETDOC':
      return { route, ...getDocs(store, payload) };
    case 'LOAD_EVENT_INFO': {
      const ref = str(payload.referenceId || payload.ref);
      return {
        route,
        record: d.activities.find(a => str(a.RefIDD) === ref) || null,
        tasks: d.tracking.filter(t => str(t.RefIDD) === ref),
        comments: d.comments.filter(c => str(c.RefIDD) === ref),
      };
    }
    case 'AI_ANALYSE_EMAIL':
      return { route, ...aiEmailAnalysis(store, payload) };
    case 'AI_CHAT':
      return { route, ...aiChat(store, payload) };
    case 'CREATE_TASK':
      return { route, ...emailToTask(store, payload, actor) };
    case 'UPDATE_TASK':
      return { route, ...dynamicAction(store, { action: 'transition_status', ...payload }, actor) };
    case 'BULKASSIGN':
      return { route, ...assignBulk(store, payload, actor) };
    case 'ACKNOWLEDGE': {
      const ref = str(payload.referenceId || payload.ref);
      return store.mutate(data => {
        const task = data.tracking.find(t => str(t.RefIDD) === ref || String(t.ID) === ref);
        if (!task) return { route, acknowledged: false, reason: 'reference_not_found' };
        task.acknowledged = true;
        task.Status = 'Acknowledged';
        return { route, acknowledged: true, ref, at: now() };
      });
    }
    case 'TRACK': {
      const ref = str(payload.referenceId || payload.ref);
      return {
        route,
        record: d.activities.find(a => str(a.RefIDD) === ref) || null,
        timeline: d.comments.filter(c => str(c.RefIDD) === ref),
      };
    }
    case 'CREATESUPPORTREQUEST': {
      const caseRef = `CASE-${Date.now().toString(36).toUpperCase()}`;
      store.mutate(data => {
        data.supportCases.unshift({ caseRef, ...payload, raisedBy: actor, at: now(), status: 'open', channel: 'internal' });
      });
      return { route, caseRef, created: true };
    }
    default:
      return { route, handled: false, note: `No dev handler for route ${route}; the request was accepted and ignored.` };
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Route one contract request.
 * @param {string} urlKey  contract key taken from the request path
 * @param {object} body    the parsed JSON body
 * @param {object} store
 * @returns {{status:number, body:object}}
 */
export function handleContract(urlKey, body, store) {
  const startedAt = now();
  const { action, payload, actor, requestId } = readRequest(body);

  // The action names the operation; the path breaks a tie and covers a caller that omits it.
  const key = resolveKey(action, urlKey);

  const fail = (message, http = 400) => ({
    status: http, body: failure({ action, requestId, http, message, startedAt }),
  });

  let data;
  try {
    switch (key) {
      case 'FETCH_ALL':                data = fetchAll(store); break;
      case 'FETCH_ACTIVITIES':         data = listActivities(store, payload); break;
      case 'REFERENCE_DATA':           data = referenceData(store); break;
      case 'GET_DOCS':                 data = getDocs(store, payload); break;
      case 'FETCH_EMAIL_ATTACHMENTS':  data = fetchEmailAttachments(store, payload); break;

      case 'SINGLE_ASSIGNMENT':        data = assignOne(store, payload, actor); break;
      case 'BULK_ASSIGNMENT':
      case 'BULK_ASSIGNMENT_DIRECT':   data = assignBulk(store, payload, actor); break;
      case 'EMAIL_RELATED_TASK':       data = emailToTask(store, payload, actor); break;
      case 'EMAIL':                    data = dispatchEmail(store, payload, actor); break;

      case 'DYNAMIC_ACTIONS':          data = dynamicAction(store, payload, actor); break;
      case 'DISPATCH_OUTBOUND':        data = dynamicAction(store, { ...payload, action: 'dispatchOutbound' }, actor); break;
      case 'ARCHIVE_REFERENCE':        data = dynamicAction(store, { ...payload, action: 'archiveReference' }, actor); break;

      case 'OTP_GENERATE':             data = otpGenerate(store, payload, actor); break;
      case 'OTP_VERIFY':               data = otpVerify(store, payload, actor); break;

      case 'AI_EMAIL_ANALYSIS':        data = aiEmailAnalysis(store, payload); break;
      case 'AI_DOC_ANALYSIS':          data = aiDocAnalysis(store, payload); break;
      case 'AI_CHAT':                  data = aiChat(store, payload); break;

      case 'SUBSIDIARY_ACTIONS':       data = subsidiaryActions(store, payload, actor, body.route || payload.route); break;

      default:
        return fail(`Unknown endpoint contract '${urlKey || action}'.`, 404);
    }
  } catch (e) {
    console.error(`[dev-api] ${key} failed:`, e);
    return fail(`Dev server error handling ${key}: ${e.message}`, 500);
  }

  store.audit({ event: 'endpoint:invoked', key, action, by: actor, requestId });
  return { status: 200, body: envelope({ action: action || key, requestId, data, startedAt }) };
}

export { ACTION_TO_KEY, ACTION_TO_KEYS };
