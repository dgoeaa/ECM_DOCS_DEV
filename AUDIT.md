# AUDIT.md

> ## ⚠️ Correction — 2026-08-01
>
> Two claims in this record are **not correct for this repository**. The findings themselves are left unedited below, as an audit record should be; these are the corrections.
>
> **1. F-007 and the secrets note are wrong about scope.** This document states no hardcoded `sig=` SAS token was found in shipped code, and the superseding note above says the signatures survive only in git history. In `dgoeaa/ECM_DOCS_DEV` at HEAD there are **22 distinct live SAS signatures across 16 tracked files in the working tree**, several of them in client-delivered JavaScript (`document-portal/js/data.js`, `document-portal_Central_NITDA_/js/data.js`, `newack/unified-hub-ackflow.html`, `newack/config.js`, and the Bespoke reference portal). Those files are served to browsers, so the credentials are readable via View Source wherever those portals are hosted.
>
> F-007's original scope was `ECM_ActivityHub_Portal/**`, and within that scope it stands. The audit simply never covered the rest of this repository. `npm run test:secrets` now enumerates the affected files and fails on any new one.
>
> **2. F-001/F-002/F-003 are scoped too narrowly.** The client-trust failure is recorded against the ECM Activity Hub Portal only. **The DGO R11.6 root runtime has the same defect, and a hardcoded `systemAdmin` besides.** It has no authentication, sends no `Authorization` header, and passes caller identity as a plain `userEmail` field taken from `localStorage`. Escalation from `viewer` to `systemAdmin` by editing one storage key was demonstrated empirically.
>
> Full analysis, method and evidence: [`CAPABILITY_ASSESSMENT_R11.6.md`](CAPABILITY_ASSESSMENT_R11.6.md) (G-03 and G-04).

> **Superseded in part by [`ECM_ActivityHub_Portal/REVIEW.md`](ECM_ActivityHub_Portal/REVIEW.md)** (full multidimensional review at commit `77cb6af`). Every finding below was independently re-verified there (§6). Summary of changes:
>
> - **F-001/F-002/F-003 upheld and strengthened** — the client-trust failure was reproduced as a live exploit, not just inferred.
> - **F-004/F-005/F-006/F-008 upheld.** F-008's self-refutation was additionally confirmed dynamically across all 15 data-bearing routes.
> - **F-007 upheld for its stated scope but materially incomplete** — no `sig=` token exists in `ECM_ActivityHub_Portal/**`, but `config/endpoints.config.js` at the repository root committed 17 live Power Automate SAS signatures in client-delivered JavaScript. *(Since remediated in source: that file now reads `window.DGO_CONFIG.endpoints`. Rotation of the signatures, which persist in git history, is still outstanding.)*
> - **"Manifest blind-spot root cause" section refuted** — the dotfile/`.env` exclusion logic it cites does not exist in the committed `precision_auditor_v3.py`, and the proposed patch would not apply. The 3-file manifest gap is caused by the auditor deliberately excluding its own run folder (`precision_auditor_v3.py:58`) and is benign.
> - **The open zip-history risk is closed** — the historical `ECM_ActivityHub_Portal.zip` blob was extracted and swept; it contains no credentials.

## Executive summary

This review found a **critical trust-boundary failure**: the application sends user identity and role from browser memory to the backend, while also allowing in-browser role switching. In practical terms, a user can alter role claims in DevTools and submit privileged actions unless the Power Automate/API layer independently enforces authorization.

The integrity check of `activityhubp_state.json` succeeded (no hash/size mismatches), but the manifest is incomplete relative to the extracted archive. Three archive files are absent from the manifest, and the auditor code explicitly excludes dotfiles and `.env`, creating blind spots for security-relevant artifacts.

No hardcoded `sig=` Power Automate SAS token or obvious API secret was found in the extracted tree. However, this does **not** reduce the criticality of the client-trust issue.

> Note: removing `ECM_ActivityHub_Portal.zip` from the current tip does **not** remove it from Git history. If a secret is later discovered in that archive, history rewrite + token rotation is required.

## Integrity results

### Rehydration verification (`python rehydrate.py`)

| Metric | Result |
|---|---:|
| Total files in manifest | 53 |
| SHA256 mismatches | 0 |
| Size mismatches | 0 |

### Zip vs manifest gap analysis

- Files present in extracted zip tree (`ECM_ActivityHub_Portal/**`): **56**
- Files present in manifest (`activityhubp_state.json`): **53**

Files present in zip but absent from manifest:

1. `aud_activityhubp_20260728_151904/activityhubp_rpt.html`
2. `aud_activityhubp_20260728_151904/activityhubp_state.json`
3. `aud_activityhubp_20260728_151904/activityhubp_sum.json`

Files present in manifest but absent from zip:

- None.

### Manifest blind-spot root cause in `precision_auditor_v3.py`

- Dotfile exclusion is explicit: `if any(p in self.ignore or p.startswith('.') for p in path.parts): continue` (`ECM_ActivityHub_Portal/precision_auditor_v3.py:57`)
- `.env` is explicitly ignored (`ECM_ActivityHub_Portal/precision_auditor_v3.py:45`)
- Tree builder also suppresses hidden paths (`ECM_ActivityHub_Portal/precision_auditor_v3.py:140`)

