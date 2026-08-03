// Authenticating proxy — configuration.
//
// Everything sensitive comes from the environment. Nothing here is committed, and the
// signed Power Automate URLs never reach a browser — that is the whole point of the
// component (AUTHENTICATION_CONTRACT.md "Why a proxy").
//
// Required:
//   DGO_TENANT_ID          Entra tenant guid
//   DGO_AUDIENCE           expected aud (the API app-id URI or client id)
//   DGO_ROLE_MAP           JSON, e.g. {"DGO.Operator":"operator","DGO.Viewer":"viewer"}
//   DGO_ENDPOINT_<KEY>     one signed URL per endpoint contract key
//
// Optional:
//   DGO_ISSUER             defaults to the v2.0 issuer for the tenant
//   DGO_JWKS_URI           defaults to the tenant's discovery keys endpoint
//   DGO_ROLES_CLAIM        defaults to "roles"
//   DGO_CLOCK_SKEW_SEC     defaults to 60
//   DGO_UPSTREAM_TIMEOUT_MS defaults to 45000
//   PORT                   defaults to 8081

import { EndpointKeys } from '../../config/endpoints.config.js';

/* `globalThis.process?.env` rather than `process.env`: a Cloudflare Worker has no `process`,
   and this module must be importable there. The Worker host passes its `env` binding
   explicitly, so the default is only ever used by the Node host. */
export function loadConfig(source = globalThis.process?.env ?? {}) {
  const get = k => source[k];
  const tenantId = get('DGO_TENANT_ID') || '';
  const missing = [];
  if (!tenantId) missing.push('DGO_TENANT_ID');
  if (!get('DGO_AUDIENCE')) missing.push('DGO_AUDIENCE');

  let roleClaimMap = {};
  try { roleClaimMap = JSON.parse(get('DGO_ROLE_MAP') || '{}'); }
  catch { missing.push('DGO_ROLE_MAP (invalid JSON)'); }
  if (!Object.keys(roleClaimMap).length) missing.push('DGO_ROLE_MAP');

  // One signed URL per contract key, supplied as DGO_ENDPOINT_<KEY>.
  const endpoints = {};
  for (const key of EndpointKeys) {
    const v = get(`DGO_ENDPOINT_${key}`);
    if (v) endpoints[key] = v;
  }
  // The anonymous intake route forwards here. It is NOT one of EndpointKeys: those are
  // authenticated contracts, and mixing an unauthenticated destination into that list
  // would make it reachable from the authorization matrix.
  const intakeEndpoint = get('DGO_ENDPOINT_INTAKE_SUBMISSION');
  if (intakeEndpoint) endpoints.INTAKE_SUBMISSION = intakeEndpoint;
  // Where relayed attachment bytes are stored — the SharePoint document library, or a
  // broker in front of it. Reached with the proxy's credential, never the browser's.
  const uploadEndpoint = get('DGO_ENDPOINT_INTAKE_UPLOAD');
  if (uploadEndpoint) endpoints.INTAKE_UPLOAD = uploadEndpoint;
  const supportEndpoint = get('DGO_ENDPOINT_INTAKE_SUPPORT');
  if (supportEndpoint) endpoints.INTAKE_SUPPORT = supportEndpoint;

  // Status read-back. Absent, /intake/status answers 503 rather than denying — see the
  // §status read-back note in intake.js for why a 404 there would be a false statement.
  const statusEndpoint = get('DGO_ENDPOINT_INTAKE_STATUS');
  if (statusEndpoint) endpoints.INTAKE_STATUS = statusEndpoint;

  // Registry scan intake (channel C). Falls back to INTAKE_UPLOAD when unset so a single
  // library serves both channels; set it separately to file counter deposits apart from
  // public submissions.
  const scanEndpoint = get('DGO_ENDPOINT_SCAN_UPLOAD');
  if (scanEndpoint) endpoints.SCAN_UPLOAD = scanEndpoint;

  // D4 · where a verification code is sent. Absent, a challenge is still issued and audited
  // but the response says sent:false, so a deployment can see verification is unreachable.
  const verifyEndpoint = get('DGO_ENDPOINT_INTAKE_VERIFY_EMAIL');
  if (verifyEndpoint) endpoints.INTAKE_VERIFY_EMAIL = verifyEndpoint;

  return {
    tenantId,
    issuer: get('DGO_ISSUER') || (tenantId ? `https://login.microsoftonline.com/${tenantId}/v2.0` : ''),
    jwksUri: get('DGO_JWKS_URI') || (tenantId ? `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys` : ''),
    audience: get('DGO_AUDIENCE') || '',
    rolesClaim: get('DGO_ROLES_CLAIM') || 'roles',
    roleClaimMap,
    clockSkewSec: Number(get('DGO_CLOCK_SKEW_SEC') || 60),
    upstreamTimeoutMs: Number(get('DGO_UPSTREAM_TIMEOUT_MS') || 45_000),
    port: Number(get('PORT') || 8081),
    // Only trust X-Forwarded-For when the proxy genuinely sits behind a trusted front door.
    // Trusting it unconditionally lets any caller spoof a source address and defeat the
    // intake rate limit entirely.
    trustForwardedFor: String(get('DGO_TRUST_FORWARDED_FOR') || '') === 'true',
    intakeRefPrefix: get('DGO_INTAKE_REF_PREFIX') || 'NITDA',
    // Signs upload tickets. An unsigned ticket is a forgeable grant to write into the
    // document library, so there is no default and no fallback: absent means uploads are
    // unavailable, not that uploads are unsigned.
    uploadSecret: get('DGO_UPLOAD_SECRET') || '',
    // D4 · signs verification challenges and proofs. Same rule as the upload secret: absent
    // means the capability is unavailable, never that it runs unsigned.
    verifySecret: get('DGO_VERIFY_SECRET') || '',
    /* Defaults to FALSE deliberately. With no mail endpoint configured the proxy cannot send
       a code, so REQUIRING one would take the public submission channel offline — a control
       that silently stops citizens writing to a government registry is worse than the abuse
       it prevents. Turning it on is a deployment decision, and every submission response
       reports which posture issued it. */
    requireVerification: String(get('DGO_REQUIRE_VERIFICATION') || '') === 'true',
    endpoints,
    missing,
    configuredEndpoints: Object.keys(endpoints),
    unconfiguredEndpoints: EndpointKeys.filter(k => !endpoints[k]),
  };
}

/** Refuse to start misconfigured. A proxy that boots without an issuer enforces nothing. */
export function assertUsable(cfg) {
  if (cfg.missing.length) {
    throw new Error(
      `Proxy cannot start — missing configuration: ${cfg.missing.join(', ')}.\n` +
      `See proxy/README.md. Refusing to run: a proxy without an issuer or audience ` +
      `validates nothing and would be worse than no proxy at all.`
    );
  }
  return cfg;
}
