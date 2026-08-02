# DGO Digital Operations — Status Report

**As at** 2 August 2026 · **Repository** `dgoeaa/ECM_DOCS_DEV` (**private**) · **main** `c8b917a`
**Interactive view:** architecture and status console — current vs target state, filterable finding register

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
| Authentication | Absent, undocumented | Provisioned, inert, contracted, tested |
| Repository visibility | **Public** | **Private** |

**Findings: 15 raised · 9 closed · 3 partial · 3 open.**

---

## 2. Verification

Every claim below is reproducible from `main`.

```
npm test
  imports   167 modules reachable · 0 broken edges           ✅
  secrets   2 baselined files · no new signatures            ✅
  auth      inert 11/11 · enforced 14/14                     ✅
  smoke     6/6 (boot, a11y, 25 routes, themes, portal)      ✅
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
| **G-04** | No authentication; privilege escalation demonstrated | Client half complete on both apps; **server half implemented and tested in `proxy/`** (66 assertions) | **Deployment** — stand up the proxy, register the Entra app, point the clients at it |
| **G-08** | Quality gate | Imports, secrets, auth, smoke | **Governance spine has no tests**; no rendered-appearance coverage |

### Open — 3

All three are the same defect class in the **ECM Activity Hub Portal**, documented since the first audit and verified still present:

| ID | Finding | Location |
|---|---|---|
| **F-001** | Production identity hardcoded in client state | `js/core/store.js:5` — `dgceo@nitda.gov.ng`, role `DGCEO` |
| **F-002** | In-browser role switch | `js/controllers/actions.js:38-42` — flips `DGCEO` ⇄ `COS` |
| **F-003** | Request envelope trusts browser claims | `js/api/client.js:5-10` — `user` and `role` from `Store.auth` |

**This is the most defensible thing to fix next.** The runtime is protected; its sibling app in the same repository is not, and the pattern to apply is already built and proven.

---

## 4. Risk

| Risk | Severity | Standing |
|---|---|---|
| No server-side enforcement anywhere | **High** | Open. Every governance control is advisory until the proxy exists. |
| ECM Portal identity fully client-controlled | **High** | Open. `F-001`/`F-002`/`F-003`. |
| 22 pilot signatures unrotated | **Low** | Pilot-only endpoints, repository private. Rotate at convenience. |
| Governance spine untested | **Medium** | A refactor could gut it and CI would stay green. |
| `overrides` cascade debt unmeasured | **Low** | Documented in `styles/index.css`. |

**Materially reduced this period:** the repository is private, so the personal-data exposure and public credential readability are closed. The signatures still warrant rotation, but the urgency is gone.

---

## 5. Delivered this period

| Landed | Change |
|---|---|
| **PR #1** `ff6122c` | Runtime repair (13 configs), theming fix, boot watchdog, welcome params, quality gate, CI, structural remediation |
| **PR #2** `84318cc` | Dormant authentication: config, service, request wiring, server-authoritative identity, contract, Diagnostics panel, 25 assertions |

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
| 1 | **ECM Portal auth parity** — closes `F-001`/`F-002`/`F-003` | In-repository |
| 2 | **Governance spine test coverage** — protect the main asset | In-repository |
| 3 | **Accessibility completion** — duplicate `<h1>`, contrast pass | In-repository |
| 4 | **Rotate 22 pilot signatures** | Power Automate |
| 5 | **Register Entra ID application** — six app roles | Tenant administration |
| 6 | **Deploy the authenticating proxy** — implementation ready in `proxy/`, needs a host and the signed URLs moved into its environment | Infrastructure |
| 7 | **Activate** — set `auth.enabled`, supply tenant config, verify | Configuration |

Steps 1–3 are executable now. Steps 4–6 need decisions outside the repository. **Step 7 is a configuration event, not a development one** — that was the point of provisioning authentication dormant.

---

## 7. Assessment

The engineering substance is real: action ownership that throws rather than warns, idempotency keys correctly constructed, an offline queue with receipts, OTP bound to a payload digest, and an endpoint registry that redacts its own credentials before logging and reports on its own weakest posture. **These are the right primitives, competently built.**

Their single weakness is that every one is enforced in the browser. The RBAC model was never the problem — **its input was**. That is now provisioned to change with one flag, and the change is guarded by tests that fail if the old path returns.

**The repair phase is complete. What remains is enforcement, and enforcement needs infrastructure rather than more code in this repository.**
