// Upload brokering — TARGET_ARCHITECTURE.md §3.3, step 4.
//
// WHY THIS EXISTS
// The portal used to base64-encode a file into a JSON workflow payload. That is what
// forced the 4 MB ceiling and the one-file-only behaviour behind F-028: base64 inflates a
// payload by a third, so the transport limit became a silent data-loss bug. Moving bytes
// out of the payload removes the ceiling and the failure mode together.
//
// A DEPARTURE FROM §3.3, STATED RATHER THAN SLIPPED IN
// The architecture document says the client "uploads each file directly to that target",
// i.e. the proxy hands the browser a SharePoint upload URL. On implementing it that is the
// wrong call: a Graph upload-session URL is a bearer credential, and handing one to a
// browser reintroduces exactly the class of problem this architecture exists to retire —
// weaker than a SAS flow trigger, but the same shape.
//
// So uploads are RELAYED through the proxy instead. The client redeems a ticket; the proxy
// verifies it, verifies the bytes, and streams to SharePoint using the credential only it
// holds. Correspondence attachments are single-digit megabytes, so the bandwidth cost is
// trivial, and relaying buys two things a redirect cannot:
//
//   1. The declared sha256 and size are VERIFIED against the actual bytes. Intake already
//      collects both; without relaying they are decoration.
//   2. No credential for a system of record ever reaches a browser — the organising rule.
//
// THE TICKET
// An HMAC-signed, short-lived, single-use grant to upload ONE named file of ONE submission.
// It is not a credential for anything else: it names its file, carries its own expiry, and
// is burned on redemption.

import crypto from 'node:crypto';
import { normaliseFilename, FILENAME_LIMITS } from '../../config/filename-policy.config.js';

export const UPLOAD_LIMITS = Object.freeze({
  maxFileBytes: 25 * 1024 * 1024,   // per attachment, actual bytes
  ticketTtlMs: 30 * 60_000,         // 30 minutes to complete an upload
  maxOutstanding: 20_000,
});

export class UploadError extends Error {
  constructor(reason, detail = '', status = 400) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = 'UploadError';
    this.reason = reason;
    this.status = status;
  }
}

const b64u = buf => Buffer.from(buf).toString('base64url');
const fromB64u = s => Buffer.from(String(s), 'base64url');

/**
 * Ticket broker.
 *
 * `secret` must be supplied and must not be guessable — an unsigned ticket is a forgeable
 * upload grant. config.js refuses to start without one when intake is enabled.
 */
export function createUploadBroker({
  secret,
  ttlMs = UPLOAD_LIMITS.ticketTtlMs,
  maxOutstanding = UPLOAD_LIMITS.maxOutstanding,
  now = () => Date.now(),
} = {}) {
  if (!secret || String(secret).length < 32) {
    throw new Error('createUploadBroker: a secret of at least 32 characters is required');
  }
  const key = Buffer.from(String(secret), 'utf8');

  // Redeemed ticket ids. A ticket is single-use: replaying one must not overwrite a file
  // that has already been accepted, or an attacker who observes a ticket could replace a
  // submitted document after the fact.
  const consumed = new Map(); // id -> expiry

  const sweep = () => {
    const t = now();
    for (const [id, exp] of consumed) if (t > exp) consumed.delete(id);
  };

  const sign = payload => {
    const body = b64u(JSON.stringify(payload));
    const mac = b64u(crypto.createHmac('sha256', key).update(body).digest());
    return `${body}.${mac}`;
  };

  return {
    /** One ticket per attachment of one submission. */
    issue({ referenceId, index, name, size, sha256 }) {
      const id = crypto.randomUUID();
      const exp = now() + ttlMs;
      return {
        ticket: sign({ id, referenceId, index, name, size, sha256: sha256 || '', exp }),
        expiresAt: new Date(exp).toISOString(),
      };
    },

    /**
     * Verify a ticket and burn it. Throws UploadError on anything suspect.
     * Order matters: signature before payload, so a malformed forgery is rejected before
     * any of its fields are read.
     */
    redeem(ticket) {
      if (typeof ticket !== 'string' || !ticket.includes('.')) throw new UploadError('malformed_ticket');
      const [body, mac] = ticket.split('.');
      if (!body || !mac) throw new UploadError('malformed_ticket');

      const expected = crypto.createHmac('sha256', key).update(body).digest();
      let given;
      try { given = fromB64u(mac); } catch { throw new UploadError('malformed_ticket'); }
      // Constant-time compare, and length-checked first because timingSafeEqual throws on
      // a length mismatch rather than returning false.
      if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
        throw new UploadError('bad_ticket_signature', '', 403);
      }

      let payload;
      try { payload = JSON.parse(fromB64u(body).toString('utf8')); }
      catch { throw new UploadError('malformed_ticket'); }

      if (now() > payload.exp) throw new UploadError('ticket_expired', '', 410);

      sweep();
      if (consumed.has(payload.id)) throw new UploadError('ticket_already_used', '', 409);
      if (consumed.size >= maxOutstanding) sweep();
      consumed.set(payload.id, payload.exp);

      return payload;
    },

    outstanding: () => consumed.size,
  };
}

