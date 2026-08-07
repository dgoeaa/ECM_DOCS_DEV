# Operational readiness audit — both platforms, every branch

**Date** 6 August 2026, amended 7 August 2026 · **Repository** `dgoeaa/ECM_DOCS_DEV`
(private) · **Anchor** `main`
**Scope** Every branch, folder, file, configuration, integration, workflow, dependency and
platform surface. Both delivered platforms, assessed independently.
**Question** Is this ready for live operationalization — real production usage against live
endpoints under structured operational conditions?

---

## Verdict

**Yes for the internal platform and the document portal as software. No for the estate they
call, and that is where every remaining blocker lives.**

The repository is in good order and its engineering is real. What this audit found was, with
one exception, not broken code. It was **checks that were narrower than the claim they made**
— three of them reporting success over a scope smaller than the one they named, and a fourth
checking three properties of a URL where eleven decide whether it works. A green light
computed across the subset a control happens to know about is the failure mode this
codebase is otherwise unusually careful about, which is why it is worth naming as a pattern
rather than as four unrelated bugs. Each is closed with an assertion that fails if it
returns.

> **Amendment, 7 August 2026.** The first packages this audit produced were provisioned
> with **wrong endpoint URLs** — four contract keys routed to the wrong flow, one signature
> mangled — and reported as runnable. The operator found it by trying to run them; no check
> here did. **O-21** and **O-22** record it in full. The pattern named two paragraphs below
> was the cause again: a signature-length check built on a guessed threshold where an exact
> figure was available, reporting success over a scope narrower than its claim.

The one structural gap was the architecture's own delivery step. The decision is that every
endpoint is called directly, with its complete URL provisioned into the artefact that is
handed over. The repository implemented the calling and not the provisioning: the URLs were
written into git-ignored files, so the artefact people actually received — a clone, or
GitHub's "Download ZIP" — was by construction the one thing that could not contain them.
That is now a build step with a build gate.

**What stands between here and live is not in this repository.** Fifty-five signed trigger
URLs must be rotated, and each flow must be built to authenticate and authorise its own
callers. No code change here can close either.

| | Before this audit | After |
|---|---|---|
| Endpoints in the delivered artefact | **impossible by construction** | provisioned, hashed, verifiable |
| Endpoint URL validation | 3 checks | 11 refusal codes, negative-controlled |
| Flow routes exercisable live | 35 of 39 | **39 of 39** |
| Activation manifest coverage | 24 of 29 routes | **29 of 29** |
| Secret ratchet's reported scope | "no signatures" (55 outside scope) | scope stated, exposure reported every run |
| Portal rotation reaching a returning visitor | required a human to remember | mechanical |
| Node assertions | ~600 across 23 suites | **~700 across 26 suites** |
| Browser assertions | 96 | **103** |
| Flow routes with a live transcript | 0 | **39 of 39** |
| Rotation work | "55 signatures" | **39 flows, 14 carrying two live signatures each** |
| Dependency advisories | 3 (1 high) | **0** |
| Entra / Azure dependency | tenant + client id + app roles | **removed — identity is two flows** |
| Default package | demo, transmits nothing | **live, 22 of 24 endpoints wired** |
| Endpoint signatures provisioned | 1 mangled, 1 with prose glued on, accepted by the gate | **43-character canonical, exact-length refusal** |
| Contract key to flow | inferred from one lineage snapshot | **explicit table, every entry citing its document** |
| Estate flows visible in a package | the 16 with a contract key | **all 39, with complete URLs** |
| Unmerged branch work | 1 commit | **0** |

---

## 1 · What was examined

| Surface | Extent |
|---|---|
| Branches | 9 remote, all compared against `main` commit-by-commit and by content |
| Tracked files | 656, 29 MB |
| Internal platform | 29 routes, 135 reachable modules, 1 849 import edges, 18 endpoint keys, 39 flow routes |
| Document portal | 5 pages, 6 endpoint keys, 1 service worker, 8 design-token files |
| Configuration | 33 config modules |
| Dependencies | 4 devDependencies, **0 runtime dependencies in either package** |
| Tooling | `setup`, `commission`, `verify:endpoints`, `dev`, `package` (new) |
| CI | 1 workflow, 4 jobs |
| Quality gate | 25 Node suites (680 assertions) + 100 browser assertions |

Everything below was verified by running it, not by reading a claim about it. Where this
document and a generated artefact disagree, the artefact is right.

---

## 2 · Findings

Ordered by consequence. **All nineteen defect findings are closed in this audit's commits**;
O-12 records the dependency posture, which is favourable. The items that remain open are in
§5, and none of them is closable from inside this repository.

O-13 through O-18 were found in the second pass, after the instruction to leave nothing
deferred. Five of the six were only findable by *doing* the thing rather than reviewing it —
running the verifier end to end, generating the rotation list, resolving every reference —
which is the general lesson of this audit and the reason §5's remaining steps are actions
rather than reviews.

### O-01 · The delivered package could not contain its endpoints — **closed**

**Severity: high.** The architecture requires each platform to call its flows directly with
the complete URLs configured into the delivered artefact. `npm run setup` wrote them to
`config/config.local.js` and `document-portal/config.local.js`, both git-ignored. The
handover artefact therefore could not carry them, by construction, and provisioning happened
on the far side of the handover with nothing checking the result.

**Closed by** `npm run package`. Two self-contained packages, endpoint configuration written
in, `PACKAGE_MANIFEST.json` hashing every byte, `ENDPOINT_PROVISIONING.md` naming what is
wired. `npm run package:verify` re-hashes a delivered package and catches an edited file, an
added file, a removed file, and a manifest edited to hide any of them. 60 assertions in
`tests/packaging.test.mjs`; CI builds and verifies both packages on every push.

