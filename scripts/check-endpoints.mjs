#!/usr/bin/env node
// Verify the configured Power Automate endpoints actually answer.
//
//   node scripts/check-endpoints.mjs
//
// Reads config/config.local.js and probes every endpoint it names, so a wiring mistake
// surfaces here rather than as an empty workspace nobody can explain. No proxy involved.
//
// ─────────────────────────────────────────────────────────────────────────────
// IT DOES NOT RUN YOUR WRITE FLOWS.
//
// A connectivity check that invokes `dispatchEmail` sends real email; one that invokes
// `singleassignment` creates a real assignment. That is not a test, it is a change to the
// live registry made by a diagnostic.
//
// So the two kinds of contract are probed differently:
//
//   readOnly (5)   POST with the real action and an empty payload. It reads; that is safe,
//                  and it is the only probe that proves the flow works end to end.
//
//   write (14)     GET, which a POST-only trigger refuses. The gateway still validates the
//                  signature first, so the response separates "URL and signature are good"
//                  (405) from "signature rejected" (401/403) WITHOUT the flow running.
//                  Weaker evidence, deliberately: the alternative is side effects.
//
// `--probe-writes` overrides this and POSTs to everything. It will run those flows. There
// is a confirmation prompt, and it is not the default.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { EndpointContracts, EndpointKeys, ConfiguredEndpointKeys } from '../config/endpoints.config.js';
import { redact } from '../core/endpoint-registry.js';

/**
 * Contracts that carry no URL of their own.
 *
 * DISPATCH_OUTBOUND and ARCHIVE_REFERENCE are real contracts that resolve to the
 * DYNAMIC_ACTIONS url — they are distinguished by the action in the body, not by address.
 * Read from the config rather than hardcoded, so a contract added later is classified
 * correctly without anyone remembering to update a list here.
 */
export const DERIVED_KEYS = EndpointKeys.filter(k => !ConfiguredEndpointKeys.includes(k));
export const CONFIGURABLE_KEYS = EndpointKeys.filter(k => ConfiguredEndpointKeys.includes(k));

/**
 * Which configured key each derived contract actually reaches.
 *
 * The aliasing lives in `url: EndpointUrls.DYNAMIC_ACTIONS` inside the config, and it is
 * invisible from Node: with no `window` every URL resolves to the empty string, so
 * comparing urls matches whichever key happens to be declared first. Re-evaluating the
 * config with each key's own NAME as its URL makes the aliasing observable, and keeps it
 * derived from the config rather than restated here where it would drift.
 */
async function derivedSourceMap() {
  const had = 'window' in globalThis;
  const prev = globalThis.window;
  globalThis.window = {
    DGO_CONFIG: { endpoints: Object.fromEntries(ConfiguredEndpointKeys.map(k => [k, k])) },
  };
  try {
    // A query string gives a fresh module instance; the already-imported one is frozen
    // with the empty URLs it evaluated with.
    const probe = await import(`../config/endpoints.config.js?sentinel=${Date.now()}`);
    const map = {};
    for (const key of DERIVED_KEYS) {
      const target = probe.EndpointContracts[key]?.url;
      if (target && ConfiguredEndpointKeys.includes(target)) map[key] = target;
    }
    return map;
  } catch {
    return {};
  } finally {
    if (had) globalThis.window = prev; else delete globalThis.window;
  }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, 'config', 'config.local.js');

const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const value = name => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : '';
};

const TIMEOUT_MS = Number(value('timeout') || 20_000);
const ONLY = (value('only') || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const PROBE_WRITES = flag('probe-writes');

/**
 * Read the endpoints out of config/config.local.js.
 *
 * The file is a browser script that assigns `window.DGO_CONFIG`, so it is evaluated in a
 * throwaway context with a `window` rather than parsed. Nothing from it is trusted beyond
 * the endpoint strings.
 */
export function readConfiguredEndpoints(file = CONFIG) {
  if (!fs.existsSync(file)) return { ok: false, reason: 'missing', endpoints: {}, auth: {} };
  let ctx;
  try {
    ctx = vm.createContext({});
    ctx.window = ctx;
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { timeout: 2000 });
  } catch (e) {
    return { ok: false, reason: `unreadable: ${e.message}`, endpoints: {}, auth: {} };
  }
  const cfg = ctx.DGO_CONFIG || {};
  const endpoints = {};
  for (const [k, v] of Object.entries(cfg.endpoints || {})) {
    const url = String(v || '').trim();
    if (url) endpoints[k] = url;
  }
  return { ok: true, endpoints, auth: cfg.auth || {} };
}

const ms = t => (t < 1000 ? `${t}ms` : `${(t / 1000).toFixed(1)}s`);

/** The profile the runtime starts with, and the one that must be enrolled. */
const DEFAULT_PROFILE_EMAIL = 'dgsregistry@nitda.gov.ng';

