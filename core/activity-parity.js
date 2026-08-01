// Canvas Activities parity service.
//
// Ports the Canvas forensic Activities logic (filter/sort, FastTrack queue payload,
// Reference_ID formulas, DGO DIGITAL OPS update semantics and attachment preview) into the
// Obsidian runtime as a frozen, side-effect-free service in the style of core/archive.js and
// core/dispatch-service.js. The `now` seam is injectable so contracts can pin the clock.
//
// This module owns *logic only*. It performs no network I/O, no State mutation and no audit
// writes — modules/activities.js drives it through executeOwnedAction()/WriteManager so
// ownership, audit and idempotency governance stays where the platform already enforces it.
import { ActivityParityConfig, DefaultActivityFilters, lifecycleSpec } from '../config/activity-parity.config.js';
import { ActionOwnership } from '../config/action-ownership.config.js';
import { ActivityLifecycleOperations } from '../config/dynamic-actions.config.js';
import { EndpointContracts } from '../config/endpoints.config.js';
import { createValidationError } from './errors.js';

const text = v => String(v ?? '').trim();
const norm = v => text(v).toLowerCase();
const pad2 = n => String(n).padStart(2, '0');

// Canvas activities arrive either raw (SharePoint choice columns: {Value}) or already
// normalised by core/domain.js (flat lowercase keys). Both shapes must resolve identically.
const choice = v => (v && typeof v === 'object' && 'Value' in v ? v.Value : v);
export const activityStatus = a => text(choice(a?.Status) ?? a?.status);
export const activityAssignmentStatus = a => text(choice(a?.AssignmentStatus) ?? a?.assignmentStatus);
export const activityAssignedTo = a => text(a?.AssignedTo ?? a?.assignedTo);
export const activityCategory = a => text(a?.Category ?? a?.category);
export const activityTitle = a => text(a?.Title ?? a?.title);
export const activityCreated = a => text(a?.Created ?? a?.created);
export const activityId = a => text(a?.ID ?? a?.id);

// Canvas date filters compare calendar days in the operator's own timezone (Today() is
// local), so a bare YYYY-MM-DD boundary is resolved to local start/end of day rather than UTC.
function toTime(value, { endOfDay = false } = {}) {
  const raw = text(value);
  if (!raw) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const t = dateOnly
    ? new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3], endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0).getTime()
    : new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

