#!/usr/bin/env node
/**
 * Live endpoint verification.
 *
 *   npm run verify:endpoints                  # read-only endpoints, both surfaces
 *   npm run verify:endpoints -- --include-writes
 *   npm run verify:endpoints -- --only FETCH_ALL,GET_DOCS
 *   npm run verify:endpoints -- --surface portal
 *   npm run verify:endpoints -- --json report.json
 *
 * Calls each configured Power Automate flow for real and reports what came back: status,
 * latency, whether the body parsed, and which top-level keys it carried against the shape
 * the contract expects. This is the step that turns "the configuration looks right" into
 * "the configuration was exercised against the live flow and here is the transcript".
 *
 * WRITES ARE OPT-IN. Roughly two thirds of the endpoint surface mutates something — the
 * contracts in config/endpoints.config.js say which. Probing those creates real records
 * in a real register, so they are skipped unless you pass `--include-writes`, and every
 * probe that does run carries a `__DGO_PROBE__` marker plus a run id so the rows it
 * creates can be found and deleted afterwards. Nothing here is safe to point at a
 * production tenant.
 *
 * NO SECRET IS PRINTED. Endpoints are identified by contract key and workflow id; the
 * signature is never written to the terminal or to the JSON report, so a report can be
 * pasted into an issue without leaking a credential.
 *
 * Exit 0 = every probed endpoint answered acceptably. Exit 1 = at least one did not.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);

const flag = name => argv.includes(name);
const opt = name => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
};

const INCLUDE_WRITES = flag('--include-writes') || flag('--all');
const ONLY = (opt('--only') || '').split(',').map(s => s.trim()).filter(Boolean);
const SURFACE = opt('--surface');
const JSON_OUT = opt('--json');
const TIMEOUT_MS = Number(opt('--timeout') || 60_000);

const RUN_ID = `probe-${Date.now().toString(36)}`;
const PROBE_EMAIL = process.env.DGO_PROBE_EMAIL || 'dgo.probe@example.invalid';

/* ------------------------------------------------------------------ *
 * Configuration, read the way the browser reads it
 * ------------------------------------------------------------------ */

function loadLocalConfig(relPath, globalName) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return {};
  const sandbox = { window: {} };
  try {
    new Function('window', fs.readFileSync(abs, 'utf8')).call(sandbox, sandbox.window);
  } catch (e) {
    console.error(`\n  ✖  ${relPath} does not evaluate: ${e.message}\n`);
    process.exit(2);
  }
  return sandbox.window[globalName]?.endpoints || {};
}

const runtimeEndpoints = loadLocalConfig('config/config.local.js', 'DGO_CONFIG');
const portalEndpoints = loadLocalConfig('document-portal/config.local.js', 'PF_CONFIG');

const { EndpointContracts } = await import('../config/endpoints.config.js');

/* ------------------------------------------------------------------ *
 * Probes
 *
 * Each probe is the smallest request that exercises the flow's routing without asking it
 * to do anything it would not do in normal use. `expect` lists the top-level response
 * keys the corpus documents for that flow; where the corpus documents none, it is left
 * out and the verifier reports what came back rather than judging it.
 * ------------------------------------------------------------------ */

