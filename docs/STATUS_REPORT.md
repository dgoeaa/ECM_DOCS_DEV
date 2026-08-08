# DGO Digital Operations — Status Report

> **Superseded on current state by
> [`audits/OPERATIONAL_READINESS_AUDIT.md`](./audits/OPERATIONAL_READINESS_AUDIT.md)**
> (6 August 2026), which audited both platforms and every branch end to end. Read that for
> where things stand; this remains the narrative of how the repair phase went. Two figures
> below were corrected by it and are marked inline.

**As at** 6 August 2026 · **Repository** `dgoeaa/ECM_DOCS_DEV` (**private**)
**Interactive view:** [`visual/`](./visual/README.md) — architecture and status console, generated
from the source tree and drift-tested by `npm run test:visual`. Where this document and the
console disagree, the console is right: it is regenerated, this is written.

> **This report is written, not generated.** It states a position at a date. It deliberately no
> longer cites a commit sha — the two it previously named (`aa94f2a`, and the proxy-removal commit
> in its amendment) have both been superseded, and a stale sha in a status header is worse than
> none. For the current state of anything mechanical — routes, endpoints, module graph, test gate —
> run `npm run commission`, which reports it rather than asserting it.

---

## 0. What changed since the last revision

Three things, each of which invalidated part of the text below and has been folded into it:

1. **The authenticating proxy was removed, not deployed.** Both clients now call each Power
   Automate flow directly, with the signed trigger URL configured into them at deploy time. Every
   obligation the proxy discharged — token validation, role derivation, per-action authorisation,
   rate limiting, reference minting, upload ticketing, the filename policy — now belongs to the
   flow itself. **G-04's server half is therefore not implemented anywhere in this repository, and
   cannot be: it lives in Power Automate.** See
   [`architecture/AUTHENTICATION_CONTRACT.md`](./architecture/AUTHENTICATION_CONTRACT.md) §2,
   [`deployment/FLOW-BUILD-PLAN.md`](./deployment/FLOW-BUILD-PLAN.md), and
   `document-portal/README.md`.

2. **A public-disclosure defect in `document-portal/` was found and fixed.** The unauthenticated
   landing page listed the register — every tracking ID, each deep-linking to the record behind it
   — and the tracking page offered "sample record" chips carrying another submitter's email
   address into the ID+email gate that page exists to enforce. Both are closed, and
   `tests/portal.spec.js` now asserts the property rather than the wording: no identifier
   belonging to a record the visitor did not submit may reach an unauthenticated page.

3. **The reference corpus was trimmed and the audit record moved out of the root.** Recorded flow
   executions were deleted and the flow contracts kept, per
   [`cutover/ARCHIVE_DISPOSITION.md`](./cutover/ARCHIVE_DISPOSITION.md). No workflow id lost its
   signed trigger URL, so **G-03 is unchanged in substance** — the exposure is smaller in file
   count and identical in effect, because deleting a file revokes nothing. The eight audit
   documents now live in [`audits/`](./audits/INDEX.md) with a supersession chain.

---

## 1. Position

**The platform is healthy and in development. Nothing is broken. Two things are unfinished, and both are security enforcement rather than function.**

Two weeks ago the flagship runtime **could not start at all** — and did so silently, holding a boot spinner indefinitely with no error. That is fixed, along with everything else the audits surfaced. The repository now carries a quality gate that would have caught the original failure in one second, and it is private.

| | Then | Now |
|---|---|---|
| Runtime | **Could not boot** | Boots; 29/29 routes render clean |
| Dark / high-contrast themes | Content invisible | Correct in all three themes |
| Test suite | **Did not exist** | 25 suites in one gate, CI on every push |
| CI | **Did not exist** | Green on every run |
| Tracked files / size | 400 · 51 MB | 656 · 29 MB |
| Broken references | 1 | **0** |
| Authentication | Absent, undocumented | Provisioned on both apps; server enforcement is the flows' obligation, and unverified |
| ECM Portal identity | Hardcoded, role switchable in-browser | Closed — F-001 … F-005 |
| Repository visibility | **Public** | **Private** |

**Findings: 15 raised · 12 closed · 3 partial · 0 open.**

