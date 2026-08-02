# Phase 2 — Security

**SHA:** `dd2e909ed0e337f7fe36a5f65201abca9ec7f28e` · tree clean
**Corpus:** 200 tracked `.js`/`.html` files (excluding `docs/`)

---

## 1. Proxy enforcement reality (§7.1) — the headline result

> **The proxy is well built. It is also not in the request path.**
> Its 66 tests pass, its token verification is genuinely sound, and in the repository's
> default configuration **not one of the four client trees routes through it.**

### 1.1 Q3 — does `jwt.js` verify, or merely decode? — **VERIFIES. `CONFIRMED-PRESENT`**

`proxy/src/jwt.js:21-30` — the algorithm allow-list:
```js
const ALGS = Object.freeze({
  RS256: { hash: 'sha256', kty: 'RSA' },  … RS384, RS512,
  PS256: { hash: 'sha256', kty: 'RSA', pss: true },  … PS384, PS512,
  ES256: { hash: 'sha256', kty: 'EC' },  ES384,
});
```
**No `HS*` entry and no `none` entry.** Both classic attacks are refused before any key is fetched.

`jwt.js:104-125`:
```js
const spec = ALGS[header.alg];
if (!spec) throw new TokenError('unsupported_alg', String(header.alg));
const jwk = await jwks.get(header.kid);
if (jwk.kty !== spec.kty) throw new TokenError('alg_key_mismatch', `${header.alg} vs ${jwk.kty}`);
if (jwk.alg && jwk.alg !== header.alg) throw new TokenError('alg_key_mismatch', jwk.alg);
…
const ok = spec.kty === 'EC'
  ? crypto.verify(spec.hash, signed, { key, dsaEncoding: 'ieee-p1363' }, sig)
  : crypto.verify(spec.hash, signed, verifyOpts, sig);
if (!ok) throw new TokenError('bad_signature');
```

`jwt.js:126-139` — every claim checked explicitly, absence treated as failure:

| Claim | Check |
|---|---|
| `exp` | `typeof payload.exp !== 'number'` → `missing_exp`; then `now >= exp + skew` → `token_expired` |
| `nbf` | checked when present |
| `iss` | `issuer_not_configured` if unset **on the proxy**; exact match required |
| `aud` | `audience_not_configured` if unset; token `aud` must intersect |
| `sub` | `identityFrom` throws `missing_subject` |

**Verdict: real cryptographic verification with correct PSS padding and IEEE-P1363 EC encoding, an allow-list that defeats `alg=none` and HMAC key confusion, and a key-type agreement check that defeats key-type confusion.** This is a competent implementation.

### 1.2 Q1 — does `roleFromClaims` read request-controlled input? — **NO. `CONFIRMED-PRESENT`**

`proxy/src/authorize.js` (`roleFromClaims`):
```js
const raw = claims?.[rolesClaim];
const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
const mapped = values.map(v => roleClaimMap[v]).filter(Boolean);
if (!mapped.length) throw new AuthzError('no_mapped_role', values.join(',') || 'none');
return mapped.sort((a, b) =>
  (Roles[b]?.permissions?.length || 0) - (Roles[a]?.permissions?.length || 0))[0];
```

Its only data source is `claims`, and `handler.js:82` passes the object returned by `verifyToken` — never `req.body`. Unmapped roles fail closed. The multi-role tiebreak uses **permission count**, not array order, so a provider that reorders the claim cannot change the outcome.

`stripAssertedIdentity` additionally removes client-asserted identity fields from **both** the top-level body and a nested `payload` object — correct, given the client's nested envelope shape.

### 1.3 Q2 — is there a path around `authorize`? — **NO. `CONFIRMED-PRESENT`**

`proxy/src/handler.js` pipeline, in source order, every failure an early return:

| Line | Gate | Failure |
|---|---|---|
| 58 | method is POST | `405` |
| 62 | contract key present | `404` |
| 69 | `Authorization: Bearer` present | → catch |
| 70 | `verifyToken(...)` | **`401`** |
| 73 | `identityFrom(claims)` | `401` |
| 82 | `roleFromClaims(claims, …)` | → catch |
| 83 | `authorize(role, contractKey)` | **`403`** |
| 91 | `stripAssertedIdentity(req.body)` | — |
| 101–105 | idempotency replay | returns cached |
| 111 | endpoint configured | `502` |
| — | forward upstream | — |

