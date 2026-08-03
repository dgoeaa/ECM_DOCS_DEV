// Authenticating proxy — Cloudflare Worker host.
//
// The second host for handler.js, alongside server.js. handler.js is transport-agnostic by
// design, so this file is only an adapter: read the request, call handleRequest, write the
// response. No routing, no validation and no security decision lives here — if a rule
// appears in this file that is not in server.js, the two hosts have diverged and one of them
// is wrong.
//
// WHAT THIS HOST IS FOR
// Cloudflare sits in front of the Power Automate flows. The flows keep their signed trigger
// URLs, but those URLs live in Worker secrets and are reachable only from here — a browser
// gets a bearer token and this Worker, never a flow URL. That is the same organising rule
// the Node host enforces; only the hosting moved.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// STATE: THE ONE THING THAT IS GENUINELY WEAKER HERE, STATED PLAINLY
//
// Five stores are in-memory: the rate limiter, the reference minter, the idempotency cache,
// the upload ticket burn-list, and the verification challenge/proof store. server.js already
// documents that these are per-instance and become N times more permissive behind N
// replicas.
//
// On Workers that caveat is stronger, and for two of them it is a different KIND of problem.
// An isolate serves many requests and lives for minutes, so this is not per-request state —
// but Cloudflare may run isolates in several colos at once and may evict one at any time.
// For the rate limiter and the minter that is a degradation. For the SINGLE-USE guarantees
// it is a correctness failure:
//
//   · an upload ticket burned in one isolate can be redeemed again in another
//   · a verification proof consumed in one isolate can be replayed in another
//
// "Single use" that holds most of the time is not single use. So this host REPORTS the scope
// it is actually enforcing rather than assuming the guarantee holds, and `/healthz` says so
// too. Bind a Durable Object or KV namespace and make the burn-lists durable before this
// carries production traffic — see docs/deployment/CLOUDFLARE.md.

import { loadConfig, assertUsable } from './config.js';
import { createJwks } from './jwt.js';
import { handleRequest, createIdempotencyStore } from './handler.js';
import { createRateLimiter, createReferenceMinter, STATUS_LIMITS } from './intake.js';
import { createUploadBroker } from './upload.js';
import { createVerificationService } from './verification.js';

const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

/**
 * Per-isolate singletons.
 *
 * Built once and reused for the isolate's life. Rebuilding per request would reset the
 * burn-lists on every call, which would turn the single-use checks into no-ops — a much
 * worse failure than the isolate-scoping described above, and a silent one.
 */
let CTX = null;

function context(env) {
  if (CTX) return CTX;

  const cfg = assertUsable(loadConfig(env));
  const audit = e => console.log(JSON.stringify(e));

  let verifier = null;
  if (cfg.verifySecret) {
    verifier = createVerificationService({ secret: cfg.verifySecret });
  } else if (cfg.requireVerification) {
    // Same refusal as the Node host: requiring a verification the proxy cannot issue would
    // take the public channel offline.
    throw new Error(
      'DGO_REQUIRE_VERIFICATION=true but DGO_VERIFY_SECRET is not set. Refusing to serve.');
  } else {
    audit({ event: 'proxy:verification-disabled', reason: 'DGO_VERIFY_SECRET not set' });
  }

  const broker = cfg.uploadSecret ? createUploadBroker({ secret: cfg.uploadSecret }) : null;
  if (!broker) audit({ event: 'proxy:upload-disabled', reason: 'DGO_UPLOAD_SECRET not set' });

  /* Single-use state is isolate-scoped unless a durable binding is present. Announced once
     per isolate so the posture appears in the logs of every deployment rather than only in
     a document nobody reads at 2am. */
  const durable = !!(env.DGO_STATE || env.DGO_STATE_DO);
  if (!durable) {
    audit({
      event: 'proxy:single-use-scope',
      scope: 'isolate',
      affects: ['upload-ticket-redemption', 'verification-proof-consumption', 'idempotency'],
      note: 'Burn-lists live in isolate memory. A ticket or proof burned in one isolate can '
          + 'be replayed in another. Bind DGO_STATE (KV) or DGO_STATE_DO (Durable Object) '
          + 'before production. See docs/deployment/CLOUDFLARE.md.',
    });
  }

  CTX = {
    cfg, audit, verifier, broker, durable,
    jwks: createJwks({ jwksUri: cfg.jwksUri }),
    idempotency: createIdempotencyStore(),
    rateLimiter: createRateLimiter(),
    statusRateLimiter: createRateLimiter({
      windowMs: STATUS_LIMITS.windowMs, perWindow: STATUS_LIMITS.perWindow,
    }),
    minter: createReferenceMinter({ prefix: cfg.intakeRefPrefix }),
  };
  return CTX;
}

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/**
 * Read the body.
 *
 * Upload redemption is raw bytes and must NOT be JSON-parsed or decoded to UTF-8, which
 * would corrupt every non-text file. The ceilings differ for the same reason they do in the
 * Node host: metadata has no business being megabytes, an attachment legitimately is.
 */
async function readBody(request, isUpload) {
  const declared = Number(request.headers.get('content-length') || 0);
  const cap = isUpload ? MAX_UPLOAD_BYTES : MAX_JSON_BYTES;
  if (Number.isFinite(declared) && declared > cap) throw new Error('payload_too_large');

  if (isUpload) {
    const buf = new Uint8Array(await request.arrayBuffer());
    // Content-Length is a claim; the actual bytes are the fact. Checked again after reading.
    if (buf.byteLength > cap) throw new Error('payload_too_large');
    return buf;
  }

  const text = await request.text();
  if (text.length > cap) throw new Error('payload_too_large');
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new Error('invalid_json'); }
}

export default {
  async fetch(request, env) {
    let ctx;
    try { ctx = context(env); }
    catch (e) {
      // A misconfigured proxy must not serve. Answering 503 with the reason is the same
      // fail-closed posture as the Node host refusing to start.
      console.log(JSON.stringify({ event: 'proxy:unusable', error: String(e.message) }));
      return json(503, { ok: false, error: 'proxy_not_configured' });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/healthz') {
      return json(200, {
        ok: true,
        host: 'cloudflare-worker',
        configuredEndpoints: ctx.cfg.configuredEndpoints.length,
        unconfigured: ctx.cfg.unconfiguredEndpoints,
        idempotencyEntries: ctx.idempotency.size(),
        // Reported, not assumed. A deployment must be able to see which guarantee it has.
        singleUseScope: ctx.durable ? 'durable' : 'isolate',
      });
    }

    const isUpload = request.method === 'PUT' && /^\/+intake\/+upload\/*$/.test(path);

    let body;
    try { body = await readBody(request, isUpload); }
    catch (e) { return json(400, { ok: false, error: String(e.message) }); }

    /* handler.js reads headers as a plain object, case-insensitively. Headers is a Map-like
       with lowercased keys, so this conversion is lossless for our purposes. */
    const headers = Object.fromEntries(request.headers);

    const out = await handleRequest(
      {
        method: request.method,
        path,
        headers,
        body,
        // Cloudflare's own header, set by the edge and not spoofable by the client — unlike
        // X-Forwarded-For, which is why sourceKey() only trusts that when told to.
        remoteAddress: request.headers.get('cf-connecting-ip') || '',
      },
      ctx,
    );

    return json(out.status, out.body, out.headers);
  },
};
