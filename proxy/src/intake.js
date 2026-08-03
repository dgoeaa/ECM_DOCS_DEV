// Anonymous correspondence intake — TARGET_ARCHITECTURE.md §3.5, §3.6.
//
// This is the ONLY unauthenticated path through the proxy, and it exists because the
// document portal is a public channel: a citizen sending a letter to NITDA has no account
// and should not need one. Everything else in handler.js requires a validated token.
//
// Because it is unauthenticated it is deliberately narrow:
//
//   CREATE ONLY   It can bring a new submission into the registry. It cannot read, list,
//                 search or mutate anything. There is no path from here to an existing
//                 record, so an anonymous caller cannot enumerate or alter correspondence.
//   RATE LIMITED  Per source address, fixed window. An open create endpoint without this
//                 is a spam amplifier attached to a government workflow.
//   SIZE CAPPED   Bounded body, bounded attachment count, bounded declared size.
//   SERVER-MINTED REFERENCES  The registry reference is issued here. A client-chosen
//                 identifier is not a reference — two submitters would collide, and a
//                 malicious one could claim someone else's.
//
// It validates the submission against the correspondence model rather than accepting
// whatever arrives: an intake channel that forwards unvalidated input is just a slower
// way of writing junk into the system of record.

/** Correspondence categories the registry accepts from the public channel. */
export const INTAKE_CATEGORIES = Object.freeze([
  'General Correspondence', 'Application', 'Proposal', 'Report',
  'Compliance Filing', 'Policy Submission', 'Invitation',
]);

export const INTAKE_LIMITS = Object.freeze({
  maxBodyBytes: 256 * 1024,   // metadata only — file bytes never come through this route
  maxAttachments: 20,
  maxAttachmentBytes: 100 * 1024 * 1024,
  maxSubjectChars: 300,
  maxDescriptionChars: 8000,
  windowMs: 60_000,
  perWindow: 5,               // submissions per address per window
});

export class IntakeError extends Error {
  constructor(reason, detail = '', status = 400) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = 'IntakeError';
    this.reason = reason;
    this.status = status;
  }
}

/* ── rate limiting ─────────────────────────────────────────────────────────────
   Fixed window, in memory. Adequate for a single instance; swap for Redis or a
   front-door WAF rule in a multi-instance deployment, where this becomes per-node
   and therefore N times more permissive than it looks. */
export function createRateLimiter({ windowMs = INTAKE_LIMITS.windowMs, perWindow = INTAKE_LIMITS.perWindow, max = 50_000 } = {}) {
  const hits = new Map(); // key -> { count, resetAt }
  return {
    check(key) {
      const now = Date.now();
      const e = hits.get(key);
      if (!e || now >= e.resetAt) {
        if (hits.size >= max) {
          for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
          if (hits.size >= max) hits.clear();   // pathological case: start clean
        }
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: perWindow - 1, retryAfterSec: 0 };
      }
      e.count += 1;
      if (e.count > perWindow) {
        return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((e.resetAt - now) / 1000) };
      }
      return { allowed: true, remaining: perWindow - e.count, retryAfterSec: 0 };
    },
    size: () => hits.size,
  };
}