`claims` is assigned **only** at line 70. `server.js:37-52` exposes one route to `handleRequest` plus `/healthz`. **There is no path to the upstream forward that skips verification or authorization.**

### 1.4 Q4 — which client call sites traverse the proxy? — **NONE, by default**

`core/data-client.js:21-27`:
```js
export function resolveUrl(key){
  const st=State.get();
  if(isAuthEnforced() && AuthConfig.proxyBaseUrl){
    return `${String(AuthConfig.proxyBaseUrl).replace(/\/+$/,'')}/${encodeURIComponent(key)}`;
  }
  return EndpointRegistry.url(key,{overrides:st.settings?.endpoints||{}});
}
```

`ECM_ActivityHub_Portal/js/api/client.js:6-10` — the same conditional:
```js
function endpoint() {
  if (isAuthEnforced() && AuthConfig.proxyBaseUrl) {
    return String(AuthConfig.proxyBaseUrl).replace(/\/+$/, "");
  }
  return CONFIG.API_URL;
}
```

The gate is `isAuthEnforced()`. `config/auth.config.js:76-77`:
```js
export function isAuthEnforced() { return AuthConfig.enabled === true; }
```
and `config/auth.config.js:28` — `enabled: _pick('enabled', false)`.

**Default is `false`.** The generated `config/config.local.js:30` also emits `auth: { enabled: false }`.

Negative search for the other two trees:
```
$ grep -rn "proxy" document-portal/js newack --include=*.js
(no output)
```

| Tree | Proxy path exists? | Default routing |
|---|---|---|
| Root platform | Yes, conditional | **DIRECT to Power Automate** |
| `ECM_ActivityHub_Portal/` | Yes, conditional | **DIRECT to `CONFIG.API_URL`** |
| `document-portal/` | **No — `CONFIRMED-ABSENT`** | **DIRECT**, 3 signed URLs |
| `newack/` | **No — `CONFIRMED-ABSENT`** | **DIRECT**, 1 signed URL |

**0 of 4 trees traverse the proxy as configured. Two of them cannot under any configuration** — they contain no code path to it.

### 1.5 §2.4 classification of every control observed

| Control | Location | Classification |
|---|---|---|
| Route access | `core/router.js:2` `canCurrentUserAccess()` | **route guard** (client-side) |
| Module/action ownership | `core/action-authority.js:7-16, 23-29` — throws | **client-side check** |
| Active-user check | `ensureCurrentUserActive()` | **client-side check** |
| Confirmation dialogs | `confirmAction` (23 modules) | **visual-only** |
| Proxy JWT + RBAC | `proxy/src/{jwt,authorize,handler}.js` | **proxy-enforced (evidenced)** — *but see below* |
| **Every browser control, in effect** | — | **bypassable (call site does not traverse proxy)** |

**Failure narrative (conditional, per §0.3).** *If* the signed Power Automate URLs in `document-portal/js/data.js:25-27` and `newack/config.js:4` remain valid, *then* any party holding them invokes those flows directly with `curl`, with no browser, no token, and no traversal of `proxy/`. No control in this repository sits between them and the flow. The same holds for the root platform and ActivityHub whenever `auth.enabled` is `false`, which is the committed default.

**Q5 — does the deployed topology force traffic through the proxy?** `INDETERMINATE`. Nothing in the repository configures network egress, private endpoints, or IP restriction on the Power Automate triggers. → Open Questions `Q-08`.

---

## 2. Unsafe sink survey (§7.2)

Reproducible over 200 tracked `.js`/`.html` files:

```
$ git ls-files '*.js' '*.html' | grep -v '^docs/' > src.txt
$ xargs -a src.txt grep -ohE '<pattern>' | wc -l
```

| Pattern | Files | Hits | Brief's export | Verdict |
|---|---:|---:|---:|---|
| `.innerHTML =` | 39 | **104** | 40 / 105 | Consistent |
| `insertAdjacentHTML` | 0 | **0** | 1 | ❌ **Brief wrong** |
| `document.write` | 0 | **0** | 1 | ❌ **Brief wrong** |
| `outerHTML =` | 0 | 0 | 0 | Consistent |
| `eval(` | 0 | 0 | 0 | Consistent |
| `new Function(` | 0 | 0 | 0 | Consistent |