/* ── shared byte handling ──────────────────────────────────────────────────────
   Two routes bring documents into the library — the anonymous ticketed one below, and the
   authenticated registry scan intake (step 7). They differ ONLY in how the caller is
   authorised. What happens to the bytes afterwards — the size ceiling, the declared-size
   check, the digest check, the relay, what counts as stored — must not diverge, or the
   two channels end up with different guarantees about the same document library.
   Hence one implementation of each, used by both. */

/**
 * Check the bytes against what was declared. Returns the computed digest.
 * Throws UploadError; never guesses which of two disagreeing values is right.
 */
export function verifyBytes(body, { declaredSize, declaredSha256, limits = UPLOAD_LIMITS } = {}) {
  if (!Buffer.isBuffer(body)) throw new UploadError('missing_body');
  if (body.length > limits.maxFileBytes) {
    throw new UploadError('file_too_large', `${body.length} bytes`, 413);
  }
  if (Number.isFinite(declaredSize) && declaredSize > 0 && body.length !== declaredSize) {
    throw new UploadError('size_mismatch', `declared ${declaredSize}, got ${body.length}`, 409);
  }
  const digest = crypto.createHash('sha256').update(body).digest('hex');
  if (declaredSha256 && digest !== declaredSha256) throw new UploadError('digest_mismatch', '', 409);
  return digest;
}

/**
 * Tell the caller their file was renamed, and why.
 *
 * Silent renaming is the failure mode to avoid here. An officer who deposits
 * `Ministry Reply FINAL.pdf` and gets back a receipt saying `name: ministry_reply_final.pdf`
 * with no explanation reasonably concludes the system is unreliable; one who is told the
 * policy normalised it learns the standard. Absent from the response entirely when nothing
 * changed, so a compliant name produces no noise.
 */
export function renameNotice(policy) {
  if (!policy?.changed) return {};
  return {
    declaredName: policy.original,
    renamed: { to: policy.name, reasons: policy.reasons, policy: 'universal-filename-policy-v1.0' },
  };
}

/**
 * Stream verified bytes to the document library.
 *
 * The credential for the library lives in server-side configuration and is never sent to a
 * browser — that is the organising rule this proxy exists to enforce. Returns
 * `{ stored, link }`; an unreachable library is reported, not thrown, because the caller
 * needs to distinguish "we accepted this and could not file it" from "we refused this".
 */
export async function relayToLibrary({
  target, body, digest, reference, filename,
  correlationId = '', fetchImpl = fetch, audit = () => {}, now = () => new Date(),
}) {
  let stored = false, link = '';
  try {
    const res = await fetchImpl(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Correlation-Id': correlationId,
        'X-DGO-Reference': reference,
        'X-DGO-Filename': encodeURIComponent(filename),
        'X-DGO-Sha256': digest,
      },
      body,
    });
    stored = res.ok;
    if (res.ok) {
      let data = {};
      try { data = await res.json(); } catch { /* a bare 200 is still a success */ }
      link = data.webUrl || data.documentUrl || data.link || '';
    }
  } catch {
    audit({ event: 'upload:upstream-unreachable', correlationId, referenceId: reference,
            at: now().toISOString() });
  }
  return { stored, link };
}