The internal platform package is 160 files / 1.0 MB; the portal is 42 files / 0.7 MB.
Neither ships the test suite, the scripts, the docs or the reference corpus.

### O-02 · Endpoint URL validation missed every failure that reaches production — **closed**

**Severity: high.** `npm run commission` checked three things: empty, placeholder,
non-HTTPS. Those are the failures made once. A trigger URL truncated at the first `&`, one
that kept its signature but lost its `api-version`, one carrying a newline out of a
spreadsheet cell, one pointing at the run-history path rather than the trigger path — every
one is non-empty, HTTPS and free of template text, and every one passes.

Called directly, a malformed URL has nothing in front of it to turn the failure into a
useful error. It fails mid-action, at an officer's desk, as a network error naming nothing.

**Closed by** `scripts/lib/endpoint-validation.mjs`: 11 refusal codes covering scheme, host
reachability, fragment, whitespace, control characters, placeholder text, workflow id,
trigger path, `api-version`, signature presence and signature length — plus a
workflow-collision check, because two keys on one flow means the second silently inherits
the first's flow. An unrecognised host is **reported, not refused**: a validator that blocks
a legitimate migration gets deleted, and a deleted validator checks nothing. `commission`
and `package` now apply the same rules and cannot reach opposite verdicts on one
configuration.

### O-03 · Four flow routes could not be verified live at all — **closed**

**Severity: high for a phase whose purpose is live operation.** `verify-endpoints` walked
the configured key list, so `DISPATCH_OUTBOUND` and `ARCHIVE_REFERENCE` — which ride the
`DYNAMIC_ACTIONS` URL and are distinguished only by `action` — could never become targets
however they were configured. `SCAN_INTAKE` and the portal's `UPLOAD` are raw-byte PUTs and
had no probe shape. The run reported the endpoints it had probed and never mentioned the
ones it structurally could not.

`UPLOAD` is half the portal's minimal-pilot set. "Both pilot endpoints are wired" and "both
pilot endpoints answer" were different claims, and only the first was ever checked.

**Closed by** driving targets from the probe table rather than the key list, a `via` field
for routes that share a URL, and a raw-bytes request shape. All 39 flow routes across both
surfaces are now reachable by `npm run verify:endpoints`.

### O-04 · The activation manifest was five routes behind the router — **closed**

**Severity: medium.** `config/platform-provisioning.config.js` is what
`core/platform-provisioner.js` validates at boot, what `modules/diagnostics.js` renders as
provisioning health, and what `core/action-runtime.js` reads to decide whether a workspace
may run an action. It carried 24 entries; the platform serves 29 routes. `briefs`,
`meetings`, `projects` (D6(b)), `scan-intake` and `ecm-erp-charter` had none.

`validate()` therefore enumerated 24 modules, computed `ok` across those 24, and returned
`true`. **A module that was never provisioned could not make the report false.** All five
workspaces render and work — the defect is that the surface an operator reads to decide
readiness could not see what it was missing.

**Closed by** entering all five with the actions each already performs. `ecm-erp-charter`
renders a charter and changes nothing, so it declares `readOnly: true`; the validator
distinguishes that from a workflow module that lost its actions, because the flag is on the
record rather than inferred. Seven assertions hold both directions of the parity, both ways
the read-only exemption could be abused, and every `ActionRuntime.run()` call site read from
the module sources.

### O-05 · The secret ratchet described a narrowed result as the whole result — **closed**

**Severity: medium.** `tests/check-secrets.mjs` printed **"No SAS signatures in tracked
files"** while 55 distinct signatures sat in 28 tracked files one directory outside its
scope. The exclusion of `docs/reference/foundational/` is deliberate and correct — that
corpus documents the deployed estate verbatim by explicit decision (D5), and scanning it
would hold the ratchet permanently red. Describing the narrowed result as the whole result
was not correct, and the command wired into CI as **"Secret scan"** was the one that said
zero. Only `npm run commission` reported the real figure, so the number a reader saw
depended on which command they happened to run.

**Closed by** stating the scope in the pass message and printing the excluded exposure on
every run. A control may narrow its scope; it may not describe the narrowed result as the
whole result.

**This also corrects the record.** `docs/STATUS_REPORT.md` recorded G-03 as "reduced to 4
signatures in 2 files". That was the application tree. The whole-repository figure — the one
that matters, because rotation is per signature — is **55 across 28 files**.

### O-06 · Rotating a portal endpoint did not reach a returning visitor — **closed**

**Severity: medium, and it defeats the only revocation mechanism there is.** The service
worker was cache-first for every same-origin GET, including `config.local.js` — the file
holding the trigger URLs. A returning visitor's browser served the cached copy and kept
calling the URL that had just been revoked. The source could only ask a human to remember to
bump `CACHE`.

Under an architecture where a signed URL can be rotated but never retired, a cache that
outlives the rotation is not a performance detail.

**Closed by** naming the cache after the build id — a digest of the provisioned endpoint set,
so rotating a signature necessarily invalidates it — and making the config network-first with
a cache fallback. A URL is only ever used online, so a stale copy can never be the one that
gets called; an offline visitor keeps the behaviour they had.

### O-07 · The endpoint registry warned against the approved architecture — **closed**

