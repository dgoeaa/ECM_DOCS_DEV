// Email verification for anonymous intake — decision D4.
//
// WHAT IT IS FOR, AND WHAT IT IS NOT FOR
// `/intake/submission` is unauthenticated because a citizen writing to NITDA has no account
// and should not need one. That is right, and this does not change it. What it changes is
// that a caller must demonstrate control of the address they submit under BEFORE a registry
// reference is minted.
//
// Two things follow, and only the second is about security:
//
//   1. THE SUBMITTER GETS A RECEIPT THAT REACHES THEM. Today a typo in the address produces
//      a reference nobody can ever use — the tracking page needs the pair, and the wrong
//      half is unrecoverable. This is the more common failure by far.
//   2. IT RAISES THE COST OF BULK ABUSE. An open create endpoint attached to a government
//      registry can be driven at the rate limit with fabricated addresses, each minting a
//      reference and a record. Requiring a round-trip through a real mailbox does not stop a
//      determined attacker — they can verify one address and reuse it — but it stops the
//      trivial case, which is the one that actually happens.
//
// WHAT IT IS EMPHATICALLY NOT: identity. A verified address proves someone reads that
// mailbox. It does not prove who they are, and nothing downstream may treat it as though it
// does.
//
// FAIL-OPEN IS A CONFIGURATION, NOT AN ACCIDENT
// With no mail endpoint configured the proxy cannot send a code, so verification cannot be
// required — demanding one would take the public channel offline. `requireVerification`
// therefore defaults to FALSE and must be turned on deliberately. The posture is reported in
// every response so a deployment cannot be wrong about which mode it is in.

import {
  hmacKey, hmacSha256, timingSafeEqual, randomInt, randomUUID, b64uEncode, b64uDecode,
  fromUtf8, utf8,
} from './crypto.js';

export const VERIFY_LIMITS = Object.freeze({
  codeLength: 6,
  ttlMs: 15 * 60_000,        // long enough for mail to arrive, short enough to matter
  maxAttempts: 5,            // per challenge, then it is burned
  windowMs: 60_000,
  perWindow: 3,              // challenges per address per window
  maxOutstanding: 50_000,
});

export class VerificationError extends Error {
  constructor(reason, detail = '', status = 400) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = 'VerificationError';
    this.reason = reason;
    this.status = status;
  }
}

const normalise = e => String(e || '').trim().toLowerCase();

/**
 * Challenge store.
 *
 * In memory, therefore per instance — the same caveat as the rate limiter and the minter.
 * Behind more than one replica a challenge issued by one node cannot be redeemed at another,
 * which fails closed (the submitter is asked to request a new code) rather than open.
 */