/**
 * Handle PUT /intake/upload.
 *
 * The ticket travels in a header rather than the path so it never lands in a proxy access
 * log or a Referer. The body is the raw file.
 */
export async function handleUpload(req, deps) {
  const {
    config = {}, broker, audit = () => {}, fetchImpl = fetch,
    correlationId = '', now = () => new Date(),
  } = deps;

  if (!broker) {
    return json(503, { ok: false, error: 'upload_not_available', correlationId });
  }

  const ticket = req.headers?.['x-upload-ticket'] || req.headers?.['X-Upload-Ticket'] || '';
  let grant;
  try {
    grant = broker.redeem(ticket);
  } catch (e) {
    audit({ event: 'upload:rejected', correlationId, reason: e.reason || 'error', at: now().toISOString() });
    return json(e.status || 400, { ok: false, error: 'invalid_ticket', reason: e.reason || 'error', correlationId });
  }

  const body = req.body;
  let digest;
  try {
    digest = verifyBytes(body, {
      declaredSize: grant.size, declaredSha256: grant.sha256,
      limits: config.uploadLimits || UPLOAD_LIMITS,
    });
  } catch (e) {
    audit({ event: 'upload:rejected', correlationId, referenceId: grant.referenceId,
            reason: e.reason, at: now().toISOString() });
    return json(e.status || 400, { ok: false, error: e.reason, correlationId });
  }

  // Accepted: the ticket was valid and the bytes match what was declared. Audited here,
  // BEFORE the storage attempt, because acceptance and storage are different outcomes —
  // a file can be legitimately accepted and still fail to reach the library, and an audit
  // trail that only records the happy path cannot tell those apart afterwards.
  audit({ event: 'upload:accepted', correlationId, referenceId: grant.referenceId,
          index: grant.index, bytes: body.length, at: now().toISOString() });

  const target = config.endpoints?.INTAKE_UPLOAD;
  if (!target) {
    audit({ event: 'upload:endpoint-not-configured', correlationId, referenceId: grant.referenceId,
            at: now().toISOString() });
    return json(202, { ok: true, referenceId: grant.referenceId, name: grant.name,
                       bytes: body.length, sha256: digest, stored: false,
                       reason: 'endpoint_not_configured', correlationId });
  }

  const { stored, link } = await relayToLibrary({
    target, body, digest, reference: grant.referenceId, filename: grant.name,
    correlationId, fetchImpl, audit, now,
  });

  audit({ event: 'upload:stored', correlationId, referenceId: grant.referenceId,
          index: grant.index, stored, at: now().toISOString() });

  return json(stored ? 201 : 202, {
    ok: true,
    referenceId: grant.referenceId,
    name: grant.name,
    bytes: body.length,
    sha256: digest,
    stored,
    attachmentLink: link,
    correlationId,
  });
}

/* ── registry scan intake — TARGET_ARCHITECTURE.md §3.2 channel C, step 7 ──────
   A clerk at the registry counter scans a physical document. Same destination library and
   the same byte guarantees as the portal path; the difference is entirely in the caller.

   NO TICKET HERE, AND THAT IS THE POINT. A ticket exists so an ANONYMOUS caller can be
   granted exactly one narrow thing. An authenticated staff member has already presented a
   verified token and passed a role check, so re-issuing them a ticket would add a round
   trip and no security — the bearer token IS the authorisation, and it carries an identity
   the ticket never could. What the two paths must NOT differ on is what happens to the
   bytes, which is why both call verifyBytes and relayToLibrary.

   Metadata travels in headers rather than a multipart body: the body is the raw file, so
   there is nothing to parse and no boundary handling to get wrong. */

export const SCAN_LIMITS = Object.freeze({
  maxFilenameChars: 200,
});

/**
 * Handle PUT /documents/scan.
 *
 * `identity` comes from the verified token — handler.js authenticates and authorises before
 * calling this. It is recorded as the depositing officer, which is the whole reason this
 * path is authenticated: a registry deposit that cannot be attributed to a person is not a
 * custody record.
 */
