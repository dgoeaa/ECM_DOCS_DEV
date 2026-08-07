#!/usr/bin/env node
/**
 * Live endpoint verification.
 *
 *   npm run verify:endpoints                  # read-only endpoints, both surfaces
 *   npm run verify:endpoints -- --include-writes
 *   npm run verify:endpoints -- --only FETCH_ALL,GET_DOCS
 *   npm run verify:endpoints -- --surface portal
 *   npm run verify:endpoints -- --json report.json
 *   npm run verify:endpoints -- --catalogue dist/dgo-internal-platform/FLOW_CATALOGUE.json
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
 * --catalogue additionally probes EVERY flow a built package's FLOW_CATALOGUE.json names,
 * including the 23 in the documented estate that no contract key calls, and reports which
 * signatures still authenticate. Those are reachability probes only — they answer "is this
 * URL live?", never "does this flow work?" — and the report keeps the two apart.
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
/**
 * A FLOW_CATALOGUE.json from a built package. With it, the run additionally answers
 * "which of the flows in the estate are still live?" for EVERY flow the catalogue names,
 * including the ones no contract key calls.
 *
 * That question had no answer before, and it is the first one live testing asks. The
 * documented estate has 39 flows; the two platforms' contract keys reach 16. When a probe
 * on a wired key comes back wrong, the next move is to point it at a different flow — and
 * pointing it at one whose signature was revoked six months ago wastes a cycle.
 *
 * ⚠  These are REACHABILITY probes, not contract probes. An unwired flow has no declared
 * contract here, so the body is empty and the only thing read off the answer is whether
 * the signature authenticated. A 200 means the URL is live; it does NOT mean the flow does
 * what its name suggests.
 */
const CATALOGUE = opt('--catalogue');

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
const { probeTables } = await import('./lib/endpoint-probes.mjs');

/* ------------------------------------------------------------------ *
 * Probes
 *
 * Defined in scripts/lib/endpoint-probes.mjs, because the ENDPOINT-CHECK.html page each
 * package carries runs the same probes from the browser. Two copies of this table is two
 * chances for the terminal and the browser to disagree about what was tested.
 * ------------------------------------------------------------------ */