const RUNTIME_PROBES = {
  FETCH_ALL: { body: { action: 'fetchAll', userEmail: PROBE_EMAIL }, expect: ['tasks', 'docs', 'emails'] },
  GET_DOCS: { body: { action: 'getDocs', userEmail: PROBE_EMAIL }, expect: ['docs'] },
  REFERENCE_DATA: { body: { action: 'lookups', userEmail: PROBE_EMAIL }, expect: ['users', 'categories', 'departments'] },
  FETCH_ACTIVITIES: { body: { action: 'LIST-ACTIVITIES', userEmail: PROBE_EMAIL } },
  FETCH_EMAIL_ATTACHMENTS: { body: { action: 'fetchEmailAttachments', userEmail: PROBE_EMAIL } },

  SUBSIDIARY_ACTIONS: { body: { action: 'GET_BOOTSTRAP', name: 'GET_BOOTSTRAP', userEmail: PROBE_EMAIL } },
  DYNAMIC_ACTIONS: { body: { action: 'dynamicGlobalAction', operation: 'noop', userEmail: PROBE_EMAIL } },
  SINGLE_ASSIGNMENT: { body: { action: 'singleassignment', operation: 'create', userEmail: PROBE_EMAIL } },
  BULK_ASSIGNMENT: { body: { action: 'bulkassignment', operation: 'create', userEmail: PROBE_EMAIL } },
  BULK_ASSIGNMENT_DIRECT: { body: { action: 'bulkassignment', operation: 'create', userEmail: PROBE_EMAIL } },
  EMAIL: { body: { action: 'dispatchEmail', userEmail: PROBE_EMAIL } },
  EMAIL_RELATED_TASK: { body: { action: 'emailtotaskassignment', userEmail: PROBE_EMAIL } },
  AI_EMAIL_ANALYSIS: { body: { action: 'aiAnalyseEmail', userEmail: PROBE_EMAIL } },
  AI_DOC_ANALYSIS: { body: { action: 'aiAnalyseEventDocs', userEmail: PROBE_EMAIL } },
  AI_CHAT: { body: { action: 'aiChat', userEmail: PROBE_EMAIL, message: '__DGO_PROBE__' }, expect: ['reply'] },
  OTP_GENERATE: { body: { action: 'otpGenerate', userEmail: PROBE_EMAIL } },
  OTP_VERIFY: { body: { action: 'otpVerify', userEmail: PROBE_EMAIL, code: '000000' } },

  /* Two contracts, one URL. DISPATCH_OUTBOUND and ARCHIVE_REFERENCE both post to the
     DYNAMIC_ACTIONS trigger and are distinguished only by `action`, so provisioning that
     one URL commissions three obligations rather than one. Until these were added, the
     verifier exercised the first and reported the surface green — a flow whose switch had
     no `dispatchOutbound` case would have been discovered by the first officer who tried
     to dispatch a decision, in production. `via` names the key whose URL to use. */
  DISPATCH_OUTBOUND: {
    via: 'DYNAMIC_ACTIONS',
    body: { action: 'dispatchOutbound', ref: '__DGO_PROBE__', channel: 'email', recipients: [PROBE_EMAIL], userEmail: PROBE_EMAIL },
  },
  ARCHIVE_REFERENCE: {
    via: 'DYNAMIC_ACTIONS',
    body: { action: 'archiveReference', ref: '__DGO_PROBE__', userEmail: PROBE_EMAIL },
  },

  /* Not a JSON contract: core/scan-intake-service.js PUTs the raw bytes of a scanned
     document with the filename, size and digest in headers, because base64-in-JSON is what
     produced the 4 MB ceiling this replaced. Probing it with a POSTed envelope would prove
     nothing about the path the platform actually uses. */
  SCAN_INTAKE: { transport: 'bytes', filename: '__DGO_PROBE__.txt' },
};

const PORTAL_PROBES = {
  STATUS: {
    write: false,
    body: { action: 'TRACK', name: 'TRACK', referenceId: '__DGO_PROBE__', email: PROBE_EMAIL },
    expect: ['record'],
  },
  SUBMISSION: {
    write: true,
    body: {
      action: 'CREATE', UserId: RUN_ID, SubmitterName: '__DGO_PROBE__', EmailAddress: PROBE_EMAIL,
      CompanyName: '__DGO_PROBE__', DocumentType: 'General Correspondence',
      subject: '__DGO_PROBE__', category: 'General Correspondence', description: RUN_ID,
    },
    expect: ['referenceId', 'uploads'],
  },
  SUPPORT: {
    write: true,
    body: { action: 'CREATESUPPORTREQUEST', name: 'CREATESUPPORTREQUEST', email: PROBE_EMAIL, subject: '__DGO_PROBE__', message: RUN_ID },
    expect: ['caseRef'],
  },
  VERIFY: { write: true, body: { action: 'otpGenerate', email: PROBE_EMAIL }, expect: ['sent'] },
  VERIFY_CONFIRM: { write: true, body: { action: 'otpVerify', email: PROBE_EMAIL, code: '000000' }, expect: ['verification'] },

  /* The ticket-redeeming attachment PUT. It is half of the portal's minimal-pilot set and
     was the one member of that set the verifier could not exercise, so "both pilot
     endpoints are wired" and "both pilot endpoints answer" were different claims and only
     the first was ever checked. A deposit without a ticket should be REFUSED — that
     refusal is the evidence that the flow validates its own callers, which on a public
     channel is the whole control. */
  UPLOAD: { write: true, transport: 'bytes', filename: '__DGO_PROBE__.txt' },
};

/** A contract's own readOnly flag is the authority for the runtime surface. */
const isWrite = (key, surface) =>
  surface === 'portal'
    ? PORTAL_PROBES[key]?.write !== false
    : !EndpointContracts[key]?.readOnly;

/* ------------------------------------------------------------------ *
 * The call
 * ------------------------------------------------------------------ */

const workflowIdOf = url => (/workflows\/([a-f0-9]{32})/.exec(url) || [])[1] || null;

/**
 * The raw-bytes request the two deposit endpoints actually receive: a PUT of the document
 * with its filename, size and SHA-256 in headers. Built here rather than in the probe
 * table so the two callers cannot describe it differently.
 */
