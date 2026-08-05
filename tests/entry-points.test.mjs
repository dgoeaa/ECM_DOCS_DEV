/**
 * Entry-point feeds — decision D4.
 *
 * The defect being closed is not "channels are unsupported" but "channel is GUESSED".
 * Everything arrived on one feed and the channel was recovered afterwards by a regex over
 * `JSON.stringify(record)`, so a record that declared its own channel could still be
 * misfiled by its own prose. Three of six records carrying an explicit channel were.
 *
 * The assertions below are therefore mostly about precedence: a record that says what it is
 * must be believed, and a record that says nothing must be visible as unplaced rather than
 * defaulting into the channel nobody audits.
 */
import assert from 'node:assert/strict';
import {
  EntryPoints, EntryPointIds, ENTRY_POINT_FIELD, CHANNEL_FIELDS,
  entryPoint, entryPointForChannel, entryPointForSourceView,
} from '../config/entry-points.config.js';
import {
  declaredEntryPoint, stampRecord, lane, partition, feedCounts,
} from '../core/entry-point-feeds.js';
import { inferSourceId, filterItemsBySource, sourceCounts } from '../core/source-views.js';

let passed = 0;
const ok = (name, fn) => { fn(); passed++; };

// ── the declaration ───────────────────────────────────────────────────────────────────
ok('all four entry points are declared', () => {
  assert.equal(EntryPoints.length, 4);
  assert.deepEqual(EntryPointIds.slice().sort(),
    ['email', 'internal-origination', 'public-portal', 'scan-counter']);
  assert.deepEqual(EntryPoints.map(e => e.code).sort(), ['A', 'B', 'C', 'D']);
});

ok('each entry point maps to exactly one source view, and no two share one', () => {
  const views = EntryPoints.map(e => e.sourceView);
  assert.equal(new Set(views).size, 4, 'two entry points claim the same view');
  for (const v of views) assert.ok(entryPointForSourceView(v), `${v} does not resolve back`);
});

ok('no channel value is claimed by two entry points', () => {
  // An ambiguous value would make routing depend on declaration order, which is exactly the
  // kind of accident the old regex chain was made of.
  const seen = new Map();
  for (const e of EntryPoints) {
    for (const v of e.channelValues) {
      assert.ok(!seen.has(v), `'${v}' is claimed by both ${seen.get(v)} and ${e.id}`);
      seen.set(v, e.id);
    }
  }
});

ok('free-text fields are NOT treated as channel declarations', () => {
  // Reading these is what misfiled a counter scan titled "Ministerial directive".
  for (const f of ['title', 'subject', 'body', 'bodyPreview', 'remarks', 'description']) {
    assert.ok(!CHANNEL_FIELDS.includes(f), `${f} must never declare a channel`);
  }
});

// ── declaration beats prose ───────────────────────────────────────────────────────────
ok('a declared channel resolves to its entry point', () => {
  assert.equal(entryPointForChannel('Document').id, 'scan-counter');
  assert.equal(entryPointForChannel('portal').id, 'public-portal');
  assert.equal(entryPointForChannel('EMAIL').id, 'email');
  assert.equal(entryPointForChannel('Registry').id, 'internal-origination');
});

ok('an unknown or empty channel claims nothing rather than guessing', () => {
  assert.equal(entryPointForChannel('carrier pigeon'), null);
  assert.equal(entryPointForChannel(''), null);
  assert.equal(entryPointForChannel(null), null);
});

ok('THE REGRESSION: a declared channel is not overruled by the record\'s own prose', () => {
  // Each of these was misfiled before D4. The title is deliberately adversarial in each.
  const cases = [
    [{ channel: 'Document', title: 'Ministerial directive' }, 'physical-scanned-documents'],
    [{ channel: 'Registry', title: 'Internal memo' }, 'dgceo-outgoing-correspondence'],
    [{ channel: 'Document', title: 'Policy on email retention' }, 'physical-scanned-documents'],
    [{ channel: 'Portal', title: 'Scanned copy of my licence' }, 'public-portal-correspondence'],
    [{ channel: 'Email', subject: 'Physical file transfer request' }, 'customer-service-emails'],
  ];
  for (const [rec, expected] of cases) {
    assert.equal(inferSourceId(rec), expected,
      `${JSON.stringify(rec)} must be filed by its channel, not its words`);
  }
});

ok('the D4 stamp outranks every other field', () => {
  const rec = { [ENTRY_POINT_FIELD]: 'scan-counter', channel: 'Email', title: 'anything' };
  assert.equal(declaredEntryPoint(rec).id, 'scan-counter');
  assert.equal(inferSourceId(rec), 'physical-scanned-documents');
});

ok('the text sweep still serves records that declare nothing', () => {
  // Kept deliberately: older captures carry no stamp and no channel, and a best guess beats
  // nothing for those. It simply no longer overrules a record that spoke for itself.
  assert.equal(inferSourceId({ title: 'Email from the ministry', fromAddress: 'a@b.ng' }),
    'customer-service-emails');
});

