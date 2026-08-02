# Addendum — `ECM_ActivityHub_Portal/` deep examination

**SHA:** `dd2e909ed0e337f7fe36a5f65201abca9ec7f28e` · tree clean
**Reason for this addendum:** Phase 4 §7.4 flagged this tree as **under-examined relative to its risk** — two High findings (`F-023`, `F-024`) emerged from reading two of its 53 files, while its two routers, 13 services and 19 pages went unread. This closes that gap under the same evidence standard.

**Scope tag:** `ACTIVITYHUB` throughout. Same rules: no code changes, no target-state design.

---

## 1. Architecture — resolved, and it is sound

### 1.1 The two routers are not a duplicate — `CONFIRMED-PRESENT`

Phase 0 §6.4 recorded two routers and deferred the question. They are different components with no overlap:

| File | Lines | Role |
|---|---:|---|
| `js/core/router.js` | 61 | **Navigation + authorization.** `parseHash()`, `navigate()`, `startRouter()`, `ROUTE_ROLES`, `canOpen()`; binds `hashchange`, sets `Store.ui.route`, calls `renderApp()` |
| `js/views/router.js` | 46 | **Route → view dispatch.** Imports 19 `render*` page functions and selects one |

`js/views/router.js:1-20` is a flat import manifest of the page renderers. **Not a duplicate router; a dispatch table.** The naming is unfortunate, nothing more.

### 1.2 Services vs pages is layering, not duplication — `CONFIRMED-PRESENT`

Phase 0 §6.4 observed 10 domain nouns appearing in both `js/services/` and `js/views/pages/` and deferred the question. Resolved by import analysis:

```
$ grep -rn "services/" ECM_ActivityHub_Portal/js/views/
(no output)                      ← no page imports any service

$ grep -rln "services/" ECM_ActivityHub_Portal/js
js/controllers/actions.js
js/main.js                       ← the only two consumers
```

Confirmed on a sampled pair — `js/views/pages/tasks.js:1-4` imports `Store`, `ui` components and `escapeHtml`, and **not** `js/services/tasks.js`, whose five exports (`listTasks`, `createTask`, `updateTask`, `completeTask`, `deleteTask`) are consumed only from `actions.js`.

**The flow is unidirectional and conventional:**

```
events/bindings → controllers/actions → services/*  → api/client → network
                                              ↓
                                            Store
                                              ↓
                          views/router → views/pages/* (read-only render)
```

**This is a clean architecture, and it is better separated than the root platform**, whose modules call `invoke()` directly from within render/bind code. Recorded as a positive finding so it is not mistaken for redundancy in future.

---

## 2. Role vocabulary divergence — the addendum's principal finding

### 2.1 The two vocabularies are disjoint — `CONFIRMED-PRESENT`

`ECM_ActivityHub_Portal/js/core/router.js:12-16`:
```js
export const ROUTE_ROLES = Object.freeze({
  "/admin":     ["SystemAdmin", "DGCEO"],
  "/audit":     ["SystemAdmin", "DGCEO", "COS"],
  "/directory": ["SystemAdmin", "DGCEO", "COS"],
});
```

`config/rbac.config.js` — the matrix `proxy/src/authorize.js:10` imports — defines: `systemAdmin`, `userAdmin`, `executive`, `director`, `operator`, `viewer`.

```
$ for r in SystemAdmin DGCEO COS; do grep -c "$r" config/rbac.config.js; done
0
0
0
```

**Zero overlap.** The portal authorizes against three role names that do not exist in the matrix the server enforces.

### 2.2 Why this is not simply a configuration choice

Both applications read their role mapping from the **same runtime key**:

| Consumer | Source | Target vocabulary |
|---|---|---|
| `config/auth.config.js:23` | `window.DGO_CONFIG?.auth` | `systemAdmin` … `viewer` |
| `ECM_ActivityHub_Portal/js/core/auth.js:21` | `window.DGO_CONFIG?.auth` | `SystemAdmin`, `DGCEO`, `COS` |
| `proxy/src/config.js:33` | `DGO_ROLE_MAP` **env var** | `systemAdmin` … `viewer` (via `Roles`) |

`ECM_ActivityHub_Portal/js/core/auth.js:102`:
```js
for (const v of values) if (AuthConfig.roleClaimMap[v]) return AuthConfig.roleClaimMap[v];
```
with the declared intent at `:32` — *"Maps identity-provider roles onto **the portal's own role vocabulary**."*

**Mitigating fact, verified:** the two browser apps load *separate* config files — `index.html:13` loads `config/config.local.js`, `ECM_ActivityHub_Portal/index.html:46` loads `./config.local.js`. So each page can carry a different `window.DGO_CONFIG.auth.roleClaimMap`, and the conflict is **avoidable by configuration rather than structural**. I state this explicitly because the opposite conclusion would have been the easier finding to write and would have been wrong.

**The finding that remains** is that activation requires **two independently maintained mappings of the same identity-provider claim** — one producing `DGCEO` for the portal's route guard, one producing `executive` for the proxy's `authorize()` — with **no test asserting they agree** and no shared source of truth. `AUTHENTICATION_CONTRACT.md` §3 (admissible as evidence of *intent* per §0.2) specifies six Entra app roles matching the root vocabulary only; the portal's three names appear in no activation document.

**Consequence at activation.** If the portal's `roleClaimMap` is configured to the root vocabulary, `canOpen("/admin")` evaluates `["SystemAdmin","DGCEO"].includes("executive")` → `false`, and `/admin`, `/audit` and `/directory` become unreachable for every principal. If it is configured to the portal vocabulary, the mapping diverges from the contract the proxy enforces. Neither state is detected by any test.

### 2.3 A third vocabulary in the generated config

