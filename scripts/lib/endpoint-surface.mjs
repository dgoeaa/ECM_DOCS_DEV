/**
 * The endpoint surface of both delivered platforms — one definition, four consumers.
 *
 * `scripts/setup.mjs` (wiring a working tree), `scripts/package.mjs` (provisioning a
 * delivered package), `scripts/commission-check.mjs` (the readiness gate) and
 * `scripts/verify-endpoints.mjs` (live probes) each used to carry their own copy of
 * these lists. Four copies of a list that must agree is four chances to disagree, and
 * they had already started to: the packager did not exist, so nothing checked that the
 * thing shipped to an operator carried the same keys the runtime resolves.
 *
 * `tests/packaging.test.mjs` asserts this file against `config/endpoints.config.js`, so a
 * key added to the runtime and forgotten here fails the build rather than shipping as a
 * silently unprovisioned endpoint.
 *
 * THE ARCHITECTURE THIS SERVES. Every URL named here is invoked directly by the browser.
 * There is no proxy, broker or other intermediary in the request path, by decision, and
 * the delivered package carries the complete URL set rather than expecting an operator to
 * assemble it. That makes provisioning a build-time obligation with a build-time gate —
 * which is the point: an endpoint that is missing from a package is caught by
 * `npm run package`, not by an officer whose action failed at a desk.
 */

/**
 * `transport` distinguishes the two request shapes, and it is not cosmetic.
 *
 *   json    a POST of a JSON envelope, resolved through `core/data-client.js` against an
 *           `EndpointContracts` entry.
 *   bytes   a PUT of the raw document bytes with metadata in headers. It has no contract
 *           entry and `DataClient.request()` must not be used for it — base64-in-JSON is
 *           what produced the 4 MB ceiling these two replaced.
 *
 * `actions` names every flow route that arrives on this URL, and a route is reached in one
 * of TWO ways — the distinction matters to whoever builds the flow:
 *
 *   by `action`     the wire body's own `action` field, which core/data-client.js takes
 *                   from the contract. `fetchAll`, `getDocs`, `singleassignment`.
 *   by `operation`  a discriminator INSIDE the payload, where several routes share one
 *                   `action`. `core/api.js` invokeObsidianAction() posts
 *                   `{ action: 'dynamicGlobalAction', payload: { operation: 'dispatchOutbound' } }`
 *                   — so `dispatchOutbound` is an operation, not an action, and a flow
 *                   switching only on `action` will never see it.
 *
 * `sourceKey` names the FLOW a key is served by, and several keys legitimately share one —
 * `EMAIL` rides `DYNAMIC_GLOBAL_ACTIONS`, `FETCH_ACTIVITIES` and `STATUS` ride
 * `SUBSIDIARY_ACTIONS`. It defaults to the key's own name. Two keys landing on one flow is
 * therefore only a defect when their `sourceKey`s DISAGREE; treating every shared flow as a
 * collision refused the real estate, where sharing is the design.
 *
 * Both are listed here because both are obligations on the flow, and provisioning one URL
 * commissions all of them. A flow that implements the first and not the rest fails at a
 * desk, not at the gate — which is why the packager reports route coverage rather than
 * only URL coverage, and why `docs/deployment/FLOW-BUILD-PLAN.md` is cross-checked against
 * this list. That cross-check found `transitionStatus` and `logAuditEvent` documented
 * nowhere, while the client had always been able to send them.
 */