---

## 2. Verification

Reproducible from `main`, re-measured 6 August 2026 by the operational-readiness audit. The
figures this block carried before that — 168 modules, 2 baselined files, 63 governance
assertions, a 6-test smoke suite — were each true when written and none was regenerated
since. That is the failure mode this block exists to avoid, so it is now stated with the
command that produces each number rather than the number alone.

```
npm test                                                    25 suites · 680 assertions
  imports      135 modules reachable · 1 849 edges · 0 broken      ✅
  secrets      0 in the application tree; 55 across 28 files
               under docs/reference/foundational/ reported, not
               scanned — see O-05                                  ⚠️
  governance   72/72 ownership, RBAC, idempotency, audit,
               provisioning parity                                 ✅
  packaging    60/60 provisioning, validation, manifest integrity  ✅
  auth         38/38 across both postures, both apps               ✅
  smoke       100 browser assertions · boot, a11y, 29 routes,
               themes, portal, containment, touch floor            ✅
CI          green on all runs · 4 jobs
```

---

## 3. Finding register

### Closed — 9

| ID | Finding | Resolution |
|---|---|---|
| **G-01** | Runtime could not boot — 13 config modules never committed (0 commits each, all history) | Restored byte-identical from the archive; 167 modules, 0 broken edges |
| **G-02** | Boot failure silent — static import resolution precedes `boot()`'s own `try/catch`, so nothing threw or logged | 15-second watchdog in `index.html` naming failing URLs |
| **G-05** | Dark theme rendered content white-on-white | Stale `data-theme` mirrors on `<body>`/`<dgo-shell>` removed |
| **G-06** | High-contrast theme visually inert | Same fix; hc now reaches pure black |
| **G-07** | Two welcome layers; `?skipWelcome=1` ignored by one | Both honour the same predicate |
| **G-08** | No test suite, no CI, no `.gitignore` — 6 of 8 npm scripts referenced an absent runner | Import checker, smoke suite, secret ratchet, CI, `.gitignore` |
| **G-09** | README/CONTRIBUTING described a different repository | Rewritten against verified facts; `docs/audits/AUDIT.md` given a correction note rather than rewritten |
| **R-01** | Personal data of ~785 individuals exposed in a public repository | Repository private; loose reference copies removed |
| **R-04/05** | Portal fork drift; 40 MB redundant archives; no licence; 54 fragile filenames | Consolidated; 400→266 files; `LICENSE` added |

### Partial — 3

| ID | Finding | Done | Outstanding |
|---|---|---|---|
| **G-03** | 22 SAS signatures in tracked files | Ratchet blocks new ones in the application tree | **Rotate them in Power Automate.** Deleting files revoked nothing. **Corrected 6 Aug:** "reduced to 4 signatures in 2 files" counted the application tree only, which is the ratchet's scope and not rotation's. The whole-repository figure is **55 distinct signatures across 28 files**, all under `docs/reference/foundational/`. See O-05 |
| **G-04** | No authentication; privilege escalation demonstrated | Client half complete on both apps | **The whole server half.** The proxy that implemented it has been removed; each flow must now validate the token, derive the role and authorise the action itself |
| **G-08** | Quality gate | Imports, secrets, governance, auth, smoke — 5 suites | **No rendered-appearance coverage**; the `overrides` cascade debt stays unmeasured |

### Open — 0

The three ECM Activity Hub Portal findings open since the first audit are closed, along with two Medium ones in the same files:

| ID | Finding | Resolution |
|---|---|---|
| **F-001** | Production identity hardcoded in client state | Neutral development placeholder; ignored entirely once enforced |
| **F-002** | In-browser role switch | Refused when enforced |
| **F-003** | Request envelope trusts browser claims | `user`/`role` dropped; Bearer attached |
| **F-004** | Privileged navigation rendered unconditionally | Filtered by `canOpen()`; empty sections omitted |
| **F-005** | Router had no authorization predicate | `ROUTE_ROLES` + explicit denial page |

---

## 4. Risk

