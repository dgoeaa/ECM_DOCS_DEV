// DGO R11.6 — endpoint contract manager (Workstream F).
// Single owner of endpoint resolution. Feature modules never see a raw signed URL: they
// address endpoints by contract key, and the registry resolves the runtime target using,
// in priority order:
//   1. a deployment-injected runtime manifest (globalThis.__DGO_ENDPOINT_MANIFEST__),
//   2. an audited operator override stored in settings,
//   3. the packaged default carried in config/endpoints.config.js.
//
// THE PACKAGED DEFAULT IS THE TARGET STATE, not a way-station. Every URL is invoked
// directly by the browser, with the complete trigger URL provisioned into the delivered
// package by `npm run package`; there is no proxy, broker or other intermediary in the
// request path, and none is to be introduced. An earlier revision of this file described
// packaged URLs as a "TEMPORARY posture" and told diagnostics to warn until they were
// moved to a broker. That broker was built, withdrawn and its branch retired, so the
// warning survived its own subject: it flagged the approved architecture as a defect and
// pointed operators at a component that does not exist.
//
// What diagnostics reports instead is what an operator can act on — which contracts have
// no resolvable target, and where each resolved target came from. The consequence of the
// direct model is stated where it belongs, in the package's own provisioning record: the
// signed URL reaches the browser, so it can be rotated but never retired, and the flow
// behind it is the only place authentication, authorisation, validation and rate limiting
// can happen.
import { EndpointContracts, EndpointUrls, EndpointKeys } from '../config/endpoints.config.js';
import { fetchPolicyFor } from '../config/fetch-policy.config.js';

export const MANIFEST_GLOBAL = '__DGO_ENDPOINT_MANIFEST__';

/** Read-only endpoints are safely retryable; write endpoints need an idempotency key. */
const isWrite = contract => contract?.readOnly !== true;

function runtimeManifest() {
  const scope = typeof globalThis !== 'undefined' ? globalThis : {};
  const manifest = scope[MANIFEST_GLOBAL];
  return manifest && typeof manifest === 'object' ? manifest : null;
}

/** Remove signature material before a URL is shown, logged or exported. */
export function redact(url) {
  const raw = String(url || '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const params = parsed.searchParams;
    ['sig', 'sv', 'sp', 'code'].forEach(name => { if (params.has(name)) params.set(name, '***'); });
    const path = parsed.pathname.replace(/\/[0-9a-f]{16,}/gi, '/***');
    return `${parsed.origin}${path}?${params.toString()}`;
  } catch {
    return raw.replace(/([?&](?:sig|code)=)[^&]*/gi, '$1***');
  }
}

/** Normalised contract in the F2.2 shape, merged with the fetch policy. */
export function contract(key) {
  const base = EndpointContracts[key];
  if (!base) return null;
  const policy = fetchPolicyFor(key);
  const write = isWrite(base);
  return Object.freeze({
    key,
    method: base.method || 'POST',
    operation: base.action,
    readOnly: !!base.readOnly,
    write,
    timeoutMs: policy.timeoutMs || base.timeoutMs || 15000,
    retry: write ? 0 : (policy.retry ?? 1),
    dedupe: !!policy.dedupe,
    cacheTtlMs: policy.cacheTtlMs || 0,
    payloadBudgetBytes: policy.payloadBudgetBytes || 0,
    requiresAuth: true,
    idempotent: !write,
    observability: true,
    sourceKey: base.sourceKey,
    routeKeys: base.routeKeys || null,
  });
}

/** Where the runtime target for a key comes from. */
export function source(key, overrides = {}) {
  const manifest = runtimeManifest();
  if (manifest && manifest[key]) return 'runtime-manifest';
  if (overrides && overrides[key]) return 'operator-override';
  return EndpointUrls[key] ? 'packaged-default' : 'unconfigured';
}

/**
 * Resolve the runtime URL for a contract key.
 * @param {string} key contract key
 * @param {object} [options]
 * @param {object} [options.overrides] operator overrides (settings.endpoints)
 */
export function url(key, { overrides = {} } = {}) {
  const manifest = runtimeManifest();
  return (manifest && manifest[key]) || overrides[key] || EndpointUrls[key] || EndpointContracts[key]?.url || '';
}

/** Redacted, observable view of every contract for diagnostics and evidence export. */
export function describeAll(overrides = {}) {
  const entries = EndpointKeys.map(key => {
    const c = contract(key);
    return {
      ...c,
      source: source(key, overrides),
      target: redact(url(key, { overrides })),
      configured: !!url(key, { overrides }),
    };
  });
  const warnings = [];

  /* The only endpoint condition an operator can act on from inside the platform. Anything
     unconfigured is a feature that will report itself unavailable at the moment of use;
     naming the keys here is what turns "the action failed" into "SCAN_INTAKE was never
     provisioned in this package". */
  const unconfigured = entries.filter(e => !e.configured);
  if (unconfigured.length) {
    warnings.push({
      code: 'endpoint.unconfigured',
      severity: 'error',
      message: `${unconfigured.length} endpoint(s) have no resolvable target in this deployment. `
        + 'Rebuild the package with those values supplied (npm run package -- --values <file>); '
        + 'the features they serve report themselves unavailable until you do.',
      keys: unconfigured.map(e => e.key),
    });
  }

  /* Reported, never warned on. An operator override is a legitimate diagnostic tool and a
     deployment-injected manifest is a supported provisioning path — but a target that did
     not come from the package is a target the package manifest does not describe, and an
     operator reading diagnostics should be able to see that without inferring it. */
  const overridden = entries.filter(e => e.configured && e.source !== 'packaged-default');
  if (overridden.length) {
    warnings.push({
      code: 'endpoint.not-from-package',
      severity: 'info',
      message: `${overridden.length} endpoint(s) resolve to a target supplied at runtime rather than `
        + 'the one provisioned into this package, so PACKAGE_MANIFEST.json does not describe where '
        + 'they point.',
      keys: overridden.map(e => e.key),
    });
  }

  return { entries, warnings };
}

export const EndpointRegistry = Object.freeze({ contract, url, source, redact, describeAll, keys: () => EndpointKeys, MANIFEST_GLOBAL });
export default EndpointRegistry;