**Explanation for the two discrepancies — and it is the §0.2 failure mode in miniature.** The only occurrence of either string anywhere in the repository is inside `FORENSIC_ROOT_PLATFORM_AUDIT.md`, a quarantined prior-audit document, where they appear in a prose table:
```
$ grep -c "insertAdjacentHTML" FORENSIC_ROOT_PLATFORM_AUDIT.md
1
```
The export counted **prior audit prose as code**. The brief inherited the number and pre-seeded it as a lead. Neither construct exists in this codebase. `CONFIRMED-ABSENT`.

### 2.1 Distribution

| Tree | Files | Hits |
|---|---:|---:|
| `document-portal/` | 6 | **58** (56%) |
| `modules/` | 25 | 31 |
| `core/` | 3 | 6 |
| `shared/` | 2 | 5 |
| `newack/` | 1 | 2 |
| `ECM_ActivityHub_Portal/` | 1 | 1 |
| `proxy/`, `config/`, `tests/` | 0 | 0 |

`proxy/` — the server component — contains **zero** DOM sinks, as it should.

---

## 3. Input → sink traces (§7.3)

External input inventory over the same corpus:

| Input | Files | Hits |
|---|---:|---:|
| `location.hash` | 15 | 30 |
| `localStorage` | 14 | 26 |
| `URLSearchParams` | 8 | 9 |
| `location.search` | 7 | 7 |
| `sessionStorage` | 4 | 8 |
| `fetch(` | 9 | 13 |
| `srcdoc` | 3 | 4 |
| `postMessage` | 1 | 1 |
| `FileReader`/`readAsDataURL` | 1 | 2 |

Only inputs with an **evidenced path to a sink** are tabled:

| # | Input | Entry point | Path | Sink | Encoding | Risk | Confidence |
|---|---|---|---|---|---|---|---|
| 1 | Backend email body | `FETCH_ALL` → `state.emails` | `modules/lookup.js:26` | `<iframe srcdoc>` | `esc()` + `sandbox="allow-same-origin"` | **Low** — no `allow-scripts`, so scripts cannot run | `CONFIRMED-PRESENT` |
| 2 | Locally rendered template | `correspondence-email-service` | `modules/correspondence-email.js:28,30` | `<iframe srcdoc>` | `esc()` + **`sandbox=""`** | **None** — maximum restriction | `CONFIRMED-PRESENT` |
| 3 | Caller-supplied HTML | *(no caller)* | `shared/components.js:42` | `<iframe srcdoc>` | `esc()` + **NO `sandbox` attribute** | **Medium — latent** | `CONFIRMED-PRESENT` |
| 4 | Attachment URL | `FETCH_EMAIL_ATTACHMENTS` | `modules/activities.js:61` | `<iframe src>` | `esc()` + bare `sandbox` + `referrerpolicy="no-referrer"` | **None** | `CONFIRMED-PRESENT` |
| 5 | URL params | `location.search` | `document-portal/js/{track,support,submit}.js` | `.value` / whitelist | n/a | **None** — see §3.2 | `CONFIRMED-PRESENT` |

### 3.1 Finding — `EmailPreviewFrame` is an unsandboxed `srcdoc` iframe

`shared/components.js:42`:
```js
export function EmailPreviewFrame({html='', title='Email preview'}={}){
  return `<iframe class="dgo-email-preview email-frame-preview" title="${esc(title)}" srcdoc="${esc(html)}"></iframe>`; }
```

**The subtlety that makes this a real defect.** `esc()` on a `srcdoc` value protects the *attribute boundary* — it stops the payload closing the attribute. It does **not** stop the content being HTML. The parser decodes the attribute's entities, and the iframe then parses the decoded value as a document. So `srcdoc` content is always live HTML, and the `sandbox` attribute is the only thing standing between it and script execution.

The repository's other four iframes get this right: two use `sandbox=""`, one `sandbox="allow-same-origin"` (no `allow-scripts`), one bare `sandbox`. **This one has no `sandbox` attribute at all** — its `srcdoc` document would execute scripts in the parent's origin.

**Why Medium and not High.** Exhaustive negative search:
```
$ xargs -a src.txt grep -n "EmailPreviewFrame"
shared/components.js:42:   ← the definition only
```
**Zero callers.** No evidenced path from any external input to this function. Per §2.3 this is a defence-in-depth gap requiring a condition not evidenced in-repo → **Medium**, capped correctly.

