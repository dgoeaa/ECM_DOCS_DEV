# Packaging — building the two artefacts that get handed over

`npm run package` builds each platform into a self-contained directory with its endpoint
URLs configured into it, a manifest hashing every byte, and a provisioning record naming
what is wired and what is not.

```
npm run package                                              # both, wired and runnable
npm run package -- --values ~/dgo-values.txt                 # wired to URLs you supply
npm run package -- --demo                                    # deliberately empty
npm run package -- --surface portal                          # one of them
npm run package:verify -- --verify dist/dgo-document-portal  # check a delivered package
```

**The default build is runnable.** With no values supplied it wires every endpoint the
documented estate provides — 17 of 18 on the internal platform, 5 of 6 on the portal — so
what you download starts working when you serve it.

Output:

| Package | Serves | Entry |
|---|---|---|
| `dist/dgo-internal-platform/` | The internal operations platform | `index.html` |
| `dist/dgo-document-portal/` | The public document portal | `index.html` |

Both are static sites. There is nothing to build, install, deploy alongside or keep
running — serve the directory.

---

## Why this exists, and what changed

The architecture decision is that each platform calls its Power Automate flows **directly**,
with the complete trigger URLs configured into the artefact that is handed over. No proxy,
no broker, no intermediary in the request path, and nothing to stand up between the browser
and the flow.

The repository implemented the first half of that and not the second. `npm run setup` wrote
the URLs into `config/config.local.js` and `document-portal/config.local.js`, both
git-ignored — so the thing people actually received, a clone or GitHub's "Download ZIP", was
by construction the one artefact that could not contain them. Provisioning was a step an
operator performed from a document, on the far side of the handover, with nothing checking
the result.

`npm run setup` is still the right command for a working tree. `npm run package` is the
command for something you are giving to someone else. Both write the same bytes from the
same endpoint definition in `scripts/lib/endpoint-surface.mjs`, so a wired working tree and
a delivered package are the same product.

---

## Posture is derived, not declared

There is no `--posture` flag. It was one, defaulting to `demo`, which meant the default
build — the one somebody runs without reading anything — produced a package that transmits
nothing. Posture is a fact about what got wired, so it is read off the result:

| Posture | When | What it is |
|---|---|---|
| `live` | any endpoint is wired | Serve it and it calls the flows. |
| `demo` | `--demo`, or nothing resolved | Boots, renders and exercises every screen, transmits nothing. Stamped `demo: true` in the manifest and in `DEPLOY.md`. |

### Where the URLs come from

1. `--values <file>`, then the environment. Always wins.
2. **The documented estate**, recovered from this repository's reference corpus. The floor,
   not the ceiling — replacing it later is a values file and a rebuild.
3. `--no-estate` disables the fallback: use only what you supplied.

### How a contract key is matched to a flow

`scripts/lib/endpoint-recovery.mjs` carries the mapping as an explicit table, and every
entry cites the document that establishes it. It used to *infer* the mapping, and both
halves of the inference were wrong in ways that reached delivered packages:

| What was inferred | What it produced |
|---|---|
| "a signature is whatever base64url characters follow `sig=`" | Prose glued onto a URL by a document export became part of the signature; a lineage artefact's mangled 40-character copy shipped verbatim. Neither could ever authenticate. |
| "the lineage artefact naming contract keys is authoritative" | `REFERENCE_DATA` was wired to a workflow id that appears nowhere else in the corpus, while the flow the operator's own list calls *"references"* — 22 occurrences across three documents — went unused. `SINGLE_ASSIGNMENT` and `AI_DOC_ANALYSIS` were wrong the same way. |

A trigger signature is base64url of a 32-byte HMAC: **exactly 43 characters**. Extraction
now takes exactly 43 and rebuilds the URL from its parts, so glued prose, entity residue
and reordered query strings cannot survive into a package. `endpoint-validation.mjs` refuses
any other length as `non-canonical-signature`, in every posture — the old threshold was
"longer than 20 is probably fine", which is exactly why the 40-character one got through.

Where documents disagree about which flow an id is, they are weighed in this order and the
catalogue records which tier settled it:

1. a documented trigger schema or response body tied to the id;
2. the operator's own labelled URL lists;
3. a contract-key name next to the URL in an application artefact;
4. corroboration across separate documents.