// Canvas: `Text(DateAdd(Today(),1), "yyyymmdd")` — the reference date is *tomorrow*.
function referenceDatePart(now) {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

export function defaultFilters() { return { ...DefaultActivityFilters }; }

// Canvas gallery filter chain + `SortByColumns(..., "Created", Descending)`.
export function filterActivities(activities = [], filters = {}) {
  const f = { ...DefaultActivityFilters, ...(filters || {}) };
  const from = toTime(f.dateFrom);
  const to = toTime(f.dateTo, { endOfDay: true });
  const search = norm(f.search);
  return (Array.isArray(activities) ? activities : []).filter(a => {
    const status = activityStatus(a);
    if (f.statusTab === 'Treated' && norm(status) !== 'treated') return false;
    if (f.statusTab === 'Not Treated' && norm(status) === 'treated') return false;
    if (f.assignedTo && norm(activityAssignedTo(a)) !== norm(f.assignedTo)) return false;
    if (f.category && norm(activityCategory(a)) !== norm(f.category)) return false;
    if (f.status && norm(status) !== norm(f.status)) return false;
    if (f.assignmentStatus && norm(activityAssignmentStatus(a)) !== norm(f.assignmentStatus)) return false;
    if (from !== null || to !== null) {
      const created = toTime(activityCreated(a));
      if (created === null) return false;
      if (from !== null && created < from) return false;
      if (to !== null && created > to) return false;
    }
    // Canvas uses StartsWith(), not a substring search.
    if (search && !norm(activityTitle(a)).startsWith(search)) return false;
    return true;
  }).sort((a, b) => (toTime(activityCreated(b)) ?? 0) - (toTime(activityCreated(a)) ?? 0));
}

export function filterOptions(activities = []) {
  const uniq = fn => [...new Set((activities || []).map(fn).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    assignedTo: uniq(activityAssignedTo),
    category: uniq(activityCategory),
    status: uniq(activityStatus),
    assignmentStatus: uniq(activityAssignmentStatus)
  };
}

// Ported legacy `isSafeUrl` guard, carried over from the pre-R11 single-file app
// (`NITDA_Digital_Ops_Hub_patched.html`, catalogued in the retired
// dgo-ported-legacy-logic/v1 inventory): only absolute http(s) targets may reach an href
// or a preview frame — this blocks javascript:, data:, vbscript: and blob: payloads
// carried on attachment metadata.
export function isSafeUrl(value) {
  const raw = text(value);
  if (!raw) return false;
  try { return ActivityParityConfig.allowedAttachmentProtocols.includes(new URL(raw).protocol); }
  catch { return false; }
}

export function safeUrl(value) { return isSafeUrl(value) ? text(value) : ''; }

export function getAttachments(activity) {
  const list = activity?.Attachments ?? activity?.attachments;
  if (!Array.isArray(list)) return [];
  return list.map((att, index) => {
    const name = text(att?.Name ?? att?.name ?? att?.FileName) || `Attachment ${index + 1}`;
    return { id: text(att?.ID ?? att?.id) || String(index), name, url: safeUrl(att?.AbsoluteUri ?? att?.url ?? att?.Link), contentType: text(att?.ContentType ?? att?.contentType) };
  });
}

// Canvas attachment preview: PDF renders inline, everything else gets an explicit fallback.
export function getAttachmentPreviewModel(attachment) {
  if (!attachment) return null;
  const name = text(attachment.name ?? attachment.Name);
  const url = safeUrl(attachment.url ?? attachment.AbsoluteUri);
  const contentType = text(attachment.contentType ?? attachment.ContentType);
  const isPdf = /\.pdf$/i.test(name) || /pdf/i.test(contentType);
  const previewable = isPdf && !!url;
  return {
    name,
    url,
    isPdf,
    previewable,
    fallbackMessage: !url
      ? 'Preview blocked: this attachment has no safe http(s) location.'
      : isPdf ? '' : 'Preview not available for this file type. Download the attachment to open it.'
  };
}

// Canvas Patch() into the DGOFASTTRACK queue.
export function buildQueuePayload(type, activity, { now = () => new Date() } = {}) {
  const spec = lifecycleSpec(type);
  if (!spec) throw createValidationError(`Unsupported activity lifecycle action: ${type}`, { type });
  if (!activity) throw createValidationError('A selected activity is required.', { type });
  const today = now().toISOString();
  const sourceId = activityId(activity);
  return {
    Title: activityTitle(activity),
    'Activity Tracking ID': text(activity.RefIDD ?? activity.referenceId),
    StartDate: today,
    AttachmentLink: text(activity.AttachmentLink ?? activity.attachmentLink),
    AssignedBy: ActivityParityConfig.queueAssignedBy,
    RefIDD: sourceId,
    AssignedTo: ActivityParityConfig.queueAssignedTo,
    RefIDDN: Number(sourceId) || sourceId,
    Status: ActivityParityConfig.queueStatus,
    Priority: ActivityParityConfig.queuePriority,
    'Acknowledgement Due Date': today,
    DueDate: today,
    NVERSE: ActivityParityConfig.queueTag,
    Category: spec.category
  };
}

// Canvas: yyyymmdd(Today()+1) - <activity ID> - <suffix> - <queue record ID>.
export function buildReferenceId(type, activity, queueRecordId, { now = () => new Date() } = {}) {
  const spec = lifecycleSpec(type);
  if (!spec) throw createValidationError(`Unsupported activity lifecycle action: ${type}`, { type });
  return `${referenceDatePart(now())}-${activityId(activity)}-${spec.suffix}-${text(queueRecordId)}`;
}

// Canvas DGO DIGITAL OPS update: Status=Treated, AssignmentStatus=Assigned, and AssignedTo /
// Category copied from the queue (patch) record.
export function buildDgoPatch(queueRecord, activity = {}) {
  const { status, assignmentStatus } = ActivityParityConfig.dgoUpdate;
  return {
    status,
    assignmentStatus,
    assignedTo: queueRecord.AssignedTo,
    category: queueRecord.Category,
    referenceId: queueRecord.Reference_ID || activity.referenceId || '',
    updatedAt: new Date().toISOString()
  };
}

// Full projection, for previews and contracts. Callers that mutate live state must apply
// buildDgoPatch() onto the *current* record instead, so concurrent edits are not discarded.
export function buildDgoUpdate(activity, queueRecord) {
  return { ...activity, ...buildDgoPatch(queueRecord, activity) };
}

export function successMessage(type, title) {
  const spec = lifecycleSpec(type);
  return `${spec ? spec.messagePrefix : type} ${text(title)} Successful`;
}

// Pure planner: everything a governed caller needs to perform one lifecycle action.
// Deliberately does not write — modules/activities.js commits through WriteManager so the
// idempotency key, audit trail and action ownership checks are applied by the platform.
export function planLifecycleAction(type, activity, { now = () => new Date(), queueRecordId } = {}) {
  const queuePayload = buildQueuePayload(type, activity, { now });
  const Reference_ID = queueRecordId === undefined ? '' : buildReferenceId(type, activity, queueRecordId, { now });
  const queueRecord = { ...queuePayload, ...(Reference_ID ? { Reference_ID } : {}) };
  return {
    type,
    queuePayload,
    queueRecord,
    Reference_ID,
    dgoUpdate: Reference_ID ? buildDgoUpdate(activity, queueRecord) : null,
    successMessage: successMessage(type, queuePayload.Title)
  };
}

// Canvas lifecycle sequence, expressed as an injectable orchestrator so the persistence
// steps are testable without a DOM or a live backend:
//   1. Patch() a new DGOFASTTRACK queue record and read back its generated ID.
//   2. Patch() the Reference_ID (which needs that ID) back onto the queue record.
//   3. Patch() the DGO DIGITAL OPS source activity with the Treated/Assigned semantics.
// Every step is performed by a caller-supplied writer, so modules/activities.js can route all
// three through WriteManager.backend() and keep the idempotency/audit governance intact.
// A failure at any step propagates: no step is silently skipped and none is client-only.
export async function commitLifecycleAction(type, activity, { now = () => new Date(), createQueueRecord, applyReferenceId, patchActivity } = {}) {
  if (typeof createQueueRecord !== 'function') throw createValidationError('createQueueRecord writer is required.', { type });
  const queuePayload = buildQueuePayload(type, activity, { now });

  const queueRecordId = await createQueueRecord(queuePayload);
  if (queueRecordId === undefined || queueRecordId === null || text(queueRecordId) === '') {
    throw createValidationError('The FastTrack queue did not return a record ID; Reference_ID cannot be minted.', { type, activity: activityId(activity) });
  }

  const Reference_ID = buildReferenceId(type, activity, queueRecordId, { now });
  const queueRecord = { ...queuePayload, ID: queueRecordId, Reference_ID };
  if (typeof applyReferenceId === 'function') await applyReferenceId(queueRecord);

  const dgoPatch = buildDgoPatch(queueRecord, activity);
  if (typeof patchActivity === 'function') await patchActivity(dgoPatch, queueRecord);

  return { type, queuePayload, queueRecord, Reference_ID, dgoPatch, dgoUpdate: { ...activity, ...dgoPatch }, successMessage: successMessage(type, queuePayload.Title) };
}

// Runtime certification of the parity adoption, surfaced by modules/diagnostics.js
// (boundary role: certification-health). It asserts the governance envelope the lifecycle
// shortcuts depend on — an owned, audited action per lifecycle type, each bound to an
// endpoint contract that actually exists — so a configuration regression becomes a visible
// release blocker instead of a runtime failure at the moment an operator archives a record.
export function certifyGovernance({ ownership = ActionOwnership, contracts = EndpointContracts } = {}) {
  const checks = Object.keys(ActivityParityConfig.lifecycle).map(type => {
    const action = `activity-${type}`;
    const spec = ownership[action];
    const backendKey = text(spec?.backend).replace('.optional', '');
    const reasons = [];
    if (!spec) reasons.push('not registered in action ownership');
    else {
      if (spec.owner !== 'activities') reasons.push(`owned by ${spec.owner}, not activities`);
      if (!text(spec.audit)) reasons.push('no audit event');
      if (!backendKey || !contracts[backendKey]) reasons.push(`backend contract ${backendKey || '(none)'} is not registered`);
    }
    return { id: action, label: `Lifecycle action ${action}`, ok: reasons.length === 0, detail: reasons.join('; ') || `${spec.owner} · ${spec.audit} · ${backendKey}` };
  });
  return { ok: checks.every(c => c.ok), checks };
}

// Runtime *backend readiness* of the lifecycle operations, surfaced by modules/diagnostics.js
// alongside certifyGovernance(). certifyGovernance() proves the client-side governance
// envelope; it says nothing about whether the DYNAMIC_ACTIONS backend flow actually recognises
// the activity lifecycle operation discriminators. There is no safe dry-run for that contract —
// every DYNAMIC_ACTIONS call is a write — so an unprobed operation is reported as
// "not verified" (ATTENTION), never as PASS. Only an observed backend response that explicitly
// acknowledges the operation flips it to verified; an explicit rejection flips it to failed.
export function recogniseLifecycleResponse(operation, response) {
  const op = text(operation);
  const data = response?.data ?? response ?? null;
  const at = new Date().toISOString();
  if (!data || typeof data !== 'object') return { operation: op, status: 'unverified', at, detail: 'The backend responded without an operation acknowledgement.' };
  const echoed = text(data.operation ?? data.action ?? data.recognisedOperation ?? data.recognizedOperation ?? data.status?.operation);
  const flag = data.recognised ?? data.recognized ?? data.status?.recognised ?? data.status?.recognized;
  if (flag === false) return { operation: op, status: 'failed', at, detail: 'The backend explicitly reported the operation as unrecognised.' };
  if (flag === true || (echoed && echoed === op)) return { operation: op, status: 'verified', at, detail: 'The backend acknowledged the operation discriminator.' };
  return { operation: op, status: 'unverified', at, detail: 'The backend responded without acknowledging the operation discriminator.' };
}

export function certifyBackendReadiness({ recognition = {}, operations = ActivityLifecycleOperations } = {}) {
  const checks = operations.map(operation => {
    const record = recognition?.[operation] || null;
    const status = ['verified', 'failed'].includes(record?.status) ? record.status : 'unverified';
    const detail = status === 'verified'
      ? `${record.detail || 'Backend recognition observed.'}${record?.at ? ` (${record.at})` : ''}`
      : status === 'failed'
        ? `${record.detail || 'The backend rejected this operation.'}${record?.at ? ` (${record.at})` : ''}`
        : 'Not verified: no safe DYNAMIC_ACTIONS dry-run exists for this write, so backend recognition of this operation discriminator has not been proven in this environment.';
    return { id: operation, label: `DYNAMIC_ACTIONS operation ${operation}`, status, ok: status === 'verified', detail };
  });
  const failed = checks.filter(c => c.status === 'failed').length;
  const unverified = checks.filter(c => c.status === 'unverified').length;
  return {
    // `ok` is only true when every operation has actually been recognised by the backend.
    ok: checks.length > 0 && failed === 0 && unverified === 0,
    status: failed ? 'failed' : unverified ? 'unverified' : 'verified',
    dryRunAvailable: false,
    summary: `${checks.length - failed - unverified}/${checks.length} verified · ${unverified} not verified · ${failed} failed`,
    checks
  };
}

export const ActivityParity = Object.freeze({
  certifyGovernance,
  certifyBackendReadiness,
  recogniseLifecycleResponse,
  lifecycleOperations: () => [...ActivityLifecycleOperations],
  defaultFilters,
  filterActivities,
  filterOptions,
  getAttachments,
  getAttachmentPreviewModel,
  isSafeUrl,
  safeUrl,
  buildQueuePayload,
  buildReferenceId,
  buildDgoPatch,
  buildDgoUpdate,
  commitLifecycleAction,
  successMessage,
  planLifecycleAction
});