// ── stamping ──────────────────────────────────────────────────────────────────────────
ok('a lane stamps the records it admits', () => {
  const [r] = lane([{ id: 1, title: 'Counter deposit' }], 'scan-counter');
  assert.equal(r[ENTRY_POINT_FIELD], 'scan-counter');
  assert.equal(r.entryPointSource, 'lane');
});

ok('stamping does not mutate the record it was given', () => {
  const original = { id: 1, title: 'x' };
  stampRecord(original, { assume: 'email' });
  assert.ok(!(ENTRY_POINT_FIELD in original));
});

ok('a declaration beats the lane, and the disagreement is recorded', () => {
  // The scan endpoint returning something stamped Portal means either the endpoint or the
  // producer is wrong. Silently picking a winner destroys the evidence needed to tell which.
  const r = stampRecord({ id: 1, channel: 'Portal' }, { assume: 'scan-counter' });
  assert.equal(r[ENTRY_POINT_FIELD], 'public-portal', 'the producer knows its own origin');
  assert.deepEqual(r.entryPointConflict,
    { lane: 'scan-counter', declared: 'public-portal', field: 'channel' });
});

ok('agreement between lane and declaration records no conflict', () => {
  const r = stampRecord({ id: 1, channel: 'Document' }, { assume: 'scan-counter' });
  assert.equal(r[ENTRY_POINT_FIELD], 'scan-counter');
  assert.ok(!('entryPointConflict' in r));
});

// ── the unplaced category ─────────────────────────────────────────────────────────────
ok('THE SILENT FAILURE: an undeclared record is unplaced, not filed as a scan', () => {
  /* The old fallback was `physical-scanned-documents`, so "we do not know" and "scanned at
     the counter" were the same answer — silently inflating the channel least likely to be
     audited. */
  const { unplaced, byEntryPoint } = partition([{ id: 1, title: 'Untitled' }]);
  assert.equal(unplaced.length, 1);
  assert.equal(unplaced[0][ENTRY_POINT_FIELD], null);
  assert.equal(unplaced[0].entryPointSource, 'unplaced');
  assert.equal(byEntryPoint['scan-counter'].length, 0, 'it must NOT land in the counter lane');
});

ok('partition splits a shared feed by what each row declares', () => {
  const { byEntryPoint, unplaced } = partition([
    { id: 1, channel: 'Portal' }, { id: 2, channel: 'Document' },
    { id: 3, channel: 'Document' }, { id: 4, channel: 'Registry' }, { id: 5 },
  ]);
  assert.equal(byEntryPoint['public-portal'].length, 1);
  assert.equal(byEntryPoint['scan-counter'].length, 2);
  assert.equal(byEntryPoint['internal-origination'].length, 1);
  assert.equal(byEntryPoint['email'].length, 0);
  assert.equal(unplaced.length, 1);
});

ok('every row survives the partition — none is dropped', () => {
  const rows = [{ id: 1, channel: 'Portal' }, { id: 2 }, { id: 3, channel: 'Email' }];
  const { stamped, byEntryPoint, unplaced } = partition(rows);
  assert.equal(stamped.length, rows.length);
  const placed = Object.values(byEntryPoint).reduce((n, v) => n + v.length, 0);
  assert.equal(placed + unplaced.length, rows.length, 'a record went missing in the split');
});

ok('feedCounts reports the two numbers worth watching', () => {
  const c = feedCounts([{ channel: 'Portal' }, { channel: 'Document' }, {},
                        { channel: 'Email', [ENTRY_POINT_FIELD]: 'scan-counter' }]);
  assert.equal(c.total, 4);
  assert.equal(c.unplaced, 1);
  assert.equal(c['public-portal'], 1);
});

ok('an empty or malformed feed does not throw', () => {
  assert.doesNotThrow(() => partition(null));
  assert.doesNotThrow(() => partition([null, undefined, 'nonsense']));
  assert.equal(partition([]).unplaced.length, 0);
});

// ── convergence still works ───────────────────────────────────────────────────────────
ok('stamped records still filter and count through the existing source views', () => {
  // D4 changes where provenance comes from, not what the rest of the platform does with it.
  const rows = lane([{ id: 1 }, { id: 2 }], 'scan-counter')
    .concat(lane([{ id: 3 }], 'public-portal'));
  assert.equal(filterItemsBySource(rows, 'physical-scanned-documents').length, 2);
  assert.equal(filterItemsBySource(rows, 'public-portal-correspondence').length, 1);
  assert.equal(sourceCounts(rows)['physical-scanned-documents'], 2);
  assert.equal(sourceCounts(rows).all, 3);
});

ok('every entry point declares where it converges', () => {
  for (const e of EntryPoints) {
    assert.ok(e.converges, `${e.id} does not say where it converges`);
    assert.ok(e.feed && e.feed.endpoint, `${e.id} does not name a feed endpoint`);
    assert.equal(typeof e.feed.dedicated, 'boolean',
      `${e.id} must say whether its feed is dedicated rather than implying it`);
  }
});

console.log(`entry-points: ${passed} assertions passed`);