| Risk | Severity | Standing |
|---|---|---|
| No server-side enforcement **running** | **High** | No implementation exists. Every control stays advisory until each flow enforces its own callers. |
| 55 published signatures unrotated | **Medium** | Repository private, so the exposure is bounded by repository access — but every one is disclosed to everyone who has it, and rotation is the only revocation. `npm run package` refuses a pilot or enforced package wired to any of them. Rotate before minting production endpoints, not at convenience. |
| Governance spine untested | — | **Closed.** 63 assertions, verified by negative control. |
| ECM Portal identity client-controlled | — | **Closed.** F-001 … F-005. |
| `overrides` cascade debt unmeasured | **Low** | Documented in `styles/index.css`. |

**Materially reduced this period:** the repository is private, so the personal-data exposure and public credential readability are closed. The signatures still warrant rotation, but the urgency is gone.

---

## 5. Delivered this period

| Landed | Change |
|---|---|
| **PR #1** `ff6122c` | Runtime repair (13 configs), theming fix, boot watchdog, welcome params, quality gate, CI, structural remediation |
| **PR #2** `84318cc` | Dormant authentication: config, service, request wiring, server-authoritative identity, contract, Diagnostics panel, 25 assertions |
| **PR #3** `aa94f2a` | ECM Portal auth parity (F-001 … F-005), governance spine coverage (63 assertions), accessibility verified |
| *withdrawn* | Authenticating proxy — built (66 assertions), then removed rather than deployed. The obligation moved to the flows; see the amendment above |

**Three audits produced:** runtime capability assessment (G-nn), repository security and data audit (R-nn), forensic structural audit with a four-tier disposition register.

### Corrections recorded

Stated because they changed conclusions, and because an audit that hides its own errors is worth less:

1. **SAS count was wrong** — 22 across 16 files, not 24 across 17. A grep character class written `[A-Za-z0-9_\-]` treats the backslash as a literal member inside POSIX brackets, producing spurious variants from escaped JSON.
2. **The theming defect was misdiagnosed** as CSS cascade debt. The cause was stale attribute mirrors — simpler, and completely different.
3. **`nitda-lockup.png` was wrongly called a dead asset** and briefly deleted. It is referenced by four files; the orphan analysis had traversed only from `index.html`. Restored, and every portal asset re-audited.
4. **The first auth test reported ten false failures** — both postures ran in one process and module caching leaked the first config into the second.
5. **Playwright was silently truncating the smoke suite** — its default `testMatch` globs `*.test.*`, so it imported the auth suite and ran its `process.exit()` while still reporting success.

---

## 6. Next

Ordered so each step de-risks the next.

| # | Step | Owner |
|---|---|---|
| 1 | ~~ECM Portal auth parity~~ — **done**, PR #3 | — |
| 2 | ~~Governance spine coverage~~ — **done**, 63 assertions | — |
| 3 | ~~Accessibility~~ — **verified clean**, no change required | — |
| 4 | **Rotate all 55 published signatures** | Power Automate |
| 5 | ~~Register an identity-provider application~~ — **removed.** No external identity provider is a dependency; identity is the OTP flow pair | — |
| 6 | **Make each flow enforce its own callers** — token validation, role derivation, per-action authorisation, rate limiting, reference minting, upload ticketing, filename policy | Power Automate |
| 7 | **Activate** — set `auth.enabled`, supply tenant config, verify | Configuration |

Steps 1–3 are complete. Steps 4–6 need decisions and work outside this repository. Step 6 no longer has code waiting for a host: removing the proxy moved that work into Power Automate, where it has not been done. **Step 7 is a configuration event, not a development one** — that was the point of provisioning authentication dormant.

---

## 7. Assessment

The engineering substance is real: action ownership that throws rather than warns, idempotency keys correctly constructed, an offline queue with receipts, OTP bound to a payload digest, and an endpoint registry that redacts its own credentials before logging and reports on its own weakest posture. **These are the right primitives, competently built.**

Their single weakness is that every one is enforced in the browser. The RBAC model was never the problem — **its input was**. That is now provisioned to change with one flag, and the change is guarded by tests that fail if the old path returns.

**The repair phase is complete. What remains is enforcement, and enforcement now needs work in the flows rather than more code in this repository.**
