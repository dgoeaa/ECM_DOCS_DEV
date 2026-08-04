# DGO Digital Operations — Status Report

**As at** 2 August 2026 · **Repository** `dgoeaa/ECM_DOCS_DEV` (**private**) · **main** `aa94f2a`
**Interactive view:** architecture and status console — current vs target state, filterable finding register

---

> **Amendment, 4 August 2026.** The authenticating proxy this report treats as the server half of
> G-04 has been **removed**, not deployed. Both clients now call each Power Automate flow directly,
> with the signed trigger URL configured into them at deploy time. The rows below that read
> "implemented in `proxy/`" describe code that no longer exists, and every obligation it discharged —
> token validation, role derivation, per-action authorisation, rate limiting, reference minting,
> upload ticketing, the filename policy — now belongs to the flow itself. **G-04's server half is
> therefore not implemented anywhere in this repository, and cannot be: it lives in Power Automate.**
> See `AUTHENTICATION_CONTRACT.md` §2 and `document-portal/README.md`.

---

## 1. Position

**The platform is healthy and in development. Nothing is broken. Two things are unfinished, and both are security enforcement rather than function.**

Two weeks ago the flagship runtime **could not start at all** — and did so silently, holding a boot spinner indefinitely with no error. That is fixed, along with everything else the audits surfaced. The repository now carries a quality gate that would have caught the original failure in one second, and it is private.

| | Then | Now |
|---|---|---|
| Runtime | **Could not boot** | Boots; 25/25 routes render clean |
| Dark / high-contrast themes | Content invisible | Correct in all three themes |
| Test suite | **Did not exist** | 4 suites, CI on every push |
| CI | **Did not exist** | Green on every run |
| Tracked files / size | 400 · 51 MB | 266 · 19 MB |
| Broken references | 1 | **0** |
| Authentication | Absent, undocumented | Provisioned on both apps; server enforcement is the flows' obligation, and unverified |
| ECM Portal identity | Hardcoded, role switchable in-browser | Closed — F-001 … F-005 |
| Repository visibility | **Public** | **Private** |

**Findings: 15 raised · 12 closed · 3 partial · 0 open.**

---

## 2. Verification

Every claim below is reproducible from `main`.

```
npm test
  imports      168 modules reachable · 0 broken edges        ✅
  secrets      2 baselined files · no new signatures         ✅
  governance   63/63 ownership, RBAC, idempotency, audit     ✅
  auth         38/38 across both postures, both apps         ✅
  smoke        6/6 boot, a11y, 25 routes, themes, portal     ✅
CI          green on all runs
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
| **G-09** | README/CONTRIBUTING described a different repository | Rewritten against verified facts; `AUDIT.md` given a correction note rather than rewritten |
| **R-01** | Personal data of ~785 individuals exposed in a public repository | Repository private; loose reference copies removed |
| **R-04/05** | Portal fork drift; 40 MB redundant archives; no licence; 54 fragile filenames | Consolidated; 400→266 files; `LICENSE` added |

### Partial — 3

| ID | Finding | Done | Outstanding |
|---|---|---|---|
| **G-03** | 22 SAS signatures in tracked files | Reduced to 4 signatures in 2 files; ratchet blocks new ones | **Rotate all 22 in Power Automate.** Deleting files revoked nothing |
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
| 22 pilot signatures unrotated | **Low** | Pilot-only endpoints, repository private. Rotate at convenience. |
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
| 4 | **Rotate 22 pilot signatures** | Power Automate |
| 5 | **Register Entra ID application** — six app roles | Tenant administration |
| 6 | **Make each flow enforce its own callers** — token validation, role derivation, per-action authorisation, rate limiting, reference minting, upload ticketing, filename policy | Power Automate |
| 7 | **Activate** — set `auth.enabled`, supply tenant config, verify | Configuration |

Steps 1–3 are complete. Steps 4–6 need decisions and work outside this repository. Step 6 no longer has code waiting for a host: removing the proxy moved that work into Power Automate, where it has not been done. **Step 7 is a configuration event, not a development one** — that was the point of provisioning authentication dormant.

---

## 7. Assessment

The engineering substance is real: action ownership that throws rather than warns, idempotency keys correctly constructed, an offline queue with receipts, OTP bound to a payload digest, and an endpoint registry that redacts its own credentials before logging and reports on its own weakest posture. **These are the right primitives, competently built.**

Their single weakness is that every one is enforced in the browser. The RBAC model was never the problem — **its input was**. That is now provisioned to change with one flag, and the change is guarded by tests that fail if the old path returns.

**The repair phase is complete. What remains is enforcement, and enforcement now needs work in the flows rather than more code in this repository.**
