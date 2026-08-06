/**
 * Endpoint recovery from the repository's own reference corpus.
 *
 * The deployed Power Automate estate is documented verbatim under
 * `docs/reference/foundational/` by explicit decision (D5), signed trigger URLs included.
 * This module reads those URLs back out and resolves them onto the platform's endpoint
 * contract keys, so a development environment can run against the flows that already
 * exist instead of requiring a fresh estate to be built before anything can be tested.
 *
 * WHY THIS EXISTS. Without it, every development cycle needs throwaway flows built by
 * hand before the configuration can be exercised at all — and configuration errors then
 * surface for the first time in production, against flows that have never been called.
 * Recovering the existing estate inverts that: configuration is proven against live
 * flows during development, and production gets a fresh estate built once, from a
 * configuration already known to be correct.
 *
 * WHAT THIS IS NOT. These signatures are published — anyone who can read this repository
 * holds them. They are development credentials by circumstance, not by design. Nothing
 * recovered here should ever back a production deployment; `npm run commission` enforces
 * that by refusing the pilot and enforced postures while a recovered signature is wired.
 *
 * NO SIGNATURE IS HARDCODED HERE. The supplementary table below maps a contract key to a
 * WORKFLOW ID — an identifier, not a credential — and the URL carrying it is looked up
 * from the corpus at runtime. That keeps `scripts/` free of signatures, so the secret
 * ratchet stays meaningful and this file can be read without handling credentials.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORPUS = 'docs/reference/';

const URL_RE =
  /https:\/\/[a-z0-9]+\.[a-z0-9]+\.environment\.api\.powerplatform\.com[^\s"'<>)\\]*sig=[A-Za-z0-9_-]+/g;
const WORKFLOW_RE = /workflows\/([a-f0-9]{32})/;

/**
 * The file that already states the mapping in the platform's own contract-key names.
 * It is a lineage artefact of the R11.6 canvas parity work and is the only place in the
 * corpus where key and URL appear together, which makes it authoritative for the runtime
 * surface — everything else in the corpus names flows in prose.
 */
const KEYED_SOURCE =
  'docs/reference/foundational/lineage/r11_6_canvas_parity_implementation/' +
  'Download Performance Hardening Sprint Report.json';