export function createVerificationService({
  secret,
  limits = VERIFY_LIMITS,
  now = () => Date.now(),
  randomCode = () => String(randomInt(10 ** VERIFY_LIMITS.codeLength))
    .padStart(VERIFY_LIMITS.codeLength, '0'),
} = {}) {
  if (!secret || String(secret).length < 32) {
    throw new Error('createVerificationService: a secret of at least 32 characters is required');
  }
  /* Imported once, lazily. WebCrypto key import is async and this factory is not, so the
     promise is held rather than awaited — every consumer is already async. */
  const keyPromise = hmacKey(String(secret));

  // email -> { hash, expiresAt, attempts, issuedAt }
  const challenges = new Map();
  // email -> { count, resetAt }   issuance throttle, separate from the intake limiter
  const issuance = new Map();
  // token -> expiry               proof of a completed verification, single-use
  const proofs = new Map();

  const sweep = () => {
    const t = now();
    for (const [k, v] of challenges) if (t > v.expiresAt) challenges.delete(k);
    for (const [k, v] of issuance) if (t >= v.resetAt) issuance.delete(k);
    for (const [k, exp] of proofs) if (t > exp) proofs.delete(k);
  };

  /* The code is stored as an HMAC, never in clear. A memory dump or a log of this structure
     should not hand anyone a working code for an address they do not control. */
  const hashOf = async (email, code) => hmacSha256(await keyPromise, `${email}:${code}`);

  const sign = async payload => {
    const body = b64uEncode(utf8(JSON.stringify(payload)));
    const mac = b64uEncode(await hmacSha256(await keyPromise, body));
    return `${body}.${mac}`;
  };

  return {
    /**
     * Issue a challenge for an address. Returns `{ code, expiresAt }` — the CALLER sends the
     * code by mail; this module never has a mail transport of its own, so it cannot leak one.
     */
    async issue(rawEmail) {
      const email = normalise(rawEmail);
      if (!email) throw new VerificationError('missing_email');

      sweep();
      const t = now();
      const seen = issuance.get(email);
      if (seen && t < seen.resetAt) {
        if (seen.count >= limits.perWindow) {
          throw new VerificationError('too_many_requests', '', 429);
        }
        seen.count += 1;
      } else {
        issuance.set(email, { count: 1, resetAt: t + limits.windowMs });
      }

      if (challenges.size >= limits.maxOutstanding) sweep();

      const code = randomCode();
      const expiresAt = t + limits.ttlMs;
      // A second request replaces the first: two live codes for one address doubles the
      // guessing surface for no benefit.
      challenges.set(email, { hash: await hashOf(email, code), expiresAt, attempts: 0, issuedAt: t });
      return { code, expiresAt: new Date(expiresAt).toISOString() };
    },

    /**
     * Redeem a code. Returns a single-use proof token on success.
     *
     * Every failure returns the same reason to the caller — see handleVerify in intake.js.
     * The distinctions kept here are for the audit log, not for the submitter.
     */
    async redeem(rawEmail, rawCode) {
      const email = normalise(rawEmail);
      const code = String(rawCode || '').trim();
      if (!email || !code) throw new VerificationError('missing_field');

      /* Look up BEFORE sweeping. Sweeping first deletes the expired entry and the failure
         then reports `no_challenge`, which is indistinguishable in the audit log from an
         address that never had one — and those are different things when reading for abuse. */
      const ch = challenges.get(email);
      if (!ch) { sweep(); throw new VerificationError('no_challenge'); }
      if (now() > ch.expiresAt) { challenges.delete(email); sweep(); throw new VerificationError('expired'); }
      sweep();

      ch.attempts += 1;
      if (ch.attempts > limits.maxAttempts) {
        // Burn it. Otherwise the attempt cap is a speed bump rather than a limit.
        challenges.delete(email);
        throw new VerificationError('too_many_attempts', '', 429);
      }

      const given = await hashOf(email, code);
      // Both are HMAC digests and therefore the same length by construction. timingSafeEqual
      // checks anyway and returns false rather than throwing on a length mismatch.
      if (!timingSafeEqual(given, ch.hash)) throw new VerificationError('mismatch');

      challenges.delete(email);
      const expiresAt = now() + limits.ttlMs;
      const token = await sign({ email, exp: expiresAt, jti: randomUUID() });
      proofs.set(token, expiresAt);
      return { token, expiresAt: new Date(expiresAt).toISOString() };
    },

    /**
     * Check a proof token against the address a submission claims.
     *
     * Single use: consumed on success, so one verification buys one submission. Without that
     * a verified address becomes a reusable bypass of the whole control.
     */
    async consume(token, rawEmail) {
      const email = normalise(rawEmail);
      if (!token) throw new VerificationError('missing_verification', '', 403);

      const [body, mac] = String(token).split('.');
      if (!body || !mac) throw new VerificationError('malformed_verification', '', 403);
      const expected = b64uEncode(await hmacSha256(await keyPromise, body));
      if (!timingSafeEqual(utf8(mac), utf8(expected))) {
        throw new VerificationError('bad_verification_signature', '', 403);
      }

      let payload;
      try { payload = JSON.parse(fromUtf8(b64uDecode(body))); }
      catch { throw new VerificationError('malformed_verification', '', 403); }

      if (now() > payload.exp) { proofs.delete(token); throw new VerificationError('verification_expired', '', 403); }
      if (!proofs.has(token)) throw new VerificationError('verification_already_used', '', 403);
      // The proof is bound to an address. A token earned for one mailbox must not submit
      // under another.
      if (payload.email !== email) throw new VerificationError('verification_email_mismatch', '', 403);

      proofs.delete(token);
      return { email: payload.email };
    },

    outstanding: () => challenges.size,
    proofsHeld: () => proofs.size,
  };
}
