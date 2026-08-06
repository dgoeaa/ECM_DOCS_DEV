/**
 * Is this string a complete, valid, directly-invocable endpoint URL?
 *
 * The platform calls every flow directly, so the URL configured into a package is the
 * whole integration: there is no proxy to normalise it, retry it against a second host,
 * or turn a malformed value into a useful error. A URL that is subtly wrong therefore
 * fails for the first time at an officer's desk, mid-action, as a network error with
 * nothing to point at.
 *
 * `npm run commission` already refused an empty value, a placeholder and a non-HTTPS
 * scheme. Those are the three failures you make once. The ones that survive to production
 * are quieter — a trigger URL truncated at the `&` by a mail client, one pasted with its
 * `sig` intact but its `api-version` lost, one carrying a stray newline from a spreadsheet
 * cell — and every one of them produces a URL that is non-empty, HTTPS and free of
 * template text. This module exists to fail those at build time.
 *
 * Deliberately NOT strict about the host. The estate is Power Automate today; a URL on an
 * unrecognised host is reported as unrecognised rather than refused, because a validator
 * that blocks a legitimate migration gets deleted, and a deleted validator checks nothing.
 */

/** Template text from the example configs, and the placeholders people actually type. */
const PLACEHOLDER =
  /YOUR_ENV|YOUR_TENANT|YOURTENANT|ROTATE_ME|REPLACE_ME|CHANGEME|<[^>]*>|example\.(?:com|org|invalid)|\.{3}/i;

/** Hosts that are not reachable from a browser somewhere else. */
const LOCAL_HOST =
  /^(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|.*\.local|.*\.localhost)$/i;
const PRIVATE_IP =
  /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

/** The hosts Power Automate serves manual HTTP triggers from. */
const POWER_AUTOMATE_HOST =
  /(?:\.powerplatform\.com|\.logic\.azure\.com|\.azure-apihub\.net)$/i;

const WORKFLOW_ID = /\/workflows\/([0-9a-f]{32})\b/i;

/** Remove signature material before a URL is printed, written to a manifest or logged. */
export function redact(url) {
  const raw = String(url || '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const params = parsed.searchParams;
    for (const name of ['sig', 'sv', 'sp', 'code']) if (params.has(name)) params.set(name, '***');
    const path = parsed.pathname.replace(/\/[0-9a-f]{16,}/gi, '/***');
    const query = params.toString();
    return `${parsed.origin}${path}${query ? `?${query}` : ''}`;
  } catch {
    return raw.replace(/([?&](?:sig|code)=)[^&]*/gi, '$1***');
  }
}

export const workflowIdOf = url => (WORKFLOW_ID.exec(String(url || '')) || [])[1] || null;

/**
 * Validate one endpoint value.
 *
 * @param {string} url        the configured value, possibly empty
 * @param {object} opts
 * @param {string} opts.key       contract key, for the message
 * @param {boolean} opts.required whether an empty value is a failure
 * @returns {{key:string, provisioned:boolean, ok:boolean, severity:'ok'|'warn'|'error',
 *            code:string, message:string, host:string|null, workflowId:string|null,
 *            redacted:string, notes:string[]}}
 */