**Remediation:** add `sandbox=""` to match the sibling components, or delete the unused export.

### 3.2 Verified clean — document-portal URL parameters

Despite holding 56% of the repository's `innerHTML` sites, no document-portal URL parameter reaches an HTML sink:

- `track.js:271-274` — `qid`/`qemail` → `PF.$('#trackId').value` (property assignment, not HTML)
- `support.js:274-276` — `.value`, and `topic` is whitelist-validated: `topicOf(q.get('topic')).key === q.get('topic')`
- `submit.js:411-412` — `pre` is whitelist-validated against `PF.SERVICES` before use

The 58 sites render records held in `localStorage`, and user-supplied fields are escaped with `PF.esc` (`document-portal/js/core.js:14-18`, escaping `&<>"'`). The values interpolated **without** `esc` are generated IDs, catalogue codes, and formatter output — `PF.pill`, `PF.bytes`, `PF.date`, `PF.dateTime`, `PF.rel` — each of which returns output built from a static lookup table or numeric arithmetic (`core.js:32-83`). **Not findings; not padded into the ledger.**

---

## 4. Secrets and endpoints (§7.4)

| Source | Count | Kind | Routing |
|---|---|---|---|
| `config/endpoints.config.js` | 17 keys | resolved from `window.DGO_CONFIG` | proxy **iff** enforced, else direct |
| `config/config.example.js` | 17 | `sig=ROTATE_ME` placeholders | n/a |
| **`document-portal/js/data.js:25-27`** | **3** | **live-shaped SAS** | **DIRECT — no proxy path exists** |
| **`newack/config.js:4`** | **1** live (+2 `YOUR_FLOW_URL` placeholders) | **live-shaped SAS** | **DIRECT — no proxy path exists** |
| `ECM_ActivityHub_Portal/config.example.js` | 2 | placeholder | proxy iff enforced, else `API_URL` |

Carried from Phase 0: **22 distinct signatures across all history, 4 at HEAD, 18 deleted-but-unrevoked, all 22 reachable from `origin/main`.**

The Phase 2 addition is the routing column. The two trees holding live-shaped credentials are precisely the two with **no code path to the proxy**, so the enforcement work in `proxy/` cannot protect them even after activation. That is a design gap, not a configuration one.

---

## 5. Browser security posture (§7.5)

Documented negative searches over the 200-file corpus:

```
$ xargs -a src.txt grep -ohiE 'Content-Security-Policy'   | wc -l   → 0
$ xargs -a src.txt grep -ohiE 'integrity='                | wc -l   → 0
$ xargs -a src.txt grep -ohiE 'X-Frame-Options|frame-ancestors' | wc -l → 0
$ xargs -a src.txt grep -ohiE 'Permissions-Policy'        | wc -l   → 0
$ xargs -a src.txt grep -ohiE 'referrerpolicy'            | wc -l   → 1
```

| Control | Repo status | Runtime status |
|---|---|---|
| Content-Security-Policy | **`CONFIRMED-ABSENT`** | `INDETERMINATE` — may be a deploy-time header |
| Subresource Integrity | **`CONFIRMED-ABSENT`** | n/a — see below |
| Framing protection | **`CONFIRMED-ABSENT`** | `INDETERMINATE` |
| Permissions-Policy | **`CONFIRMED-ABSENT`** | `INDETERMINATE` |
| Referrer policy | 1 occurrence — `modules/activities.js:61`, on an iframe | — |

**SRI has no practical gap.** External-host enumeration over the corpus finds no third-party script or stylesheet origin; `http://` references are `http://localhost:8080` (2), `http://localhost`, `http://127.0.0.1` (dev servers), `http://x` (`proxy/src/server.js:52`, a `new URL()` parse base) and `http://www.w3.org/2000/svg` (an XML namespace, not a fetch). **No mixed-content risk and nothing to pin.** A strict CSP would consequently be unusually easy to adopt — the only inline script is `index.html:26-59`.

### 5.1 `DOC-DRIFT-001` — CSP discussed in prose, absent from code