`scripts/setup-local.mjs:127` writes:
```js
devIdentity: { email: 'operator@localhost', name: 'Development Operator', role: 'Officer' }
```
consumed at `ECM_ActivityHub_Portal/js/core/store.js:15,17` — `role: _dev.role || "Officer"`.

**`Officer` appears in neither vocabulary.** It is inert-only (once enforced, role comes from claims), so the impact is cosmetic — but it means the shipped development identity carries a role name that no guard in either application recognises. **Low.**

---

## 3. Client-side controls — verified working as documented

| Control | Location | Verified behaviour |
|---|---|---|
| Role switch refused when enforced | `js/controllers/actions.js:41-45` | `if (!roleSwitchAllowed())` → toast and `return`. `roleSwitchAllowed()` = `!isAuthEnforced()` (`js/core/auth.js`). **Correct.** |
| Identity dropped from envelope when enforced | `js/api/client.js:20-22` | `const asserted = clientMayAssertIdentity() ? { user, role } : {};` **Correct.** |
| Bearer attached when enforced | `js/api/client.js:44-46` | `...(await authHeaders())` on both the `PowerAutomateClient` and `fetch` paths. **Correct.** |
| Route guard permissive while inert | `js/core/router.js:19-25` | `if (!isAuthEnforced()) return true;` — documented as deliberate |
| Explicit denial page | `js/core/router.js:48-52` | `setRoute("/denied")` → `renderDenied` |
| Token decode is display-only | `js/core/auth.js:53-60` | Comment: *"No signature verification — that is the server's job."* **Correct separation.** |

Only **3 of 18 routes** carry any role restriction (`/admin`, `/audit`, `/directory`). The remaining 15 — including `/approvals`, `/decisions`, `/minutes` — are unrestricted for any authenticated principal. Whether that is intended is `INDETERMINATE`; no document states a route-privilege model for this portal.

---

## 4. Output encoding — verified clean

```
$ grep -rn "innerHTML" ECM_ActivityHub_Portal/js
js/views/layout.js:33:  app.innerHTML = `
```

**A single sink**, and it is a composition root: `layout.js:32-45` interpolates only the return values of `renderSidebar()`, `renderHeader()`, `renderRoute()` and the toast/busy/modal fragments. Escaping belongs in the leaf renderers, and is present:

- **22 of 24** view files call `escapeHtml`.
- The two that do not are clean: `pages/notfound.js` (23 lines, **zero** interpolations) and `pages/reports.js` (18 lines, 4 interpolations — all static literals passed to `button()`).

`escapeHtml` is imported from `js/utils/fn.js`. **No finding.**

---

## 5. Request envelope — recorded, not rated

`js/api/client.js:24-29`:
```js
const envelope = { action, ...asserted, timestamp: new Date().toISOString(), payload };
```

Domain data is nested under `payload`; `action` and (while inert) `user`/`role` sit at the top level. Whether the receiving flow reads nested fields is not determinable from this repository — the flow definitions are not here. **Recorded descriptively; `INDETERMINATE` as to consequence** → `Q-15`.

The client also prefers `window.PowerAutomateClient` when present (`:38-41`), falling back to `fetch`. `powerAutomateClient.js` at the tree root supplies it.

---

## 6. Addendum findings

| ID | Title | Sev | Confidence | Scope |
|---|---|---|---|---|
| `F-025` | Portal and server authorize in disjoint role vocabularies; activation needs two hand-maintained claim mappings with no test asserting agreement | **Medium** | `CONFIRMED-PRESENT` | `ACTIVITYHUB` |
| `F-026` | Only 3 of 18 routes carry any role restriction; no document states a route-privilege model | **Low** | `CONFIRMED-PRESENT` | `ACTIVITYHUB` |
| `F-027` | Generated `devIdentity.role` is `"Officer"`, a value in neither role vocabulary | **Low** | `CONFIRMED-PRESENT` | `ACTIVITYHUB` |

**Verified clean — recorded so it is not re-examined:** two routers are distinct components, not duplicates; services/pages is correct unidirectional layering and better separated than the root platform; a single `innerHTML` site which is a composition root; 22 of 24 view files escape, and the two that do not have no dynamic data; role switch, envelope identity stripping and bearer attachment all behave as documented; token decode is explicitly display-only.

**Risk rating for `ECM_ActivityHub_Portal/` is unchanged at High** — driven by `F-023` (default backend is a personal third-party origin) and `F-024` (two remote scripts, no SRI). Nothing found in this addendum raises or lowers it: the tree's application code is competent, and its risk lies entirely in its configuration defaults and its dependency loading.

---

## 7. Open Question added

| # | Question | Why the repo cannot answer | What would answer it |
|---|---|---|---|
| `Q-15` | Does the ActivityHub's receiving flow read the nested `payload` object, or only top-level fields? | The flow definition is not in this repository | The Power Automate flow's trigger schema |

---

## 8. Addendum limitations

1. **Read for structure and control flow, not line by line.** 53 files were mapped; `js/core/{router,auth,store,config}.js`, `js/api/client.js`, `js/controllers/actions.js`, `js/views/{layout,router}.js` and two page/service pairs were read closely. The remaining 17 pages and 11 services were assessed by import graph, export surface and grep, not full reading.
2. **`js/data/demo.js` was not examined.** Its name implies fixture data; whether it seeds `Store` and under what condition is untested.
3. **`powerAutomateClient.js` was identified as the preferred transport but not read.**
4. **No runtime execution.** The single smoke test that loads this tree asserts only that the page mounts without same-origin failures.
5. **`F-025`'s activation consequence is reasoned from code, not observed** — auth cannot be enforced in this environment without a tenant and a token provider.

---

**Addendum complete. Engagement remains closed at `dd2e909`; findings total 28 (7 High, 11 Medium, 10 Low).**