### Why the estate, and not a fresh one

Those signatures are **published** — committed to this repository, so anyone with access
holds them. Wiring them is a decision, not an oversight.

Minting a fresh production estate before the platform has been exercised live is the worse
trade. Live testing reveals contract adjustments; each adjustment means regenerating
triggers again; and every regeneration cycle re-exposes the new set through the same working
files. Two or three rounds of that and the "fresh" estate is as disclosed as the old one.

So: test on the estate that is already disclosed, adjust until the contracts hold, then mint
production URLs **once**, at the end, and rotate into them. `npm run rotation` produces that
worklist — 39 flows. Every package stamps its own exposure in `PACKAGE_MANIFEST.json` and
carries a warning in `DEPLOY.md`, so no deployment can be wrong about which it holds.

**A package carrying disclosed URLs is fit for live testing of the flow contracts. It is not
fit to carry real correspondence or citizens' personal data.**

---

## What the build refuses

A package is not emitted when:

- **a URL is malformed** — in every posture, demo included. A truncated paste has nothing in
  front of it to produce a useful error;
- **two keys with different source flows resolve to the same one**, because the second
  silently inherits the first's flow and every action routed to it lands on a switch with no
  case for it. Keys that *declare* they share a flow — `EMAIL` on `DYNAMIC_GLOBAL_ACTIONS`,
  `STATUS` and `SUPPORT` on `SUBSIDIARY_ACTIONS` — are the design, not a collision;
- **the package cannot resolve its own module graph** — every asset and every module the
  entry HTML reaches is resolved inside the package before it is written.

Those are defects. Two things are deliberately **not** refusals:

- **A disclosed signature** is stamped, not blocked. Blocking it made the only configuration
  that can be tested live the one the tool would not build.
- **An endpoint with no URL** ships unprovisioned and is recorded as such. `SCAN_INTAKE` has
  no flow in the estate at all and the portal's `UPLOAD` has no ticket-redeeming flow — gaps
  in the deployed estate, not in the build. Refusing on them would leave nothing runnable;
  each reports itself unconfigured at the point of use instead.

### Why URL validation is stricter than it looks

`npm run commission` used to check three things: empty, placeholder, non-HTTPS. Those are
the failures you make once. The ones that survive to production are quieter:

| What happened | What the URL looks like |
|---|---|
| Pasted from a mail client that broke the line at `&` | non-empty, HTTPS, no template text, **no signature** |
| Copied out of a spreadsheet cell | ends in a newline |
| Truncated somewhere between two documents | has `sig`, has no `api-version` |
| Someone pasted the run history URL | valid Power Automate host, **not a trigger path** |

Every one of them passes the three old checks. Called directly, a malformed URL has nothing
in front of it to produce a useful error: it fails mid-action, at an officer's desk, as a
network error with nothing to point at. `scripts/lib/endpoint-validation.mjs` fails all of
them at build time, and `npm run commission` now applies the same rules, so the gate and the
packager cannot reach opposite verdicts on one configuration.

A URL on an unrecognised host is **reported, not refused** — a validator that blocks a
legitimate migration gets deleted, and a deleted validator checks nothing.

---

## What is in a package

| File | What it is |
|---|---|
| `PACKAGE_MANIFEST.json` | Every file, its size and its SHA-256; the endpoint provisioning record; the build id. **Signatures are redacted** — the manifest is safe to paste into an issue. |
| `ENDPOINT_PROVISIONING.md` | What is wired, what is not, which flow routes each URL carries, and how to rotate. Redacted. |
| `FLOW_CATALOGUE.json` | **Every endpoint URL in full, unredacted** — the ones wired here, and every other flow in the documented estate. **This is a credential.** |
| `ENDPOINT-CHECK.html` | The endpoint workbench, run from your own browser. Serve the directory and open it. |
| `ENDPOINT-CHECK-STANDALONE.html` | The same workbench with the configuration and the whole flow catalogue inlined. No server, no sibling file. **This is a credential.** |
| `DEPLOY.md` | How to deploy it and what to verify first. |
| `config/config.local.js` *or* `config.local.js` | The provisioned endpoint URLs, in the form the browser reads. **This is a credential.** |