export const RUNTIME_ENDPOINTS = Object.freeze([
  { key: 'FETCH_ALL', pilot: true, transport: 'json', actions: ['fetchAll'],
    note: 'the register itself — officers see nothing without it' },
  { key: 'DYNAMIC_ACTIONS', pilot: true, transport: 'json', sourceKey: 'DYNAMIC_GLOBAL_ACTIONS',
    actions: ['dynamicGlobalAction', 'dispatchOutbound', 'archiveReference', 'transitionStatus', 'logAuditEvent'],
    note: 'every governed write: register, triage, treat, approve, dispatch, close, archive' },
  { key: 'SINGLE_ASSIGNMENT', pilot: true, transport: 'json', actions: ['singleassignment'],
    note: 'assign one correspondence to one officer' },
  { key: 'BULK_ASSIGNMENT', pilot: true, transport: 'json', actions: ['bulkassignment'],
    note: 'assign many at once' },
  { key: 'FETCH_ACTIVITIES', transport: 'json', sourceKey: 'SUBSIDIARY_ACTIONS', actions: ['LIST-ACTIVITIES'],
    note: 'activity feed' },
  { key: 'REFERENCE_DATA', transport: 'json', actions: ['lookups'],
    note: 'lookups and reference data' },
  { key: 'GET_DOCS', transport: 'json', actions: ['getDocs'],
    note: 'document retrieval' },
  { key: 'FETCH_EMAIL_ATTACHMENTS', transport: 'json', actions: ['fetchEmailAttachments'],
    note: 'email attachment retrieval' },
  { key: 'BULK_ASSIGNMENT_DIRECT', transport: 'json', actions: ['bulkassignment'],
    note: 'direct bulk assignment variant' },
  { key: 'EMAIL', transport: 'json', sourceKey: 'DYNAMIC_GLOBAL_ACTIONS', actions: ['dispatchEmail'],
    note: 'outward correspondence email' },
  { key: 'EMAIL_RELATED_TASK', transport: 'json', actions: ['emailtotaskassignment'],
    note: 'email-to-task assignment' },
  { key: 'AI_EMAIL_ANALYSIS', transport: 'json', actions: ['aiAnalyseEmail'],
    note: 'AI analysis of inbound email' },
  { key: 'AI_DOC_ANALYSIS', transport: 'json', actions: ['aiAnalyseEventDocs'],
    note: 'AI analysis of event documents' },
  { key: 'AI_CHAT', transport: 'json', actions: ['aiChat'],
    note: 'AI chat' },
  { key: 'OTP_GENERATE', transport: 'json', actions: ['otpGenerate'],
    note: 'one-time passcode issue' },
  { key: 'OTP_VERIFY', transport: 'json', actions: ['otpVerify'],
    note: 'one-time passcode check' },
  { key: 'SUBSIDIARY_ACTIONS', transport: 'json', sourceKey: 'SUBSIDIARY_ACTIONS',
    actions: ['INIT', 'REFRESH_EMAILS', 'LOAD_EMAIL_DETAILS', 'AI_ANALYSE_EMAIL', 'CREATE_TASK',
      'UPDATE_TASK', 'LOAD_EVENT_INFO', 'AI_CHAT', 'TRACK', 'ACKNOWLEDGE', 'GET_ALL',
      'GET_BOOTSTRAP', 'LISTDOCS', 'GETDOC', 'BULKASSIGN', 'CREATESUPPORTREQUEST',
      'GETREFERENCES', 'LIST-ACTIVITIES'],
    note: 'multi-route subsidiary action flow' },
  { key: 'SCAN_INTAKE', transport: 'bytes', actions: ['(raw PUT)'],
    note: 'registry counter scan deposit (raw-bytes PUT, not a JSON contract)' },
]);

export const PORTAL_ENDPOINTS = Object.freeze([
  { key: 'SUBMISSION', pilot: true, transport: 'json', actions: ['CREATE'],
    note: 'register a submission, mint its reference, issue upload tickets' },
  { key: 'UPLOAD', pilot: true, transport: 'bytes', actions: ['(raw PUT)'],
    note: 'redeem one ticket with the bytes of one attachment' },
  { key: 'STATUS', transport: 'json', sourceKey: 'SUBSIDIARY_ACTIONS', actions: ['TRACK'],
    note: 'citizens tracking a submission (reference + email pair)' },
  { key: 'SUPPORT', transport: 'json', sourceKey: 'SUBSIDIARY_ACTIONS', actions: ['CREATESUPPORTREQUEST'],
    note: 'public help desk — CASE- references, never enters the registry' },
  { key: 'VERIFY', transport: 'json', actions: ['otpGenerate'],
    note: 'mail a one-time code to a submitter' },
  { key: 'VERIFY_CONFIRM', transport: 'json', actions: ['otpVerify'],
    note: 'exchange that code for the proof SUBMISSION accepts' },
]);

/** The two delivered platforms, by the name their package carries. */
export const SURFACES = Object.freeze({
  runtime: Object.freeze({
    id: 'runtime',
    label: 'Internal operations platform',
    packageName: 'dgo-internal-platform',
    endpoints: RUNTIME_ENDPOINTS,
    configPath: 'config/config.local.js',
    globalName: 'DGO_CONFIG',
    envPrefixes: Object.freeze(['DGO_ENDPOINT_', 'DGO_']),
  }),
  portal: Object.freeze({
    id: 'portal',
    label: 'Public document portal',
    packageName: 'dgo-document-portal',
    endpoints: PORTAL_ENDPOINTS,
    configPath: 'config.local.js',
    globalName: 'PF_CONFIG',
    envPrefixes: Object.freeze(['PF_ENDPOINT_', 'DGO_ENDPOINT_INTAKE_', 'PF_']),
  }),
});

export const SURFACE_IDS = Object.freeze(Object.keys(SURFACES));

export const keysOf = surfaceId => SURFACES[surfaceId].endpoints.map(e => e.key);

/**
 * The irreducible set: correspondence cannot flow end to end without these. Everything
 * else is a feature you add later with one value and a rebuild, which is why an unset
 * non-pilot key is reported rather than treated as a failure.
 */
export const pilotKeysOf = surfaceId =>
  SURFACES[surfaceId].endpoints.filter(e => e.pilot).map(e => e.key);

export const entryOf = (surfaceId, key) =>
  SURFACES[surfaceId].endpoints.find(e => e.key === key) || null;

/** Every flow route reachable on a surface, whether or not it has its own URL. */
export const actionsOf = surfaceId =>
  SURFACES[surfaceId].endpoints.flatMap(e => e.actions.map(a => ({ key: e.key, action: a })));
