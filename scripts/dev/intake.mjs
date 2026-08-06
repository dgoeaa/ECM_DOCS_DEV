// Anonymous intake and the authenticated scan path, implemented locally.
//
// Same request bodies and same response fields as the intake and `/documents/scan` flow
// contracts in document-portal/README.md, so document-portal/js/core.js and
// core/scan-intake-service.js need no change to talk to this.
//
// What is deliberately NOT reproduced: token validation, role authorization and identity
// stripping. In production those are each flow's own responsibility, and they need a verified
// proof. This file accepts what it is given and records it. It is a development stand-in,
// and the banner in dev-server.mjs says so on every start.
//
// What IS reproduced, because leaving it out would change how the portal behaves:
//   · server-minted references — a client-supplied one never survives
//   · the record rebuilt from known fields, so extra keys are dropped
//   · single-use, expiring, HMAC-signed upload tickets
//   · declared size and sha256 verified against the bytes that actually arrive
//   · the uniform 404 on status read-back, so an unknown reference and a wrong email
//     are indistinguishable

import crypto from 'node:crypto';

const now = () => new Date().toISOString();
const str = v => String(v ?? '').trim();

export const LIMITS = Object.freeze({
  maxAttachments: 5,
  maxFileBytes: 10 * 1024 * 1024,
  maxScanBytes: 25 * 1024 * 1024,
  ticketTtlMs: 15 * 60 * 1000,
});

/* Signs upload tickets. Generated per process: a ticket must not survive a restart, and a
   dev secret written to disk is a dev secret that eventually gets copied somewhere real. */
const TICKET_SECRET = crypto.randomBytes(32);
const consumedTickets = new Set();

