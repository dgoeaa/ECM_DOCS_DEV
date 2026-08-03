// Registry scan intake — the byte path. TARGET_ARCHITECTURE.md §3.2 channel C, step 7.
//
// WHY THIS IS NOT DataClient.request
// Every other outbound call in this platform is a JSON contract invocation: a body of
// `{action, payload}` against a contract key. A scanned document is raw bytes, and the one
// thing this architecture is emphatic about is that bytes must not travel base64-encoded
// inside a JSON payload — that is what produced the 4 MB ceiling and the silent truncation
// behind F-028 on the portal side. So this is a PUT of the file itself, with the metadata
// in headers, against `PUT {proxyBaseUrl}/documents/scan`.
//
// WHAT THE PLATFORM NEVER HOLDS
// The document library credential. The proxy holds it and relays the bytes; nothing here
// ever sees a SharePoint URL it could write to. That is the same rule that governs the
// portal, applied to the internal channel.
//
// FAILING HONESTLY
// With no proxy configured this returns `{ok:false, reason:'not-configured'}` and the
// workspace does NOT create a correspondence record. A registry record pointing at a
// document that was never filed is a broken custody record — it is the silent-loss failure
// wearing an internal badge, and the registry is the one place that cannot tolerate it.

import { AuthConfig } from '../config/auth.config.js';
import { authHeaders } from './auth.js';

export const SCAN_LIMITS = Object.freeze({
  maxFileBytes: 25 * 1024 * 1024,
  accept: ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff',
           'application/msword',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  acceptLabel: 'PDF, PNG, JPG, TIFF, DOC or DOCX',
});

/** Is a byte path available at all? False means demo mode, and the caller must say so. */
export function scanIntakeConfigured() {
  return !!AuthConfig.proxyBaseUrl;
}

function scanUrl() {
  const base = AuthConfig.proxyBaseUrl;
  if (!base) return '';
  return `${String(base).replace(/\/+$/, '')}/documents/scan`;
}

/** SHA-256 of the file, hex. Declared to the proxy, which verifies it against the bytes. */
export async function digestOf(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Local checks, so an obviously bad file is refused before it crosses the network. */
export function validateScan(file, { limits = SCAN_LIMITS } = {}) {
  if (!file) return 'No file selected.';
  if (!file.size) return 'That file is empty.';
  if (file.size > limits.maxFileBytes) {
    return `That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${limits.maxFileBytes / 1048576} MB.`;
  }
  // Advisory only: the extension and the declared type are both caller-supplied, so this
  // catches mistakes, not attacks. The proxy and the library are what actually decide.
  if (file.type && !limits.accept.includes(file.type)) {
    return `${limits.acceptLabel} only. That file reports as ${file.type}.`;
  }
  return '';
}

/**
 * Deposit one scanned document.
 *
 * Returns `{ok, referenceId, attachmentLink, stored, depositedBy, sha256, bytes, reason}`.
 *
 * `stored:false` with `ok:true` means the proxy accepted and verified the bytes but could
 * not file them — a real distinction the caller must not flatten, because the deposit
 * happened and is audited even though the document is not yet in the library.
 */
export async function depositScan(file, { fetchImpl = fetch } = {}) {
  const url = scanUrl();
  if (!url) return { ok: false, reason: 'not-configured' };

  const invalid = validateScan(file);
  if (invalid) return { ok: false, reason: 'invalid', detail: invalid };

  let sha256;
  try { sha256 = await digestOf(file); }
  catch { return { ok: false, reason: 'digest-failed' }; }

  let res;
  try {
    res = await fetchImpl(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-DGO-Filename': encodeURIComponent(file.name),
        'X-DGO-Sha256': sha256,
        'X-DGO-Size': String(file.size),
        ...(await authHeaders()),
      },
      body: file,
    });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }

  let data = {};
  try { data = await res.json(); } catch { /* reported through status below */ }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      reason: res.status === 401 ? 'unauthenticated'
            : res.status === 403 ? 'forbidden'
            : data.error || 'refused',
    };
  }

  return {
    ok: true,
    referenceId: data.referenceId || '',
    attachmentLink: data.attachmentLink || '',
    stored: data.stored === true,
    // From the verified token, not from anything this client asserted.
    depositedBy: data.depositedBy || '',
    depositedAt: data.depositedAt || new Date().toISOString(),
    sha256: data.sha256 || sha256,
    bytes: data.bytes ?? file.size,
  };
}