The **only** occurrence of `Content-Security-Policy` in the entire repository is inside `FORENSIC_ROOT_PLATFORM_AUDIT.md`:
```
$ git ls-files | xargs grep -lI 'Content-Security-Policy'
FORENSIC_ROOT_PLATFORM_AUDIT.md
```
A quarantined document discusses a control that does not exist in code. Per §9.2 this is `DOC-DRIFT`. It is also, candidly, **self-inflicted** — that document was produced earlier in this same session, and it is the second time (after the redacted signatures) that prior audit prose has contaminated the evidence base. It is the strongest practical argument for §0.2 that this engagement has produced.

---

## 6. Diagram 2 — trust boundaries

See `diagrams/02-trust-boundaries.mmd`. Bypass paths are drawn explicitly; the proxy is drawn beside the request path rather than on it, which is the diagram's principal assertion.

---

## 7. Phase 2 findings (provisional)

| ID | Title | Sev | Confidence | Scope |
|---|---|---|---|---|
| `F-012` | **Proxy is not in the request path** — 0 of 4 trees route through it by default; every browser control is therefore bypassable | **High** | `CONFIRMED-PRESENT` | `CROSS` |
| `F-013` | `document-portal/` and `newack/` have **no proxy code path at all** — unreachable by enforcement even after activation | **High** | `CONFIRMED-PRESENT` | `DOCPORTAL`, `NEWACK` |
| `F-014` | `EmailPreviewFrame` renders `srcdoc` with no `sandbox` attribute (latent — zero callers) | **Medium** | `CONFIRMED-PRESENT` | `ROOT` |
| `F-015` | No CSP / framing / permissions policy in any entry point | **Medium** | `CONFIRMED-ABSENT` (repo) | `CROSS` |
| `F-016` | `modules/lookup.js:26` grants `allow-same-origin` to an iframe rendering backend email HTML | **Low** | `CONFIRMED-PRESENT` | `ROOT` |
| `DOC-DRIFT-001` | CSP/SRI described in root audit prose; absent from code | **Low** | `CONFIRMED-PRESENT` | `CROSS` |

**Resolved from Phase 1:** `F-011` (`reports`/`statistics` invoke `EMAIL` without `executeOwnedAction`) stays **Low**. With the proxy out of the path, the ownership guard's presence or absence changes nothing about what reaches Power Automate — the endpoint is directly invocable regardless. The guard is a UX and audit control here, not a security boundary.

**Verified clean — recorded so effort is not re-spent:** no `eval`/`Function`/`document.write`/`outerHTML`/`insertAdjacentHTML` anywhere; `proxy/` has zero DOM sinks; JWT verification is cryptographically sound; `roleFromClaims` cannot be influenced by request body; the handler has no authz bypass; document-portal URL params never reach HTML sinks; four of five iframes are correctly sandboxed.

---

## 8. Open Questions added in Phase 2

| # | Question | Why the repo cannot answer | What would answer it |
|---|---|---|---|
| `Q-08` | Does deployed topology force traffic through the proxy? | No egress/network config in-repo | Azure network + Power Automate trigger IP restrictions |
| `Q-09` | Are CSP/framing/referrer headers applied at deploy time? | Headers are a hosting concern | Live response headers from the deployed origin |
| `Q-10` | Is `proxy/` deployed at all, and is `auth.enabled` overridden in the deployed config? | `config.local.js` is git-ignored and environment-specific | Deployed `config.local.js` / host environment |

---

## 9. Phase 2 limitations

1. **No token was minted and no request was sent.** Proxy behaviour is established by reading `jwt.js`, `authorize.js` and `handler.js`, corroborated by the repository's own 66 passing assertions — not by driving traffic.
2. **No credential was exercised.** Whether the 22 signatures are still valid is untested and untestable without invoking live government workflows.
3. **`ECM_ActivityHub_Portal/` was assessed only at its API boundary** (`js/api/client.js`). Its 53 files, two routers and 10 service/page pairs were not read; its single `innerHTML` site was not traced.
4. **`document-portal/sw.js` was not analysed as a cache-poisoning surface.** §7.3 called for a dedicated look; the phase's budget went to §7.1 as instructed. Carried to Phase 3, where its precache manifest is relevant to what ships.
5. **The 104 `innerHTML` sites were assessed by input-origin tracing, not exhaustively one by one.** Sites rendering static template literals were excluded by inspection of their inputs rather than individually documented, per §7.2's instruction not to pad the ledger.
6. **`newack/`'s 2 `innerHTML` sites were counted, not traced.**

---

**Gate: Phase 2 complete. Awaiting acceptance before Phase 3.**