**Severity: medium, as a governance defect.** `core/endpoint-registry.js` reported packaged
URLs as a `endpoint.packaged-signature` warning describing them as a "TEMPORARY posture" and
directing operators to "move to the endpoint broker", citing
`evidence/ENDPOINT_CONTRACT_AUDIT.json`. The broker was built, withdrawn and its branch
retired; the evidence file does not exist. The warning had outlived its own subject and was
flagging the approved architecture as a defect while pointing at a component that does not
exist.

**Closed by** reporting what an operator can act on — which contracts have no resolvable
target, and which resolve to something other than the packaged value. The consequence of the
direct model is stated where it belongs, in each package's provisioning record.

### O-08 · Touch targets fell below the platform's own declared floor — **closed**

**Severity: low.** Finding 20 of the folded frontend review, still live. `--dgo-control-target-min`
is 44px. Three rules undercut it: `.dgo-sidebar__item` to 36px, `.dgo-iconbtn` to 34px,
`.dgo-persona-button` to 40px — all inside narrow and landscape breakpoints, which is to say
on touch devices, which is the one context where the floor is load-bearing rather than
decorative. `.dgo-sidebar__item` was also absent from the target-size rule in
`platform-authority.css`, so the floor for the 29 controls every user presses on every visit
was owned by whatever `app.css` last said.

**Closed by** deleting all three overrides, claiming `.dgo-sidebar__item` in the authority
sheet, and measuring the rendered height at two touch viewports in
`tests/containment.spec.js`. Verified as a negative control: reinstating the 36px rule fails
it.

### O-09 · Three definitions of the endpoint surface — **closed**

**Severity: low, high blast radius.** The endpoint list existed in `setup.mjs` and
`config.example.js`; the pilot subset again in `commission-check.mjs`; the URL rules in
`commission-check.mjs`; the signature scanner in `commission-check.mjs` and again in
`check-secrets.mjs`. Copies of a list that must agree are chances for it to disagree, and
the consequence is not cosmetic: a wired working tree and a delivered package could
provision different endpoint sets while both reported success.

**Closed by** `scripts/lib/endpoint-surface.mjs`, `endpoint-validation.mjs` and
`published-signatures.mjs`. `tests/packaging.test.mjs` asserts the surface against
`config/endpoints.config.js` in both directions, so a key added to the runtime and forgotten
fails the build rather than shipping as a silently unprovisioned endpoint.

### O-10 · One commit of unmerged branch work — **closed**

See §4. The folded frontend-review register was carried onto `main` and the superseded
document removed.

### O-12 · Dependencies — **clean where it counts, one advisory accepted**

**Severity: informational, and the finding is favourable.** Both delivered packages have
**zero runtime dependencies**. No module under `core/`, `modules/`, `shared/` or `config/`
imports a bare specifier; every import is relative. Neither package contains a bundler
output, a vendored library or a CDN reference, which is why each is a static directory you
can serve and nothing else.

Everything in `package.json` is a `devDependency` and none of it ships:

| Package | Used by | Ships? |
|---|---|---|
| `@playwright/test` | the browser suite | no |
| `http-server` | `npm start`, the test server | no |
| `linkinator` | `npm run test:links` | no |
| `puppeteer-core` | tooling | no |

`npm audit` reported three advisories, all transitive under `linkinator`. The high-severity
one (`brace-expansion`, DoS) is resolved by a lockfile bump taken in this audit. **Two
moderate ones remain** — `uuid` reached through `gaxios`, reached through `linkinator` —
and are accepted rather than forced: closing them needs a `linkinator` major bump, the tool
is an informational link crawler that CI already runs `continue-on-error`, and it does not
execute against anything untrusted. Recorded so the acceptance is a decision rather than an
oversight.

`@playwright/test` is declared as `^1.48.0` and resolves to 1.62.0. That is not a
reproducibility problem: `package-lock.json` pins it and CI installs with `npm ci`, so the
browser build is deterministic. Worth stating because the floating range reads like one.

### O-13 · The verifier mis-reported four correct behaviours — **closed**

**Severity: medium, and only findable by running it.** Executing
`npm run verify:endpoints -- --include-writes` against a conforming endpoint implementation
— the first time every route had ever been called and its answer compared with what the
client reads — produced four defects in the verifier itself. Each would have reported a
working flow as broken, which is the same class of error as reading an egress filter's 403
as a live flow, in the other direction.

| Defect | What it did |
|---|---|
| `STATUS`'s designed 404 read as *"no such flow — the trigger URL is stale"* | The uniform denial, which is the control working, reported as a broken endpoint |
| `UPLOAD`'s 403 read as *"the signature is wrong or revoked"* | The ticket check refusing an unticketed deposit — the pass — reported as a failure |
| Contract shape checked at the top level only | Six correctly-shaped responses reported as gaps; the payload is inside the documented envelope's `data` |
| Contract shape checked against refusals | A 400 refusing a thin probe obviously carries no `referenceId`; saying so buried the one case that matters, a 2xx missing what the client reads |

**Closed by** a per-probe `expectStatus` declaration — so an exemption is a decision on the
record and cannot quietly widen — envelope-aware shape checking that records *where* the
contract was satisfied, and scoping the shape check to successful responses. A verifier that
cries wolf gets ignored on the run where it is right.

### O-14 · `AI_CHAT` answered in a shape the client cannot read — **closed**

**Severity: medium.** The same run produced a real integration defect. The endpoint answered
`{ result: { message } }`; `modules/assistant.js:28` reads `res?.reply || res?.message` off
the unwrapped envelope. Both were `undefined`, so every Assistant request rendered its own
fallback — *"No reply was returned by the AI flow"* — against an endpoint that had answered
correctly.

