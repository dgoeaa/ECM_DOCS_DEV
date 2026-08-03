// Where the registry sequence actually lives.
//
// THE DEFECT THIS EXISTS TO CLOSE
// The reference minter held its counter in a module-level variable seeded at 1. Two
// processes therefore both minted NITDA-YYYY-000001:
//
//     process 1 first mint: NITDA-2026-000001
//     process 2 first mint: NITDA-2026-000001
//
// On the Node host that needed a restart. On a Worker it needs a cold start, which happens
// routinely and invisibly. The result is two citizens holding a receipt for the same
// registry reference, and a register that contains that reference twice. For a records
// system that is not a rough edge, it is the register being wrong.
//
// intake.js had already named this as the one thing that could not stay in memory. It stayed
// in memory anyway, because nothing enforced it. Now something does.
//
// WHY A DURABLE OBJECT AND NOT KV
// A sequence needs read-modify-write to be ATOMIC. Workers KV is eventually consistent and
// has no atomic increment: two isolates can both read N and both write N+1, which produces
// exactly the collision this module exists to prevent — only less often, and therefore
// later and more confusingly. KV is not a weaker option here, it is a wrong one, so it is
// not offered.
//
// A Durable Object is single-threaded per object with strongly consistent storage. One
// object serves the whole registry sequence, which sounds like a bottleneck and is not:
// correspondence intake is measured in documents per hour.

/** The `${prefix}-${year}-${sequence}` shape, shared with core/reference-minter.js. */
export const SEQUENCE_WIDTH = 6;

/**
 * In-memory sequence. Correct for ONE process and for nothing else.
 *
 * Kept because the test suite and the Node dev host need it, and marked `durable: false` so
 * that a deployment which requires durability can refuse to start rather than discovering
 * the problem in the register.
 */
export function createMemoryReferenceStore({ seed = 1 } = {}) {
  // `seed` is the FIRST number issued, not the last one skipped — the meaning the previous
  // minter had, kept so callers that pass a seed keep getting the reference they expect.
  const byYear = new Map();
  return {
    durable: false,
    kind: 'memory',
    async next(year) {
      const n = byYear.has(year) ? byYear.get(year) + 1 : seed;
      byYear.set(year, n);
      return n;
    },
    peek: year => (byYear.has(year) ? byYear.get(year) + 1 : seed),
  };
}

/**
 * Durable Object sequence.
 *
 * `namespace` is the Worker binding (env.DGO_REFERENCE_DO). One object id — `registry` —
 * so every isolate in every colo increments the same counter.
 */
export function createDurableReferenceStore(namespace, { name = 'registry' } = {}) {
  if (!namespace) throw new Error('createDurableReferenceStore: a Durable Object binding is required');
  const stub = () => namespace.get(namespace.idFromName(name));
  return {
    durable: true,
    kind: 'durable-object',
    async next(year) {
      const res = await stub().fetch('https://reference-counter/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      });
      if (!res.ok) throw new Error(`reference_counter_unavailable: ${res.status}`);
      const { sequence } = await res.json();
      if (!Number.isInteger(sequence) || sequence < 1) {
        throw new Error('reference_counter_returned_invalid_sequence');
      }
      return sequence;
    },
  };
}

/**
 * The Durable Object itself. Exported from worker.js so wrangler can bind it.
 *
 * `blockConcurrencyWhile` makes the read-modify-write indivisible. Without it two overlapping
 * requests to the same object could interleave between the get and the put, which is the
 * same collision in a smaller window — and a smaller window is worse, because it survives
 * testing and fails in production.
 */
export class ReferenceCounter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    let year;
    try { ({ year } = await request.json()); }
    catch { return Response.json({ error: 'malformed_request' }, { status: 400 }); }

    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      return Response.json({ error: 'invalid_year' }, { status: 400 });
    }

    /* Keyed by year: the sequence restarts each January, which is how a paper registry
       numbers a file and what the NITDA-YYYY-NNNNNN format already implies. Keying on a
       single global counter instead would make the year in the reference decorative. */
    const key = `seq:${year}`;
    let sequence;
    await this.state.blockConcurrencyWhile(async () => {
      sequence = ((await this.state.storage.get(key)) || 0) + 1;
      await this.state.storage.put(key, sequence);
    });

    /* A number issued here is spent whether or not the caller goes on to succeed. Gaps are
       therefore possible and are the correct trade: re-using a number that may already be on
       a citizen's receipt would be far worse than a register that skips one. */
    return Response.json({ sequence, year });
  }
}