function bytesRequest(spec) {
  const payload = Buffer.from(`__DGO_PROBE__ ${RUN_ID}\n`, 'utf8');
  return {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-DGO-Filename': spec.filename || '__DGO_PROBE__.bin',
      'X-DGO-Size': String(payload.length),
      'X-DGO-Sha256': createHash('sha256').update(payload).digest('hex'),
      'X-DGO-Probe': RUN_ID,
    },
    body: payload,
  };
}

async function probe(key, url, spec) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const result = { key, workflowId: workflowIdOf(url), ms: 0 };
  try {
    const req = spec.transport === 'bytes'
      ? bytesRequest(spec)
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-DGO-Probe': RUN_ID },
          body: JSON.stringify({ ...spec.body, __probe: RUN_ID }),
        };
    const res = await fetch(url, { ...req, signal: controller.signal });
    result.ms = Date.now() - started;
    result.status = res.status;
    const text = await res.text();
    result.bytes = text.length;
    try {
      const json = JSON.parse(text);
      result.parsed = true;
      result.keys = json && typeof json === 'object' && !Array.isArray(json) ? Object.keys(json) : [];
      if (spec.expect) {
        result.expected = spec.expect;
        result.missing = spec.expect.filter(k => !result.keys.includes(k));
      }
    } catch {
      result.parsed = false;
      result.snippet = text.slice(0, 160).replace(/\s+/g, ' ');
    }
  } catch (e) {
    result.ms = Date.now() - started;
    result.error = e.name === 'AbortError' ? `timed out after ${TIMEOUT_MS}ms` : e.message;
  } finally {
    clearTimeout(timer);
  }
  return result;
}

/**
 * Phrases that mean an intermediary answered, not Power Automate. Corporate egress
 * filters, sandbox proxies and captive portals all return their own 403 or 407 with a
 * human-readable body.
 */
const INTERCEPT = /not in allowlist|egress|proxy|blocked by|access denied by|captive portal|forbidden by policy/i;

/**
 * A probe is acceptable when the FLOW answered as a working flow would. Three distinct
 * outcomes, and conflating them is the failure mode this function exists to avoid:
 *
 *   reached + working    2xx, or a 4xx the flow itself produced — a flow that refuses a
 *                        deliberately thin probe payload is a flow that validates its
 *                        input, which is exactly what it should do.
 *   reached + broken     401/403/404/5xx from Power Automate: revoked signature, stale
 *                        URL, or the flow erroring.
 *   never reached        a transport failure, or a response that did not come from Power
 *                        Automate at all.
 *
 * That last case is why `parsed` is checked before status. A Power Automate manual
 * trigger answers JSON or nothing; a non-JSON body means something in the middle
 * intercepted the call. An earlier cut of this function read the intermediary's own 403
 * as "the flow is live and validating" and reported six endpoints green while not one
 * packet had reached the tenant. A verifier that green-lights unreachable endpoints is
 * worse than no verifier, because it is trusted.
 */