Nothing caught it because nothing had ever called the endpoint and compared the answer with
what the client reads. That is the entire value of the exercise, and it is why the live run
against the tenant in §5 is not optional.

### O-15 · Two flow routes were documented nowhere — **closed**

**Severity: medium.** `core/api.js` has always been able to send `transitionStatus` and
`logAuditEvent` as operations on `DYNAMIC_ACTIONS`. Neither appears in
`docs/deployment/FLOW-BUILD-PLAN.md`, which is the document somebody builds the flows from —
so a flow built exactly to specification would have rejected two operations the client emits,
at a desk, as an unrecognised operation.

Invisible to every other check: the client is correct, the contract is correct, and only the
instructions were incomplete. **Closed by** documenting both with their obligations, and by
making the cross-check mechanical in `tests/packaging.test.mjs` — every provisioned route
must appear in the build plan.

The audit also corrected its own conflation here: `dispatchOutbound` and the rest are
discriminated by `operation` **inside the payload**, not by the wire `action`. A flow
switching only on `action` would never see them, so `scripts/lib/endpoint-surface.mjs` now
states which mechanism reaches each route.

### O-16 · The rotation instruction was unusable — **closed**

**Severity: medium.** *"Rotate 55 signatures in Power Automate"* is true and unusable: it
names a number, not a list. It does not say which flow each belongs to, which endpoint key
reaches it, or which of them are the same credential in eight files. Deriving that by hand
from a 23 MB corpus is how a rotation gets half done.

**Closed by** `npm run rotation`, which derives it — one row per **workflow**, because
rotation is per flow and regenerating one trigger invalidates every copy of its URL at once.
Signatures are fingerprinted, never printed, so the register is safe to paste into a ticket.

**It immediately produced a finding.** The 55 signatures resolve to **39 distinct flows**, so
the work is 39 rotations rather than 55 — and **14 of those flows carry two different live
signatures each.** That is a partial rotation that left the old trigger URL valid alongside
the new one, and it was not previously recorded anywhere. Two further signatures could not be
attributed to a workflow and are reported by fingerprint rather than dropped.

### O-17 · Dead architecture in the delivered documentation — **closed**

**Severity: low.** The atlas generator detected `proxy/src` and drew either topology; the
docs console carried a full proxy request-pipeline diagram, an upload-ticket lifecycle
diagram, and eleven conditional branches describing a tier that was withdrawn rather than
deployed.

Dead branches in a briefing pack are worse than dead code in a module: it is the artefact
people read to learn what the system is, and a diagram of a tier that does not exist is a
confident wrong picture — the exact failure the generated-documentation approach exists to
prevent. **Closed by** removing the detection, both diagrams and every branch, and by
asserting the single topology in both directions — including that a `proxy/` reappearing on
disk now fails the build, because under the current decision that means an intermediary has
been reintroduced.

### O-18 · Nothing blocking checked the documentation's own references — **closed**

**Severity: low.** `npm run test:links` crawls the two applications with a browser-shaped
checker; it needs a server, reaches external hosts, and is `continue-on-error` in CI for good
reason. The consequence was that nothing blocking ever checked `docs/`, which is where the
broken references actually were.

**Closed by** `tests/references.test.mjs`: no server, no network, no dependencies, 902
references across 395 files resolved on disk in under a second, and it fails the build. It
carries a guard on itself — if the matchers stop matching it fails rather than passing by
checking nothing — and its single exclusion is asserted to stay single.

### O-19 · Entra ID was a dependency nothing needed — **removed**

**Severity: medium, as an architectural dependency.** `config/auth.config.js` described an
Entra ID integration: `provider: 'entra-id'`, a `tenantId` and `clientId` supplied at deploy
time, OIDC scopes, a `rolesClaim` and a `roleClaimMap` translating an identity provider's
group claims onto platform roles. `commission-check` refused the enforced posture without the
tenant values, and `AUTHENTICATION_CONTRACT.md` §3 opened by telling you to register an
application and define six app roles.

None of it was ever activated, and all of it sat on the critical path of activation: a
directory registration, a client id to obtain, and an administrator's approval — for a
platform whose entire architecture is otherwise zero-build, zero-dependency and
self-contained, with nothing to stand up between the browser and the flow.

**The replacement already existed.** `core/otp-identity.js` is an identity provider built
entirely from Power Automate flows — `OTP_GENERATE` mails a one-time code, `OTP_VERIFY`
exchanges it for a signed expiring proof — and it already satisfied `core/auth.js`'s
token-provider contract. Identity now has the same shape as everything else here.

Removed from the auth config, the auth core, `setup.mjs`, the packager, the commission gate,
both test suites, the architecture generators and six documents. Activation is now a flag and
two endpoints, and the endpoints arrive in the package with every other URL. What did not
change: the role still comes from the server side and never from the client, and an
unresolved role is still denied rather than defaulted — the escalation regression is still
covered in both directions.

### O-20 · The build gate blocked the only package that could be tested — **corrected**

**Severity: high, and it was my error.** The packager refused to emit a pilot or enforced
package wired to a signature published in this repository, and defaulted to `demo` — a
package that boots, renders and transmits nothing.

The combination made the artefact that can actually be exercised live the one thing the tool
would not build, and the only way past it was to mint a fresh production estate before
anything had been tested. **That is precisely the sequence that gets an estate regenerated
two or three times:** live testing reveals contract adjustments, each adjustment means
regenerating triggers, and every regeneration cycle re-exposes the new set through the same
working files. The gate was optimising a property it could not protect at the cost of the
one thing that reduces total exposure — testing once, on already-disclosed URLs, then
minting production URLs once at the end.

