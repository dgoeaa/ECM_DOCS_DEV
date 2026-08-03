import { PUBLIC_DOCUMENT_KINDS } from '../../config/correspondence-categories.config.js';
import { normaliseFilename } from '../../config/filename-policy.config.js';
import { VerificationError } from './verification.js';
import { createMemoryReferenceStore, SEQUENCE_WIDTH } from './reference-store.js';

// Anonymous correspondence intake — TARGET_ARCHITECTURE.md §3.5, §3.6.
//
// This is the ONLY unauthenticated path through the proxy, and it exists because the
// document portal is a public channel: a citizen sending a letter to NITDA has no account
// and should not need one. Everything else in handler.js requires a validated token.
//
// Because it is unauthenticated it is deliberately narrow:
//
//   NO MUTATION OF EXISTING RECORDS
//                 It can create a submission and it can read back the status of ONE record
//                 the caller already identifies. It cannot list, search, or change anything
//                 that already exists.
//   RATE LIMITED  Per source address, fixed window, with a separate and stricter budget for
//                 status reads. An open create endpoint without this is a spam amplifier
//                 attached to a government workflow; an open read endpoint without it is an
//                 enumeration tool.
//   SIZE CAPPED   Bounded body, bounded attachment count, bounded declared size.
//   SERVER-MINTED REFERENCES  The registry reference is issued here. A client-chosen
//                 identifier is not a reference — two submitters would collide, and a
//                 malicious one could claim someone else's.
//
// The status read was added in step 6 and it weakened the create-only property this module
// started with, so the tradeoff is recorded rather than buried. See §status read-back below
// for what constrains it and, more importantly, for what does NOT.
//
// It validates the submission against the correspondence model rather than accepting
// whatever arrives: an intake channel that forwards unvalidated input is just a slower
// way of writing junk into the system of record.

/**
 * Correspondence categories the registry accepts from the public channel.
 *
 * Derived from config/correspondence-categories.config.js rather than restated, for the
 * same reason authorize.js imports the RBAC matrix instead of copying it: two lists drift,
 * and the drift is silent. This one had already drifted — it carried 'Invitation' where the
 * platform used 'Event Invitation', so a portal submission arrived with a category no
 * routing rule and no report would ever match (F-032).
 */
export const INTAKE_CATEGORIES = PUBLIC_DOCUMENT_KINDS;

export const INTAKE_LIMITS = Object.freeze({
  maxBodyBytes: 256 * 1024,   // metadata only — file bytes never come through this route
  maxAttachments: 20,
  maxAttachmentBytes: 100 * 1024 * 1024,
  maxSubjectChars: 300,
  maxDescriptionChars: 8000,
  windowMs: 60_000,
  perWindow: 5,               // submissions per address per window
});

/* Status reads get their own, tighter budget. A submission is a deliberate act a person
   performs a handful of times; a status read is the operation an attacker would repeat, so
   the two must not draw on a shared allowance. Ten per minute is far above what the
   tracking page needs and far below what guessing needs. */
