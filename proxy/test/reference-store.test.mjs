#!/usr/bin/env node
/**
 * The registry sequence.
 *
 * THE DEFECT
 * The minter kept its counter in a module variable. Two processes both issued
 * NITDA-YYYY-000001, so two citizens could hold a receipt for one reference and the register
 * would contain it twice. On a Worker that needs a cold start, which happens routinely.
 *
 * The first test in this file is that defect, written as an assertion, so it cannot come back
 * without something going red.
 *
 * WHAT IS AND IS NOT PROVED HERE
 * The Durable Object is exercised against a faithful stand-in: single object, strongly
 * consistent storage, and `blockConcurrencyWhile` serialising the read-modify-write. That
 * proves the COUNTER LOGIC — which is where the collision lived. It does not prove that
 * Cloudflare's runtime behaves as documented; only `wrangler dev` and a deployment do.
 *
 * Run: node test/reference-store.test.mjs
 */

import assert from 'node:assert/strict';
import {
  createMemoryReferenceStore, createDurableReferenceStore, ReferenceCounter, SEQUENCE_WIDTH,
} from '../src/reference-store.js';
import { createReferenceMinter } from '../src/intake.js';

let passed = 0, failed = 0;
const t = async (label, fn) => {
  try { await fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

const at = y => () => new Date(Date.UTC(y, 5, 1));

/**
 * A stand-in for the Durable Object runtime.
 *
 * `blockConcurrencyWhile` is modelled as a real mutex rather than a pass-through. A
 * pass-through would let the interleaving test pass against an implementation that has no
 * mutual exclusion at all, which is exactly the bug being guarded — the stand-in has to be
 * able to FAIL.
 */
function fakeDurableObjectNamespace() {
  const objects = new Map();
  let queue = Promise.resolve();
  const makeState = () => {
    const storage = new Map();
    return {
      storage: {
        // Deliberately asynchronous with a real yield: a get/put pair that never suspends
        // cannot interleave in JS, so a synchronous fake would prove nothing.
        get: async k => { await new Promise(r => setTimeout(r, 0)); return storage.get(k); },
        put: async (k, v) => { await new Promise(r => setTimeout(r, 0)); storage.set(k, v); },
      },
      blockConcurrencyWhile: fn => {
        const run = queue.then(fn);
        queue = run.catch(() => {});
        return run;
      },
    };
  };
  return {
    idFromName: name => name,
    get(id) {
      if (!objects.has(id)) objects.set(id, new ReferenceCounter(makeState()));
      const obj = objects.get(id);
      return { fetch: (url, init) => obj.fetch(new Request(url, init)) };
    },
  };
}

console.log('\nThe registry sequence');

/* ── the defect ─────────────────────────────────────────────────────────────── */
section('The collision that made a pilot unsafe');

await t('REGRESSION: two in-memory minters DO collide — this is why the store exists', async () => {
  const a = createReferenceMinter({ clock: at(2026) });
  const b = createReferenceMinter({ clock: at(2026) });
  assert.equal(await a.mint(), await b.mint(),
    'if this ever stops being true the in-memory store gained durability it does not have');
  assert.equal(a.durable, false);
  assert.equal(b.durable, false);
});

await t('two minters sharing ONE durable store do NOT collide', async () => {
  // The same two independent minters — the only change is where the sequence lives.
  const ns = fakeDurableObjectNamespace();
  const a = createReferenceMinter({ clock: at(2026), store: createDurableReferenceStore(ns) });
  const b = createReferenceMinter({ clock: at(2026), store: createDurableReferenceStore(ns) });
  const first = await a.mint();
  const second = await b.mint();
  assert.notEqual(first, second, 'a second isolate must not re-issue the first reference');
  assert.equal(first, 'NITDA-2026-000001');
  assert.equal(second, 'NITDA-2026-000002');
  assert.equal(a.durable, true);
});

await t('a burst of concurrent mints issues every number exactly once', async () => {
  /* The failure this catches is interleaving: two callers reading N and both writing N+1.
     It only appears under concurrency, which is why this is a burst and not a loop. */
  const ns = fakeDurableObjectNamespace();
  const minters = Array.from({ length: 5 }, () =>
    createReferenceMinter({ clock: at(2026), store: createDurableReferenceStore(ns) }));
  const refs = await Promise.all(
    Array.from({ length: 60 }, (_, i) => minters[i % minters.length].mint()));

  assert.equal(new Set(refs).size, refs.length, 'every reference must be unique');
  const seqs = refs.map(r => Number(r.split('-')[2])).sort((x, y) => x - y);
  assert.deepEqual(seqs, Array.from({ length: 60 }, (_, i) => i + 1),
    'and the sequence must be gapless: 1..60 with nothing skipped or repeated');
});

/* ── the shape ──────────────────────────────────────────────────────────────── */
section('The reference keeps its shape');

await t('the format is unchanged by where the sequence lives', async () => {
  const ns = fakeDurableObjectNamespace();
  const m = createReferenceMinter({ clock: at(2026), store: createDurableReferenceStore(ns) });
  assert.match(await m.mint(), /^NITDA-2026-\d{6}$/);
  assert.equal(SEQUENCE_WIDTH, 6);
});

await t('a custom prefix is honoured', async () => {
  const ns = fakeDurableObjectNamespace();
  const m = createReferenceMinter({ prefix: 'NITDA', clock: at(2026), store: createDurableReferenceStore(ns) });
  assert.ok((await m.mint()).startsWith('NITDA-'));
});

await t('the sequence restarts each year, which is what the year in the reference is for', async () => {
  const ns = fakeDurableObjectNamespace();
  const store = createDurableReferenceStore(ns);
  const y26 = createReferenceMinter({ clock: at(2026), store });
  const y27 = createReferenceMinter({ clock: at(2027), store });
  await y26.mint(); await y26.mint();
  assert.equal(await y27.mint(), 'NITDA-2027-000001', '2027 must not continue 2026 numbering');
  assert.equal(await y26.mint(), 'NITDA-2026-000003', 'and 2026 must carry on where it left off');
});

await t('`seed` still means the FIRST number issued, as it always did', async () => {
  const m = createReferenceMinter({ seed: 318, clock: at(2026) });
  assert.equal(await m.mint(), 'NITDA-2026-000318');
  assert.equal(m.peek(), 319);
});

/* ── refusals ───────────────────────────────────────────────────────────────── */
section('The counter refuses what it cannot number');

await t('a malformed or absurd year is refused rather than numbered', async () => {
  const obj = new ReferenceCounter({
    storage: { get: async () => 0, put: async () => {} },
    blockConcurrencyWhile: fn => fn(),
  });
  for (const bad of [{ year: 'nineteen' }, { year: 1066 }, { year: 99999 }, {}]) {
    const res = await obj.fetch(new Request('https://x/next', {
      method: 'POST', body: JSON.stringify(bad),
    }));
    assert.equal(res.status, 400, `year ${JSON.stringify(bad)} should be refused`);
  }
});

await t('an unreachable counter throws rather than falling back to a local number', async () => {
  /* Falling back would be the worst possible behaviour: it would silently reissue numbers
     precisely when the durable store is unavailable, which is when nobody is watching. */
  const broken = { idFromName: n => n, get: () => ({ fetch: async () => new Response('', { status: 500 }) }) };
  const m = createReferenceMinter({ clock: at(2026), store: createDurableReferenceStore(broken) });
  await assert.rejects(() => m.mint(), /reference_counter_unavailable/);
});

await t('a counter returning nonsense is not trusted', async () => {
  const liar = {
    idFromName: n => n,
    get: () => ({ fetch: async () => Response.json({ sequence: -1 }) }),
  };
  const m = createReferenceMinter({ clock: at(2026), store: createDurableReferenceStore(liar) });
  await assert.rejects(() => m.mint(), /invalid_sequence/);
});

await t('building a durable store with no binding is refused at construction', () => {
  assert.throws(() => createDurableReferenceStore(null), /Durable Object binding is required/);
});

/* ── the posture is visible ─────────────────────────────────────────────────── */
section('A deployment can tell which guarantee it has');

await t('the minter reports whether its sequence is durable', async () => {
  assert.equal(createReferenceMinter({}).durable, false);
  assert.equal(createReferenceMinter({}).kind, 'memory');
  const ns = fakeDurableObjectNamespace();
  const d = createReferenceMinter({ store: createDurableReferenceStore(ns) });
  assert.equal(d.durable, true);
  assert.equal(d.kind, 'durable-object');
});

const VALID_ENV = {
  DGO_TENANT_ID: 't', DGO_AUDIENCE: 'api://x',
  DGO_ROLE_MAP: '{"DGO.Viewer":"viewer"}',
  DGO_ENDPOINT_FETCH_ALL: 'https://flow.example/x',
};

await t('healthz names the sequence backing so a pilot cannot be wrong about it', async () => {
  const { default: cold } = await import('../src/worker.js?cold=posture');
  const res = await cold.fetch(new Request('https://proxy.example/healthz'), { ...VALID_ENV });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.referenceSequence, 'memory');
  assert.equal(body.referenceSequenceDurable, false);
});

await t('the Worker refuses to serve when durability is REQUIRED but absent', async () => {
  /* Asserted as a difference, not as a bare 503. An earlier version of this test passed
     because the env was missing DGO_ROLE_MAP — the right status for entirely the wrong
     reason. Pairing it with the identical env above, which serves 200, is what makes the
     durability flag the only thing that can account for the refusal. */
  const { default: cold } = await import('../src/worker.js?cold=nodurable');
  const res = await cold.fetch(new Request('https://proxy.example/healthz'), {
    ...VALID_ENV, DGO_REQUIRE_DURABLE_REFERENCES: 'true',
  });
  assert.equal(res.status, 503, 'issuing references it cannot promise are unique is worse than 503');
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