const KEYED_PAIR = /\b([A-Z][A-Z0-9_]{3,30})\s*:\s*"(https:\/\/[^"]*sig=[^"]*)"/g;

/**
 * Keys the keyed source does not carry, resolved by workflow id instead.
 *
 * Each entry records WHY the mapping holds, because several of these are routes on a
 * shared flow rather than dedicated flows, and that is not obvious from the id alone.
 */
const SUPPLEMENTARY = {
  portal: {
    SUBMISSION: {
      workflowId: '1ff7714c11a74fa4a876f8f6a79b64d2',
      why: 'The document submission portal flow, documented in ' +
        'docs/reference/foundational/flows/DOCUMENT SUBMISSION PORTAL POWER AU.txt.',
      caveat:
        'CONTRACT MISMATCH. This flow takes the file inline as FileContentBase64 and ' +
        'answers { trackingId, referenceId, … }. The portal today declares attachments ' +
        'and expects { referenceId, uploads: [ticket, …] }, then PUTs raw bytes to ' +
        'UPLOAD. Wired so the difference is provable rather than assumed — ' +
        '`npm run verify:endpoints` reports exactly which fields are missing.',
    },
    VERIFY: {
      workflowId: '314aaf27593147089b38322e5ca25936',
      why: 'The OTP_GENERATE flow. The portal\'s VERIFY contract — take an email, mail ' +
        'a one-time code, rate-limit per address — is what this flow already does.',
    },
    VERIFY_CONFIRM: {
      workflowId: '43879c5165de439680055ab4258b3f27',
      why: 'The OTP_VERIFY flow, the redemption half of the pair above.',
    },
    STATUS: {
      workflowId: '85c556f10b8244ba9d839a2ebe240b91',
      why: 'The subsidiary-actions flow. config/endpoints.config.js declares TRACK among ' +
        'its routeKeys, which is the read-back the portal\'s STATUS contract describes.',
      caveat:
        'Routed, not dedicated: this reaches the TRACK route of a shared flow. Whether ' +
        'that route is implemented is a live question — verify before relying on it.',
    },
    SUPPORT: {
      workflowId: '85c556f10b8244ba9d839a2ebe240b91',
      why: 'The same shared flow. CREATESUPPORTREQUEST is declared among its routeKeys ' +
        'and is the operation config/support-routing.config.js already names.',
      caveat: 'Routed, not dedicated — same caveat as STATUS.',
    },
  },
  runtime: {},
};

/** Keys with no flow anywhere in the corpus, recorded so the absence is stated. */
export const UNAVAILABLE = {
  runtime: {
    SCAN_INTAKE:
      'No flow in the corpus accepts a raw-bytes PUT with X-DGO-Filename / X-DGO-Size / ' +
      'X-DGO-Sha256. Registry Scan Intake reports itself unconfigured, which is correct — ' +
      'it must not appear to file a document it never filed.',
  },
  portal: {
    UPLOAD:
      'No ticket-redeeming upload flow exists. The legacy submission flow takes bytes ' +
      'inline as base64 instead, which is the 4 MB ceiling the ticket design replaced.',
  },
};

function trackedCorpusFiles() {
  return execFileSync('git', ['ls-files', '-z', CORPUS], {
    cwd: ROOT, maxBuffer: 64 * 1024 * 1024,
  })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

/**
 * Read one corpus file as text, flattening the escaping the exports carry.
 *
 * These are documentation artefacts, not clean data: JSON files whose payloads are
 * themselves JSON-encoded strings, HTML with entity-encoded ampersands, plain text
 * pasted from half a dozen tools. The authoritative keyed block, for instance, lives
 * inside a JSON string value, so it reads `KEY: \"https://…\"` on disk — matching it
 * without unescaping the quotes finds nothing at all, which is exactly what happened.
 *
 * Unescaping here is deliberately lossy and that is fine: this is a scanner looking for
 * URLs and key names, not a parser that has to round-trip anything.
 */
function readNormalised(rel) {
  const abs = path.join(ROOT, rel);
  let text;
  try {
    if (fs.statSync(abs).size > 64 * 1024 * 1024) return '';
    text = fs.readFileSync(abs, 'latin1');
  } catch {
    return '';
  }
  return text
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/\\n/g, '\n');
}

/**
 * Index every URL in the corpus by workflow id.
 *
 * A flow's trigger may have been regenerated more than once, so one id can carry several
 * signatures. Corroboration is the tie-break: the signature documented in the most
 * places is the one the estate actually settled on. Alternates are returned rather than
 * discarded, because picking wrong is recoverable only if you can see what else there was.
 */
export function indexCorpus() {
  const byWorkflow = new Map();
  for (const rel of trackedCorpusFiles()) {
    const text = readNormalised(rel);
    if (!text) continue;
    for (const m of text.matchAll(URL_RE)) {
      const url = m[0];
      const wf = WORKFLOW_RE.exec(url);
      if (!wf) continue;
      const id = wf[1];
      if (!byWorkflow.has(id)) byWorkflow.set(id, new Map());
      const bySig = byWorkflow.get(id);
      if (!bySig.has(url)) bySig.set(url, { url, count: 0, sources: new Set() });
      const rec = bySig.get(url);
      rec.count++;
      rec.sources.add(rel);
    }
  }
  const out = new Map();
  for (const [id, bySig] of byWorkflow) {
    const ranked = [...bySig.values()].sort(
      (a, b) => b.sources.size - a.sources.size || b.count - a.count
    );
    out.set(id, ranked.map(r => ({ ...r, sources: [...r.sources] })));
  }
  return out;
}

/** Read the keyed source into `key -> url`. */
function readKeyedSource() {
  const text = readNormalised(KEYED_SOURCE);
  const out = new Map();
  if (!text) return out;
  for (const m of text.matchAll(KEYED_PAIR)) {
    // First occurrence wins: the block is emitted once, and later prose may quote a
    // stale copy of an individual line.
    if (!out.has(m[1])) out.set(m[1], m[2]);
  }
  return out;
}

/**
 * Resolve every endpoint the corpus can supply.
 *
 * Returns `{ runtime, portal, unavailable, index }` where each surface maps a contract
 * key to `{ url, workflowId, via, why, caveat, alternates }`. `via` records how the
 * mapping was established, so the wiring can be audited without re-deriving it.
 */
export function recoverEndpoints({ runtimeKeys, portalKeys }) {
  const index = indexCorpus();
  const keyed = readKeyedSource();

  const pickByWorkflow = id => {
    const candidates = index.get(id);
    if (!candidates || !candidates.length) return null;
    return {
      url: candidates[0].url,
      alternates: candidates.slice(1).map(c => c.url),
      sources: candidates[0].sources,
    };
  };

  const resolve = (keys, surface) => {
    const found = {};
    const missing = [];
    for (const key of keys) {
      if (surface === 'runtime' && keyed.has(key)) {
        const url = keyed.get(key);
        const wf = WORKFLOW_RE.exec(url);
        found[key] = {
          url,
          workflowId: wf ? wf[1] : null,
          via: 'keyed source',
          why: `Named as ${key} in ${path.basename(KEYED_SOURCE)}.`,
          alternates: (wf && (index.get(wf[1]) || []).map(c => c.url).filter(u => u !== url)) || [],
        };
        continue;
      }
      const supp = SUPPLEMENTARY[surface]?.[key];
      if (supp) {
        const picked = pickByWorkflow(supp.workflowId);
        if (picked) {
          found[key] = {
            url: picked.url,
            workflowId: supp.workflowId,
            via: 'workflow id',
            why: supp.why,
            caveat: supp.caveat,
            alternates: picked.alternates,
            sources: picked.sources,
          };
          continue;
        }
      }
      missing.push(key);
    }
    return { found, missing };
  };

  return {
    runtime: resolve(runtimeKeys, 'runtime'),
    portal: resolve(portalKeys, 'portal'),
    unavailable: UNAVAILABLE,
    index,
  };
}

/** Signatures recovered here are published; the gate needs to recognise them. */
export function recoveredSignatures() {
  const sigs = new Set();
  for (const candidates of indexCorpus().values()) {
    for (const c of candidates) {
      const m = /sig=([A-Za-z0-9_-]+)/.exec(c.url);
      if (m) sigs.add(m[1]);
    }
  }
  return sigs;
}