**Corrected.** The default build wires every endpoint the documented estate provides — 17 of
18 on the internal platform, 5 of 6 on the portal — and posture is derived from what got
wired rather than declared by a flag. A disclosed signature is **stamped**, not refused:
recorded in `PACKAGE_MANIFEST.json` and carried as a warning in `DEPLOY.md`, in both cases
saying what it means rather than only that it exists. `npm run commission` reports it in
every posture and blocks in none.

What is still refused is unchanged and still defects: a malformed URL, a package that cannot
resolve its own module graph, and two keys with *different* source flows landing on the same
one.

That last check also had to be corrected. It compared workflow ids alone and refused the real
estate for three "collisions" that are the design — `EMAIL` rides `DYNAMIC_GLOBAL_ACTIONS`,
`STATUS` and `SUPPORT` are routes of one shared flow. The contracts already declared this
through `sourceKey`; the check now reads it.

**The two remaining unwired endpoints are estate gaps, not build gaps.** `SCAN_INTAKE` has no
flow in the corpus and the portal's `UPLOAD` has no ticket-redeeming flow. Both must be
BUILT, not rotated — the commission gate now says so rather than sending someone to
regenerate a trigger that does not exist.

### O-21 · The provisioned URLs were wrong, and the gate could not see it — **corrected**

**Severity: critical, and it was my error.** It was found by the operator, not by me, and
not by any check in this repository: they downloaded the packages, tried to run them, and
found endpoints that could not authenticate and flows that were wired to nothing.

Three distinct defects, all in `scripts/lib/endpoint-recovery.mjs`:

**1 · Signatures were extracted greedily, so malformed ones shipped.** The scanner matched
"`sig=` followed by base64url characters" and took whatever it found. A Power Automate
trigger signature is HMAC-SHA256 in base64url — **exactly 43 characters**. The reference
corpus contains URLs with document prose glued straight onto the query string
(`…sig=<43 chars>getEmailsPOST`) and one lineage artefact carrying a **40-character copy
with characters altered mid-string**. Both were provisioned verbatim. `EMAIL_RELATED_TASK`
went out with a signature that could not authenticate under any circumstances.

**2 · Validation was too loose to catch it.** `endpoint-validation.mjs` refused a signature
shorter than 20 characters. Forty is longer than twenty, so the mangled copy passed the one
check whose whole purpose is catching truncated pastes. The threshold was a guess where an
exact figure was available.

**3 · The mapping was inferred from the wrong document.** Contract keys were matched by
scanning one lineage artefact for `KEY: "https://…"` pairs. That artefact is a single
build's snapshot, and where it disagrees with the operator's own labelled flow lists it is
the one that is wrong. Four keys were misrouted:

| Key | Was wired to | Should be | What settled it |
|---|---|---|---|
| `REFERENCE_DATA` | `d67f2acb` — one line, one document, no corroboration anywhere | `ff455c68` | Defined twice in the specification document, as LOOKUPS and GET REFERENCES, both with schema and response; 22 occurrences across three documents |
| `SINGLE_ASSIGNMENT` | `6b3bad30` | `f71397ff` | Named SINGLE ASSIGN by the specification document, "create task and update activity" by the consolidated list, "Create task" by the numbered flow list |
| `AI_DOC_ANALYSIS` | `20e3b003` — which the specification document's own index calls LOOKUPS | `5b29edc8` | Documented trigger `{ DocId, TaskId }` and response `{ event_name, ai_summary, accept_url }` — exactly the `aiAnalyseEventDocs` contract |
| `EMAIL_RELATED_TASK` | the right flow, the mangled signature | `a942d230`, 43-char | Two documents carry the same 43-character value |

**Corrected.** Extraction now takes exactly 43 characters and **rebuilds** the URL from its
parts, so glued prose, entity residue and reordered query strings cannot survive into a
package. Validation refuses any other length as `non-canonical-signature`, in every posture.
The mapping is an explicit table where **every entry cites the document that establishes
it**, and where documents disagree the entry records which reading was taken and why.
Evidence is weighed in a stated order: a documented schema beats a prose label, the
operator's own lists beat an application artefact, and corroboration breaks ties.

Two negative controls guard it: loosening extraction back to greedy fails
`tests/commissioning.test.mjs`, and reverting any of the four keys to its old id fails the
same suite by name.

### O-22 · Twenty-three available flows were invisible — **corrected**

The documented estate has **39 flows**. The two platforms' 22 contract keys reach **16** of
them. The other 23 — including **GET EMAILS, GET TASKS, BULK OPS GET DOCS** and *"get
correspondence (flat response)"* — are called by nothing, because the platform routes those
reads through `SUBSIDIARY_ACTIONS` and `FETCH_ALL` rather than through dedicated flows.

That is a design decision and not in itself a defect. **The defect was that it was
invisible.** Every document a package carried redacted its signatures, so the complete URLs
existed in exactly one place — `config.local.js`, in the form the browser reads — and a flow
that exists and answers was indistinguishable from a flow that had been overlooked. During
live testing, "this probe answered wrongly, what else could this key point at?" had no
answer short of grepping the reference corpus.

**Corrected.** Every package now carries `FLOW_CATALOGUE.json`: all 39 flows with their
complete URLs, the reference documents that name each one, which contract keys call it, and
the alternates for each wired key. Repointing a key is one line in a values file and a
rebuild. The file is a credential and says so; it adds no exposure beyond what serving the
package already creates, since the same URLs are in the configuration the browser downloads.

Negative controls: filtering the unwired flows out of the catalogue, or redacting its URLs,
each fail `tests/packaging.test.mjs`.

