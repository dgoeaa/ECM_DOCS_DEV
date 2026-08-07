/**
 * ENDPOINT-CHECK.html — the endpoint workbench, run from the browser, on the operator's machine.
 *
 * WHY THIS EXISTS. `npm run verify:endpoints` answers "do these flows work?" from a
 * terminal. That is the wrong machine. The browser is where the real request path is — it
 * is what actually calls the flows, under the CORS rules the flows actually apply, from the
 * network the deployment actually sits on — and until this page existed the only way to ask
 * it anything was to open the platform and try to use it, which reports a failure as a blank
 * panel.
 *
 * More practically: the terminal check cannot be run by whoever is deploying this. It needs
 * a checkout, Node, and a network path to Power Automate. The person serving a static
 * directory has a browser. So every round of "does it work?" cost a message to someone who
 * could run the CLI, and the answer came back describing a different machine's network.
 *
 * ── WHAT IT DOES, AND WHY EACH PART EARNS ITS PLACE ────────────────────────────────────
 *
 * It began as one button that probed the configured endpoints. That answered "is the
 * configuration live?" and nothing else, which is the first question of about six that live
 * testing actually asks. The rest are here now, each because the alternative was a message
 * to somebody with a terminal:
 *
 *   ENDPOINTS   Each contract, probed with the request the platform itself sends. Answers
 *               "is this key wired to something that responds?"
 *   ROUTES      One URL can carry many routes — SUBSIDIARY_ACTIONS carries eighteen. A flow
 *               that answers on its first route and has no case for the other seventeen
 *               passes the endpoint check and fails at an officer's desk. This probes every
 *               declared route separately, which is the difference between "the flow is
 *               live" and "the flow implements what the client will send it".
 *   CONSOLE     Free-form. Pick any URL the package knows, edit the body, send it, read the
 *               whole response. Every canned probe is a guess about what the flow wants;
 *               when the guess is wrong the next move is to try something else, and that
 *               required a terminal until now.
 *   ESTATE      All flows the documented estate provides, including the ones no contract key
 *               calls, with a reachability probe and a repoint helper that writes the
 *               values-file line for you.
 *   REPORT      Everything the session did, as JSON, downloadable — with signatures stripped
 *               so it can be pasted into an issue.
 *   ENVIRONMENT What this browser is and what that implies for the calls, because half of
 *               all "it doesn't work" is the page having been opened the wrong way.
 *
 * ── WHAT IT REFUSES TO CONFLATE ────────────────────────────────────────────────────────
 *
 * A call can fail in four ways that look alike and mean entirely different things, and
 * getting them wrong sends someone to fix something that is not broken:
 *
 *   the flow answered          2xx, or a 4xx the flow itself produced
 *   the signature is refused   401/403 carrying a Power Automate body
 *   the flow is not there      404 on the trigger path
 *   nothing was reached        a network error, a CORS rejection, or a non-JSON body from
 *                              an intermediary — a corporate filter, a captive portal
 *
 * The fourth is the one that matters most and is invisible to the page's own code: a
 * cross-origin fetch blocked by CORS throws with NO status and NO body, indistinguishable
 * from the host being down. The page says exactly that rather than guessing, because
 * "signature revoked" and "your browser refused to make the call" lead to opposite actions.
 *
 * ONE CLASSIFIER, used by all four probe paths. Duplicating it is how the terminal verifier
 * came to report an egress filter's 403 first as a live flow and later as a revoked
 * signature — the same mistake in both directions, fifty lines apart in one file.
 *
 * ⚠  IT READS THE PROVISIONED URLS, so it must be served from the package. It carries no
 * signature of its own, and the report it exports carries none either.
 */

import { probeTables } from './endpoint-probes.mjs';
import { EndpointContracts } from '../../config/endpoints.config.js';

const PROBE_EMAIL = 'dgo.probe@example.invalid';

export function renderEndpointCheckPage(surfaceId, surface, meta) {
  const runtime = surfaceId === 'runtime';
  const { RUNTIME_PROBES, PORTAL_PROBES } = probeTables({
    probeEmail: PROBE_EMAIL,
    runId: '__RUN_ID__',
  });
  const probes = runtime ? RUNTIME_PROBES : PORTAL_PROBES;

  /* WHICH PROBES MUTATE.
     Derived from the contracts for the runtime and from the probe table for the portal —
     the same two authorities `scripts/verify-endpoints.mjs` uses, so the browser and the
     terminal cannot disagree about what is safe to run unattended.

     It is keyed off the PROBE table, not the endpoint list. Two contracts — DISPATCH_OUTBOUND
     and ARCHIVE_REFERENCE — have no endpoint entry of their own because they ride the
     DYNAMIC_ACTIONS URL, so an endpoint-keyed set left both out and the page dispatched
     correspondence and archived a reference without the write box ticked. */
  const writeKeys = runtime
    ? Object.keys(RUNTIME_PROBES).filter(k => !EndpointContracts[k]?.readOnly)
    : Object.entries(PORTAL_PROBES).filter(([, p]) => p.write !== false).map(([k]) => k);

  /* Every declared route, flattened, with the URL key it rides. This is what the ROUTES tab
     walks: 39 on the runtime against 20 endpoint probes, because the shared flows carry
     most of them. */
  const routes = surface.endpoints.flatMap(e => e.actions
    .filter(a => a !== '(raw PUT)')
    .map(action => ({
      key: e.key,
      action,
      transport: e.transport,
      sourceKey: e.sourceKey || e.key,
      /* A route is a write unless its own key is a read-only contract. Conservative on
         purpose: an unrecognised route on a write-capable flow is treated as a write. */
      write: runtime ? !EndpointContracts[e.key]?.readOnly : writeKeys.includes(e.key),
    })));

  const data = {
    surface: surfaceId,
    platform: surface.label,
    globalName: surface.globalName,
    configPath: surface.configPath,
    envPrefix: surface.envPrefixes[0],
    buildId: meta.buildId,
    builtAt: meta.builtAt,
    probes,
    writeKeys,
    routes,
    endpoints: surface.endpoints.map(e => ({
      key: e.key, transport: e.transport, pilot: Boolean(e.pilot), note: e.note,
      actions: e.actions, sourceKey: e.sourceKey || e.key,
    })),
  };

  return PAGE(data);
}