/**
 * Tell the operator whether they will be able to open anything.
 *
 * This is the single most confusing failure on the direct path, and it looks nothing like
 * its cause: every endpoint is green, the registry loads, and then every workspace says
 * "Access denied — this profile is not enrolled for the pilot". The runtime replaces its
 * user list from the flow response and then checks the local profile's email against it.
 */
function reportEnrolment(emails) {
  const enrolled = emails.includes(DEFAULT_PROFILE_EMAIL);
  console.log(`\nStaff enrolment — the flow returned ${emails.length} user${emails.length === 1 ? '' : 's'}.`);

  if (enrolled) {
    console.log(`  ✓ ${DEFAULT_PROFILE_EMAIL} is among them, so the default profile can open`);
    console.log('    the workspaces its role allows.');
    return;
  }

  console.log(`  ! ${DEFAULT_PROFILE_EMAIL} is NOT among them.`);
  console.log('');
  console.log('    The runtime replaces its user list with what the flows return, then gates');
  console.log('    every workspace on the signed-in profile appearing in it. Left as is, the');
  console.log('    platform will load your data and then refuse every screen with');
  console.log('    "Access denied — this profile is not enrolled for the pilot".');
  console.log('');
  console.log('    Fix it either way round:');
  console.log('      · set the local profile to an email the flow returns — open the app,');
  console.log('        go to Settings, and change the profile email; or');
  console.log('      · add your own address to the staff list the flow reads.');
  console.log('');
  const sample = emails.slice(0, 3);
  console.log(`    Addresses it returned: ${sample.join(', ')}${emails.length > sample.length ? `, +${emails.length - sample.length} more` : ''}`);
}

/** Count the rows in whatever collection the response carried, for a useful one-liner. */
function describePayload(data) {
  const body = data && typeof data === 'object' ? (data.data ?? data) : null;
  if (!body || typeof body !== 'object') return '';
  let total = 0;
  for (const v of Object.values(body)) if (Array.isArray(v)) total += v.length;
  return total ? `${total} records` : '';
}

/**
 * The staff emails a read endpoint returned.
 *
 * Worth extracting because of a failure that is otherwise very hard to diagnose: the
 * runtime REPLACES its user list with whatever the flows return, and then gates every
 * workspace on the signed-in profile's email appearing in it. Wire real endpoints whose
 * user list does not contain your email and the whole platform answers "Access denied —
 * this profile is not enrolled for the pilot", which reads like a permissions problem in
 * SharePoint rather than a local profile that needs changing.
 */