function verdictOf(r) {
  if (r.error) return { ok: false, reached: false, why: r.error };

  if (r.parsed === false) {
    const intercepted = INTERCEPT.test(r.snippet || '');
    return {
      ok: false,
      reached: false,
      why: intercepted
        ? 'never reached Power Automate — an egress filter or proxy answered instead'
        : `answered with non-JSON (${r.status}) — this did not come from Power Automate`,
    };
  }

  if (r.status === 401 || r.status === 403) {
    return { ok: false, reached: true, why: `unauthorised (${r.status}) — the signature is wrong or revoked` };
  }
  if (r.status === 404) return { ok: false, reached: true, why: 'no such flow — the trigger URL is stale' };
  if (r.status >= 500) return { ok: false, reached: true, why: `flow error ${r.status}` };
  if (r.status >= 400) return { ok: true, reached: true, why: `refused (${r.status}) — the flow is live and validating` };
  if (r.missing?.length) return { ok: true, reached: true, why: `answered, but without ${r.missing.join(', ')}` };
  return { ok: true, reached: true, why: 'answered' };
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

/*
 * Targets are driven by the PROBE TABLE, not by the configured key list.
 *
 * The earlier loop walked `Object.entries(endpoints)`, so a contract reachable only
 * through another key's URL — DISPATCH_OUTBOUND and ARCHIVE_REFERENCE both ride
 * DYNAMIC_ACTIONS — could never become a target however it was configured. Three flow
 * routes were therefore unverifiable by construction, and nothing said so: the run
 * reported the endpoints it had probed and never mentioned the ones it structurally
 * could not.
 */
const targets = [];
for (const [surface, endpoints, probes] of [
  ['runtime', runtimeEndpoints, RUNTIME_PROBES],
  ['portal', portalEndpoints, PORTAL_PROBES],
]) {
  if (SURFACE && SURFACE !== surface) continue;
  for (const [key, spec] of Object.entries(probes)) {
    if (ONLY.length && !ONLY.includes(key)) continue;
    const url = String(endpoints[spec.via || key] || '').trim();
    if (!url) continue;
    targets.push({ surface, key, url, spec, write: isWrite(key, surface), via: spec.via || null });
  }
}

if (!targets.length) {
  console.log('\n  Nothing to verify — no endpoint is configured.\n');
  console.log('  npm run setup -- --recover --force     # wire the documented estate\n');
  process.exit(1);
}

console.log(`\nDGO Digital Operations — live endpoint verification`);
console.log(`  run id ${RUN_ID}`);
console.log(`  ${targets.length} endpoint(s) configured${INCLUDE_WRITES ? '' : ', read-only probes only'}\n`);

if (INCLUDE_WRITES) {
  console.log('  ⚠  WRITE PROBES ENABLED. Real records will be created, tagged');
  console.log(`     __DGO_PROBE__ and ${RUN_ID}. Delete them when you are done.\n`);
}

const results = [];
for (const t of targets) {
  if (t.write && !INCLUDE_WRITES) {
    results.push({ ...t, skipped: 'mutates — pass --include-writes to probe it' });
    continue;
  }
  process.stdout.write(`  ${t.key.padEnd(24)} `);
  const r = await probe(t.key, t.url, t.spec);
  const v = verdictOf(r);
  results.push({ ...t, ...r, verdict: v });
  const icon = v.ok ? '✅' : '⛔';
  const status = r.error ? '---' : String(r.status);
  console.log(`${icon} ${status.padEnd(4)} ${String(r.ms + 'ms').padEnd(8)} ${v.why}` +
    (t.via ? `  (on ${t.via}'s URL)` : '') +
    (t.spec.transport === 'bytes' ? '  (raw-bytes PUT)' : ''));
  if (r.keys?.length) console.log(`  ${' '.repeat(24)}    keys: ${r.keys.join(', ')}`);
  if (r.parsed === false) console.log(`  ${' '.repeat(24)}    non-JSON: ${r.snippet}`);
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

const probed = results.filter(r => !r.skipped);
const failed = probed.filter(r => !r.verdict.ok);
const skipped = results.filter(r => r.skipped);
const shapeGaps = probed.filter(r => r.verdict.ok && r.missing?.length);

console.log('\n  ' + '─'.repeat(72) + '\n');

if (skipped.length) {
  console.log(`  ${skipped.length} not probed (would mutate):`);
  console.log(`     ${skipped.map(s => s.key).join(', ')}\n`);
}

if (shapeGaps.length) {
  console.log(`  ${shapeGaps.length} answered but did not match the declared contract:\n`);
  for (const r of shapeGaps) {
    console.log(`     ${r.key} — expected ${r.expected.join(', ')}`);
    console.log(`       got ${r.keys.length ? r.keys.join(', ') : '(no object keys)'}`);
  }
  console.log('\n  This is the finding the exercise exists to produce: the flow is live and');
  console.log('  reachable, but its response does not carry what the client reads. Fix it in');
  console.log('  Power Automate now, in development, rather than discovering it in production.\n');
}

if (JSON_OUT) {
  // Deliberately without `url` — a report must be safe to paste into an issue.
  const safe = results.map(({ url, spec, ...rest }) => rest);
  fs.writeFileSync(JSON_OUT, JSON.stringify({ runId: RUN_ID, at: new Date().toISOString(), results: safe }, null, 2));
  console.log(`  Report written to ${JSON_OUT} (no signatures included)\n`);
}

const unreachable = failed.filter(r => !r.verdict.reached);

if (unreachable.length === probed.length && probed.length) {
  console.log('  ⛔ NOTHING REACHED POWER AUTOMATE.\n');
  console.log('  Every probe was answered by something other than the tenant, so this run');
  console.log('  verified nothing about your configuration — it verified your network.');
  console.log('  No conclusion about the endpoints can be drawn from it either way.\n');
  console.log('  Run it from a machine whose egress policy allows');
  console.log('  *.environment.api.powerplatform.com, then read the result.\n');
  process.exit(1);
}

if (failed.length) {
  console.log(`  ⛔ ${failed.length} of ${probed.length} probed endpoint(s) did not answer acceptably:\n`);
  for (const r of failed) console.log(`     ${r.key} — ${r.verdict.why}`);
  if (unreachable.length) {
    console.log(`\n  ${unreachable.length} of those never reached Power Automate, so they are`);
    console.log('  unverified rather than broken — the configuration may be fine.');
  }
  console.log('');
  process.exit(1);
}

console.log(`  ✅ ${probed.length} endpoint(s) answered acceptably.\n`);
if (skipped.length) {
  console.log('  Re-run with --include-writes to exercise the write surface as well.\n');
}
process.exit(0);
