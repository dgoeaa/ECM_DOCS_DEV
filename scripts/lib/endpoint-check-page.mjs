/**
 * ENDPOINT-CHECK.html — the endpoint check, run from the browser, on the operator's machine.
 *
 * WHY THIS EXISTS. `npm run verify:endpoints` answers "do these flows work?" from a
 * terminal. That is the wrong machine. The browser is where the real request path is — it
 * is what actually calls the flows, under the CORS rules the flows actually apply, from the
 * network the deployment actually sits on — and until now the only way to ask it anything
 * was to open the platform and try to use it, which reports a failure as a blank panel.
 *
 * More practically: the terminal check cannot be run by whoever is deploying this. It needs
 * a checkout, Node, and a network path to Power Automate. The person serving a static
 * directory has a browser. So every round of "does it work?" cost a message to someone who
 * could run the CLI, and the answer came back describing a different machine's network.
 *
 * This page is that check, self-contained, in the package, with no build step and no
 * dependency. Open it, press the button, read the transcript. Every request it makes is the
 * same request the platform makes: same URL out of the same `config.local.js`, same method,
 * same body shape from `scripts/lib/endpoint-probes.mjs`, which the terminal check reads too.
 *
 * WHAT IT REFUSES TO CONFLATE. A call can fail in four ways that look alike and mean
 * entirely different things, and getting them wrong sends someone to fix something that
 * is not broken:
 *
 *   the flow answered          2xx, or a 4xx the flow itself produced
 *   the signature is refused   401/403 carrying a Power Automate body
 *   the flow is not there      404 on the trigger path
 *   nothing was reached        a network error, a CORS rejection, or a non-JSON body from
 *                              an intermediary — a corporate filter, a captive portal
 *
 * The fourth is the one that matters most here and is invisible to the page's own code: a
 * cross-origin fetch blocked by CORS throws with NO status and NO body, indistinguishable
 * from the host being down. The page says exactly that rather than guessing, because
 * "signature revoked" and "your browser refused to make the call" lead to opposite actions.
 *
 * ⚠  IT READS THE PROVISIONED URLS, so it must be served from the package. It carries no
 * signature of its own.
 */

/** Serialised into the page so the browser and the terminal probe identically. */
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

  const data = {
    surface: surfaceId,
    platform: surface.label,
    globalName: surface.globalName,
    configPath: surface.configPath,
    buildId: meta.buildId,
    builtAt: meta.builtAt,
    probes,
    writeKeys,
    endpoints: surface.endpoints.map(e => ({
      key: e.key, transport: e.transport, pilot: Boolean(e.pilot), note: e.note,
    })),
  };

  return PAGE(data);
}