function usersIn(data) {
  const body = data && typeof data === 'object' ? (data.data ?? data) : null;
  const rows = body && (body.users || body.Users);
  if (!Array.isArray(rows)) return null;
  return rows
    .map(u => String(u?.email || u?.Email || '').trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Probe one endpoint.
 * @returns {{key:string, ok:boolean, status:number, ms:number, note:string, invoked:boolean}}
 */
export async function probe(key, url, { timeoutMs = TIMEOUT_MS, probeWrites = false } = {}) {
  const contract = EndpointContracts[key];
  const readOnly = contract?.readOnly === true;
  const invoke = readOnly || probeWrites;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const started = Date.now();

  try {
    const res = invoke
      ? await fetch(url, {
          method: contract?.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: contract?.action || key,
            payload: {},
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          }),
          signal: ctl.signal,
        })
      // Deliberately the wrong method: proves the URL and signature without running it.
      : await fetch(url, { method: 'GET', signal: ctl.signal });

    const took = Date.now() - started;
    const text = await res.text().catch(() => '');
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* not JSON; fine */ }

    if (invoke) {
      if (res.ok) {
        const detail = describePayload(data);
        // A flow can answer 200 and still report failure in the envelope.
        if (data && data.ok === false) {
          const msg = (data.errors?.[0]?.message || data.status?.message || 'flow reported failure');
          return { key, ok: false, status: res.status, ms: took, note: String(msg).slice(0, 60), invoked: true };
        }
        return { key, ok: true, status: res.status, ms: took, note: detail, invoked: true,
                 users: usersIn(data) };
      }
      return { key, ok: false, status: res.status, ms: took, note: explain(res.status), invoked: true };
    }

    // Not invoked. 405 is the good answer — the gateway accepted the signature and the
    // trigger refused the method, which is exactly what we wanted to learn.
    if (res.status === 405) {
      return { key, ok: true, status: res.status, ms: took, note: 'signature accepted, not invoked', invoked: false };
    }
    if (res.status === 401 || res.status === 403) {
      return { key, ok: false, status: res.status, ms: took, note: explain(res.status), invoked: false };
    }
    return {
      key, ok: null, status: res.status, ms: took, invoked: false,
      note: `inconclusive — ${explain(res.status) || 'unexpected for a GET probe'}`,
    };
  } catch (e) {
    const took = Date.now() - started;
    const aborted = e.name === 'AbortError';
    return {
      key, ok: false, status: 0, ms: took, invoked: false,
      note: aborted ? `no response in ${ms(timeoutMs)}` : `unreachable — ${String(e.cause?.code || e.message).slice(0, 40)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function explain(status) {
  if (status === 401 || status === 403) return 'signature rejected — rotate this one';
  if (status === 404) return 'not found — wrong URL, or the flow is deleted';
  if (status === 429) return 'throttled by Power Automate';
  if (status === 502 || status === 503) return 'flow is failing or turned off';
  if (status >= 500) return 'flow error';
  if (status === 400) return 'flow rejected the request shape';
  return '';
}

// ---------------------------------------------------------------------------

export async function run({ probeWrites = PROBE_WRITES, only = ONLY } = {}) {
  const cfg = readConfiguredEndpoints();

  if (!cfg.ok) {
    console.log(cfg.reason === 'missing'
      ? `\nNo config/config.local.js.\nRun:  node scripts/setup-endpoints.mjs\n`
      : `\nCould not read config/config.local.js — ${cfg.reason}\n`);
    return 1;
  }

  // Only the keys that take a URL are counted. Including the derived ones would report
  // them permanently "not configured" while they are in fact reachable, which reads as a
  // gap that can never be closed.
  const keys = CONFIGURABLE_KEYS.filter(k => (!only.length || only.includes(k)));
  const configured = keys.filter(k => cfg.endpoints[k]);
  const missing = keys.filter(k => !cfg.endpoints[k]);
  const aliasOf = await derivedSourceMap();
  const derivedLive = DERIVED_KEYS.filter(k => aliasOf[k] && cfg.endpoints[aliasOf[k]]);

  if (!configured.length) {
    console.log('\nNo endpoints are configured yet.\nRun:  node scripts/setup-endpoints.mjs\n');
    return 1;
  }

  if (cfg.auth?.enabled) {
    console.log('\n  Note: auth.enabled is true, so the app routes through a proxy at');
    console.log(`  ${cfg.auth.proxyBaseUrl || '(unset)'} rather than at these URLs directly.`);
    console.log('  This check probes the URLs themselves.\n');
  }

  console.log(`\nChecking ${configured.length} endpoint${configured.length === 1 ? '' : 's'}…\n`);

  const pad = Math.max(...configured.map(k => k.length));
  const results = [];

  // Sequential on purpose: a burst of parallel requests against Power Automate invites the
  // throttle, and a 429 here would read as a broken endpoint.
  for (const key of configured) {
    const r = await probe(key, cfg.endpoints[key], { probeWrites });
    results.push(r);
    const mark = r.ok === true ? '✓' : r.ok === false ? '✗' : '?';
    const status = r.status || '—';
    const line = `  ${mark} ${key.padEnd(pad)}  ${String(status).padEnd(3)}  ${ms(r.ms).padStart(5)}`;
    console.log(r.note ? `${line}  ${r.note}` : line);
  }

  // Enrolment. Collected from whichever read endpoint answered with a user list.
  const returnedUsers = results.map(r => r.users).find(u => Array.isArray(u) && u.length);

  const live = results.filter(r => r.ok === true).length;
  const bad = results.filter(r => r.ok === false);
  const unclear = results.filter(r => r.ok === null);

  console.log(`\n${live} of ${keys.length} endpoints live.  No proxy involved.`);

  if (derivedLive.length) {
    // Grouped by target, because two derived contracts need not share one.
    const byTarget = derivedLive.reduce((acc, k) => ((acc[aliasOf[k]] ??= []).push(k), acc), {});
    for (const [target, ks] of Object.entries(byTarget)) {
      console.log(`${ks.join(' and ')} reach the registry through ${target}.`);
    }
  }

  if (missing.length) {
    console.log(`\n${missing.length} not configured — the modules that use them will report it:`);
    console.log(`  ${missing.join(', ')}`);
  }
  if (unclear.length) {
    console.log(`\n${unclear.length} inconclusive. These are write flows probed WITHOUT running them,`);
    console.log('so the evidence is weaker by design. Re-run with --probe-writes to');
    console.log('invoke them for real — that will have side effects.');
  }
  if (bad.length) {
    console.log(`\n${bad.length} failed:`);
    for (const r of bad) console.log(`  ${r.key.padEnd(pad)}  ${redact(cfg.endpoints[r.key])}`);
  }

  if (returnedUsers) reportEnrolment(returnedUsers);

  console.log('');

  return bad.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (PROBE_WRITES) {
    console.log('\n  --probe-writes will INVOKE your write flows: assignments will be');
    console.log('  created and email will be sent. Ctrl-C now if that is not what you want.');
    await new Promise(r => setTimeout(r, 4000));
  }
  process.exit(await run());
}