const { RUNTIME_PROBES, PORTAL_PROBES } =
  probeTables({ probeEmail: PROBE_EMAIL, runId: RUN_ID });

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

      /* The contract shape can be nested. The documented flow envelope is
         `{ ok, status, request, timing, meta, data }` and the payload the client reads —
         `tasks`, `docs`, `emails` — is inside `data`; core/data-loader.js calls
         assertEnvelope() and then reads the collections out of it. Checking only the top
         level reported six correctly-shaped responses as contract gaps, which is a verifier
         that cries wolf, and a verifier that cries wolf gets ignored on the run where it is
         right. Both levels are considered, and which one satisfied the contract is
         recorded so the transcript stays honest about what it found where. */
      const envelope = json && typeof json.data === 'object' && json.data !== null && !Array.isArray(json.data)
        ? Object.keys(json.data) : null;
      result.dataKeys = envelope;
      /* The declared shape describes a SUCCESSFUL response. Checking it against a refusal
         reports a contract gap on a flow that is behaving correctly: a thin probe payload
         refused with 400 obviously carries no `referenceId`, and saying so buries the one
         case that matters — a 2xx that answered without what the client reads. */
      if (spec.expect && res.status < 400) {
        result.expected = spec.expect;
        const atTop = spec.expect.filter(k => !result.keys.includes(k));
        const inData = envelope ? spec.expect.filter(k => !envelope.includes(k)) : atTop;
        result.missing = inData.length <= atTop.length ? inData : atTop;
        result.matchedIn = result.missing.length === 0 && atTop.length > 0 ? 'data' : 'top-level';
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
function verdictOf(r, spec = {}) {
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

  /* A STATUS OF ITS OWN, DECLARED BY THE PROBE.
     Two endpoints answer correctly with a code this function otherwise reads as broken, and
     conflating them is the same class of error as reading an egress filter's 403 as a live
     flow — just in the other direction.

       STATUS  404 is its DESIGNED denial. It deliberately does not distinguish an unknown
               reference from a wrong email, because doing so answers "does this reference
               exist?" for anybody who asks. A probe carrying __DGO_PROBE__ must get a 404,
               and getting one is the control working.
       UPLOAD  403 without a valid ticket is the ticket check doing its job. A deposit that
               succeeds without a ticket is the failure; a refusal is the pass.

     Declared per probe rather than inferred, so the exemption is a decision on the record
     and cannot quietly widen to endpoints that have not earned it. */
  if (Array.isArray(spec.expectStatus) && spec.expectStatus.includes(r.status)) {
    return { ok: true, reached: true, why: `${r.status} — ${spec.expectStatusWhy || 'the documented response for this probe'}` };
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

/* `--catalogue` is a mode of its own: it needs no configured endpoint, because the URLs
   come from the catalogue file. Exiting here on an empty target list made the two passes
   inseparable, so "which flows in the estate are still live?" could only be asked from a
   tree that already had a working configuration — which is backwards, since the answer is
   what you need in order to build one. */
if (!targets.length && !CATALOGUE) {
  console.log('\n  Nothing to verify — no endpoint is configured.\n');
  console.log('  npm run setup -- --recover --force     # wire the documented estate');
  console.log('  npm run verify:endpoints -- --catalogue <pkg>/FLOW_CATALOGUE.json\n');
  process.exit(1);
}

console.log(`\nDGO Digital Operations — live endpoint verification`);
console.log(`  run id ${RUN_ID}`);
console.log(`  ${targets.length} endpoint(s) configured${INCLUDE_WRITES ? '' : ', read-only probes only'}\n`);
if (!targets.length) console.log('  No contract endpoint is configured — estate reachability only.\n');

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
  const v = verdictOf(r, t.spec);
  results.push({ ...t, ...r, verdict: v });
  const icon = v.ok ? '✅' : '⛔';
  const status = r.error ? '---' : String(r.status);
  console.log(`${icon} ${status.padEnd(4)} ${String(r.ms + 'ms').padEnd(8)} ${v.why}` +
    (t.via ? `  (on ${t.via}'s URL)` : '') +
    (t.spec.transport === 'bytes' ? '  (raw-bytes PUT)' : ''));
  if (r.keys?.length) {
    console.log(`  ${' '.repeat(24)}    keys: ${r.keys.join(', ')}`);
    if (r.matchedIn === 'data') {
      console.log(`  ${' '.repeat(24)}    contract shape satisfied inside data: ${r.dataKeys.join(', ')}`);
    }
  }
  if (r.parsed === false) console.log(`  ${' '.repeat(24)}    non-JSON: ${r.snippet}`);
}

/* ------------------------------------------------------------------ *
 * The rest of the estate
 * ------------------------------------------------------------------ */

/**
 * Probe every flow a package's FLOW_CATALOGUE.json names, and report which are live.
 *
 * Deliberately separate from the run above and deliberately weaker. The probes above know
 * what each endpoint is FOR — they send a contract-shaped body and check the answer
 * against the shape the client reads. A flow no contract key calls has no such contract
 * here, so this sends nothing and reads one thing off the answer: did the signature
 * authenticate?
 *
 * The distinction is the point. Reporting "GET EMAILS: live" from an empty POST is honest.
 * Reporting "GET EMAILS: working" from the same probe would not be, and this function must
 * never grow into claiming the second.
 */
async function probeCatalogue() {
  if (!CATALOGUE) return;
  let cat;
  try {
    cat = JSON.parse(fs.readFileSync(path.resolve(ROOT, CATALOGUE), 'utf8'));
  } catch (e) {
    console.log(`  ⚠  Could not read ${CATALOGUE}: ${e.message}\n`);
    return;
  }
  const flows = (cat.availableFlows || []).filter(f => f.url);
  if (!flows.length) return;

  console.log(`  Estate reachability — ${flows.length} flow(s) from ${CATALOGUE}\n`);
  console.log('  Empty-body probes. These say whether a signature still authenticates.');
  console.log('  They say nothing about whether a flow does what its name suggests.\n');

  const rows = [];
  for (const f of flows) {
    const r = await probe(f.workflowId, f.url, { body: {} });
    /* Reuse the main verdict rather than re-deriving one. The first cut of this loop wrote
       its own `status < 500` test, and against this machine's egress policy — which answers
       every call with its own 403 and a plain-text body — it reported all 39 signatures
       REFUSED and advised against repointing any key at them. Not one packet had reached
       the tenant. That is the exact failure `verdictOf` was written to prevent, reproduced
       fifty lines further down the same file because the classification was duplicated
       instead of called. */
    const v = verdictOf(r, {});
    /* `ok` here means "the flow answered as a working flow would". For a contract probe
       that is the finding; for an empty-body probe it is only evidence the signature
       authenticated, which is all this pass claims. */
    const state = !v.reached ? 'unreached' : v.ok || r.status === 400 ? 'live' : 'refused';
    const wired = f.wiredTo?.length ? f.wiredTo.join(', ') : '—';
    rows.push({ workflowId: f.workflowId, flow: f.flow, wiredTo: f.wiredTo || [],
      status: r.status ?? null, ms: r.ms, error: r.error || null, state, why: v.why });
    const icon = state === 'unreached' ? '⚠ ' : state === 'live' ? '✅' : '⛔';
    console.log(`  ${icon} ${String(r.status ?? '---').padEnd(4)} ${f.workflowId.slice(0, 8)}  `
      + `${(f.flow || '').slice(0, 44).padEnd(46)}${wired}`);
  }

  const by = state => rows.filter(r => r.state === state);
  const [live, refused, unreached] = ['live', 'refused', 'unreached'].map(by);
  console.log('');
  if (unreached.length === rows.length) {
    console.log('  ⚠  NONE of these reached Power Automate. Every call was answered by');
    console.log(`     something else — ${rows[0].why}.`);
    console.log('     This measured the network, not the estate: no signature here has been');
    console.log('     shown to be either live or revoked, and none should be treated as');
    console.log('     either. Re-run from a machine whose egress policy allows');
    console.log('     *.environment.api.powerplatform.com.\n');
  } else {
    console.log(`  ${live.length} live · ${refused.length} refused · ${unreached.length} unreached\n`);
    if (refused.length) {
      console.log('  Refused signatures cannot serve any key. Do not repoint a key at one:\n');
      for (const d of refused) console.log(`     ${d.workflowId.slice(0, 8)}  ${d.flow} — ${d.why}`);
      console.log('');
    }
    if (unreached.length) {
      console.log(`  ${unreached.length} never reached Power Automate and are unverified rather`);
      console.log('  than broken.\n');
    }
  }
  catalogueRows = rows;
}

let catalogueRows = [];

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

/** Written after the catalogue pass so the report carries it too. */
function writeReport() {
  if (!JSON_OUT) return;
  // Deliberately without `url` — a report must be safe to paste into an issue.
  const safe = results.map(({ url, spec, ...rest }) => rest);
  fs.writeFileSync(JSON_OUT, JSON.stringify({
    runId: RUN_ID, at: new Date().toISOString(), results: safe, estate: catalogueRows,
  }, null, 2));
  console.log(`  Report written to ${JSON_OUT} (no signatures included)\n`);
}

const unreachable = failed.filter(r => !r.verdict.reached);

if (!probed.length) {
  await probeCatalogue();
  writeReport();
  process.exit(catalogueRows.some(r => r.state === 'refused') ? 1 : 0);
}

if (unreachable.length === probed.length && probed.length) {
  writeReport();
  console.log('  ⛔ NOTHING REACHED POWER AUTOMATE.\n');
  console.log('  Every probe was answered by something other than the tenant, so this run');
  console.log('  verified nothing about your configuration — it verified your network.');
  console.log('  No conclusion about the endpoints can be drawn from it either way.\n');
  console.log('  Run it from a machine whose egress policy allows');
  console.log('  *.environment.api.powerplatform.com, then read the result.\n');
  process.exit(1);
}

if (failed.length) {
  await probeCatalogue();
  writeReport();
  console.log(`  ⛔ ${failed.length} of ${probed.length} probed endpoint(s) did not answer acceptably:\n`);
  for (const r of failed) console.log(`     ${r.key} — ${r.verdict.why}`);
  if (unreachable.length) {
    console.log(`\n  ${unreachable.length} of those never reached Power Automate, so they are`);
    console.log('  unverified rather than broken — the configuration may be fine.');
  }
  console.log('');
  process.exit(1);
}

await probeCatalogue();
writeReport();

console.log(`  ✅ ${probed.length} endpoint(s) answered acceptably.\n`);
if (skipped.length) {
  console.log('  Re-run with --include-writes to exercise the write surface as well.\n');
}
process.exit(0);
