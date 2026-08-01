// DGO R11.6 — endpoint contract manager (Workstream F).
// Single owner of endpoint resolution. Feature modules never see a raw signed URL: they
// address endpoints by contract key, and the registry resolves the runtime target using,
// in priority order:
//   1. a deployment-injected runtime manifest (globalThis.__DGO_ENDPOINT_MANIFEST__),
//   2. an audited operator override stored in settings,
//   3. the packaged default carried in config/endpoints.config.js.
// The packaged defaults are signed Power Automate URLs and are therefore treated as a
// TEMPORARY posture (upgrade plan F2.1 option 4): the registry reports them through
// diagnostics so the rotation to a broker or injected manifest stays visible.
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
  const packaged = entries.filter(e => e.source === 'packaged-default');
  const warnings = [];
  if (packaged.length) {
    warnings.push({
      code: 'endpoint.packaged-signature',
      severity: 'warn',
      message: `${packaged.length} endpoint(s) still resolve to packaged signed URLs. Inject ${MANIFEST_GLOBAL} at deployment time or move to the endpoint broker; see evidence/ENDPOINT_CONTRACT_AUDIT.json for the rotation procedure.`,
      keys: packaged.map(e => e.key),
    });
  }
  const unconfigured = entries.filter(e => !e.configured);
  if (unconfigured.length) {
    warnings.push({ code: 'endpoint.unconfigured', severity: 'error', message: 'Endpoints without a resolvable target', keys: unconfigured.map(e => e.key) });
  }
  return { entries, warnings };
}

export const EndpointRegistry = Object.freeze({ contract, url, source, redact, describeAll, keys: () => EndpointKeys, MANIFEST_GLOBAL });
export default EndpointRegistry;