const PAGE = data => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Endpoint workbench — ${esc(data.platform)}</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff; --fg: #15181d; --muted: #5b6472; --line: #d9dee6;
    --ok: #0f7b3f; --warn: #8a5a00; --bad: #b3261e; --void: #4b5563;
    --card: #f6f8fa; --accent: #1a56db; --code: #eef1f5;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1216; --fg: #e6e9ee; --muted: #9aa4b2; --line: #2a313b;
      --ok: #4ade80; --warn: #fbbf24; --bad: #f87171; --void: #9aa4b2;
      --card: #161b22; --accent: #7aa2f7; --code: #10141a;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 1.5rem 1rem 5rem; background: var(--bg); color: var(--fg);
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 1150px; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin: 0 0 .2rem; }
  .sub { color: var(--muted); margin: 0 0 1rem; font-size: .875rem; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 1rem 1.1rem; margin-bottom: 1.1rem; }
  .card h2 { font-size: 1rem; margin: 0 0 .5rem; }
  .card h3 { font-size: .9rem; margin: 1.1rem 0 .4rem; }
  .card p { margin: .35rem 0; color: var(--muted); font-size: .86rem; }
  button { font: inherit; font-weight: 600; padding: .55rem 1rem; border-radius: 8px;
    border: 1px solid var(--line); background: var(--fg); color: var(--bg); cursor: pointer; }
  button[disabled] { opacity: .45; cursor: progress; }
  button.secondary { background: transparent; color: var(--fg); font-weight: 500; }
  label.opt { display: block; margin: .35rem 0; font-size: .86rem; cursor: pointer; }
  label.opt input { margin-right: .5rem; }
  .controls { display: flex; gap: .6rem; flex-wrap: wrap; align-items: center; margin-top: .8rem; }
  select, input[type=text], textarea {
    font: inherit; padding: .45rem .6rem; border-radius: 7px; border: 1px solid var(--line);
    background: var(--bg); color: var(--fg); max-width: 100%; }
  textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px;
    width: 100%; min-height: 8rem; resize: vertical; }
  select, input[type=text] { min-width: 12rem; }
  /* Tabs */
  nav.tabs { display: flex; gap: .3rem; flex-wrap: wrap; border-bottom: 1px solid var(--line);
    margin-bottom: 1.1rem; padding-bottom: .1rem; }
  nav.tabs button { background: transparent; color: var(--muted); border: 0;
    border-bottom: 2px solid transparent; border-radius: 0; padding: .55rem .8rem;
    font-weight: 600; font-size: .9rem; }
  nav.tabs button[aria-selected=true] { color: var(--fg); border-bottom-color: var(--accent); }
  section[hidden] { display: none; }
  .scroller { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table { border-collapse: collapse; width: 100%; font-size: .86rem; min-width: 640px; }
  th, td { text-align: left; padding: .45rem .55rem; border-bottom: 1px solid var(--line);
    vertical-align: top; }
  th { font-size: .72rem; letter-spacing: .04em; text-transform: uppercase; color: var(--muted);
    position: sticky; top: 0; background: var(--card); }
  td.key { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .v { font-weight: 600; white-space: nowrap; }
  .v.ok { color: var(--ok); } .v.bad { color: var(--bad); }
  .v.warn { color: var(--warn); } .v.void { color: var(--void); }
  .why { color: var(--muted); font-size: .83rem; }
  .keys { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .77rem;
    color: var(--muted); word-break: break-word; }
  pre { background: var(--code); border: 1px solid var(--line); border-radius: 7px;
    padding: .7rem .8rem; overflow-x: auto; font-size: 12.5px; margin: .5rem 0;
    max-height: 26rem; overflow-y: auto; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85em;
    background: var(--code); padding: .1rem .3rem; border-radius: 4px; }
  .tally { display: flex; gap: 1.4rem; flex-wrap: wrap; margin: .9rem 0 .3rem; font-size: .88rem; }
  .tally b { font-size: 1.3rem; display: block; font-weight: 700; }
  .banner { border-left: 4px solid var(--warn); padding: .7rem .9rem; margin: .9rem 0;
    background: var(--card); border-radius: 0 8px 8px 0; }
  .banner.bad { border-left-color: var(--bad); }
  .banner.good { border-left-color: var(--ok); }
  .banner h3 { margin: 0 0 .3rem; font-size: .92rem; }
  .banner p { margin: .25rem 0; font-size: .86rem; color: var(--fg); }
  .row { display: flex; gap: .6rem; flex-wrap: wrap; align-items: flex-end; margin: .6rem 0; }
  .row > div { display: flex; flex-direction: column; gap: .25rem; }
  .row label { font-size: .76rem; text-transform: uppercase; letter-spacing: .04em;
    color: var(--muted); font-weight: 600; }
  .pill { display: inline-block; font-size: .7rem; padding: .1rem .4rem; border-radius: 999px;
    border: 1px solid var(--line); color: var(--muted); margin-left: .35rem; }
  .kv { display: grid; grid-template-columns: max-content 1fr; gap: .2rem .9rem;
    font-size: .85rem; margin: .5rem 0; }
  .kv dt { color: var(--muted); }
  .kv dd { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    word-break: break-all; }
  @media (max-width: 640px) { body { padding: 1rem .7rem 5rem; } .kv { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<main>
  <h1>Endpoint workbench</h1>
  <p class="sub">${esc(data.platform)} &middot; build <code>${esc(data.buildId)}</code>
    &middot; packaged ${esc(data.builtAt)}</p>

  <nav class="tabs" role="tablist">
    <button role="tab" data-tab="check"   aria-selected="true">Endpoints</button>
    <button role="tab" data-tab="routes"  aria-selected="false">Routes</button>
    <button role="tab" data-tab="console" aria-selected="false">Console</button>
    <button role="tab" data-tab="estate"  aria-selected="false">Estate</button>
    <button role="tab" data-tab="report"  aria-selected="false">Report</button>
    <button role="tab" data-tab="env"     aria-selected="false">Environment</button>
  </nav>

  <!-- ── ENDPOINTS ─────────────────────────────────────────────────────────── -->
  <section id="tab-check">
    <div class="card">
      <h2>Every configured endpoint</h2>
      <p>Calls each flow this package is configured to call, <strong>from this browser</strong>,
        the same way the platform does &mdash; same URL out of
        <code>${esc(data.configPath)}</code>, same method, same request shape. It reports what
        came back.</p>
      <p>Nothing is sent anywhere except to the flows themselves, and no signature is ever
        displayed or copied into a report.</p>
      <div class="controls">
        <button id="run">Run the check</button>
        <button class="secondary" id="runOne">Run one&hellip;</button>
      </div>
      <label class="opt"><input type="checkbox" id="writes">
        Include write probes &mdash; these create real records, tagged
        <code>__DGO_PROBE__</code> and a run id</label>
      <label class="opt"><input type="checkbox" id="bodies">
        Show the full response body for every probe</label>
    </div>
    <div id="out"></div>
  </section>

  <!-- ── ROUTES ────────────────────────────────────────────────────────────── -->
  <section id="tab-routes" hidden>
    <div class="card">
      <h2>Every declared route</h2>
      <p>One URL can carry many routes: the flow switches on the discriminator in the body.
        <strong>${data.routes.length} routes across ${data.endpoints.length} endpoints</strong>
        &mdash; <code>SUBSIDIARY_ACTIONS</code> alone carries eighteen.</p>
      <p>A flow that answers on its first route and has no case for the rest passes the
        Endpoints tab and fails at an officer's desk. This sends each route separately.</p>
      <div class="banner">
        <h3>Read this before trusting a green row</h3>
        <p>A route probe proves the flow <em>accepted</em> a request carrying that
          discriminator. It cannot prove the flow <em>implements</em> it: a flow whose switch
          has a permissive default answers 200 to a route it does nothing with. Treat a green
          row as "not refused", and confirm behaviour by looking at what the flow actually
          did.</p>
        <p>The discriminator is sent as both <code>action</code> and <code>name</code>,
          because the documented estate uses both conventions and no single one is right for
          every flow.</p>
      </div>
      <div class="controls">
        <button id="runRoutes">Probe every route</button>
      </div>
      <label class="opt"><input type="checkbox" id="routeWrites">
        Include routes that mutate &mdash; most of these do</label>
    </div>
    <div id="routesOut"></div>
  </section>

  <!-- ── CONSOLE ───────────────────────────────────────────────────────────── -->
  <section id="tab-console" hidden>
    <div class="card">
      <h2>Send a request</h2>
      <p>Every canned probe above is a guess about what a flow wants. When the guess is
        wrong, the next move is to try something else &mdash; and that needed a terminal
        until now.</p>
      <div class="row">
        <div style="flex:1 1 22rem">
          <label for="cTarget">Target</label>
          <select id="cTarget" style="width:100%"></select>
        </div>
        <div>
          <label for="cMethod">Method</label>
          <select id="cMethod">
            <option>POST</option><option>PUT</option><option>GET</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div style="flex:1 1 100%">
          <label for="cBody">Request body (JSON)</label>
          <textarea id="cBody" spellcheck="false"></textarea>
        </div>
      </div>
      <div class="controls">
        <button id="cSend">Send</button>
        <button class="secondary" id="cPretty">Format JSON</button>
        <button class="secondary" id="cReset">Load the contract probe</button>
      </div>
      <p id="cWarn" class="why"></p>
    </div>
    <div id="consoleOut"></div>
  </section>

  <!-- ── ESTATE ────────────────────────────────────────────────────────────── -->
  <section id="tab-estate" hidden>
    <div class="card">
      <h2>Every flow the estate provides</h2>
      <p>Including the ones no contract key calls. A flow that exists and answers used to be
        indistinguishable from one that had been overlooked.</p>
      <div class="banner">
        <h3>These are reachability probes only</h3>
        <p>An empty body, so the only thing read off the answer is whether the signature
          authenticated. <strong>Live means the URL is live. It does not mean the flow does
          what its name suggests.</strong></p>
      </div>
      <div class="row">
        <div style="flex:1 1 16rem">
          <label for="eFilter">Filter</label>
          <input type="text" id="eFilter" placeholder="name, workflow id, or the key that calls it" style="width:100%">
        </div>
      </div>
      <div class="controls">
        <button id="runEstate">Probe every flow</button>
        <button class="secondary" id="loadEstate">List them without probing</button>
      </div>
    </div>
    <div class="card" id="repointCard" hidden>
      <h2>Point a key at a different flow</h2>
      <p>Produces the line for a values file. Supplied values always beat the documented
        estate, and only the keys you name change.</p>
      <div class="row">
        <div><label for="rKey">Contract key</label><select id="rKey"></select></div>
        <div style="flex:1 1 18rem"><label for="rFlow">Flow</label><select id="rFlow" style="width:100%"></select></div>
      </div>
      <div class="controls"><button class="secondary" id="rMake">Write the line</button></div>
      <pre id="rOut" hidden></pre>
      <p class="why">Then: <code>npm run package -- --values &lt;file&gt;</code> and redeploy.</p>
    </div>
    <div id="estateOut"></div>
  </section>

  <!-- ── REPORT ────────────────────────────────────────────────────────────── -->
  <section id="tab-report" hidden>
    <div class="card">
      <h2>Everything this session did</h2>
      <p>One transcript across all four probe paths. <strong>No URL and no signature reaches
        it</strong>, so it is safe to paste into an issue or attach to a ticket.</p>
      <div class="controls">
        <button id="repDownload">Download JSON</button>
        <button class="secondary" id="repCopy">Copy as text</button>
        <button class="secondary" id="repClear">Clear</button>
      </div>
    </div>
    <div id="reportOut"></div>
  </section>

  <!-- ── ENVIRONMENT ───────────────────────────────────────────────────────── -->
  <section id="tab-env" hidden>
    <div class="card">
      <h2>What this browser is</h2>
      <p>Half of "it doesn't work" is the page having been opened the wrong way. This is what
        the calls are actually being made from.</p>
      <div id="envOut"></div>
    </div>
    <div class="card">
      <h2>Reading a result</h2>
      <p><span class="v ok">answered</span> &mdash; the flow replied. If it replied without
        the keys the platform reads, that is named, and it is the finding worth having: the
        flow is live but its response does not carry what the client needs.</p>
      <p><span class="v ok">refused</span> &mdash; a 4xx the flow itself produced. The flow is
        live and validating its input. For <code>UPLOAD</code> and <code>STATUS</code> a
        refusal is the correct answer and is marked as a pass.</p>
      <p><span class="v bad">signature</span> &mdash; 401 or 403 from Power Automate. The
        trigger URL was regenerated, or it never authenticated. Rotate and rebuild.</p>
      <p><span class="v bad">no flow</span> &mdash; 404 on the trigger path. The flow was
        deleted or the URL is stale.</p>
      <p><span class="v void">not reached</span> &mdash; the call never got an answer from
        Power Automate. A browser CORS rejection, an offline network, or something in the
        middle answering instead. <strong>This says nothing about the endpoint.</strong> A
        CORS rejection gives this page no status and no body, so it cannot be told apart from
        the host being unreachable &mdash; and neither is evidence that the signature is
        wrong.</p>
    </div>
  </section>
</main>

<script src="${esc(data.configPath)}" onerror="window.__CONFIG_MISSING=1"></script>
<script>
"use strict";
const DATA = ${JSON.stringify({
    surface: data.surface, platform: data.platform, globalName: data.globalName,
    configPath: data.configPath, envPrefix: data.envPrefix, buildId: data.buildId,
    probes: data.probes, writeKeys: data.writeKeys, routes: data.routes,
    endpoints: data.endpoints,
  })};

const RUN_ID = 'probe-' + Date.now().toString(36);
const el = (t, cls, txt) => { const n = document.createElement(t);
  if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const $ = id => document.getElementById(id);

/* Every probe body carries the run id, so anything a write probe creates can be found. */
const withRunId = o => JSON.parse(JSON.stringify(o).split('__RUN_ID__').join(RUN_ID));

function endpoints() {
  const cfg = window[DATA.globalName];
  if (window.__CONFIG_MISSING || !cfg) return null;
  return cfg.endpoints || {};
}

/* ------------------------------------------------------------------ *
 * The classifier — ONE of it, used by all four probe paths
 * ------------------------------------------------------------------ */

/**
 * \`parsed === false\` is checked before status for the reason spelled out on the
 * Environment tab: a Power Automate manual trigger answers JSON or nothing, so a non-JSON
 * body means something in the middle answered. Reading an intermediary's 403 as "the flow
 * refused you" is how a network problem gets diagnosed as a credential problem.
 */
function verdict(r, spec) {
  spec = spec || {};
  if (r.threw) {
    return { cls: 'void', label: 'not reached', reached: false, ok: false,
      why: r.error + ' \\u2014 a CORS rejection, an offline network or a blocked host. '
        + 'This gives no status and no body, so it is not evidence about the endpoint.' };
  }
  if (r.parsed === false) {
    return { cls: 'void', label: 'not reached', reached: false, ok: false,
      why: 'answered ' + r.status + ' with a non-JSON body \\u2014 that did not come from '
        + 'Power Automate. Something in the middle answered.' };
  }
  if (spec.expectStatus && spec.expectStatus.indexOf(r.status) !== -1) {
    return { cls: 'ok', label: 'refused', reached: true, ok: true,
      why: r.status + ' \\u2014 ' + (spec.expectStatusWhy || 'the documented response for this probe') };
  }
  if (r.status === 401 || r.status === 403) {
    return { cls: 'bad', label: 'signature', reached: true, ok: false,
      why: r.status + ' \\u2014 the trigger signature is wrong or has been regenerated' };
  }
  if (r.status === 404) {
    return { cls: 'bad', label: 'no flow', reached: true, ok: false,
      why: '404 on the trigger path \\u2014 the flow is gone or the URL is stale' };
  }
  if (r.status >= 500) {
    return { cls: 'bad', label: 'flow error', reached: true, ok: false,
      why: r.status + ' \\u2014 the flow was reached and failed inside itself' };
  }
  if (r.status >= 400) {
    return { cls: 'ok', label: 'refused', reached: true, ok: true,
      why: r.status + ' \\u2014 the flow is live and validating its input' };
  }
  if (r.missing && r.missing.length) {
    return { cls: 'warn', label: 'answered', reached: true, ok: true,
      why: 'answered without ' + r.missing.join(', ') + ' \\u2014 the flow is live, but its '
        + 'response does not carry what the platform reads' };
  }
  return { cls: 'ok', label: 'answered', reached: true, ok: true, why: 'answered' };
}

/* ------------------------------------------------------------------ *
 * The call
 * ------------------------------------------------------------------ */

async function call(url, spec) {
  spec = spec || {};
  const started = performance.now();
  const r = { ms: 0 };
  try {
    let init;
    if (spec.transport === 'bytes') {
      const payload = new TextEncoder().encode('__DGO_PROBE__ ' + RUN_ID + '\\n');
      const digest = await crypto.subtle.digest('SHA-256', payload);
      init = { method: 'PUT', body: payload, headers: {
        'Content-Type': 'application/octet-stream',
        'X-DGO-Filename': spec.filename || '__DGO_PROBE__.bin',
        'X-DGO-Size': String(payload.length),
        'X-DGO-Sha256': [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join(''),
        'X-DGO-Probe': RUN_ID,
      } };
    } else if (spec.method === 'GET') {
      init = { method: 'GET' };
    } else {
      const body = Object.assign({}, withRunId(spec.body || {}), { __probe: RUN_ID });
      init = { method: spec.method || 'POST', body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' } };
      r.sent = body;
    }
    const res = await fetch(url, init);
    r.ms = Math.round(performance.now() - started);
    r.status = res.status;
    r.statusText = res.statusText;
    r.headers = {};
    /* Only the headers CORS actually exposes to a cross-origin reader. The rest are not
       missing from the response, they are withheld from this page — worth saying, because
       an empty header list otherwise reads as a broken flow. */
    res.headers.forEach((v, k) => { r.headers[k] = v; });
    const text = await res.text();
    r.bytes = text.length;
    r.raw = text.length > 200000 ? text.slice(0, 200000) + '\\n\\u2026 truncated for display' : text;
    try {
      const json = JSON.parse(text);
      r.parsed = true;
      r.json = json;
      r.keys = json && typeof json === 'object' && !Array.isArray(json) ? Object.keys(json) : [];
      /* The documented envelope is { ok, status, request, timing, meta, data } and the
         payload the platform reads lives inside \`data\`. Checking only the top level
         reports correctly-shaped responses as gaps, and a check that cries wolf is ignored
         on the run where it is right. */
      const inner = json && json.data && typeof json.data === 'object' && !Array.isArray(json.data)
        ? Object.keys(json.data) : null;
      r.dataKeys = inner;
      /* The declared shape describes a SUCCESS. Checking it against a refusal reports a
         contract gap on a flow that is behaving correctly. */
      if (spec.expect && res.status < 400) {
        const atTop = spec.expect.filter(k => r.keys.indexOf(k) === -1);
        const inData = inner ? spec.expect.filter(k => inner.indexOf(k) === -1) : atTop;
        r.missing = inData.length <= atTop.length ? inData : atTop;
        r.matchedIn = r.missing.length === 0 && atTop.length > 0 ? 'data' : 'top-level';
      }
    } catch (e) {
      r.parsed = false;
      r.snippet = text.slice(0, 200).replace(/\\s+/g, ' ');
    }
  } catch (e) {
    r.ms = Math.round(performance.now() - started);
    r.threw = true;
    r.error = e && e.message ? e.message : String(e);
  }
  return r;
}

/* ------------------------------------------------------------------ *
 * The transcript
 *
 * Appended to by every probe path. Deliberately holds no url and no signature: a report
 * that cannot be pasted into an issue is a report nobody sends.
 * ------------------------------------------------------------------ */

const TRANSCRIPT = [];
function record(kind, name, r, v, extra) {
  TRANSCRIPT.push(Object.assign({
    at: new Date().toISOString(), kind: kind, name: name,
    status: r.status == null ? null : r.status, ms: r.ms,
    state: v.label, reached: v.reached, ok: v.ok, why: v.why,
    responseKeys: r.keys || null, dataKeys: r.dataKeys || null,
    missing: r.missing || null, error: r.error || null,
  }, extra || {}));
  renderReport();
}

/* ------------------------------------------------------------------ *
 * Shared rendering
 * ------------------------------------------------------------------ */

function table(cols, minWidth) {
  const t = el('table');
  if (minWidth) t.style.minWidth = minWidth;
  const head = el('tr');
  cols.forEach(c => head.appendChild(el('th', null, c)));
  const thead = el('thead'); thead.appendChild(head); t.appendChild(thead);
  const tb = el('tbody'); t.appendChild(tb);
  const wrap = el('div', 'scroller'); wrap.appendChild(t);
  return { wrap: wrap, body: tb };
}

function banner(kind, title, lines) {
  const b = el('div', 'banner' + (kind === 'bad' ? ' bad' : kind === 'good' ? ' good' : ''));
  b.appendChild(el('h3', null, title));
  lines.forEach(l => b.appendChild(el('p', null, l)));
  return b;
}

function tallyOf(pairs) {
  const t = el('div', 'tally');
  pairs.forEach(function (p) {
    const d = el('div'); d.appendChild(el('b', null, String(p[1])));
    d.appendChild(document.createTextNode(p[0])); t.appendChild(d);
  });
  return t;
}

function detailCell(r, v, showBody) {
  const td = el('td', 'why');
  td.appendChild(document.createTextNode(v.why));
  if (r.keys && r.keys.length) {
    td.appendChild(el('div', 'keys', 'keys: ' + r.keys.join(', ')));
    if (r.matchedIn === 'data') {
      td.appendChild(el('div', 'keys', 'inside data: ' + r.dataKeys.join(', ')));
    }
  }
  if (r.snippet) td.appendChild(el('div', 'keys', r.snippet));
  if (showBody && r.raw) {
    const pre = el('pre', null, r.parsed ? JSON.stringify(r.json, null, 2) : r.raw);
    td.appendChild(pre);
  }
  return td;
}

function noConfigBanner() {
  return banner('bad', 'No endpoint configuration was loaded', [
    DATA.configPath + ' did not load. Serve this directory over HTTP rather than opening the '
      + 'file directly \\u2014 a page opened from disk cannot load its own scripts in most '
      + 'browsers. From this directory: python3 -m http.server 8080',
    'A self-contained copy of this page, with the configuration inlined and no other file '
      + 'needed, can be produced from the package with the bundling script.',
  ]);
}

/* ------------------------------------------------------------------ *
 * 1 · Endpoints
 * ------------------------------------------------------------------ */

async function runCheck(onlyKey) {
  const btn = $('run'); btn.disabled = true; $('runOne').disabled = true;
  const out = $('out'); out.textContent = '';

  const eps = endpoints();
  if (!eps) { out.appendChild(noConfigBanner()); btn.disabled = false; $('runOne').disabled = false; return; }

  const includeWrites = $('writes').checked;
  const showBody = $('bodies').checked;
  const card = el('div', 'card');
  card.appendChild(el('h2', null, onlyKey ? 'Endpoint \\u2014 ' + onlyKey : 'Configured endpoints'));
  const t = table(['Endpoint', 'Result', 'HTTP', 'ms', 'What came back']);
  card.appendChild(t.wrap);
  out.appendChild(card);

  const rows = [];
  for (const key of Object.keys(DATA.probes)) {
    if (onlyKey && key !== onlyKey) continue;
    const spec = DATA.probes[key];
    const urlKey = spec.via || key;
    const url = (eps[urlKey] || '').trim();
    const tr = el('tr');
    tr.appendChild(el('td', 'key', key + (spec.via ? ' \\u2192 ' + spec.via : '')));

    if (!url) {
      tr.appendChild(el('td', 'v void', 'unset'));
      tr.appendChild(el('td', 'num', '\\u2014'));
      tr.appendChild(el('td', 'num', '\\u2014'));
      tr.appendChild(el('td', 'why', 'not provisioned \\u2014 the feature it serves reports '
        + 'itself unconfigured rather than failing mid-action'));
      t.body.appendChild(tr); continue;
    }
    if (DATA.writeKeys.indexOf(key) !== -1 && !includeWrites) {
      tr.appendChild(el('td', 'v void', 'skipped'));
      tr.appendChild(el('td', 'num', '\\u2014'));
      tr.appendChild(el('td', 'num', '\\u2014'));
      tr.appendChild(el('td', 'why', 'mutates \\u2014 tick "include write probes" to exercise it'));
      t.body.appendChild(tr); continue;
    }

    tr.appendChild(el('td', 'v void', 'calling\\u2026'));
    tr.appendChild(el('td', 'num', ''));
    tr.appendChild(el('td', 'num', ''));
    tr.appendChild(el('td', 'why', ''));
    t.body.appendChild(tr);
    await new Promise(r => requestAnimationFrame(r));

    const res = await call(url, spec);
    const v = verdict(res, spec);
    rows.push({ key: key, v: v, res: res });
    record('endpoint', key, res, v, { via: spec.via || null });

    tr.children[1].className = 'v ' + v.cls;
    tr.children[1].textContent = v.label;
    tr.children[2].textContent = res.status != null ? res.status : '\\u2014';
    tr.children[3].textContent = res.ms;
    tr.replaceChild(detailCell(res, v, showBody), tr.children[4]);
  }

  const reached = rows.filter(r => r.v.reached);
  const good = rows.filter(r => r.v.ok);
  card.insertBefore(tallyOf([['answered acceptably', good.length],
    ['reached the flow', reached.length], ['probed', rows.length]]), t.wrap);

  if (rows.length && reached.length === 0) {
    card.insertBefore(banner('bad', 'Nothing reached Power Automate', [
      'Every call was answered by something other than the flows, or by nothing at all. '
        + 'This run measured your network, not your endpoints \\u2014 no conclusion about the '
        + 'configuration can be drawn from it either way.',
      'The usual causes, in order: the page was opened from disk instead of served over '
        + 'HTTP; the flows do not return CORS headers for this origin; or an egress filter '
        + 'between this browser and *.environment.api.powerplatform.com. The Environment tab '
        + 'says which of those this page can rule out.',
    ]), card.querySelector('.tally'));
  } else if (rows.some(r => r.v.cls === 'bad')) {
    card.insertBefore(banner('warn', 'Some flows were reached and did not answer acceptably', [
      'These reached Power Automate, so the finding is about the flow or its signature '
        + 'rather than about the network. Each row says which.',
    ]), card.querySelector('.tally'));
  } else if (rows.length) {
    card.insertBefore(banner('good', 'Every probed endpoint answered acceptably', [
      'Next: the Routes tab. An endpoint that answers is not the same as a flow that '
        + 'implements every route the client will send it.',
    ]), card.querySelector('.tally'));
  }

  btn.disabled = false; $('runOne').disabled = false;
}

/* ------------------------------------------------------------------ *
 * 2 · Routes
 * ------------------------------------------------------------------ */

async function runRoutes() {
  const btn = $('runRoutes'); btn.disabled = true;
  const out = $('routesOut'); out.textContent = '';
  const eps = endpoints();
  if (!eps) { out.appendChild(noConfigBanner()); btn.disabled = false; return; }

  const includeWrites = $('routeWrites').checked;
  const card = el('div', 'card');
  card.appendChild(el('h2', null, 'Routes \\u2014 ' + DATA.routes.length + ' declared'));
  const t = table(['Route', 'On endpoint', 'Result', 'HTTP', 'ms', 'What came back'], '760px');
  card.appendChild(t.wrap);
  out.appendChild(card);

  const rows = [];
  for (const rt of DATA.routes) {
    const url = (eps[rt.key] || '').trim();
    const tr = el('tr');
    tr.appendChild(el('td', 'key', rt.action));
    tr.appendChild(el('td', 'key', rt.key));
    if (!url) {
      tr.appendChild(el('td', 'v void', 'unset'));
      tr.appendChild(el('td', 'num', '\\u2014')); tr.appendChild(el('td', 'num', '\\u2014'));
      tr.appendChild(el('td', 'why', 'the endpoint carrying this route is not provisioned'));
      t.body.appendChild(tr); continue;
    }
    if (rt.write && !includeWrites) {
      tr.appendChild(el('td', 'v void', 'skipped'));
      tr.appendChild(el('td', 'num', '\\u2014')); tr.appendChild(el('td', 'num', '\\u2014'));
      tr.appendChild(el('td', 'why', 'mutates \\u2014 tick the box above to exercise it'));
      t.body.appendChild(tr); continue;
    }

    tr.appendChild(el('td', 'v void', 'calling\\u2026'));
    tr.appendChild(el('td', 'num', '')); tr.appendChild(el('td', 'num', ''));
    tr.appendChild(el('td', 'why', ''));
    t.body.appendChild(tr);
    await new Promise(r => requestAnimationFrame(r));

    /* Both conventions at once. The documented estate discriminates on \`action\` in some
       flows and \`name\` in others, and sending one of them would report a flow as missing a
       route it implements under the other spelling. */
    const spec = rt.transport === 'bytes'
      ? { transport: 'bytes' }
      : { body: { action: rt.action, name: rt.action, userEmail: '${PROBE_EMAIL}' } };
    const res = await call(url, spec);
    const v = verdict(res, {});
    rows.push({ v: v });
    record('route', rt.key + '.' + rt.action, res, v, { endpoint: rt.key });

    tr.children[2].className = 'v ' + v.cls;
    tr.children[2].textContent = v.label;
    tr.children[3].textContent = res.status != null ? res.status : '\\u2014';
    tr.children[4].textContent = res.ms;
    tr.replaceChild(detailCell(res, v, false), tr.children[5]);
  }

  const reached = rows.filter(r => r.v.reached).length;
  const good = rows.filter(r => r.v.ok).length;
  card.insertBefore(tallyOf([['not refused', good], ['reached the flow', reached],
    ['probed', rows.length]]), t.wrap);
  btn.disabled = false;
}

/* ------------------------------------------------------------------ *
 * 3 · Console
 * ------------------------------------------------------------------ */

function consoleTargets() {
  const eps = endpoints() || {};
  const out = [];
  DATA.endpoints.forEach(function (e) {
    if (eps[e.key]) out.push({ label: e.key + '  \\u2014  ' + e.note, url: eps[e.key], key: e.key });
  });
  (window.__ESTATE || []).forEach(function (f) {
    out.push({ label: 'estate: ' + (f.flow || f.workflowId.slice(0, 8))
      + (f.wiredTo && f.wiredTo.length ? '  (' + f.wiredTo.join(', ') + ')' : '  (no key)'),
      url: f.url, key: null });
  });
  return out;
}

function fillConsoleTargets() {
  const sel = $('cTarget');
  const prev = sel.value;
  sel.textContent = '';
  const targets = consoleTargets();
  if (!targets.length) {
    sel.appendChild(el('option', null, 'no configuration loaded'));
    $('cWarn').textContent = DATA.configPath + ' did not load, so there is nothing to call.';
    return;
  }
  targets.forEach(function (t, i) {
    const o = el('option', null, t.label);
    o.value = String(i);
    sel.appendChild(o);
  });
  window.__C_TARGETS = targets;
  if (prev && targets[Number(prev)]) sel.value = prev;
  loadContractProbe();
}

function loadContractProbe() {
  const t = (window.__C_TARGETS || [])[Number($('cTarget').value)];
  if (!t) return;
  const spec = t.key ? DATA.probes[t.key] : null;
  const body = spec && spec.body ? withRunId(spec.body) : { action: '', userEmail: '${PROBE_EMAIL}' };
  $('cBody').value = JSON.stringify(body, null, 2);
  const isWrite = t.key && DATA.writeKeys.indexOf(t.key) !== -1;
  $('cWarn').textContent = isWrite
    ? 'This endpoint MUTATES. Anything it creates is tagged __DGO_PROBE__ and ' + RUN_ID + '.'
    : (t.key ? 'This endpoint is read-only by its contract.'
             : 'An estate flow with no contract here \\u2014 its request shape is unknown, so the body is yours to write.');
}

async function consoleSend() {
  const t = (window.__C_TARGETS || [])[Number($('cTarget').value)];
  if (!t) return;
  const btn = $('cSend'); btn.disabled = true;
  const out = $('consoleOut'); out.textContent = '';
  const method = $('cMethod').value;

  let body = {};
  if (method !== 'GET') {
    try { body = JSON.parse($('cBody').value || '{}'); }
    catch (e) {
      out.appendChild(banner('bad', 'The request body is not valid JSON', [String(e.message || e)]));
      btn.disabled = false; return;
    }
  }

  const card = el('div', 'card');
  card.appendChild(el('h2', null, 'Response'));
  card.appendChild(el('p', null, 'calling\\u2026'));
  out.appendChild(card);

  const res = await call(t.url, { method: method, body: body });
  const v = verdict(res, {});
  record('console', t.label, res, v, { method: method });

  card.textContent = '';
  card.appendChild(el('h2', null, 'Response'));
  const dl = el('dl', 'kv');
  [['Result', v.label], ['Why', v.why], ['HTTP', (res.status != null ? res.status : '\\u2014')
    + (res.statusText ? ' ' + res.statusText : '')], ['Time', res.ms + ' ms'],
   ['Bytes', res.bytes != null ? String(res.bytes) : '\\u2014']].forEach(function (p) {
    dl.appendChild(el('dt', null, p[0])); dl.appendChild(el('dd', null, String(p[1])));
  });
  card.appendChild(dl);

  const hk = Object.keys(res.headers || {});
  card.appendChild(el('h3', null, 'Response headers'));
  if (hk.length) {
    const hdl = el('dl', 'kv');
    hk.sort().forEach(function (k) {
      hdl.appendChild(el('dt', null, k)); hdl.appendChild(el('dd', null, res.headers[k]));
    });
    card.appendChild(hdl);
  } else {
    /* Not a broken flow. CORS exposes only a short safelist to a cross-origin reader unless
       the flow opts more in with Access-Control-Expose-Headers. Saying so stops an empty
       list reading as an empty response. */
    card.appendChild(el('p', null, 'None exposed. A cross-origin reader sees only the CORS '
      + 'safelist unless the flow adds Access-Control-Expose-Headers \\u2014 this is a '
      + 'browser rule, not a fault in the flow.'));
  }

  if (res.sent) {
    card.appendChild(el('h3', null, 'Request sent'));
    card.appendChild(el('pre', null, JSON.stringify(res.sent, null, 2)));
  }
  card.appendChild(el('h3', null, 'Response body'));
  card.appendChild(el('pre', null,
    res.raw == null ? '(no body \\u2014 the call did not complete)'
      : res.parsed ? JSON.stringify(res.json, null, 2) : res.raw));

  btn.disabled = false;
}

/* ------------------------------------------------------------------ *
 * 4 · Estate
 * ------------------------------------------------------------------ */

async function loadEstate() {
  if (window.__ESTATE) return window.__ESTATE;
  if (window.__FLOW_CATALOGUE) {
    window.__ESTATE = (window.__FLOW_CATALOGUE.availableFlows || []).filter(f => f.url);
    return window.__ESTATE;
  }
  try {
    const res = await fetch('FLOW_CATALOGUE.json', { cache: 'no-store' });
    const cat = await res.json();
    window.__ESTATE = (cat.availableFlows || []).filter(f => f.url);
    return window.__ESTATE;
  } catch (e) {
    return null;
  }
}

function estateMatches(f, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return (f.flow || '').toLowerCase().indexOf(q) !== -1
    || f.workflowId.toLowerCase().indexOf(q) !== -1
    || (f.wiredTo || []).join(' ').toLowerCase().indexOf(q) !== -1;
}

async function renderEstate(probeThem) {
  const out = $('estateOut'); out.textContent = '';
  const flows = await loadEstate();
  if (!flows) {
    out.appendChild(banner('warn', 'FLOW_CATALOGUE.json could not be read', [
      'It ships beside this page in the package. Serve the whole package directory, or use '
        + 'the self-contained copy of this page, which has the catalogue inlined.',
    ]));
    return;
  }
  fillRepoint(flows);
  $('repointCard').hidden = false;
  fillConsoleTargets();

  const q = $('eFilter').value.trim();
  const shown = flows.filter(f => estateMatches(f, q));

  const card = el('div', 'card');
  card.appendChild(el('h2', null, 'Estate \\u2014 ' + shown.length
    + (q ? ' of ' + flows.length : '') + ' flows'));
  const t = table(['Flow', 'Called by', 'Evidence', 'Result', 'HTTP', 'ms'], '700px');
  card.appendChild(t.wrap);
  out.appendChild(card);

  let live = 0, refused = 0, unreached = 0;
  for (const f of shown) {
    const tr = el('tr');
    tr.appendChild(el('td', 'key', f.flow || f.workflowId.slice(0, 8)));
    tr.appendChild(el('td', 'why', (f.wiredTo && f.wiredTo.length)
      ? f.wiredTo.join(', ') : 'no contract key calls this flow'));
    const ev = el('td', 'why', f.evidenceTier ? 'tier ' + f.evidenceTier : '\\u2014');
    if (f.contested) ev.appendChild(el('span', 'pill', 'contested'));
    if (f.warning) ev.appendChild(el('span', 'pill', 'caveat'));
    if ((f.evidence || []).length) {
      const d = el('div', 'keys', f.evidence[0]);
      ev.appendChild(d);
    }
    tr.appendChild(ev);
    tr.appendChild(el('td', 'v void', probeThem ? 'calling\\u2026' : '\\u2014'));
    tr.appendChild(el('td', 'num', '\\u2014'));
    tr.appendChild(el('td', 'num', '\\u2014'));
    t.body.appendChild(tr);
    if (!probeThem) continue;

    await new Promise(r => requestAnimationFrame(r));
    const res = await call(f.url, { body: {} });
    const v = verdict(res, {});
    const state = !v.reached ? 'unreached' : (v.ok || res.status === 400) ? 'live' : 'refused';
    if (state === 'live') live++; else if (state === 'refused') refused++; else unreached++;
    record('estate', f.flow || f.workflowId, res, v, { workflowId: f.workflowId, state: state });

    tr.children[3].className = 'v ' + (state === 'live' ? 'ok' : state === 'refused' ? 'bad' : 'void');
    tr.children[3].textContent = state;
    tr.children[4].textContent = res.status != null ? res.status : '\\u2014';
    tr.children[5].textContent = String(res.ms);
  }

  if (probeThem) {
    card.insertBefore(tallyOf([['live', live], ['refused', refused], ['not reached', unreached]]), t.wrap);
    if (unreached === shown.length && shown.length) {
      card.insertBefore(banner('bad', 'None of these reached Power Automate', [
        'This measured the network, not the estate. No signature here has been shown to be '
          + 'either live or revoked, and none should be treated as either.',
      ]), card.querySelector('.tally'));
    }
  }
}

function fillRepoint(flows) {
  const k = $('rKey'); k.textContent = '';
  DATA.endpoints.forEach(function (e) {
    const o = el('option', null, e.key); o.value = e.key; k.appendChild(o);
  });
  const f = $('rFlow'); f.textContent = '';
  flows.forEach(function (x, i) {
    const o = el('option', null, (x.flow || x.workflowId.slice(0, 8))
      + (x.wiredTo && x.wiredTo.length ? '  \\u2014 now ' + x.wiredTo.join(', ') : '  \\u2014 unused'));
    o.value = String(i); f.appendChild(o);
  });
}

function makeRepointLine() {
  const flows = window.__ESTATE || [];
  const f = flows[Number($('rFlow').value)];
  const key = $('rKey').value;
  if (!f || !key) return;
  const pre = $('rOut');
  pre.hidden = false;
  pre.textContent =
    '# ' + key + ' \\u2192 ' + (f.flow || f.workflowId) + '\\n'
    + '# ' + (f.evidence && f.evidence.length ? f.evidence[0] : 'no citation recorded') + '\\n'
    + DATA.envPrefix + key + '=' + f.url + '\\n';
}

/* ------------------------------------------------------------------ *
 * 5 · Report
 * ------------------------------------------------------------------ */

function renderReport() {
  const out = $('reportOut');
  out.textContent = '';
  if (!TRANSCRIPT.length) {
    out.appendChild(el('div', 'card')).appendChild(el('p', null,
      'Nothing yet. Run something on the Endpoints, Routes, Console or Estate tab.'));
    return;
  }
  const card = el('div', 'card');
  card.appendChild(el('h2', null, TRANSCRIPT.length + ' result(s)'));
  const t = table(['When', 'Kind', 'Name', 'Result', 'HTTP', 'ms', 'Why'], '720px');
  card.appendChild(t.wrap);
  TRANSCRIPT.slice().reverse().forEach(function (e) {
    const tr = el('tr');
    tr.appendChild(el('td', 'why', e.at.slice(11, 19)));
    tr.appendChild(el('td', 'why', e.kind));
    tr.appendChild(el('td', 'key', e.name));
    tr.appendChild(el('td', 'v ' + (e.ok ? 'ok' : e.reached ? 'bad' : 'void'), e.state));
    tr.appendChild(el('td', 'num', e.status == null ? '\\u2014' : String(e.status)));
    tr.appendChild(el('td', 'num', String(e.ms)));
    tr.appendChild(el('td', 'why', e.why));
    t.body.appendChild(tr);
  });
  out.appendChild(card);
}

function reportPayload() {
  return {
    reportFormat: 'dgo.endpoint-check/1',
    runId: RUN_ID,
    at: new Date().toISOString(),
    package: DATA.surface,
    platform: DATA.platform,
    buildId: DATA.buildId,
    origin: location.origin,
    protocol: location.protocol,
    userAgent: navigator.userAgent,
    /* No url and no signature, by construction: TRANSCRIPT never carries one. */
    results: TRANSCRIPT,
  };
}

function downloadReport() {
  const blob = new Blob([JSON.stringify(reportPayload(), null, 2)], { type: 'application/json' });
  const a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'endpoint-check-' + DATA.surface + '-' + RUN_ID + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}

function copyReport() {
  const lines = ['Endpoint check \\u2014 ' + DATA.platform + ' \\u2014 build ' + DATA.buildId,
    RUN_ID + ' \\u2014 ' + new Date().toISOString(), ''];
  TRANSCRIPT.forEach(function (e) {
    lines.push(e.kind.padEnd(9) + e.name.padEnd(30)
      + String(e.status == null ? '---' : e.status).padEnd(5)
      + (e.ms + 'ms').padEnd(8) + e.state + ' \\u2014 ' + e.why);
  });
  const text = lines.join('\\n');
  if (navigator.clipboard) navigator.clipboard.writeText(text);
  const b = $('repCopy');
  b.textContent = 'Copied \\u2014 no URLs, no signatures';
  setTimeout(function () { b.textContent = 'Copy as text'; }, 2500);
}

/* ------------------------------------------------------------------ *
 * 6 · Environment
 * ------------------------------------------------------------------ */

function renderEnv() {
  const out = $('envOut'); out.textContent = '';
  const eps = endpoints();
  const set = eps ? Object.values(eps).filter(Boolean).length : 0;
  const total = eps ? Object.keys(eps).length : 0;
  const fileUrl = location.protocol === 'file:';

  const dl = el('dl', 'kv');
  [['Page origin', location.origin || '(opaque \\u2014 file://)'],
   ['Protocol', location.protocol],
   ['Secure context', String(window.isSecureContext)],
   ['Configuration', eps ? set + ' of ' + total + ' endpoints set' : 'NOT LOADED'],
   ['Config path', DATA.configPath],
   ['Catalogue', window.__FLOW_CATALOGUE ? 'inlined into this page'
     : (window.__ESTATE ? 'loaded from FLOW_CATALOGUE.json' : 'not loaded yet')],
   ['Build', DATA.buildId],
   ['Run id', RUN_ID],
   ['Browser', navigator.userAgent]].forEach(function (p) {
    dl.appendChild(el('dt', null, p[0])); dl.appendChild(el('dd', null, String(p[1])));
  });
  out.appendChild(dl);

  if (!eps) {
    out.appendChild(banner('bad', 'The configuration did not load', [
      'Everything on the other tabs needs it. ' + (fileUrl
        ? 'This page was opened from disk, and a file:// page cannot load a sibling script in '
          + 'most browsers. Serve the directory over HTTP, or use the self-contained copy of '
          + 'this page which has the configuration inlined.'
        : 'The server is not returning ' + DATA.configPath + ' beside this page. Check that '
          + 'you are serving the package root and not its parent directory.'),
    ]));
  }
  if (fileUrl) {
    out.appendChild(banner('warn', 'Opened from disk', [
      'A file:// page has an opaque origin. Every call to a flow is cross-origin, and the '
        + 'flow must return Access-Control-Allow-Origin: * for it to succeed \\u2014 an echo of '
        + 'a specific origin will not match "null". If calls come back "not reached" here but '
        + 'work when served over HTTP, that is the reason, and it is a fact about the flow\\u2019s '
        + 'CORS configuration rather than about the URL.',
    ]));
  }
  out.appendChild(banner('', 'What a "not reached" result can and cannot tell you', [
    'The browser deliberately hides the difference between a CORS rejection, DNS failure, a '
      + 'refused connection and a dropped packet: fetch() throws the same TypeError for all '
      + 'four, with no status and no body. This page reports that as "not reached" and stops, '
      + 'rather than guessing at a cause it has no evidence for.',
    'To tell them apart, open one of the trigger URLs directly in a new tab. A Power Automate '
      + 'error page means the network path is fine and the problem is CORS or the signature; '
      + 'a browser-level connection error means the host is not reachable from here at all.',
  ]));
}

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

const TABS = ['check', 'routes', 'console', 'estate', 'report', 'env'];
function showTab(name) {
  TABS.forEach(function (t) {
    $('tab-' + t).hidden = t !== name;
    document.querySelector('[data-tab="' + t + '"]').setAttribute('aria-selected', String(t === name));
  });
  if (name === 'env') renderEnv();
  if (name === 'console') fillConsoleTargets();
  if (name === 'report') renderReport();
}
document.querySelectorAll('nav.tabs button').forEach(function (b) {
  b.addEventListener('click', function () { showTab(b.dataset.tab); });
});

const guard = fn => function () {
  Promise.resolve().then(fn).catch(function (e) {
    const out = $('out');
    out.appendChild(banner('bad', 'The check itself failed', [String((e && e.stack) || e)]));
    document.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
  });
};

$('run').addEventListener('click', guard(function () { return runCheck(null); }));
$('runOne').addEventListener('click', guard(function () {
  const keys = Object.keys(DATA.probes);
  const pick = window.prompt('Which endpoint?\\n\\n' + keys.join(', '), keys[0]);
  if (pick && keys.indexOf(pick) !== -1) return runCheck(pick);
}));
$('runRoutes').addEventListener('click', guard(runRoutes));
$('cSend').addEventListener('click', guard(consoleSend));
$('cReset').addEventListener('click', loadContractProbe);
$('cTarget').addEventListener('change', loadContractProbe);
$('cPretty').addEventListener('click', function () {
  try { $('cBody').value = JSON.stringify(JSON.parse($('cBody').value), null, 2); }
  catch (e) { $('cWarn').textContent = 'Not valid JSON: ' + e.message; }
});
$('runEstate').addEventListener('click', guard(function () { return renderEstate(true); }));
$('loadEstate').addEventListener('click', guard(function () { return renderEstate(false); }));
$('eFilter').addEventListener('input', function () {
  if ($('estateOut').textContent) renderEstate(false);
});
$('rMake').addEventListener('click', makeRepointLine);
$('repDownload').addEventListener('click', downloadReport);
$('repCopy').addEventListener('click', copyReport);
$('repClear').addEventListener('click', function () { TRANSCRIPT.length = 0; renderReport(); });

renderReport();
</script>
</body>
</html>
`;

/**
 * The same page with its two siblings folded in: one file that depends on nothing.
 *
 * WHY BOTH ARE SHIPPED. The served copy reads `config.local.js` and `FLOW_CATALOGUE.json`
 * from beside it, which is right for a page living inside a served package — it can never
 * disagree with the configuration the platform itself uses, because it is reading the same
 * bytes. That property is worth keeping.
 *
 * It is also useless to somebody who has a phone, a downloaded folder and no server. The
 * first person to try this got `404 File not found`, because a static server serves the
 * directory it was started in and theirs was one level up — a mistake the page cannot
 * detect, cannot explain, and would have had exactly the same trouble explaining if the
 * package had been extracted somewhere else entirely.
 *
 * So the standalone copy exists for the case where getting a server and a path right is
 * the obstacle. Open it from anywhere, including from disk. It carries the endpoint URLs,
 * which makes it exactly as sensitive as the configuration file it inlines.
 *
 * @param {string} html      the served page, as emitted above
 * @param {string} config    the contents of config.local.js, verbatim
 * @param {string} catalogue the contents of FLOW_CATALOGUE.json, verbatim
 * @param {string} configPath the path the served page loads its config from
 */
export function inlineCheckPage(html, config, catalogue, configPath) {
  const tag = `<script src="${configPath}" onerror="window.__CONFIG_MISSING=1"></script>`;
  if (!html.includes(tag)) {
    throw new Error('inlineCheckPage: the config script tag is not where it was expected');
  }
  let out = html.replace(tag,
    '<script>\n/* Inlined from ' + configPath + ' \u2014 verbatim, so this page and the platform\n'
    + '   read exactly the same endpoint values. */\n' + config.trimEnd() + '\n</script>');

  /* The catalogue is picked up by loadEstate(), which checks `window.__FLOW_CATALOGUE`
     before it reaches for the network. Defining it is the whole change — no code path is
     rewritten, so the two copies cannot drift in behaviour. */
  const anchor = '<script>\n"use strict";';
  if (!out.includes(anchor)) {
    throw new Error('inlineCheckPage: the script anchor is not where it was expected');
  }
  out = out.replace(anchor, anchor
    + '\n/* The whole flow catalogue, inlined \u2014 loadEstate() reads this before the network. */\n'
    + 'window.__FLOW_CATALOGUE = ' + catalogue.trim() + ';\n');

  return out.replace('<h1>Endpoint workbench</h1>',
    '<h1>Endpoint workbench</h1>\n  <p class="sub"><b>Self-contained copy.</b> The endpoint '
    + 'configuration and the full flow catalogue are inlined into this file. It needs no '
    + 'other file and no server \u2014 open it from anywhere, including from disk.</p>');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