### `ENDPOINT-CHECK.html` — the workbench that runs where the deployment is

`npm run verify:endpoints` answers "do these flows work?" from a terminal, and that is the
wrong machine. It needs a checkout, Node, and a network path to Power Automate. Whoever is
serving the static directory has a browser and none of the other three — so every round of
"does it work?" cost a message to somebody who could run the CLI, and the answer came back
describing a different machine's network.

The browser is also where the real request path is: it is what actually calls the flows,
under the CORS rules the flows actually apply, from the network the deployment actually sits
on. So the check ships inside the package.

```
cd dist/dgo-internal-platform
python3 -m http.server 8080
# open http://localhost:8080/ENDPOINT-CHECK.html and press Run
```

Six tabs, each because the alternative was a message to somebody with a terminal:

| Tab | Answers |
|---|---|
| **Endpoints** | Is each key wired to something that responds? Same URL, method and body the platform sends, from `scripts/lib/endpoint-probes.mjs` — the terminal check reads the same table. |
| **Routes** | One URL carries many routes; `SUBSIDIARY_ACTIONS` carries eighteen. **38 routes probed separately.** A flow that answers on its first route and has no case for the rest passes the Endpoints tab and fails at an officer's desk. |
| **Console** | Free-form. Pick any URL the package knows — contract endpoint or estate flow — edit the body, send it, read the whole response with headers and timing. Every canned probe is a guess; when it's wrong you need to try something else. |
| **Estate** | All 39 flows, filterable, with a reachability probe and a **repoint helper** that writes the values-file line for you. |
| **Report** | Everything the session did, downloadable as JSON. No URL and no signature reaches it, so it can be pasted into an issue. |
| **Environment** | Origin, protocol, secure context, whether the configuration loaded — because half of "it doesn't work" is the page having been opened the wrong way. |

Write probes are behind a tick box on both the Endpoints and Routes tabs.

**A route probe proves the flow accepted a request carrying that discriminator. It cannot
prove the flow implements it** — a permissive default answers 200 to a route it does nothing
with. The page says so where the results appear, not only here.

### `ENDPOINT-CHECK-STANDALONE.html` — when the obstacle is the server, not the endpoints

The served copy reads `config.local.js` and `FLOW_CATALOGUE.json` from beside it. That is
right for a page inside a served package: it reads the same bytes the platform does, so the
two can never disagree.

It is useless to somebody with a phone, a downloaded folder and no server. The first person
to open it got `404 File not found`, because a static server serves the directory it was
started in and theirs was one level up — a mistake the page cannot detect and cannot explain.

So the packager emits a second copy with the configuration and the whole catalogue folded
in. **Open it from anywhere, including from disk.** It carries the endpoint URLs, which makes
it exactly as sensitive as the configuration file it inlines.

**It keeps four outcomes apart, because collapsing any two sends someone to fix the wrong
thing:**

| Result | Means |
|---|---|
| **answered** / **refused** | The flow replied. A 4xx it produced itself is a live, validating flow — for `UPLOAD` and `STATUS` a refusal is the *correct* answer. |
| **signature** | 401/403 from Power Automate. Rotate and rebuild. |
| **no flow** | 404 on the trigger path. Deleted, or the URL is stale. |
| **not reached** | The call never got an answer from Power Automate: a browser CORS rejection, an offline network, or something in the middle answering instead. **This says nothing about the endpoint.** A CORS rejection gives the page no status and no body, so it cannot be told apart from an unreachable host — and neither is evidence about the signature. |

That last row is the one that matters. The CLI has got it wrong twice, in opposite
directions, and both times it reported a network fact as an estate fact.

### `FLOW_CATALOGUE.json`, and why a package needs it

Everything else redacts, because the manifest and the provisioning record are meant to
travel. That left the complete URLs in one place — `config.local.js` — in the form the
browser reads rather than a form anyone can work with, and it left the flows the platform
has **no contract key for** with nowhere to appear at all.