### O-23 · The atlas drift test could not see its own generator break — **corrected**

**Severity: medium, and it was my error, found by sweeping rather than by any check.**

Removing Entra deleted `AuthConfig.scopes`. `scripts/visual-docs-data.mjs` still spread it,
so `npm run visual` died with `TypeError: AuthConfig.scopes is not iterable` — and
`tests/visual-docs.test.mjs` stayed green throughout, because every assertion in it reads the
**committed** `docs/visual/platform-data.js` and compares that with the live configuration.
The committed file kept answering correctly for as long as nothing else changed.

That is the pattern this audit named at the front, occurring inside a control this audit
itself relies on: **a check reporting success over a narrower scope than the one it claims.**
"Nothing has drifted" and "nothing was measured" are different findings and the suite could
not tell them apart.

**Corrected.** The suite now runs the generator as a subprocess and fails if it cannot
produce a dataset, read-only — `--write` would repair the very drift the suite exists to
detect. Negative control: restoring the `scopes` spread fails the new assertion by name.

Seven statements in `docs/visual/app.js` were corrected at the same time, each of which
described a request path or an identity provider this repository no longer ships. They are
listed under the proxy-residue closure in §4.

### O-11 · Stale figures in live prose — **closed**

Six documents and two scripts stated 25 routes; there are 29. Historical audits keep their
original figures — correcting a point-in-time record would falsify it — but prose that
states a current fact was corrected.

---

## 3 · The two platforms, assessed independently

### Platform 1 — the internal operations platform

29 routes, 135 modules, 24 workspaces, 6 roles, 18 endpoint keys carrying 39 flow routes.

| Dimension | State | Evidence |
|---|---|---|
| Boot | Clean, with a 15-second watchdog naming failing URLs | `tests/smoke.spec.js` |
| Routes | 29/29 mount without error | smoke suite |
| Themes | Light, dark and high-contrast all repaint | smoke suite |
| Accessibility | Entry points exposed; touch floor now honoured at every breakpoint | smoke + `containment.spec.js` |
| Governance spine | Action ownership, RBAC, idempotency, audit — 72 assertions, negative-controlled | `governance.test.mjs` |
| Activation manifest | 29/29 routes, health report enumerates all | O-04 |
| Endpoint contracts | 19 contracts over 18 URLs; redaction verified | `governance.test.mjs` |
| Offline behaviour | Queue with receipts; failed writes stay visible and retryable | `hardening.test.mjs` (103) |
| Identity | Server-authoritative when enforced; directory role survives normalisation; an empty directory response does not promote to systemAdmin | `identity-directory.test.mjs` (33) |
| Packaging | 160 files, 1.0 MB, self-contained, manifest-verified | `packaging.test.mjs` |

**Open:** authorisation is advisory until the flows enforce it (G-04). Client identity is a
`userEmail` from `localStorage` in the pilot posture; editing one storage key escalates a
viewer to systemAdmin. That is a property of the posture, correctly documented, and it is
what `enforced` plus flow-side validation exists to change.

### Platform 2 — the document portal

5 pages, 6 endpoint keys, service worker, 8 token files shared with the internal platform.

| Dimension | State | Evidence |
|---|---|---|
| Pages | All 5 load with no same-origin failure | `tests/portal.spec.js` |
| Disclosure | No identifier or email belonging to a record reaches an unauthenticated page | `portal.spec.js`, asserted as a property |
| Denial semantics | One uniform message that does not say which half was wrong, so the register cannot be enumerated | `portal.spec.js` |
| Unreachable registry | Falls back to device data and says so; with no device copy reports *unavailable*, not *not-found* | `portal.spec.js` |
| Taxonomy | Every public correspondence type maps to an internal category | `portal.spec.js`, `categories.test.mjs` (21) |
| Demo mode | With `SUBMISSION` unset nothing is transmitted — the safe failure for a public channel | `packaging.test.mjs` |
| Service worker | Cache keyed to the build; endpoint config never served cache-first | O-06 |
| Packaging | 42 files, 0.7 MB, self-contained, manifest-verified | `packaging.test.mjs` |

**The STATUS proof asymmetry — client half now closed, flow half specified.** `VERIFY` and
`VERIFY_CONFIRM` gated *submission* while `PF.intake.status()` posted `{referenceId, email}`
and no proof at all. The reference-plus-email pair is the whole gate on reading a record
back, and a forwarded receipt is the ordinary way a correct pair reaches someone it does not
belong to.

A client cannot strengthen a gate the flow does not enforce, so this is provisioned the way
authentication is: **complete, dormant, and the flow decides.** A `STATUS` flow answering
`403 verification_required` now triggers the same code round-trip the submission wizard runs
and the page retries with the proof; a flow that does not ask is unaffected and the submitter
is asked for nothing. When a proof is sent the email leaves the request body entirely — the
flow resolves the address from the proof — and the address is kept out of the URL, the
history entry and the `Referer` header, both of which are explicit properties of the contract
in `document-portal/README.md`. Where the flow demands a proof and the deployment cannot send
a code, the page says so rather than starting a round-trip it cannot finish.

Five assertions in `tests/hardening.test.mjs` and three in `tests/portal.spec.js`. **What
remains is the flow half and only the flow half**, and it is now specified rather than
proposed.

---

## 4 · Branches — disposition register

Nine remote branches. **One carried unmerged work; it has been folded in. `main` is now the
single source of truth.**