export const STATUS_LIMITS = Object.freeze({
  maxBodyBytes: 4 * 1024,
  maxReferenceChars: 64,
  windowMs: 60_000,
  perWindow: 10,
  maxTimelineEntries: 50,
  maxNoteChars: 2000,
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
   NITDA-<year>-<sequence>.

   This used to keep the counter in a module variable seeded at 1, with a comment saying a
   real deployment must back it with a durable counter. Nothing enforced that, so two
   processes both minted NITDA-YYYY-000001 — two citizens with a receipt for one reference,
   and the register holding it twice.

   The sequence now comes from a STORE. The default is still in-memory, because the test
   suite and the dev host need it, but it reports `durable: false` so a deployment that
   requires durability can refuse to serve instead of finding out later. See
   reference-store.js for why that store must be a Durable Object and not KV. */
export function createReferenceMinter({
  prefix = 'NITDA', seed = 1, clock = () => new Date(), store,
} = {}) {
  const backing = store || createMemoryReferenceStore({ seed });
  return {
    durable: backing.durable === true,
    kind: backing.kind,
    async mint() {
      const year = clock().getUTCFullYear();
      const n = String(await backing.next(year)).padStart(SEQUENCE_WIDTH, '0');
      return `${prefix}-${year}-${n}`;
    },
    peek: () => (backing.peek ? backing.peek(clock().getUTCFullYear()) : null),
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
    /* The agency's Universal Filename Policy, applied where files actually enter the
       registry. Normalising rather than rejecting is deliberate: a citizen must not be
       turned away because their phone named the scan `IMG_20260101(1).jpg`. The name they
       sent is kept as `originalName` so the file can still be tied back to what they
       attached — storing only the normalised name would quietly rewrite their submission.
       Taking the basename is part of this now; it used to be the whole of it. */
    const policy = normaliseFilename(name);
    const safeName = policy.name;
    const size = Number(a.size);
    if (!Number.isFinite(size) || size < 0) throw new IntakeError('attachment_invalid_size', safeName);
    declaredBytes += size;
    if (declaredBytes > limits.maxAttachmentBytes) throw new IntakeError('attachments_too_large', `${declaredBytes} bytes declared`);
    const sha256 = str(a.sha256).toLowerCase();
    if (sha256 && !/^[a-f0-9]{64}$/.test(sha256)) throw new IntakeError('attachment_invalid_digest', safeName);
    return policy.changed
      ? { name: safeName, originalName: policy.original, renamed: policy.reasons, size, sha256 }
      : { name: safeName, size, sha256 };
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
 * Validate a helpdesk case.
 *
 * A support case is a create, like a submission, but it is NOT correspondence: it does not
 * enter the registry, does not get a registry reference, and must not be mapped onto a
 * correspondence category. Giving it its own shape keeps the two from being conflated in
 * the system of record.
 */
export function validateSupportCase(body, { limits = INTAKE_LIMITS } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new IntakeError('malformed_body');

  const name = str(body.name);
  if (!name) throw new IntakeError('missing_name');

  const email = str(body.email).toLowerCase();
  if (!email) throw new IntakeError('missing_email');
  if (!EMAIL.test(email)) throw new IntakeError('invalid_email');

  const message = str(body.message);
  if (!message) throw new IntakeError('missing_message');
  if (message.length > limits.maxDescriptionChars) throw new IntakeError('message_too_long', `${message.length} chars`);

  const topic = str(body.topic);
  // A submitter may quote a registry reference they are asking about. It is a hint for the
  // helpdesk, never a lookup key — this route cannot read a record under any circumstance.
  const aboutReference = str(body.aboutReference).slice(0, 64);

  return { name, email, topic, message, aboutReference };
}

/* ── status read-back ──────────────────────────────────────────────────────────
   TARGET_ARCHITECTURE.md §3.4. Until step 6 the tracking page reported whatever this
   browser's own localStorage said, so it could not show a decision the registry had
   actually made, and a submission made on a phone was invisible on a laptop. It was a
   local echo wearing the costume of a tracking system.

   The read is guarded by three things, and it is worth being precise about what each one
   does and does not buy:

     1. THE PAIR. A caller must present the reference AND the email it was submitted under.
     2. UNIFORM DENIAL. Unknown reference and wrong email return the identical response.
        Without this the route answers "does NITDA-2026-000318 exist?" for anybody who asks,
        which is an enumeration oracle over the registry's own numbering.
     3. ALLOW-LISTED PROJECTION. Only the fields below ever leave this function. The
        description, the attachment list, the assigned officer and the internal unit are not
        in it, so a successful guess yields status and dates, not the correspondence.

   What this does NOT buy, stated plainly: references are sequential (NITDA-<year>-<seq>),
   therefore guessable. The email is the only real secret in the pair, and it is a secret
   that submitters routinely publish. Rate limiting is what makes online guessing
   impractical — it is not a substitute for an unguessable reference. The durable fix is a
   high-entropy lookup token issued at submission and sent in the acknowledgement email;
   that is recorded as a finding rather than silently assumed away here. */

/** Validate a status lookup. Returns the pair; throws IntakeError on violation. */
export function validateStatusQuery(body, { limits = STATUS_LIMITS } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new IntakeError('malformed_body');

  const referenceId = str(body.referenceId).toUpperCase();
  if (!referenceId) throw new IntakeError('missing_reference');
  if (referenceId.length > limits.maxReferenceChars) throw new IntakeError('reference_too_long');
  // Deliberately a shape check, not a registry lookup: this rejects junk before it reaches
  // the upstream, and it must NOT distinguish "well-formed but unknown" from "known".
  if (!/^[A-Z0-9][A-Z0-9-]{5,}$/.test(referenceId)) throw new IntakeError('invalid_reference');

  const email = str(body.email).toLowerCase();
  if (!email) throw new IntakeError('missing_email');
  if (!EMAIL.test(email)) throw new IntakeError('invalid_email');

  return { referenceId, email };
}

/**
 * Reduce an upstream record to the citizen-visible view.
 *
 * Built by allow-list, never by deletion: a registry that starts returning a new internal
 * field must not have it appear on a public tracking page because nobody remembered to add
 * it to a blocklist.
 */
export function projectStatus(upstream, { limits = STATUS_LIMITS } = {}) {
  const r = upstream && typeof upstream === 'object' ? upstream : {};
  const raw = Array.isArray(r.timeline) ? r.timeline.slice(0, limits.maxTimelineEntries) : [];

  const timeline = raw.map(e => {
    const t = e && typeof e === 'object' ? e : {};
    // A note is only carried when the registry has explicitly marked the entry public.
    // Internal deliberation lives on the same timeline in most case systems, and the
    // default for anything not marked must be to withhold it.
    const isPublic = t.public === true;
    return {
      at: str(t.at),
      status: str(t.status),
      label: str(t.label),
      note: isPublic ? str(t.note).slice(0, limits.maxNoteChars) : '',
    };
  }).filter(e => e.at || e.label);

  return {
    referenceId:    str(r.referenceId) || str(r.reference),
    status:         str(r.status),
    statusLabel:    str(r.statusLabel),
    category:       str(r.category),
    subject:        str(r.subject),
    receivedAt:     str(r.receivedAt),
    acknowledgedAt: str(r.acknowledgedAt),
    updatedAt:      str(r.updatedAt),
    closedAt:       str(r.closedAt),
    actionRequired: r.actionRequired === true,
    timeline,
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
    config = {}, rateLimiter, statusRateLimiter, minter, broker, verifier,
    audit = () => {}, fetchImpl = fetch, correlationId = '', now = () => new Date(),
  } = deps;

  const ACTIONS = ['submission', 'support', 'status', 'verify', 'verify-confirm'];
  const action = String(req.path || '').split('/').filter(Boolean).pop() || '';
  if (!ACTIONS.includes(action)) {
    return { status: 404, headers: { 'Content-Type': 'application/json' },
             body: { ok: false, error: 'unknown_intake_action', action, correlationId } };
  }

  const key = sourceKey(req, { trustForwardedFor: !!config.trustForwardedFor });
  // Status reads draw on their own budget so that repeated lookups cannot exhaust a
  // legitimate submitter's ability to submit, and — the direction that matters — so that a
  // guessing run cannot hide inside the more generous submission allowance.
  const limiter = action === 'status' ? (statusRateLimiter || rateLimiter) : rateLimiter;
  const rl = limiter.check(action === 'status' ? `status:${key}` : key);
  if (!rl.allowed) {
    audit({ event: 'intake:rate-limited', correlationId, source: key, action, at: now().toISOString() });
    return { status: 429,
             headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) },
             body: { ok: false, error: 'rate_limited', retryAfterSeconds: rl.retryAfterSec, correlationId } };
  }

  /* ── D4 · email verification ────────────────────────────────────────────────
     Two steps, both anonymous and both rate limited. `verify` issues a code to an address;
     `verify-confirm` exchanges the code for a single-use proof that /intake/submission
     accepts. See proxy/src/verification.js for what this does and does not buy. */
  if (action === 'verify' || action === 'verify-confirm') {
    if (!verifier) {
      return { status: 503, headers: { 'Content-Type': 'application/json' },
               body: { ok: false, error: 'verification_not_available', correlationId } };
    }
    const email = str(req.body?.email).toLowerCase();
    if (!email || !EMAIL.test(email)) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: { ok: false, error: 'invalid_email', correlationId } };
    }

    if (action === 'verify') {
      let challenge;
      try { challenge = await verifier.issue(email); }
      catch (e) {
        audit({ event: 'intake:verify-throttled', correlationId, source: key, at: now().toISOString() });
        return { status: e.status || 400, headers: { 'Content-Type': 'application/json' },
                 body: { ok: false, error: e.reason, correlationId } };
      }

      /* The code goes out by mail, and this module never returns it to the caller — doing so
         would make the whole exercise decorative. With no mail endpoint configured the
         challenge is still issued and audited, and the response says `sent: false` so a
         deployment can see that verification is not actually reachable. */
      const target = config.endpoints?.INTAKE_VERIFY_EMAIL;
      let sent = false;
      if (target) {
        try {
          const res = await fetchImpl(target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
            body: JSON.stringify({ to: email, code: challenge.code, expiresAt: challenge.expiresAt }),
          });
          sent = res.ok;
        } catch { /* reported as sent:false */ }
      }
      audit({ event: 'intake:verify-issued', correlationId, source: key, sent, at: now().toISOString() });
      return { status: 202, headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
               body: { ok: true, sent, expiresAt: challenge.expiresAt, correlationId } };
    }

    // verify-confirm
    let proof;
    try { proof = await verifier.redeem(email, req.body?.code); }
    catch (e) {
      audit({ event: 'intake:verify-failed', correlationId, source: key,
              reason: e.reason, at: now().toISOString() });
      /* ONE reason for every failure. "no challenge", "expired" and "wrong code" are three
         different facts about an address, and telling them apart tells a caller whether an
         address has a live challenge — which is exactly what someone probing would want. */
      return { status: e.status || 400, headers: { 'Content-Type': 'application/json' },
               body: { ok: false, error: 'verification_failed', correlationId } };
    }
    audit({ event: 'intake:verify-confirmed', correlationId, source: key, at: now().toISOString() });
    return { status: 200, headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
             body: { ok: true, verification: proof.token, expiresAt: proof.expiresAt, correlationId } };
  }

  if (action === 'status') {
    let q;
    try {
      q = validateStatusQuery(req.body, { limits: config.statusLimits || STATUS_LIMITS });
    } catch (e) {
      audit({ event: 'intake:status-rejected', correlationId, source: key,
              reason: e.reason || 'error', at: now().toISOString() });
      return { status: e.status || 400, headers: { 'Content-Type': 'application/json' },
               body: { ok: false, error: 'invalid_status_query', reason: e.reason || 'error', correlationId } };
    }

    // The single denial. Unknown reference, wrong email and an upstream 404 all return
    // exactly this object — same status, same body, no distinguishing field. Every early
    // return below goes through it for that reason.
    const deny = () => ({
      status: 404, headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      body: { ok: false, error: 'not_found', correlationId },
    });

    const target = config.endpoints?.INTAKE_STATUS;
    if (!target) {
      // No read-back configured. Say so, rather than denying — a 404 here would tell the
      // submitter their request does not exist, which is a false statement about the
      // registry when the truth is that this proxy has nowhere to ask.
      audit({ event: 'intake:status-not-configured', correlationId, at: now().toISOString() });
      return { status: 503, headers: { 'Content-Type': 'application/json' },
               body: { ok: false, error: 'status_not_available', correlationId } };
    }

    let upstream = null;
    try {
      const res = await fetchImpl(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
        body: JSON.stringify({ referenceId: q.referenceId, email: q.email }),
      });
      if (res.status === 404) {
        audit({ event: 'intake:status-miss', correlationId, source: key, at: now().toISOString() });
        return deny();
      }
      if (!res.ok) {
        audit({ event: 'intake:status-upstream-error', correlationId, upstreamStatus: res.status,
                at: now().toISOString() });
        return { status: 502, headers: { 'Content-Type': 'application/json' },
                 body: { ok: false, error: 'status_upstream_error', correlationId } };
      }
      upstream = await res.json();
    } catch {
      audit({ event: 'intake:status-upstream-unreachable', correlationId, at: now().toISOString() });
      return { status: 502, headers: { 'Content-Type': 'application/json' },
               body: { ok: false, error: 'status_upstream_error', correlationId } };
    }

    // The email is re-checked here even though it was sent upstream. An upstream that
    // ignores the email parameter and matches on the reference alone would otherwise turn
    // this route into an unauthenticated read of any record — this proxy does not delegate
    // that check on the strength of an assumption about someone else's implementation.
    const record = upstream && typeof upstream === 'object' && upstream.record ? upstream.record : upstream;
    const onFile = str(record?.senderEmail || record?.email).toLowerCase();
    if (!onFile || onFile !== q.email) {
      audit({ event: 'intake:status-denied', correlationId, source: key, at: now().toISOString() });
      return deny();
    }

    audit({ event: 'intake:status-served', correlationId, source: key,
            referenceId: q.referenceId, at: now().toISOString() });
    return {
      status: 200, headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      body: { ok: true, record: projectStatus(record, { limits: config.statusLimits || STATUS_LIMITS }), correlationId },
    };
  }

  if (action === 'support') {
    let sup;
    try {
      sup = validateSupportCase(req.body, { limits: config.intakeLimits || INTAKE_LIMITS });
    } catch (e) {
      audit({ event: 'intake:support-rejected', correlationId, source: key,
              reason: e.reason || 'error', at: now().toISOString() });
      return { status: e.status || 400, headers: { 'Content-Type': 'application/json' },
               body: { ok: false, error: 'invalid_support_case', reason: e.reason || 'error', correlationId } };
    }
    // A case reference, not a registry reference — deliberately a different prefix so the
    // two can never be mistaken for one another in a log or by a person.
    const caseRef = `CASE-${(await minter.mint()).split('-').slice(1).join('-')}`;
    const at = now().toISOString();
    audit({ event: 'intake:support-accepted', correlationId, source: key, caseRef, at });

    const supTarget = config.endpoints?.INTAKE_SUPPORT;
    let delivered = false;
    if (supTarget) {
      try {
        const res = await fetchImpl(supTarget, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
          body: JSON.stringify({ ...sup, caseRef, receivedAt: at, source: 'document-portal' }),
        });
        delivered = res.ok;
      } catch { /* reported below as delivered:false */ }
    }
    return { status: 202, headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
             body: { ok: true, caseRef, receivedAt: at, delivered, correlationId } };
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

  /* D4 · verification is checked BEFORE the reference is minted. Minting first and then
     refusing would burn a registry sequence number on a rejected submission. */
  const verificationRequired = !!config.requireVerification;
  if (verificationRequired) {
    if (!verifier) {
      return { status: 503, headers: { 'Content-Type': 'application/json' },
               body: { ok: false, error: 'verification_not_available', correlationId } };
    }
    try {
      await verifier.consume(req.body?.verification, record.senderEmail);
    } catch (e) {
      audit({ event: 'intake:unverified-rejected', correlationId, source: key,
              reason: e.reason, at: now().toISOString() });
      return { status: e.status || 403, headers: { 'Content-Type': 'application/json' },
               body: { ok: false, error: 'verification_required', reason: e.reason, correlationId } };
    }
  }

  const referenceId = await minter.mint();
  const receivedAt = now().toISOString();

  /* One upload ticket per attachment (step 4). Each is a short-lived, single-use grant to
     upload ONE named file of THIS submission — not a credential for anything else. Without
     a broker configured the array is empty, which is the honest answer: the portal then
     keeps its existing dispatch path rather than being told uploads are available. */
  const uploads = broker
    ? await Promise.all(record.attachments.map(async (a, i) => {
        const t = await broker.issue({ referenceId, index: i, name: a.name, size: a.size, sha256: a.sha256 });
        return { name: a.name, size: a.size, ticket: t.ticket, expiresAt: t.expiresAt, uploadPath: '/intake/upload' };
      }))
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
                     reason: 'endpoint_not_configured', uploads, verified: verificationRequired, correlationId } };
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
      // Whether this reference was issued against a verified address. Stated rather than
      // implied: a deployment must not have to guess which posture it is running.
      verified: verificationRequired,
      correlationId,
    },
  };
}
