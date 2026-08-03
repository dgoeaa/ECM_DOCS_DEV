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
  if (!Buffer.isBuffer(body)) {
    audit({ event: 'upload:rejected', correlationId, referenceId: grant.referenceId,
            reason: 'missing_body', at: now().toISOString() });
    return json(400, { ok: false, error: 'missing_body', correlationId });
  }

  const limits = config.uploadLimits || UPLOAD_LIMITS;
  if (body.length > limits.maxFileBytes) {
    audit({ event: 'upload:rejected', correlationId, referenceId: grant.referenceId,
            reason: 'file_too_large', bytes: body.length, at: now().toISOString() });
    return json(413, { ok: false, error: 'file_too_large', maxBytes: limits.maxFileBytes, correlationId });
  }

  // The size the submission declared is now checkable against what actually arrived. A
  // mismatch means the two do not describe the same file, which is a reason to refuse
  // rather than to guess which one is right.
  if (Number.isFinite(grant.size) && grant.size > 0 && body.length !== grant.size) {
    audit({ event: 'upload:size-mismatch', correlationId, referenceId: grant.referenceId,
            declared: grant.size, actual: body.length, at: now().toISOString() });
    return json(409, { ok: false, error: 'size_mismatch', declared: grant.size, actual: body.length, correlationId });
  }

  const digest = crypto.createHash('sha256').update(body).digest('hex');
  if (grant.sha256 && digest !== grant.sha256) {
    audit({ event: 'upload:digest-mismatch', correlationId, referenceId: grant.referenceId,
            at: now().toISOString() });
    return json(409, { ok: false, error: 'digest_mismatch', correlationId });
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

  // The credential for the document library lives here and is never sent to the browser.
  let stored = false, link = '';
  try {
    const res = await fetchImpl(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Correlation-Id': correlationId,
        'X-DGO-Reference': grant.referenceId,
        'X-DGO-Filename': encodeURIComponent(grant.name),
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
    audit({ event: 'upload:upstream-unreachable', correlationId, referenceId: grant.referenceId,
            at: now().toISOString() });
  }

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

const json = (status, body, headers = {}) => ({
  status, headers: { 'Content-Type': 'application/json', ...headers }, body,
});