| Branch | Ahead of `main` | Content | Disposition |
|---|---|---|---|
| `main` | — | — | **Trunk** |
| `platform/no-proxy` | 0 | Fully merged | Retire — `main` is its content |
| `platform/with-proxy` | 20 | The authenticating proxy: `proxy/src`, worker secrets tooling, `setup-endpoints.mjs` | **Retire.** Implements the rejected architecture. Not a superset of `main` — it lacks `setup.mjs`, the commissioning gate and the identity suite. Nothing in it is wanted |
| `claude/platform-commissioning-live-5vnn9n` | 1 | Phantom endpoint key + stale counts | Retire — content verified present in `main` |
| `claude/platform-package-unzip-a0bfbe` | 1 | ZIP path-length fix | Retire — landed as `6cdc2af` |
| `claude/platform-parity-check-xp2028` | 7 | **The folded review register** | **Carried onto `main`** by this audit. Retire |
| `archive/forensic-audit-gen1` | 43 | Gen-1 forensic audit | **Keep as archive.** Narrative recovered into `docs/audits/` |
| `archive/repo-hygiene-audit` | 49 | Hygiene audit | **Keep as archive.** Narrative recovered into `docs/audits/repository-hygiene/` |
| `archive/proxy-harness` | 3 | Local proxy harness | **Keep as archive** or retire with `platform/with-proxy` |

### Executing the retirement — **executed 7 August 2026, four of eight**

The owner performed the deletions. Four branches are gone; four remain. Recorded here as
fact rather than as instructions, because the instructions have now been partly carried out
and a document that still reads like a to-do list is a document nobody can use to tell what
happened.

| Branch | Tip | State | Content verified in `main` |
|---|---|---|---|
| `claude/platform-parity-check-xp2028` | `0fa6a88` | **deleted** | Yes — `docs/audits/FRONTEND_REVIEW_PARITY_VERDICT.md` is on `main` and was never on the branch |
| `claude/platform-commissioning-live-5vnn9n` | `7a84fde` | **deleted** | Yes — the `SCAN_UPLOAD` phantom key is corrected on `main` and a governance assertion guards it |
| `claude/platform-package-unzip-a0bfbe` | `b175775` | **deleted** | Yes — `tests/package-portability.test.mjs` is on `main` |
| `platform/no-proxy` | `8c90967` | **deleted** | Yes — it was 0 ahead |
| `platform/with-proxy` | `3469b2f` | remains | n/a — the rejected architecture, kept nowhere |
| `archive/proxy-harness` | `fe197ff` | remains | n/a |
| `archive/forensic-audit-gen1` | `22033ec` | remains | Narrative recovered into `docs/audits/` |
| `archive/repo-hygiene-audit` | `73d1e0f` | remains | Narrative recovered into `docs/audits/repository-hygiene/` |

**The retirement tags were never applied.** Tagging returns `HTTP 403` from this environment
— the session's git credentials are scoped to the designated working branch, verified on
both the tag write and the ref delete, twice, on separate days. So the four deleted tips
above are preserved by **this table and nothing else**: two of them are still reachable
through the closed pull requests that carried them (`#12` → `0fa6a88`, `#15` → `7a84fde`),
and `b175775` and `8c90967` are reachable only by SHA.

That is acceptable and is stated rather than glossed: every one was verified **by content
diff against `main`, not by commit topology**, before deletion. Nothing unique was lost. But
if the tips are wanted as refs, they must be tagged from a machine with write access, and
GitHub will not keep unreachable objects indefinitely:

```sh
git tag retired/claude-platform-parity-check-xp2028        0fa6a88
git tag retired/claude-platform-commissioning-live-5vnn9n  7a84fde
git tag retired/claude-platform-package-unzip-a0bfbe       b175775
git tag retired/platform-no-proxy                          8c90967
git tag retired/platform-with-proxy                        3469b2f
git push origin --tags
```

The four that remain can be deleted at the owner's discretion. `platform/with-proxy` should
be tagged first — it holds 20 commits of an implementation withdrawn by decision rather than
abandoned, and deleting it untagged is the one irreversible step here. The three `archive/*`
branches carry no content `main` lacks; their narrative was recovered into `docs/audits/`.

### The proxy variant residue — **closed 7 August 2026**

Previously left open as the owner's decision, on the grounds that the generator's
dual-variant handling was "deliberate, tested and harmless". Two of those three were true.

`scripts/visual-docs-data.mjs` and `tests/visual-docs.test.mjs` already assert the absence of
a proxy tier correctly, and that stays. What was not harmless was the **prose**: seven
statements in `docs/visual/app.js` described a request path this repository does not ship —
configuration "readable by the proxy", a 404 on `config.local.js` because "endpoints may come
from the proxy instead", a KPI counting proxy test suites that is structurally always zero,
and an auth paragraph naming an Entra tenant, a client id and a proxy base URL after all
three had been removed. Each is now either corrected to what is in force or, where it
explains why there is no proxy, kept deliberately. The one comparison table that contrasts
"with a proxy" against "here" is retained: it is the record of a decision, not a description
of the tree.

---

## 5 · Readiness for live operationalization

### Cleared

- Both platforms build, boot and pass their gate: **680 Node assertions across 25 suites, 100
  browser assertions**, green.
- Both package as self-contained, manifest-verified artefacts with their endpoints
  provisioned in.
- All 39 flow routes are exercisable live by `npm run verify:endpoints`.
- The build refuses a package that is not fit to deploy, and says which endpoint and why.
- No intermediary exists anywhere in either request path, and each package declares that in
  its manifest rather than leaving a reviewer to infer it.

### Blocking — neither is closable in this repository