function signTicket(claims) {
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const mac = crypto.createHmac('sha256', TICKET_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verifyTicket(ticket) {
  const [body, mac] = str(ticket).split('.');
  if (!body || !mac) return { ok: false, reason: 'malformed' };

  const expected = crypto.createHmac('sha256', TICKET_SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'bad_signature' };

  let claims;
  try { claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch { return { ok: false, reason: 'malformed' }; }

  if (Date.parse(claims.exp) < Date.now()) return { ok: false, reason: 'expired' };
  if (consumedTickets.has(ticket)) return { ok: false, reason: 'already_redeemed' };
  return { ok: true, claims };
}

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

/* A fixed code, printed in the server banner. The real flow mails one; there is no mail
   here, so a random code would only lock the submitter out of their own submission. */
export const DEV_VERIFY_CODE = '123456';
const verifyChallenges = new Map();

/** Categories the portal may claim. `channel` and `correspondenceType` are fixed here. */
const PUBLIC_CATEGORIES = [
  'General Correspondence', 'Application', 'Proposal', 'Report',
  'Compliance Filing', 'Policy Submission', 'Event Invitation',
];

/**
 * Rebuild the submission from known fields. Anything else a caller sends is dropped —
 * the same principle as stripAssertedIdentity on the authenticated path.
 */
function rebuildSubmission(body) {
  const errors = [];
  const email = str(body.email).toLowerCase();
  const title = str(body.title || body.subject);
  const name = str(body.name || body.contactName);

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('A valid email address is required.');
  if (!title) errors.push('A subject or title is required.');
  if (!name) errors.push('A contact name is required.');

  const declared = Array.isArray(body.files) ? body.files : Array.isArray(body.attachments) ? body.attachments : [];
  if (declared.length > LIMITS.maxAttachments) errors.push(`At most ${LIMITS.maxAttachments} attachments.`);

  const files = declared.slice(0, LIMITS.maxAttachments).map(f => ({
    name: str(f.name) || 'attachment',
    size: Number(f.size) || 0,
    sha256: str(f.sha256),
  }));
  for (const f of files) {
    if (f.size > LIMITS.maxFileBytes) errors.push(`${f.name} exceeds ${LIMITS.maxFileBytes / 1048576} MB.`);
  }

  const category = PUBLIC_CATEGORIES.includes(str(body.category)) ? str(body.category) : 'General Correspondence';

  return {
    errors,
    record: {
      title, name, email,
      organisation: str(body.org || body.organisation),
      orgType: str(body.orgType),
      state: str(body.state),
      phone: str(body.phone),
      description: str(body.description || body.message).slice(0, 4000),
      category,
      type: str(body.type),
      priority: str(body.priority) === 'expedited' ? 'expedited' : 'standard',
      files,
      // Fixed, never taken from the caller: these say where a document came from, and a
      // submitter must not be able to label their letter as internally registered.
      channel: 'Document Portal',
      correspondenceType: 'Inbound',
    },
  };
}

/** The citizen-visible projection. Allow-listed, so a field added later cannot leak. */
function projectStatus(sub) {
  return {
    referenceId: sub.referenceId,
    title: sub.record.title,
    category: sub.record.category,
    status: sub.status,
    receivedAt: sub.receivedAt,
    updatedAt: sub.updatedAt,
    attachments: sub.record.files.map(f => ({ name: f.name })),
    timeline: (sub.timeline || []).filter(t => t.public).map(t => ({ at: t.at, status: t.status, note: t.note || '' })),
  };
}

// ---------------------------------------------------------------------------

export function handleIntake(path, method, body, store, { headers = {} } = {}) {
  const route = path.replace(/^\/+|\/+$/g, '');

  // ── POST /intake/submission
  if (route === 'intake/submission' && method === 'POST') {
    const { errors, record } = rebuildSubmission(body || {});
    if (errors.length) return { status: 400, body: { ok: false, error: 'validation_failed', reasons: errors } };

    // Server-minted. A client-supplied referenceId never survives.
    const referenceId = store.mintReference();
    const receivedAt = now();

    const uploads = record.files.map(f => ({
      name: f.name,
      ticket: signTicket({
        ref: referenceId, name: f.name, size: f.size, sha256: f.sha256,
        exp: new Date(Date.now() + LIMITS.ticketTtlMs).toISOString(),
      }),
    }));

    store.mutate(d => {
      d.submissions.unshift({
        referenceId, record, status: 'received', receivedAt, updatedAt: receivedAt,
        timeline: [{ at: receivedAt, status: 'received', note: 'Submission received and reference issued.', public: true }],
      });
      // The submission enters the registry the operations app reads. This is what makes
      // the two applications one system rather than two demos side by side.
      const docId = Math.max(0, ...d.activities.map(a => Number(a.ID) || 0)) + 1;
      d.activities.unshift({
        ID: docId,
        Title: record.title,
        RefIDD: referenceId,
        Category: record.category,
        Status: 'Not Treated',
        AssignmentStatus: 'Not Assigned',
        AssignedTo: '',
        RoutedToDSU: 'Registry',
        Created: receivedAt,
        Description: `From ${record.name}${record.organisation ? ` (${record.organisation})` : ''}. ${record.description}`.trim(),
      });
    });

    store.audit({ event: 'intake:accepted', referenceId, category: record.category });

    // 202, not 200: a reference is issued, but classification and routing have not happened.
    return {
      status: 202,
      body: { ok: true, referenceId, receivedAt, uploads, delivered: true, verified: false, devServer: true },
    };
  }

  // ── PUT /intake/upload — ticket in a header, raw bytes in the body
  if (route === 'intake/upload' && method === 'PUT') {
    const ticket = str(headers['x-upload-ticket']);
    const check = verifyTicket(ticket);
    if (!check.ok) return { status: 403, body: { ok: false, stored: false, error: 'ticket_' + check.reason } };

    const bytes = Buffer.isBuffer(body) ? body : Buffer.alloc(0);
    const { claims } = check;

    // Verified, not trusted. A mismatch is refused rather than reconciled by guessing.
    if (claims.size && bytes.length !== Number(claims.size)) {
      return { status: 400, body: { ok: false, stored: false, error: 'size_mismatch',
                                    declared: Number(claims.size), received: bytes.length } };
    }
    const digest = sha256(bytes);
    if (claims.sha256 && digest !== claims.sha256) {
      return { status: 400, body: { ok: false, stored: false, error: 'digest_mismatch' } };
    }

    consumedTickets.add(ticket);
    const link = `dev-store://attachments/${encodeURIComponent(claims.ref)}/${encodeURIComponent(claims.name)}`;
    store.mutate(d => {
      d.attachments.unshift({
        referenceId: claims.ref, name: claims.name, size: bytes.length,
        sha256: digest, storedAt: now(), channel: 'intake', attachmentLink: link,
        // Metadata only. The dev server verifies the bytes and then discards them rather
        // than writing uploaded files to disk.
        bytesRetained: false,
      });
    });
    store.audit({ event: 'intake:upload-stored', referenceId: claims.ref, name: claims.name, bytes: bytes.length });

    return { status: 200, body: { ok: true, stored: true, attachmentLink: link, sha256: digest, bytes: bytes.length } };
  }

  // ── POST /intake/support
  if (route === 'intake/support' && method === 'POST') {
    const email = str(body?.email).toLowerCase();
    const message = str(body?.message);
    if (!email || !message) return { status: 400, body: { ok: false, error: 'validation_failed' } };

    const caseRef = `CASE-${Date.now().toString(36).toUpperCase()}`;
    store.mutate(d => {
      d.supportCases.unshift({
        caseRef, email, message,
        name: str(body.name), topic: str(body.topic),
        requestId: str(body.requestId), at: now(), status: 'open', channel: 'portal', replies: [],
      });
    });
    store.audit({ event: 'intake:support-accepted', caseRef });
    return { status: 200, body: { ok: true, caseRef, receivedAt: now(), delivered: true } };
  }

  // ── POST /intake/status
  if (route === 'intake/status' && method === 'POST') {
    const referenceId = str(body?.referenceId);
    const email = str(body?.email).toLowerCase();
    // Uniform denial: an unknown reference and a wrong email are byte-identical, so the
    // route never answers "does this reference exist?" for anybody who asks.
    const deny = { status: 404, body: { ok: false, error: 'not_found' } };
    if (!referenceId || !email) return deny;

    const sub = store.get().submissions.find(s => s.referenceId === referenceId);
    if (!sub || sub.record.email !== email) return deny;

    return { status: 200, body: { ok: true, record: projectStatus(sub) } };
  }

  // ── POST /intake/verify and /intake/verify-confirm
  if (route === 'intake/verify' && method === 'POST') {
    const email = str(body?.email).toLowerCase();
    if (!email) return { status: 400, body: { ok: false, error: 'email_required' } };
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    verifyChallenges.set(email, { code: DEV_VERIFY_CODE, expiresAt });
    store.audit({ event: 'intake:verify-requested', email });
    // `sent:false` is the truth — no mail leaves this machine, and the portal is written
    // to tell the submitter that rather than send them to an empty inbox.
    return { status: 200, body: { ok: true, sent: false, expiresAt, devCode: DEV_VERIFY_CODE } };
  }

  if (route === 'intake/verify-confirm' && method === 'POST') {
    const email = str(body?.email).toLowerCase();
    const code = str(body?.code);
    const challenge = verifyChallenges.get(email);
    // One reason for every failure, as the contract requires: telling "no challenge",
    // "expired" and "wrong code" apart tells a prober whether an address has a live one.
    if (!challenge || Date.parse(challenge.expiresAt) < Date.now() || code !== challenge.code) {
      return { status: 400, body: { ok: false, error: 'verification_failed' } };
    }
    verifyChallenges.delete(email);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const verification = signTicket({ email, kind: 'verification', exp: expiresAt });
    return { status: 200, body: { ok: true, verification, expiresAt } };
  }

  return null;
}

// ---------------------------------------------------------------------------

/**
 * PUT /documents/scan — the authenticated byte path.
 *
 * Same byte rules as the anonymous upload: the declared size and digest are checked
 * against what actually arrives. The difference in production is entirely in who may
 * call it, and that difference is exactly what this dev server cannot enforce.
 */
export function handleScan(method, bodyBuffer, store, { headers = {} } = {}) {
  if (method !== 'PUT') return { status: 405, body: { ok: false, error: 'method_not_allowed' } };

  const name = decodeURIComponent(str(headers['x-dgo-filename'])) || 'scan.pdf';
  const declaredSize = Number(headers['x-dgo-size']) || 0;
  const declaredDigest = str(headers['x-dgo-sha256']);
  const bytes = Buffer.isBuffer(bodyBuffer) ? bodyBuffer : Buffer.alloc(0);

  if (!bytes.length) return { status: 400, body: { ok: false, error: 'empty_body' } };
  if (bytes.length > LIMITS.maxScanBytes) return { status: 413, body: { ok: false, error: 'too_large' } };
  if (declaredSize && bytes.length !== declaredSize) {
    return { status: 400, body: { ok: false, error: 'size_mismatch', declared: declaredSize, received: bytes.length } };
  }
  const digest = sha256(bytes);
  if (declaredDigest && digest !== declaredDigest) {
    return { status: 400, body: { ok: false, error: 'digest_mismatch' } };
  }

  // A scanned document is a physically-received one entering the registry, so it gets a
  // reference and a record — not just a file.
  const referenceId = store.mintReference();
  const link = `dev-store://scans/${encodeURIComponent(referenceId)}/${encodeURIComponent(name)}`;
  const depositedBy = 'dev-server (unauthenticated — no token is validated here)';

  store.mutate(d => {
    d.attachments.unshift({ referenceId, name, size: bytes.length, sha256: digest,
                            storedAt: now(), channel: 'scan', attachmentLink: link, bytesRetained: false });
    const docId = Math.max(0, ...d.activities.map(a => Number(a.ID) || 0)) + 1;
    d.activities.unshift({
      ID: docId, Title: name.replace(/\.[^.]+$/, ''), RefIDD: referenceId,
      Category: 'General Correspondence', Status: 'Not Treated', AssignmentStatus: 'Not Assigned',
      AssignedTo: '', RoutedToDSU: 'Registry', Created: now(),
      Description: `Scanned at the registry counter. ${bytes.length} bytes, sha256 ${digest.slice(0, 16)}…`,
      AttachmentLink: link,
    });
  });
  store.audit({ event: 'scan:deposited', referenceId, name, bytes: bytes.length });

  return {
    status: 200,
    body: { ok: true, referenceId, attachmentLink: link, stored: true, depositedBy, sha256: digest, bytes: bytes.length },
  };
}
