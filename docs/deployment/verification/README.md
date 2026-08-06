# Endpoint verification evidence

## What this is, and what it is not

`endpoint-verification.json` is the transcript of
`npm run verify:endpoints -- --include-writes` run on 6 August 2026 against
**`scripts/dev-server.mjs`, the local conforming endpoint implementation.**

**It is not evidence about a Power Automate tenant.** No production or pilot flow was
called; no signature was used; nothing in a real register was written. Reading it as
tenant evidence would be exactly the error the verifier itself is built to prevent — an
earlier cut of `verdictOf()` read an egress filter's 403 as "the flow is live and
validating" and reported six endpoints green while not one packet had reached Power
Automate.

## What it does establish

Three things, all of which were previously unestablished:

1. **Every flow route is now reachable by the verifier.** 26 probes covering all 39 routes
   across both surfaces. Four of them could not be probed at all before: `DISPATCH_OUTBOUND`
   and `ARCHIVE_REFERENCE` ride the `DYNAMIC_ACTIONS` URL and the verifier walked the
   configured key list, so they could never become targets however they were configured;
   `SCAN_INTAKE` and `UPLOAD` are raw-byte PUTs and had no probe shape.

2. **The client and a conforming implementation agree on every response shape.** They did
   not. Running this produced a real integration defect — `AI_CHAT` answered
   `{ result: { message } }` while `modules/assistant.js` reads `reply` or `message` off the
   unwrapped envelope, so every local Assistant request rendered "No reply was returned by
   the AI flow" against an endpoint that had answered correctly. Nothing caught it because
   nothing had ever called the endpoint and compared the answer with what the client reads.

3. **The verifier's own verdicts are sound.** The run also surfaced four defects in the
   verifier, each of which would have mis-reported a correct flow:

   | Defect | Effect |
   |---|---|
   | `STATUS`'s designed 404 read as "no such flow — the trigger URL is stale" | The uniform denial, which is a control working, reported as a broken endpoint |
   | `UPLOAD`'s 403 read as "the signature is wrong or revoked" | The ticket check refusing an unticketed deposit — the pass — reported as a failure |
   | Contract shape checked only at the top level | Six correctly-shaped responses reported as gaps; the payload is inside the documented envelope's `data` |
   | Contract shape checked against refusals | A 400 refusing a thin probe payload obviously carries no `referenceId`; saying so buried the one case that matters, a 2xx missing what the client reads |

   A verifier that cries wolf gets ignored on the run where it is right.

## What still has to happen against the tenant

This transcript does not substitute for the real run, and the readiness assessment does not
treat it as one. Before go-live:

```
npm run setup -- --values <your values file> --force
npm run verify:endpoints -- --include-writes
```

Against the real estate that will create real records, tagged `__DGO_PROBE__` with a run id
so they can be found and deleted afterwards. Read the result, and read it knowing that a
non-JSON body means something intercepted the call and the run verified your network rather
than your configuration.

## Regenerating this file

```
npm run dev                                   # the local implementation, on 8080
npm run setup -- --values <dev values>        # point the config at it
npm run verify:endpoints -- --include-writes --json <path>
```

The committed copy carries no signature and no URL: endpoints are identified by contract key
only, so it is safe to attach to a ticket.
