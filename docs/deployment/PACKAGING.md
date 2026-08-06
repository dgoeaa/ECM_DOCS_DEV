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
| `ENDPOINT_PROVISIONING.md` | What is wired, what is not, which flow routes each URL carries, and how to rotate. |
| `DEPLOY.md` | How to deploy it and what to verify first. |
| `config/config.local.js` *or* `config.local.js` | The provisioned endpoint URLs. **This is a credential.** |

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

**There is no Entra tenant, no directory registration and no administrator approval on this
path.** Identity is `OTP_GENERATE` and `OTP_VERIFY`, two Power Automate flows that arrive in
the package with every other URL, so activation is a flag rather than a procurement.

The seven server-side obligations are specified in
[`../architecture/AUTHENTICATION_CONTRACT.md`](../architecture/AUTHENTICATION_CONTRACT.md)
§2 and sequenced in [`FLOW-BUILD-PLAN.md`](./FLOW-BUILD-PLAN.md). Exercise them live with
`npm run verify:endpoints -- --include-writes` before declaring anything live.

---

## Before handing a package over

```
npm test                                                     # 25 suites, 100 browser assertions
npm run package -- --values <file>
npm run package:verify -- --verify dist/dgo-internal-platform
npm run package:verify -- --verify dist/dgo-document-portal
npm run verify:endpoints -- --include-writes                 # the flows answer, live
npm run commission                                           # obligations a person must sign
```

The last two are the ones that cannot be skipped. `verify:endpoints` is the difference
between "the configuration looks right" and "the configuration was exercised against the
live flow and here is the transcript"; `commission` reports the obligations no script can
settle.