const PAGE = data => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Endpoint check — ${esc(data.platform)}</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff; --fg: #15181d; --muted: #5b6472; --line: #d9dee6;
    --ok: #0f7b3f; --warn: #8a5a00; --bad: #b3261e; --void: #4b5563;
    --card: #f6f8fa;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1216; --fg: #e6e9ee; --muted: #9aa4b2; --line: #2a313b;
      --ok: #4ade80; --warn: #fbbf24; --bad: #f87171; --void: #9aa4b2;
      --card: #161b22;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 2rem 1.25rem 4rem; background: var(--bg); color: var(--fg);
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  .sub { color: var(--muted); margin: 0 0 1.5rem; font-size: .9rem; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 1rem 1.15rem; margin-bottom: 1.25rem; }
  .card h2 { font-size: 1rem; margin: 0 0 .5rem; }
  .card p { margin: .35rem 0; color: var(--muted); font-size: .875rem; }
  button { font: inherit; font-weight: 600; padding: .6rem 1.15rem; border-radius: 8px;
    border: 1px solid var(--line); background: var(--fg); color: var(--bg); cursor: pointer; }
  button[disabled] { opacity: .5; cursor: progress; }
  button.secondary { background: transparent; color: var(--fg); font-weight: 500; }
  label.opt { display: block; margin: .4rem 0; font-size: .875rem; cursor: pointer; }
  label.opt input { margin-right: .5rem; }
  .controls { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; margin-top: .9rem; }
  .scroller { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: .875rem; min-width: 720px; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid var(--line);
    vertical-align: top; }
  th { font-size: .74rem; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
  td.key { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .v { font-weight: 600; white-space: nowrap; }
  .v.ok { color: var(--ok); } .v.bad { color: var(--bad); }
  .v.warn { color: var(--warn); } .v.void { color: var(--void); }
  .why { color: var(--muted); font-size: .84rem; }
  .keys { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .78rem;
    color: var(--muted); word-break: break-word; }
  .tally { display: flex; gap: 1.5rem; flex-wrap: wrap; margin: 1rem 0 .25rem; font-size: .9rem; }
  .tally b { font-size: 1.35rem; display: block; font-weight: 700; }
  .banner { border-left: 4px solid var(--warn); padding: .75rem 1rem; margin: 1rem 0;
    background: var(--card); border-radius: 0 8px 8px 0; }
  .banner.bad { border-left-color: var(--bad); }
  .banner h3 { margin: 0 0 .35rem; font-size: .95rem; }
  .banner p { margin: .3rem 0; font-size: .875rem; color: var(--fg); }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85em;
    background: var(--card); padding: .1rem .3rem; border-radius: 4px; }
  .hidden { display: none; }
</style>
</head>
<body>
<main>
  <h1>Endpoint check</h1>
  <p class="sub">${esc(data.platform)} &middot; build <code>${esc(data.buildId)}</code>
    &middot; packaged ${esc(data.builtAt)}</p>

  <div class="card">
    <h2>What this does</h2>
    <p>Calls each flow this package is configured to call, <strong>from this browser</strong>,
      the same way the platform does &mdash; same URL out of <code>${esc(data.configPath)}</code>,
      same method, same request shape. It reports what came back.</p>
    <p>It runs entirely here. Nothing is sent anywhere except to the flows themselves, and
      no signature is ever displayed or copied into the report.</p>
    <div class="controls">
      <button id="run">Run the check</button>
      <label class="opt"><input type="checkbox" id="writes">
        Include write probes &mdash; these create real records, tagged <code>__DGO_PROBE__</code></label>
    </div>
    <div class="controls">
      <label class="opt"><input type="checkbox" id="estate">
        Also probe every other flow in the estate (reachability only &mdash; says whether a
        signature still authenticates, not whether the flow works)</label>
    </div>
  </div>

  <div id="out"></div>

  <div class="card">
    <h2>Reading the result</h2>
    <p><span class="v ok">answered</span> &mdash; the flow replied. If it replied without the
      keys the platform reads, that is named, and it is the finding worth having: the flow is
      live but its response does not carry what the client needs.</p>
    <p><span class="v ok">refused</span> &mdash; a 4xx the flow itself produced. The flow is
      live and validating its input. For <code>UPLOAD</code> and <code>STATUS</code> a refusal
      is the correct answer and is marked as a pass.</p>
    <p><span class="v bad">signature</span> &mdash; 401 or 403 from Power Automate. The trigger
      URL was regenerated, or it never authenticated. Rotate and rebuild.</p>
    <p><span class="v bad">no flow</span> &mdash; 404 on the trigger path. The flow was deleted
      or the URL is stale.</p>
    <p><span class="v void">not reached</span> &mdash; the call never got an answer from Power
      Automate. A browser CORS rejection, an offline network, or something in the middle
      answering instead. <strong>This says nothing about the endpoint.</strong> A CORS
      rejection in particular gives this page no status and no body to read, so it cannot be
      told apart from the host being unreachable &mdash; and neither is evidence that the
      signature is wrong.</p>
  </div>
</main>

<script src="${esc(data.configPath)}" onerror="window.__CONFIG_MISSING=1"></script>
<script>
"use strict";
const DATA = ${JSON.stringify({
    surface: data.surface, globalName: data.globalName, configPath: data.configPath,
    probes: data.probes, writeKeys: data.writeKeys, endpoints: data.endpoints,
  })};

const RUN_ID = 'probe-' + Date.now().toString(36);
const out = document.getElementById('out');
const el = (t, cls, txt) => { const n = document.createElement(t);
  if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

/* Every probe body carries the run id, so anything a write probe creates can be found. */
const withRunId = o => JSON.parse(JSON.stringify(o).split('__RUN_ID__').join(RUN_ID));

function endpoints() {
  const cfg = window[DATA.globalName];
  if (window.__CONFIG_MISSING || !cfg) return null;
  return cfg.endpoints || {};
}

/**
 * The four outcomes, kept apart.
 *
 * \`parsed === false\` is checked before status for the reason spelled out on the page: a
 * Power Automate manual trigger answers JSON or nothing, so a non-JSON body means something
 * in the middle answered. Reading an intermediary's 403 as "the flow refused you" is how a
 * network problem gets diagnosed as a credential problem.
 */
function verdict(r, spec) {
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

async function call(url, spec) {
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
    } else {
      const body = Object.assign({}, withRunId(spec.body || {}), { __probe: RUN_ID });
      init = { method: 'POST', body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' } };
    }
    const res = await fetch(url, init);
    r.ms = Math.round(performance.now() - started);
    r.status = res.status;
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      r.parsed = true;
      r.keys = json && typeof json === 'object' && !Array.isArray(json) ? Object.keys(json) : [];
      /* The documented envelope is { ok, status, request, timing, meta, data } and the
         payload the platform reads lives inside \`data\`. Checking only the top level
         reports correctly-shaped responses as gaps, and a check that cries wolf is
         ignored on the run where it is right. */
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

function table(cols) {
  const t = el('table');
  const head = el('tr');
  cols.forEach(c => head.appendChild(el('th', null, c)));
  const thead = el('thead'); thead.appendChild(head); t.appendChild(thead);
  const tb = el('tbody'); t.appendChild(tb);
  const wrap = el('div', 'scroller'); wrap.appendChild(t);
  return { wrap: wrap, body: tb };
}

function banner(kind, title, lines) {
  const b = el('div', 'banner' + (kind === 'bad' ? ' bad' : ''));
  b.appendChild(el('h3', null, title));
  lines.forEach(l => b.appendChild(el('p', null, l)));
  return b;
}

async function run() {
  const btn = document.getElementById('run');
  btn.disabled = true;
  out.textContent = '';

  const eps = endpoints();
  if (!eps) {
    out.appendChild(banner('bad', 'No endpoint configuration was loaded', [
      DATA.configPath + ' did not load. Serve this directory over HTTP rather than opening '
        + 'the file directly \\u2014 a page opened from disk cannot load its own scripts in '
        + 'most browsers.',
      'From this directory:  python3 -m http.server 8080   then open '
        + 'http://localhost:8080/ENDPOINT-CHECK.html',
    ]));
    btn.disabled = false;
    return;
  }

  const includeWrites = document.getElementById('writes').checked;
  const card = el('div', 'card');
  card.appendChild(el('h2', null, 'Configured endpoints'));
  const t = table(['Endpoint', 'Result', 'HTTP', 'ms', 'What came back']);
  card.appendChild(t.wrap);
  out.appendChild(card);

  const rows = [];
  for (const spec_key of Object.keys(DATA.probes)) {
    const spec = DATA.probes[spec_key];
    const urlKey = spec.via || spec_key;
    const url = (eps[urlKey] || '').trim();
    const tr = el('tr');
    const name = el('td', 'key', spec_key + (spec.via ? '  (on ' + spec.via + ')' : ''));
    tr.appendChild(name);

    if (!url) {
      tr.appendChild(el('td', 'v void', 'unset'));
      tr.appendChild(el('td', 'num', '\\u2014'));
      tr.appendChild(el('td', 'num', '\\u2014'));
      tr.appendChild(el('td', 'why', 'not provisioned \\u2014 the feature it serves reports '
        + 'itself unconfigured rather than failing mid-action'));
      t.body.appendChild(tr);
      continue;
    }
    if (DATA.writeKeys.indexOf(spec_key) !== -1 && !includeWrites) {
      tr.appendChild(el('td', 'v void', 'skipped'));
      tr.appendChild(el('td', 'num', '\\u2014'));
      tr.appendChild(el('td', 'num', '\\u2014'));
      tr.appendChild(el('td', 'why', 'mutates \\u2014 tick "include write probes" to exercise it'));
      t.body.appendChild(tr);
      continue;
    }

    const pending = el('td', 'v void', 'calling\\u2026');
    tr.appendChild(pending);
    tr.appendChild(el('td', 'num', ''));
    tr.appendChild(el('td', 'num', ''));
    tr.appendChild(el('td', 'why', ''));
    t.body.appendChild(tr);
    await new Promise(r => requestAnimationFrame(r));

    const res = await call(url, spec);
    const v = verdict(res, spec);
    rows.push({ key: spec_key, v: v, res: res });

    tr.children[1].className = 'v ' + v.cls;
    tr.children[1].textContent = v.label;
    tr.children[2].textContent = res.status != null ? res.status : '\\u2014';
    tr.children[3].textContent = res.ms;
    const detail = el('td', 'why');
    detail.appendChild(document.createTextNode(v.why));
    if (res.keys && res.keys.length) {
      detail.appendChild(el('div', 'keys', 'keys: ' + res.keys.join(', ')));
      if (res.matchedIn === 'data') {
        detail.appendChild(el('div', 'keys', 'inside data: ' + res.dataKeys.join(', ')));
      }
    }
    if (res.snippet) detail.appendChild(el('div', 'keys', res.snippet));
    tr.replaceChild(detail, tr.children[4]);
  }

  const reached = rows.filter(r => r.v.reached);
  const good = rows.filter(r => r.v.ok);
  const tally = el('div', 'tally');
  [['answered acceptably', good.length], ['reached the flow', reached.length],
   ['probed', rows.length]].forEach(pair => {
    const d = el('div'); d.appendChild(el('b', null, String(pair[1])));
    d.appendChild(document.createTextNode(pair[0])); tally.appendChild(d);
  });
  card.insertBefore(tally, t.wrap);

  if (rows.length && reached.length === 0) {
    card.insertBefore(banner('bad', 'Nothing reached Power Automate', [
      'Every call was answered by something other than the flows, or by nothing at all. '
        + 'This run measured your network, not your endpoints \\u2014 no conclusion about '
        + 'the configuration can be drawn from it either way.',
      'The usual causes, in order: the page was opened from disk instead of served over '
        + 'HTTP; the flows do not return CORS headers for this origin; or an egress filter '
        + 'between this browser and *.environment.api.powerplatform.com.',
    ]), tally);
  } else if (rows.some(r => r.v.cls === 'bad')) {
    card.insertBefore(banner('warn', 'Some flows were reached and did not answer acceptably', [
      'These reached Power Automate, so the finding is about the flow or its signature '
        + 'rather than about the network. Each row says which.',
    ]), tally);
  }

  if (document.getElementById('estate').checked) await runEstate();

  const copy = el('button', 'secondary', 'Copy a report');
  copy.onclick = () => {
    const lines = ['Endpoint check \\u2014 ' + DATA.surface + ' \\u2014 ' + RUN_ID,
      new Date().toISOString(), ''];
    rows.forEach(r => lines.push(
      r.key.padEnd(26) + String(r.res.status == null ? '---' : r.res.status).padEnd(5)
      + String(r.res.ms + 'ms').padEnd(8) + r.v.label + ' \\u2014 ' + r.v.why));
    /* No URL and no signature: a report has to be safe to paste. */
    navigator.clipboard.writeText(lines.join('\\n'));
    copy.textContent = 'Copied \\u2014 it carries no URLs or signatures';
  };
  const controls = el('div', 'controls'); controls.appendChild(copy);
  card.appendChild(controls);

  btn.disabled = false;
}

/**
 * Every other flow in the estate, from FLOW_CATALOGUE.json.
 *
 * Empty-body probes. They answer "does this signature still authenticate?" and nothing
 * else, and the heading says so \\u2014 reporting "GET EMAILS: live" from an empty POST is
 * honest, reporting "GET EMAILS: working" from the same probe would not be.
 */
async function runEstate() {
  let cat;
  try {
    const res = await fetch('FLOW_CATALOGUE.json', { cache: 'no-store' });
    cat = await res.json();
  } catch (e) {
    out.appendChild(banner('warn', 'FLOW_CATALOGUE.json could not be read', [String(e.message || e)]));
    return;
  }
  const flows = (cat.availableFlows || []).filter(f => f.url);
  if (!flows.length) return;

  const card = el('div', 'card');
  card.appendChild(el('h2', null, 'The rest of the estate \\u2014 ' + flows.length + ' flows'));
  card.appendChild(el('p', null,
    'Empty-body probes. A live result means the signature still authenticates. It does not '
    + 'mean the flow does what its name says.'));
  const t = table(['Flow', 'Result', 'HTTP', 'ms', 'Called by']);
  card.appendChild(t.wrap);
  out.appendChild(card);

  let live = 0, refused = 0, unreached = 0;
  for (const f of flows) {
    const res = await call(f.url, { body: {} });
    const v = verdict(res, {});
    const state = !v.reached ? 'unreached' : (v.ok || res.status === 400) ? 'live' : 'refused';
    if (state === 'live') live++; else if (state === 'refused') refused++; else unreached++;

    const tr = el('tr');
    tr.appendChild(el('td', 'key', f.flow || f.workflowId.slice(0, 8)));
    tr.appendChild(el('td', 'v ' + (state === 'live' ? 'ok' : state === 'refused' ? 'bad' : 'void'), state));
    tr.appendChild(el('td', 'num', res.status != null ? res.status : '\\u2014'));
    tr.appendChild(el('td', 'num', String(res.ms)));
    tr.appendChild(el('td', 'why', (f.wiredTo && f.wiredTo.length) ? f.wiredTo.join(', ')
      : 'no contract key calls this flow'));
    t.body.appendChild(tr);
    await new Promise(r => requestAnimationFrame(r));
  }

  const tally = el('div', 'tally');
  [['live', live], ['refused', refused], ['not reached', unreached]].forEach(pair => {
    const d = el('div'); d.appendChild(el('b', null, String(pair[1])));
    d.appendChild(document.createTextNode(pair[0])); tally.appendChild(d);
  });
  card.insertBefore(tally, t.wrap);

  if (unreached === flows.length) {
    card.insertBefore(banner('bad', 'None of these reached Power Automate', [
      'This measured the network, not the estate. No signature here has been shown to be '
        + 'either live or revoked, and none should be treated as either.',
    ]), tally);
  }
}

document.getElementById('run').addEventListener('click', () => { run().catch(e => {
  out.appendChild(banner('bad', 'The check itself failed', [String(e && e.stack || e)]));
  document.getElementById('run').disabled = false;
}); });
</script>
</body>
</html>
`;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