export function validateEndpointUrl(url, { key = '(unnamed)', required = false } = {}) {
  const notes = [];
  const base = { key, host: null, workflowId: null, redacted: '', notes };
  const fail = (code, message) =>
    ({ ...base, provisioned: true, ok: false, severity: 'error', code, message });

  const raw = url === undefined || url === null ? '' : String(url);

  if (!raw.trim()) {
    return {
      ...base,
      provisioned: false,
      ok: !required,
      severity: required ? 'error' : 'warn',
      code: required ? 'missing-required' : 'unprovisioned',
      message: required
        ? 'required endpoint has no URL — the feature it serves cannot work'
        : 'not provisioned — the feature it serves reports itself unconfigured',
    };
  }

  /* Checked before parsing: `new URL()` tolerates a leading tab and a trailing newline,
     strips them, and hands back a URL that works here and fails in the browser when the
     same raw string is assigned into a config file. */
  if (raw !== raw.trim()) return fail('surrounding-whitespace', 'has leading or trailing whitespace');
  if (/\s/.test(raw)) return fail('embedded-whitespace', 'contains a space, tab or newline');
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fail('control-character', 'contains a control character');
  if (PLACEHOLDER.test(raw)) return fail('placeholder', 'is template text, not a real trigger URL');

  let parsed;
  try { parsed = new URL(raw); } catch { return fail('unparseable', 'is not a valid absolute URL'); }

  base.host = parsed.host;
  base.redacted = redact(raw);
  base.workflowId = workflowIdOf(raw);

  if (parsed.protocol !== 'https:') {
    return fail('not-https',
      `uses ${parsed.protocol}// — a trigger URL is a bearer credential and must not travel in clear`);
  }
  if (parsed.hash) {
    return fail('has-fragment',
      'carries a #fragment, which is never part of a trigger URL — it was most likely truncated or mis-pasted');
  }
  if (!parsed.hostname.includes('.') || LOCAL_HOST.test(parsed.hostname) || PRIVATE_IP.test(parsed.hostname)) {
    return fail('unreachable-host',
      `points at ${parsed.hostname}, which is not resolvable from a browser outside this machine`);
  }

  const isPowerAutomate = POWER_AUTOMATE_HOST.test(parsed.hostname);

  if (isPowerAutomate) {
    /* The four parts of a manual-trigger URL. Missing any one of them produces a request
       Power Automate answers with a 4xx that names none of them. */
    if (!base.workflowId) {
      return fail('no-workflow-id',
        'has no /workflows/<32-hex> segment, so it does not address a flow');
    }
    if (!/\/paths\/invoke/i.test(parsed.pathname)) {
      return fail('not-a-trigger-path',
        'does not end at /triggers/<name>/paths/invoke — this is not a trigger URL');
    }
    if (!parsed.searchParams.get('api-version')) {
      return fail('no-api-version',
        'has no api-version parameter — the usual symptom of a URL truncated at the first &');
    }
    const sig = parsed.searchParams.get('sig') || '';
    if (!sig) {
      return fail('no-signature',
        'has no sig parameter, so the trigger will refuse it — the usual symptom of a truncated paste');
    }
    if (sig.length < 20) {
      return fail('short-signature', `has a ${sig.length}-character sig, which is too short to be complete`);
    }
    for (const p of ['sp', 'sv']) {
      if (!parsed.searchParams.get(p)) notes.push(`no ${p} parameter — unusual for a manual trigger`);
    }
  } else {
    notes.push(`host ${parsed.hostname} is not a recognised Power Automate host — verify it deliberately`);
  }

  return {
    ...base,
    provisioned: true,
    ok: true,
    severity: notes.length ? 'warn' : 'ok',
    code: notes.length ? 'provisioned-with-notes' : 'provisioned',
    message: notes.length ? notes.join('; ') : 'complete and well-formed',
  };
}

/**
 * Validate a whole surface at once.
 *
 * @param {object} values           key → url
 * @param {Array<{key:string, pilot?:boolean}>} endpoints  the surface definition
 * @param {object} [opts]
 * @param {string[]} [opts.required] keys that must be present; defaults to the pilot set
 */
export function validateSurface(values, endpoints, { required } = {}) {
  const requiredKeys = required || endpoints.filter(e => e.pilot).map(e => e.key);
  const results = endpoints.map(e =>
    validateEndpointUrl(values?.[e.key], { key: e.key, required: requiredKeys.includes(e.key) }));

  const unknown = Object.keys(values || {})
    .filter(k => !endpoints.some(e => e.key === k))
    .map(k => ({
      key: k, provisioned: true, ok: false, severity: 'error', code: 'unknown-key',
      message: 'is not an endpoint this platform resolves — it will be delivered and never called',
      host: null, workflowId: null, redacted: redact(values[k]), notes: [],
    }));

  const all = [...results, ...unknown];

  /* Two flows behind one URL is a configuration mistake that looks like nothing: the
     second key silently inherits the first key's flow, and every action routed to it
     lands on a switch that has no case for it. */
  const byWorkflow = new Map();
  for (const r of all) {
    if (!r.workflowId) continue;
    if (!byWorkflow.has(r.workflowId)) byWorkflow.set(r.workflowId, []);
    byWorkflow.get(r.workflowId).push(r.key);
  }
  const collisions = [...byWorkflow.entries()]
    .filter(([, keys]) => keys.length > 1)
    .map(([workflowId, keys]) => ({ workflowId, keys }));

  return {
    results: all,
    provisioned: all.filter(r => r.provisioned && r.ok).length,
    errors: all.filter(r => !r.ok),
    warnings: all.filter(r => r.ok && r.severity === 'warn'),
    missingRequired: results.filter(r => !r.provisioned && requiredKeys.includes(r.key)).map(r => r.key),
    collisions,
  };
}