export async function handleScanIntake(req, deps) {
  const {
    config = {}, identity = {}, audit = () => {}, fetchImpl = fetch,
    minter, correlationId = '', now = () => new Date(),
  } = deps;

  const h = k => String(req.headers?.[k] ?? req.headers?.[k.toLowerCase()] ?? '');

  /* Decode BEFORE normalising. The header is percent-encoded, so `%2e%2e%2f` is a path
     separator that only exists after decoding — normalising first would leave it intact and
     the basename step would be looking at the wrong string. */
  let declaredName = '';
  try { declaredName = decodeURIComponent(h('x-dgo-filename')).trim(); }
  catch { declaredName = h('x-dgo-filename').trim(); }
  if (!declaredName) {
    return json(400, { ok: false, error: 'missing_filename', correlationId });
  }
  // The agency's Universal Filename Policy. A registry deposit is named by an officer, so
  // unlike the public path this one also reports what it changed, so the officer learns the
  // standard rather than silently having their names rewritten forever.
  const policy = normaliseFilename(declaredName, {
    limits: { ...FILENAME_LIMITS, maxBodyChars: SCAN_LIMITS.maxFilenameChars },
  });
  const filename = policy.name;

  const declaredSha256 = h('x-dgo-sha256').toLowerCase();
  if (declaredSha256 && !/^[a-f0-9]{64}$/.test(declaredSha256)) {
    return json(400, { ok: false, error: 'invalid_digest', correlationId });
  }
  const declaredSize = Number(h('x-dgo-size'));

  // The reference is minted HERE, not accepted from the client. modules/correspondence.js
  // mints `NITDA-${Date.now().toString().slice(-6)}` in the browser, which collides under
  // concurrency and is chosen by the caller. A registry reference must be neither.
  const referenceId = h('x-dgo-reference').trim().toUpperCase() || (minter ? minter.mint() : '');
  if (!referenceId) {
    return json(503, { ok: false, error: 'reference_minter_unavailable', correlationId });
  }

  let digest;
  try {
    digest = verifyBytes(req.body, {
      declaredSize, declaredSha256, limits: config.uploadLimits || UPLOAD_LIMITS,
    });
  } catch (e) {
    audit({ event: 'scan:rejected', correlationId, referenceId, subject: identity.subject,
            reason: e.reason, at: now().toISOString() });
    return json(e.status || 400, { ok: false, error: e.reason, correlationId });
  }

  // Attribution before storage, for the same reason as the intake path: accepted and filed
  // are different events, and only recording the second loses the ability to tell a failed
  // filing from a deposit that never happened.
  audit({ event: 'scan:accepted', correlationId, referenceId, filename,
          ...(policy.changed ? { declaredName: policy.original, renamed: policy.reasons } : {}),
          subject: identity.subject, email: identity.email,
          bytes: req.body.length, sha256: digest, at: now().toISOString() });

  const target = config.endpoints?.SCAN_UPLOAD || config.endpoints?.INTAKE_UPLOAD;
  if (!target) {
    audit({ event: 'scan:endpoint-not-configured', correlationId, referenceId, at: now().toISOString() });
    return json(202, { ok: true, referenceId, name: filename, bytes: req.body.length,
                       sha256: digest, stored: false, reason: 'endpoint_not_configured',
                       ...renameNotice(policy),
                       depositedBy: identity.email || '', correlationId });
  }

  const { stored, link } = await relayToLibrary({
    target, body: req.body, digest, reference: referenceId, filename,
    correlationId, fetchImpl, audit, now,
  });

  audit({ event: 'scan:stored', correlationId, referenceId, stored,
          subject: identity.subject, at: now().toISOString() });

  return json(stored ? 201 : 202, {
    ok: true,
    referenceId,
    name: filename,
    bytes: req.body.length,
    sha256: digest,
    stored,
    attachmentLink: link,
    ...renameNotice(policy),
    // Returned so the workspace can write it onto the correspondence record. It comes from
    // the token, never from the request body — a clerk cannot deposit as a colleague.
    depositedBy: identity.email || '',
    depositedAt: now().toISOString(),
    correlationId,
  });
}

const json = (status, body, headers = {}) => ({
  status, headers: { 'Content-Type': 'application/json', ...headers }, body,
});
