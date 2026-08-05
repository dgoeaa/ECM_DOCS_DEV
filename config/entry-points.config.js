// The four entry points, declared — decision D4.
//
// WHAT WAS WRONG
// Everything arrived through one `FETCH_ALL` call, landed in one flat collection, and the
// channel a record came in through was recovered AFTERWARDS by `inferSourceId()`: a regex
// swept over `JSON.stringify(record)`.
//
// That is guessing, and it guessed badly. Measured against records that DECLARE their
// channel, three of six were misfiled:
//
//   channel:'Document', title:'Ministerial directive'  -> dgceo-outgoing  (the word
//                                                          'directive' in the title won)
//   channel:'Registry', title:'Internal memo'          -> physical-scan   ('registry'
//                                                          matched the scan pattern)
//   channel:'Document', title:'Policy on email …'      -> email
//
// The record said what it was and the inference did not listen, because the explicit field
// was concatenated into the same haystack as the entire serialised record and outvoted by
// prose. A record with no channel at all silently became a physical scan, since that was
// the fallback — so "unknown" and "scanned at the counter" were indistinguishable.
//
// WHAT D4 DECIDED
// Each entry point keeps its own first-line dedicated feed; convergence happens afterwards,
// through the normalising layer. The point is that PROVENANCE IS STAMPED AT THE DOOR by the
// feed that admitted the record, rather than reconstructed later from its contents. A
// record's origin is a fact known at ingestion; anything that reconstructs it downstream is
// re-deriving something it was told and can get wrong.
//
// A NOTE ON WHAT "DEDICATED FEED" CAN MEAN TODAY
// Only two entry points have a dedicated READ endpoint of their own (`SCAN_INTAKE` for the
// counter; the portal writes through `INTAKE_SUBMISSION` and is read back with everything
// else). The rest are served by the shared `FETCH_ALL`. This file does not pretend
// otherwise: `feed.endpoint` names the dedicated endpoint where one exists and `FETCH_ALL`
// where it does not, and `feed.dedicated` says which is which. What every entry point gets
// regardless is its own first-line LANE — a partition applied at the door, with the stamp
// written there — so the convergence layer downstream is identical either way and a
// dedicated endpoint can be introduced later without moving anything else.

/**
 * `channelValues` are the values a record may legitimately carry to claim this entry point.
 * They are matched EXACTLY (case-insensitively) against declared channel fields — never
 * against free text, which is the mistake being corrected.
 */
export const EntryPoints = Object.freeze([
  Object.freeze({
    id: 'public-portal',
    code: 'A',
    label: 'Public portal',
    origin: 'External submitter, no account',
    sourceView: 'public-portal-correspondence',
    channelValues: Object.freeze(['portal', 'public portal', 'public-portal', 'web']),
    entryModule: 'document-portal/submit.html',
    feed: Object.freeze({ endpoint: 'FETCH_ALL', dedicated: false, writeEndpoint: 'INTAKE_SUBMISSION' }),
    converges: 'activities',
  }),
  Object.freeze({
    id: 'email',
    code: 'B',
    label: 'Email',
    origin: 'Monitored mailbox',
    sourceView: 'customer-service-emails',
    channelValues: Object.freeze(['email', 'mail', 'mailbox', 'customer service']),
    entryModule: 'core/data-loader.js',
    feed: Object.freeze({ endpoint: 'FETCH_ALL', dedicated: false, collection: 'emails' }),
    converges: 'emails',
  }),
  Object.freeze({
    id: 'scan-counter',
    code: 'C',
    label: 'Scan / physical counter',
    origin: 'Registry counter clerk',
    sourceView: 'physical-scanned-documents',
    channelValues: Object.freeze(['document', 'scan', 'scanned', 'physical', 'counter']),
    entryModule: 'modules/scan-intake.js',
    feed: Object.freeze({ endpoint: 'SCAN_INTAKE', dedicated: true }),
    converges: 'activities',
  }),
  Object.freeze({
    id: 'internal-origination',
    code: 'D',
    label: 'Internal origination',
    origin: 'NITDA staff',
    /* The view is named for the traffic it mostly carries (DGCEO outgoing) rather than for
       the channel. Recorded here rather than quietly renamed, so the two vocabularies are
       visibly the same thing and neither has to be guessed at. */
    sourceView: 'dgceo-outgoing-correspondence',
    channelValues: Object.freeze(['registry', 'internal', 'dgceo', 'outgoing', 'in-platform']),
    entryModule: 'modules/correspondence.js',
    feed: Object.freeze({ endpoint: 'FETCH_ALL', dedicated: false }),
    converges: 'activities',
  }),
]);

export const EntryPointIds = Object.freeze(EntryPoints.map(e => e.id));

/** The record field that carries the stamp, written by the feed that admitted the record. */
export const ENTRY_POINT_FIELD = 'entryPoint';

/**
 * Fields that may DECLARE a channel. Read in order; the first non-empty one wins.
 *
 * Deliberately a short, explicit list rather than "anything that looks like a channel".
 * These are the fields a producer sets on purpose. Free-text fields — title, subject, body,
 * remarks — are absent by design: they are what the old inference read, and reading them is
 * what misfiled a directive as outgoing correspondence.
 */
export const CHANNEL_FIELDS = Object.freeze([
  ENTRY_POINT_FIELD, 'channel', 'Channel', 'sourceView', 'sourceId', 'ingestionSource',
  'sourceType', 'correspondenceType', 'CorrespondenceType',
]);

export function entryPoint(id) {
  return EntryPoints.find(e => e.id === id) || null;
}

export function entryPointForSourceView(sourceView) {
  return EntryPoints.find(e => e.sourceView === sourceView) || null;
}

/** The entry point a declared channel value claims, or null if it claims none. */
export function entryPointForChannel(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return null;
  return EntryPoints.find(e => e.id === v)
      || EntryPoints.find(e => e.sourceView === v)
      || EntryPoints.find(e => e.channelValues.includes(v))
      || null;
}