That mattered more than it sounds. The documented estate has **39 flows**. Twenty-two
contract keys across the two platforms reach **16** of them. The other **23 — including
GET EMAILS, GET TASKS, BULK OPS GET DOCS and "get correspondence (flat response)" — are
called by nothing**, because the platform routes those reads through `SUBSIDIARY_ACTIONS`
and `FETCH_ALL` rather than through dedicated flows. A flow that exists and answers was
therefore indistinguishable from a flow that had been overlooked, and the only way to tell
was to grep the reference corpus.

The catalogue names all 39, each with its complete URL, the reference documents that name
it, which contract keys (if any) call it, and — where the documents disagree about what a
flow is — which reading was taken and why. During live testing, "this probe answered
wrongly, what else could this key point at?" is answered by reading one file:

```
FETCH_ALL → point it at "all data and references" instead
  1. copy that flow's url out of FLOW_CATALOGUE.json
  2. echo "DGO_ENDPOINT_FETCH_ALL=<url>" >> ~/dgo-values.txt
  3. npm run package -- --values ~/dgo-values.txt
```

Supplied values always beat the documented estate, and only the keys named change.

The platform's own `README.md` is preserved. The repository's scaffolding — `tests/`,
`scripts/`, `docs/`, `package.json`, the reference corpus — is not shipped.

### The build id

A digest of the **provisioned endpoint set**, not of the clock. Two builds of the same code
with the same endpoints carry the same id; rotating one signature changes it. That is what
makes "is this the deployment I verified?" an answerable question.

It also does real work in the portal. The service worker names its cache after it, so a
rotation necessarily invalidates the cache — previously the source could only ask a human to
remember, and a returning visitor kept calling the URL that had just been revoked. The
endpoint config is additionally network-first, so a stale copy can never be the one that
gets called while online.

---

## Verifying a delivered package

```
npm run package:verify -- --verify dist/dgo-internal-platform
```

Recomputes every file hash against the manifest and re-validates the endpoint set. It
catches an edited file, an added file, a removed file, and a manifest edited to hide any of
them. **A package that does not verify must not be deployed.**

The only file not covered is `PACKAGE_MANIFEST.json` itself, which would have to contain its
own digest; it is checked instead against the digest of its own file list.

---

## The obligation a package cannot discharge

Each flow is called directly, so **each flow is the only place authentication,
authorisation, validation and rate limiting can happen.** No file in a package can do it for
them, and no check in this repository can prove they do.

Enabling auth provisions the client half: the browser acquires a one-time-code proof and
sends it, stops asserting identity itself, and reads the role the proof carries. It does not
make any decision server-authoritative.

**There is no identity-provider tenant, no directory registration and no administrator approval on this
path.** Identity is `OTP_GENERATE` and `OTP_VERIFY`, two Power Automate flows that arrive in
the package with every other URL, so activation is a flag rather than a procurement.

The seven server-side obligations are specified in
[`../architecture/AUTHENTICATION_CONTRACT.md`](../architecture/AUTHENTICATION_CONTRACT.md)
§2 and sequenced in [`FLOW-BUILD-PLAN.md`](./FLOW-BUILD-PLAN.md). Exercise them live with
`npm run verify:endpoints -- --include-writes` before declaring anything live.

---

## Before handing a package over

```
npm test                                                     # 26 suites, 103 browser assertions
npm run package -- --values <file>
npm run package:verify -- --verify dist/dgo-internal-platform
npm run package:verify -- --verify dist/dgo-document-portal
npm run verify:endpoints -- --include-writes \
  --catalogue dist/dgo-internal-platform/FLOW_CATALOGUE.json # the flows answer, live
npm run commission                                           # obligations a person must sign
```

`--catalogue` adds a second pass over **every** flow in the estate, including the 23 no
contract key calls, and reports which signatures still authenticate. Those are reachability
probes with an empty body: a `200` means the URL is live, not that the flow does what its
name suggests. The report keeps the two apart, and it keeps a third case apart from both —
a call answered by an egress filter rather than by Power Automate is reported **unreached**,
never as a revoked signature. That distinction has been got wrong in this script twice, in
opposite directions, and `tests/endpoint-verification.test.mjs` now holds it in place.

The last two are the ones that cannot be skipped. `verify:endpoints` is the difference
between "the configuration looks right" and "the configuration was exercised against the
live flow and here is the transcript"; `commission` reports the obligations no script can
settle.