This is a systematic omission pattern for hidden files/directories.

Proposed patch (not applied):

```diff
--- a/precision_auditor_v3.py
+++ b/precision_auditor_v3.py
@@
-        self.ignore = {".git", ".env", "node_modules", "__pycache__", ".DS_Store"}
+        self.ignore = {".git", "node_modules", "__pycache__", ".DS_Store"}
@@
-            if any(p in self.ignore or p.startswith('.') for p in path.parts): continue
+            if any(p in self.ignore for p in path.parts):
+                continue
@@
-        paths = sorted([p for p in root.iterdir() if not any(i in p.parts for i in self.ignore) and not p.name.startswith('.')],
+        paths = sorted([p for p in root.iterdir() if not any(i in p.parts for i in self.ignore)],
```

## Findings table

| ID | Title | Severity | File | Line | Description | Recommended fix |
|---|---|---|---|---:|---|---|
| F-001 | Client-side asserted identity/role used for backend action envelope | Critical | `ECM_ActivityHub_Portal/htdocs/js/core/store.js` | 5-6 | Production identity (`dgceo@nitda.gov.ng`, role `DGCEO`) is hardcoded in client state. | Do not trust browser role/email claims. Require server-issued identity (OIDC/JWT/session) and derive role server-side. |
| F-002 | In-browser role switching alters effective claim sent to backend | Critical | `ECM_ActivityHub_Portal/htdocs/js/controllers/actions.js` | 39-42 | A UI action flips role between `DGCEO` and `COS`; this is mutable client state, not authenticated identity. | Remove role-switch in production; enforce role changes only through authenticated backend policy. |
| F-003 | Backend call envelope trusts mutable browser claims | Critical | `ECM_ActivityHub_Portal/htdocs/js/api/client.js` | 5-10 | Every API call includes `user`/`role` taken directly from `Store.auth.user`; attacker can modify via DevTools. | Ignore these fields for authorization. Backend should read caller identity from trusted auth context and authorize action server-side. |
| F-004 | Admin/privileged navigation visible without route guard | Medium | `ECM_ActivityHub_Portal/htdocs/js/views/sidebar.js` | 28-31 | Admin routes are always rendered; no role-based visibility check before routing. | Add route guard policy in router and backend authorization checks for all privileged actions. |
| F-005 | Route engine has no authorization gate | Medium | `ECM_ActivityHub_Portal/htdocs/js/core/router.js` | 22-26 | Router sets route and renders without any authz predicate. | Add route guard middleware (client UX only) and enforce real authorization in backend handlers. |
| F-006 | Defined action `TASK_COMPLETE` is never used | Low | `ECM_ActivityHub_Portal/htdocs/js/core/config.js` / `ECM_ActivityHub_Portal/htdocs/js/services/tasks.js` | 47 / 39-40 | `TASK_COMPLETE` exists in config but `completeTask` reuses `TASK_UPDATE`; contract drift risk with backend flows. | Either call `CONFIG.ACTIONS.TASK_COMPLETE` from `completeTask` or remove the unused constant to keep contract unambiguous. |
| F-007 | Secret/token exposure check for `sig=` in shipped code | Low | `ECM_ActivityHub_Portal/htdocs/js/core/config.js` / `ECM_ActivityHub_Portal/htdocs/powerAutomateClient.js` | 9 / 7-13 | Review found no hardcoded `sig=` SAS token or API key. Exposed value is a proxy URL, not a credential by itself. | Keep all flow signatures server-side; continue scanning for `sig=`/tokens before release. |
| F-008 | Suspected modal XSS (unescaped `${...}`) in `modals.js` | Low | `ECM_ActivityHub_Portal/htdocs/js/views/components/modals.js` / `ECM_ActivityHub_Portal/htdocs/js/utils/fn.js` | 13-14 / 22-29 | **Refuted for current data paths:** modal field interpolations are escaped; `escapeHtml` handles `& < > " '`. Raw `body/actionsHtml` insertion remains a structural risk if future callers pass untrusted HTML. | Keep strict escaping at all interpolation sites; avoid passing unsanitized HTML into `shell()`. Consider DOM API rendering to reduce `innerHTML` risk. |

## Prioritised remediation plan

1. **Immediate (0-2 days):**
   - Remove production role-switch behavior.
   - Enforce authentication and role authorization in Power Automate/API gateway.
   - Treat client `user`/`role` as untrusted metadata only.

2. **Short-term (this sprint):**
   - Add explicit backend authorization checks per action (`CONFIG.ACTIONS.*`).
   - Add route guard UX in SPA (non-security control) to reduce accidental misuse.
   - Align service contracts (`TASK_COMPLETE` parity).

3. **Hardening (next sprint):**
   - Patch auditor to include dotfiles and `.env` metadata (content policy as required).
   - Keep release scans for `sig=`, keys, and connection strings.
   - Move from large template-literal `innerHTML` rendering toward safer DOM construction patterns.
