#!/usr/bin/env node
/**
 * Live-verification reporting tests.
 *
 * `scripts/verify-endpoints.mjs` is the step that turns "the configuration looks right"
 * into "the configuration was exercised against the live flow and here is the transcript".
 * Its assertions about the network are therefore load-bearing in a way its assertions about
 * flows are not: a verifier that misreports WHY a call failed sends someone to fix the wrong
 * thing, and they will trust it, because a transcript reads as evidence.
 *
 * One failure mode has now occurred twice, in opposite directions, and both times inside
 * this one script:
 *
 *   1. an egress filter's own 403 was read as "the flow is live and validating", and six
 *      endpoints were reported green while not one packet had reached the tenant;
 *   2. the same 403 was read as "the signature is revoked", and all 39 flows in the estate
 *      were reported refused — with advice not to repoint any key at them — on a machine
 *      whose network policy simply blocks the host.
 *
 * The second happened because the classification was duplicated rather than called. These
 * tests run the real script against a local server that answers exactly the way an
 * intercepting proxy does, and assert the report says *unreached*.
 *
 * Usage:  node tests/endpoint-verification.test.mjs
 * Exit:   0 = all assertions hold, 1 = otherwise
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'verify-endpoints.mjs');

let passed = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { failures.push(`${name}\n      ${e.message}`); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

/* ------------------------------------------------------------------ *
 * Stand-in servers, each in its own process
 *
 * They must be separate processes. Running one in this process and then calling the
 * verifier through spawnSync deadlocks: spawnSync blocks this event loop, so the server
 * cannot answer, and the child sits until its own 60-second timeout — three flows, three
 * minutes, and a test suite that looks hung rather than failed.
 * ------------------------------------------------------------------ */

async function startServer(handler) {
  const code = `
    const http = require('node:http');
    const s = http.createServer(${handler});
    s.listen(0, '127.0.0.1', () => process.stdout.write('PORT ' + s.address().port + '\\n'));
  `;
  const child = spawn(process.execPath, ['-e', code], { stdio: ['ignore', 'pipe', 'inherit'] });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the stand-in server never bound a port')), 10_000);
    child.stdout.on('data', d => {
      const m = /PORT (\d+)/.exec(String(d));
      if (m) { clearTimeout(timer); resolve(Number(m[1])); }
    });
  });
  return { child, base: `http://127.0.0.1:${port}`, stop: () => child.kill() };
}

/* The distinguishing property of an intercepted call is not the status code — Power
   Automate returns 403 too — it is that the body is not JSON. A manual HTTP trigger
   answers JSON or nothing. */
const proxy = await startServer(`(req, res) => {
  res.writeHead(403, { 'Content-Type': 'text/plain' });
  res.end('Host not in allowlist: defaultxxxx.a1.environment.api.powerplatform.com. ' +
    'Add this host to your network egress settings to allow access.');
}`);
const base = proxy.base;

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dgo-verify-'));
const cataloguePath = path.join(work, 'FLOW_CATALOGUE.json');
const reportPath = path.join(work, 'report.json');

/* Three flows, one of them wired, so the report has both shapes to classify. */
fs.writeFileSync(cataloguePath, JSON.stringify({
  catalogueFormat: 'dgo.flow-catalogue/1',
  availableFlows: [
    { workflowId: 'a'.repeat(32), flow: 'GET EMAILS', wiredTo: [], url: `${base}/a` },
    { workflowId: 'b'.repeat(32), flow: 'GET TASKS', wiredTo: [], url: `${base}/b` },
    { workflowId: 'c'.repeat(32), flow: 'GET DOCS', wiredTo: ['runtime.GET_DOCS'], url: `${base}/c` },
  ],
}, null, 2));

const run = spawnSync(process.execPath, [
  SCRIPT, '--catalogue', cataloguePath, '--json', reportPath, '--only', '__none__',
], { cwd: ROOT, encoding: 'utf8' });

proxy.stop();

const out = `${run.stdout}${run.stderr}`;

/* ------------------------------------------------------------------ *
 * Assertions
 * ------------------------------------------------------------------ */

console.log('\nLive-verification reporting\n');

check('an intercepted call is reported as unreached, not as a revoked signature', () => {
  assert(/NONE of these reached Power Automate/i.test(out),
    `the run did not identify the interception:\n${out.slice(-1200)}`);
  assert(!/Do not repoint a key at one/.test(out),
    'the run advised against repointing keys on the strength of an intercepted 403 — '
    + 'that is advice derived from the network, presented as a fact about the estate');
});

check('it says the measurement is void rather than reporting a result', () => {
  assert(/measured the network, not the estate/i.test(out),
    'a run that reached nothing must say no conclusion can be drawn, in those terms');
  assert(/egress/i.test(out), 'the run must name what to change to get a real result');
});

check('the catalogue pass reaches every flow, wired or not', () => {
  for (const id of ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']) {
    assert(out.includes(id), `${id} was never probed — the catalogue pass skipped a flow`);
  }
});

check('the JSON report carries the estate pass and no URL', () => {
  assert(fs.existsSync(reportPath), 'no report was written');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert(Array.isArray(report.estate) && report.estate.length === 3,
    `the report carries ${report.estate?.length ?? 0} estate rows, expected 3`);
  assert(report.estate.every(r => r.state === 'unreached'),
    `an intercepted probe was recorded as ${report.estate.map(r => r.state).join('/')}`);
  const raw = JSON.stringify(report);
  assert(!raw.includes(base), 'the report carries an endpoint URL — it must be safe to paste');
  assert(!new RegExp('si' + 'g=').test(raw), 'the report carries a signature parameter');
});

/* ------------------------------------------------------------------ *

   The negative control for the controls above: the same script, against a server that
   answers the way a live flow does, must NOT report interception. Without this, every
   assertion here would still pass if the script simply printed the interception banner
   unconditionally. */

const flow = await startServer(`(req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, data: { emails: [] } }));
}`);
const liveBase = flow.base;

fs.writeFileSync(cataloguePath, JSON.stringify({
  availableFlows: [{ workflowId: 'd'.repeat(32), flow: 'GET EMAILS', wiredTo: [], url: `${liveBase}/a` }],
}, null, 2));

const liveRun = spawnSync(process.execPath, [
  SCRIPT, '--catalogue', cataloguePath, '--json', reportPath, '--only', '__none__',
], { cwd: ROOT, encoding: 'utf8' });
flow.stop();

check('a flow that answers is reported live, so the banner is not unconditional', () => {
  const text = `${liveRun.stdout}${liveRun.stderr}`;
  assert(!/NONE of these reached Power Automate/i.test(text),
    'a responding flow was reported as unreached — the classification is stuck');
  assert(/1 live · 0 refused · 0 unreached/.test(text),
    `expected a live verdict, got:\n${text.slice(-800)}`);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert(report.estate[0].state === 'live', `state was ${report.estate[0].state}`);
});

fs.rmSync(work, { recursive: true, force: true });

if (failures.length) {
  console.log(`  ✖  ${failures.length} failed\n`);
  for (const f of failures) console.log(`     ${f}\n`);
  process.exit(1);
}
console.log(`  ${passed}/${passed} assertions hold\n`);
process.exit(0);