| # | Blocker | Owner |
|---|---|---|
| **1** | **Rotate all 55 published signatures.** They are committed here; anyone with repository access holds them. Deleting a file revokes nothing. `npm run package` refuses to build a pilot or enforced package wired to any of them, so this cannot be forgotten — it can only be done. | Power Automate |
| **2** | **Make each flow enforce its own callers** — token validation, role derivation, per-action authorisation, rate limiting, reference minting, upload ticketing, filename policy. Called directly, the flow is the only place any of it can happen. Until then every control in this repository is advisory. `docs/architecture/AUTHENTICATION_CONTRACT.md` §2, sequenced in `FLOW-BUILD-PLAN.md`. | Power Automate |

### Required before the phase can be called complete

| # | Step | Why |
|---|---|---|
| 3 | `npm run verify:endpoints -- --include-writes` against the live estate | The only step that turns "the configuration looks right" into a transcript. Exercises all 39 routes including the four O-03 restored |
| 4 | Register the Entra application, six app roles | Prerequisite for `enforced` |
| 5 | Set `DGO_AUTH_ENABLED=true`, rebuild, verify both packages, deploy | The client half becomes a configuration event, not a development one. No tenant to register — Entra is removed |
| 6 | Run the browser suite against the deployed hostname | Deployment is where endpoint-config presence differs from local |
| 7 | Decide the `STATUS` flow's proof obligation | §3, platform 2 |
| 8 | Approve the Part H routing table; clear test records before real correspondence | `npm run commission` reports both; neither is a script's to settle |

### The sequencing point

Production endpoint URLs are not to be minted until this phase's outputs are accepted. That
ordering is now enforceable rather than procedural: `npm run package`
refuses every URL that is malformed, duplicated across flows, or already published here. When
the production estate is built, the packages are rebuilt against it and the build id changes
— which is how a deployment can be told apart from the one it replaced, and what makes the
portal's cache invalidate.

---

## 6 · What this audit could not do

Everything reachable from this environment has been closed. What follows is the complete
list of what could not be, and why — each is a physical limit of the environment or an
authority that is not this repository's, not a deferral.

| # | Not done | Why it cannot be done here |
|---|---|---|
| 1 | **Rotate the 39 flows** | Requires authenticated access to the Power Automate tenant. `npm run rotation` produces the exact worklist; `npm run package` refuses to build against any signature still published |
| 2 | **Build the server half of G-04** | Seven obligations that live inside Power Automate flows. No file in this repository can implement them and no check in it can verify them |
| 3 | **Call a live flow** | No endpoint in this environment is reachable. Every probe failed at the network, and the verifier correctly reported that it had verified the network rather than the configuration. The full 39-route transcript in `docs/deployment/verification/` was produced against the local conforming implementation and is labelled as such |
| 4 | **Register the Entra application** | Tenant administration |
| 5 | **Approve the Part H routing table** | A governance decision, not a technical one. `npm run commission` reports it as unsigned |
| 6 | **Clear test records before real correspondence** | Acts on a live SharePoint list |
| 7 | **Delete the five retired branches, or push their tags** | The session's git credentials are scoped to the designated working branch. Both return `HTTP 403` — verified, not assumed. The tags exist locally and §4 gives the commands and the commit each preserves |
| 8 | **Merge to `main`** | The pull request is open; landing it is a review decision |

Two further bounds on scope, stated because an audit that does not bound itself cannot be
relied on:

- **The reference corpus was not audited for accuracy** — 23 MB of harvested flow
  definitions, list exports and response samples, classified as untrusted harvest by
  `docs/README.md`. What was audited is what it *exposes*: 55 signatures across 28 files,
  resolved to 39 flows, reported on every run.
- **Closed historical findings were not re-opened.** `docs/audits/INDEX.md` holds the
  supersession chain; point-in-time records keep their original figures, because correcting
  a record of what was true on a date falsifies it.

## 7 · Corrections to the existing record

Recorded because they change conclusions.

1. **G-03 was understated.** `docs/STATUS_REPORT.md` recorded "4 signatures in 2 files". The
   whole-repository figure is **55 across 28 files**. The smaller number counted the
   application tree only, which is the ratchet's scope and not rotation's.
2. **The route count was 25 in six places and is 29.** Corrected where stated as current
   fact; left alone in historical records and where "25 routes" is used illustratively.
3. **Finding 20's scope was slightly overstated** in the source assessment: the 36px override
   sat inside a landscape media query, so it did not apply at every viewport. It applied on
   touch devices, which is worse rather than better, and the finding stands.
4. **`endpoint.packaged-signature` was not a warning about a risk.** It was a warning about
   the approved architecture, left behind by a component that was withdrawn. Removing it is a
   correction, not a relaxation.
5. **The first packages this audit produced carried wrong endpoint URLs.** Four contract keys
   were routed to the wrong flow and one signature was mangled; the packages were reported as
   provisioned and runnable, and they were neither. The operator found it while trying to run
   them. See O-21. The lesson recorded here is narrower than the fix: **a validator built on
   a guessed threshold — "longer than 20 is probably fine" — checks nothing when the exact
   figure was available and unused.**
6. **A green drift test is not evidence its generator runs.** `npm run visual` was broken
   for the whole of the Entra-removal work and `npm run test:visual` never noticed, because
   it read the last dataset the generator had successfully written. See O-23.
7. **"17 of 18 endpoints provisioned" was true and misleading.** It counted contract keys
   against contract keys. Measured against the estate, 16 of 39 available flows were reached
   and 23 were called by nothing, which is the figure an operator preparing to test live
   actually needs. See O-22.