/** Source address for rate limiting. Trusts a forwarding header only when configured to. */
export function sourceKey(req, { trustForwardedFor = false } = {}) {
  if (trustForwardedFor) {
    const xff = req.headers?.['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return req.remoteAddress || 'unknown';
}

/* ── reference minting ─────────────────────────────────────────────────────────
   NITDA-<year>-<sequence>. The sequence is monotonic within a process; a real
   deployment must back it with a durable counter or the registry's own numbering,
   or two instances will mint the same reference. Stated rather than hidden — this
   is the one part of intake that cannot stay in memory. */
export function createReferenceMinter({ prefix = 'NITDA', seed = 1, clock = () => new Date() } = {}) {
  let seq = seed;
  return {
    mint() {
      const year = clock().getUTCFullYear();
      const n = String(seq++).padStart(6, '0');
      return `${prefix}-${year}-${n}`;
    },
    peek: () => seq,
  };
}

/* ── validation ────────────────────────────────────────────────────────────── */

const str = v => (typeof v === 'string' ? v.trim() : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/**
 * Validate an intake submission against the correspondence model.
 * Returns a normalised record; throws IntakeError on the first violation.
 *
 * Normalisation matters as much as rejection: the record that reaches the registry is
 * built here from known fields, so anything extra a caller sends is dropped rather than
 * forwarded. That is the same principle as stripAssertedIdentity on the authenticated
 * path — never pass through what you did not validate.
 */
export function validateSubmission(body, { categories = INTAKE_CATEGORIES, limits = INTAKE_LIMITS } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new IntakeError('malformed_body');

  const subject = str(body.subject);
  if (!subject) throw new IntakeError('missing_subject');
  if (subject.length > limits.maxSubjectChars) throw new IntakeError('subject_too_long', `${subject.length} chars`);

  const category = str(body.category);
  if (!category) throw new IntakeError('missing_category');
  if (!categories.includes(category)) throw new IntakeError('unknown_category', category);

  // Only 'Incoming' is meaningful from a public channel. 'Registry' and 'Email' describe
  // internal origination and the mailbox channel; accepting them here would let an
  // anonymous caller mislabel where a document came from.
  const correspondenceType = str(body.correspondenceType) || 'Incoming';
  if (correspondenceType !== 'Incoming') throw new IntakeError('unsupported_correspondence_type', correspondenceType);

  const senderEmail = str(body.senderEmail).toLowerCase();
  if (!senderEmail) throw new IntakeError('missing_sender_email');
  if (!EMAIL.test(senderEmail)) throw new IntakeError('invalid_sender_email');

  const sender = body.sender && typeof body.sender === 'object' ? body.sender : {};
  const senderName = str(sender.name);
  if (!senderName) throw new IntakeError('missing_sender_name');

  const description = str(body.description);
  if (description.length > limits.maxDescriptionChars) throw new IntakeError('description_too_long', `${description.length} chars`);

  const raw = body.attachments;
  if (raw !== undefined && !Array.isArray(raw)) throw new IntakeError('malformed_attachments');
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > limits.maxAttachments) throw new IntakeError('too_many_attachments', `${list.length}`);

  let declaredBytes = 0;
  const attachments = list.map((a, i) => {
    if (!a || typeof a !== 'object') throw new IntakeError('malformed_attachment', `index ${i}`);
    const name = str(a.name);
    if (!name) throw new IntakeError('attachment_missing_name', `index ${i}`);
    // A path separator in a declared filename is either a mistake or an attempt to
    // influence where the file lands. Neither is acceptable; take the basename.
    const safeName = name.split(/[\\/]/).pop();
    const size = Number(a.size);
    if (!Number.isFinite(size) || size < 0) throw new IntakeError('attachment_invalid_size', safeName);
    declaredBytes += size;
    if (declaredBytes > limits.maxAttachmentBytes) throw new IntakeError('attachments_too_large', `${declaredBytes} bytes declared`);
    const sha256 = str(a.sha256).toLowerCase();
    if (sha256 && !/^[a-f0-9]{64}$/.test(sha256)) throw new IntakeError('attachment_invalid_digest', safeName);
    return { name: safeName, size, sha256 };
  });

  return {
    channel: 'Portal',
    correspondenceType,
    subject,
    category,
    senderEmail,
    sender: {
      name: senderName,
      organisation: str(sender.organisation),
      organisationType: str(sender.organisationType),
    },
    senderPhone: str(body.senderPhone),
    eventDate: str(body.eventDate),
    description,
    attachments,
    declaredBytes,
  };
}

/**
 * Handle POST /intake/submission.
 *
 * Deliberately returns 202 rather than 200: the registry has accepted the submission for
 * processing and issued a reference, but classification and routing have not happened yet.
 * Saying 200 would claim more than is true.
 */
export async function handleIntake(req, deps) {
  const {
    config = {}, rateLimiter, minter, broker, audit = () => {}, fetchImpl = fetch,
    correlationId = '', now = () => new Date(),
  } = deps;

  const action = String(req.path || '').split('/').filter(Boolean).pop() || '';
  if (action !== 'submission') {
    return { status: 404, headers: { 'Content-Type': 'application/json' },
             body: { ok: false, error: 'unknown_intake_action', action, correlationId } };
  }

  const key = sourceKey(req, { trustForwardedFor: !!config.trustForwardedFor });
  const rl = rateLimiter.check(key);
  if (!rl.allowed) {
    audit({ event: 'intake:rate-limited', correlationId, source: key, at: now().toISOString() });
    return { status: 429,
             headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) },
             body: { ok: false, error: 'rate_limited', retryAfterSeconds: rl.retryAfterSec, correlationId } };
  }

  let record;
  try {
    record = validateSubmission(req.body, {
      categories: config.intakeCategories || INTAKE_CATEGORIES,
      limits: config.intakeLimits || INTAKE_LIMITS,
    });
  } catch (e) {
    audit({ event: 'intake:rejected', correlationId, source: key,
            reason: e.reason || 'error', at: now().toISOString() });
    return { status: e.status || 400, headers: { 'Content-Type': 'application/json' },
             body: { ok: false, error: 'invalid_submission', reason: e.reason || 'error', correlationId } };
  }

  const referenceId = minter.mint();
  const receivedAt = now().toISOString();

  /* One upload ticket per attachment (step 4). Each is a short-lived, single-use grant to
     upload ONE named file of THIS submission — not a credential for anything else. Without
     a broker configured the array is empty, which is the honest answer: the portal then
     keeps its existing dispatch path rather than being told uploads are available. */
  const uploads = broker
    ? record.attachments.map((a, i) => {
        const t = broker.issue({ referenceId, index: i, name: a.name, size: a.size, sha256: a.sha256 });
        return { name: a.name, size: a.size, ticket: t.ticket, expiresAt: t.expiresAt, uploadPath: '/intake/upload' };
      })
    : [];

  // The audit line records what arrived and from where. The submitter's email is part of
  // the correspondence record itself, so it is not extra exposure to log the reference
  // against it — but the description and attachment names are not logged.
  audit({ event: 'intake:accepted', correlationId, source: key, referenceId,
          category: record.category, attachments: record.attachments.length, at: receivedAt });

  const target = config.endpoints?.INTAKE_SUBMISSION;
  if (!target) {
    // No downstream configured. The reference has been minted and the caller is told the
    // submission is accepted-but-not-yet-delivered, rather than being given a false success.
    audit({ event: 'intake:endpoint-not-configured', correlationId, referenceId, at: receivedAt });
    return { status: 202, headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
             body: { ok: true, referenceId, receivedAt, delivered: false,
                     reason: 'endpoint_not_configured', uploads, correlationId } };
  }

  let delivered = false, upstreamStatus = 0;
  try {
    const res = await fetchImpl(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      body: JSON.stringify({ ...record, referenceId, receivedAt, source: 'document-portal' }),
    });
    upstreamStatus = res.status;
    delivered = res.ok;
  } catch (e) {
    audit({ event: 'intake:upstream-unreachable', correlationId, referenceId, at: now().toISOString() });
  }

  audit({ event: 'intake:forwarded', correlationId, referenceId, delivered,
          upstreamStatus, at: now().toISOString() });

  return {
    status: 202,
    headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    body: {
      ok: true,
      referenceId,
      receivedAt,
      delivered,
      // One ticket per attachment. Redeem each at PUT /intake/upload with the ticket in
      // an X-Upload-Ticket header and the raw file as the body.
      uploads,
      correlationId,
    },
  };
}
