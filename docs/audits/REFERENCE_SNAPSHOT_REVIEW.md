# Critical Review — `dgo_targets__state.json` Reference Snapshot

**Reviewed** 2 August 2026 · **Source** `9e18fa24-dgo_targets__state.json` (12.5 MB, 158 file records, 10.5 MB of embedded content)
**Coverage** every record enumerated; every claim below verified against the current `main` working tree.

---

## 1. What the file actually is

Not the `dgo-embedded-state/v1` bundle its name suggests. It is a **flat file-snapshot array** — one record per file, each carrying `path`, `name`, `size`, `modified`, `sha256`, `binary`, and either `content` or `content_base64`. Content spans **6 December 2021 → 31 July 2026**.

It is a capture of the *reference and working material* around the platform, not the platform itself. No runtime source from `core/`, `modules/`, or `config/` is present.

| Cluster | Files | Size | Verdict |
|---|---:|---:|---|
| `Refe/` — flow definitions, SharePoint package, registers, canvas app | 72 | 8.57 MB | **High value** |
| `files_sorted_by_type…` — acknowledgement-slip variants | 28 | 0.51 MB | Self-labelled duplicates |
| `ECMAScript2016-Design-Patterns-master` | 26 | 0.04 MB | **Unrelated third-party** |
| `platform-architecture-pack` | 18 | 0.05 MB | **Superseded — do not adopt** |
| `universal_filename_policy_deliverables` | 6 | 0.05 MB | Process-only |
| Loose root documents (BRD/FRD, manifest, provisioning extraction, exec UI) | 8 | 1.15 MB | Already archived |

**36 of 158 records are already in `ECM_DOCS_DEV.zip`; 122 are not.** The overlap is the already-known material (BRD/FRD, operations manifest, SharePoint extraction, DGCEO data model).

---

## 2. Findings that change what we do

### A-1 · The nested request envelope cannot reach the flows — **Critical**

The deployed trigger schema declares **25 top-level properties** and **no `payload` property**:

```
name, id, method, action, Action, operation, Operation, userEmail, UserEmail, email,
docId, DocId, taskId, TaskId, acknowledgedBy, status, trackingID, source, AssignmentType,
Selected, NewActivityTask, mode, device, Email, SelectedItems
```

`core/data-client.js:32` sends the **nested** envelope by default:

```js
{ action, payload: {...}, userEmail, requestId, timestamp }
```

Only `modules/single-assignment.js:112` passes `{flatPayload:true}`. Every other governed call nests its data.

The flow reads top-level fields — `triggerBody()?['userEmail']`, `?['action']`, `?['source']`. Under the nested envelope only `action` and `userEmail` land where the flow looks; `operation`, `mode`, `docId`, `taskId`, `id` are buried inside `payload` and never read. Because the schema sets `additionalProperties: true`, **the request is accepted rather than rejected** — the flow returns `200 OK` with default/empty data.

The pilot's own verified envelope is flat:

```json
{ "action":"lookups", "operation":"read", "mode":"read",
  "source":"DGO_FAST_Track_WEB_OPS", "userEmail":"…", "method":"POST",
  "device":{ "id":"standalone-html", "platform":"…", "ua":"…" } }
```

`source: "DGO_FAST_Track_WEB_OPS"` is sent on every pilot call and by nothing in the current runtime.

**This is the most likely reason live data would not come back even with correct endpoints, and it fails silently rather than loudly.**

### A-2 · Two contract action values are outside the flow's vocabulary — **High**

The manifest records seven wire actions verified from working pilot source. Against `config/endpoints.config.js`:

| Contract | Repo sends | Pilot uses | |
|---|---|---|---|
| `REFERENCE_DATA` | `lookups` | `lookups` | ✅ |
| `GET_DOCS` | `getDocs` | `getDocs` | ✅ |
| `SINGLE_ASSIGNMENT` | `singleassignment` | `singleassignment` | ✅ |
| `BULK_ASSIGNMENT`/`_DIRECT` | `bulkassignment` | `bulkassignment` | ✅ |
| `EMAIL_RELATED_TASK` | `emailtotaskassignment` | `emailtotaskassignment` | ✅ |
| **`FETCH_ACTIVITIES`** | **`LIST-ACTIVITIES`** | **`getTasks`** | ❌ |
| **`SUBSIDIARY_ACTIONS`** | **`INIT`** | **`emailsfetch`** | ❌ |

The flow switches on `toLower(trim(coalesce(action, AssignmentType, '')))`. Unmatched values fall to `Default`, which composes a generic response — again, no error.

### A-3 · The deployed `archive` case is empty — **High**

`Case_archive` has `actions: {}` — zero steps. `ARCHIVE_REFERENCE` routes to `DYNAMIC_ACTIONS` with action `archiveReference`, which would not match `archive` in any event. **Archive is a client-side illusion: nothing is persisted server-side.**

### A-4 · `accessScope` is captured but enforced nowhere — **Medium**

Written in `modules/user-admin.js:60`, normalised in `core/current-user.js:56`, seeded in `core/state.js:2` — and read by **no** access decision. `canAccess()` in `config/rbac.config.js` evaluates role and persona only.

The snapshot's own enrollment audit raised exactly this ("Scope/department enforcement", MEDIUM) and it remains open. Every user therefore sees all records regardless of assigned directorate. The provisioning package ships a `DGO_AccessScopes` list built to back it.

### A-5 · The "no safe dry-run" limitation is contradicted by the deployed definition — **Medium**

`modules/diagnostics.js` reports: *"No safe DYNAMIC_ACTIONS dry-run exists (every call is a write)."* The definition shows **11 of 14 cases are read-only**:

| Mutating | Connector operations |
|---|---|
| `update` | `PatchItem` |
| `fetchtask` | **`SendEmailV2`** |
| `support_request` | `PostItem`, `PatchItem` |

`getz_details` and `watchlist` are single `GetItem` reads — suitable, genuinely safe probes. `ping` is also non-mutating but **not** a lightweight health check: it issues 8 connector calls including Graph HTTP requests against Inbox and Sent Items.

### A-6 · `fetchtask` sends email despite its name — **Medium**

`Case_fetchtask` invokes `SendEmailV2`. Any code or operator treating it as a read is wrong. Worth an explicit note wherever the action vocabulary is documented.

---

## 3. Confirmations — raise confidence, create no new work

**B-1 · Server-side proof of G-04.** The flow derives the caller from the request body and nothing else:

```
varuserEmail = trim(coalesce(triggerBody()?['userEmail'], triggerBody()?['UserEmail'], ''))
```

That value flows straight into the response as `request.requestedBy`. There is no token validation anywhere in the definition. The privilege-escalation finding was previously demonstrated from the client side; this is the server side of the same fact, in the deployed artefact.

**B-2 · The role catalogue matches the repo exactly.** All six roles in `DGO_RoleCatalogue` are permission-for-permission identical to `config/rbac.config.js` (13/7/3/4/2/0 for systemAdmin/userAdmin/executive/director/operator/viewer), tagged `R11.6-PILOT`. The provisioning package is genuinely aligned with the current runtime and can be trusted as its server-side counterpart. It also supplies the exact six app roles the Entra registration step needs.

**B-3 · No new credentials.** All 11 SAS signatures in the snapshot are already present in `ECM_DOCS_DEV.zip`. The snapshot adds no exposure.

**B-4 · The proxy is structurally mandatory, now with a second reason.** The flow's CORS allow-list is `Content-Type, X-DGO-Trigger, X-Correlation-ID` — **`Authorization` is absent**. A browser sending a bearer token direct to the flow would fail preflight. `missingActivationConfig()` already requires `proxyBaseUrl`, so the design is correct; this is corroboration, not a gap.

**B-5 · The response envelope our client parses is the right one.** `core/contracts.js:16` reads `request.requestId`, `request.trackingId`, `timing.*`, `meta.runId`, `meta.flowName`, `meta.contractVersion` — matching the deployed `Compose__Standard_Response_Revised` shape exactly, contract version `2026-03-23.5`.

---

## 4. Directly useful assets

| Asset | Why it matters |
|---|---|
| **`DGO_SHAREPOINT_RUNTIME_PACKAGE/`** | 10 lists, 97 fields, 6 roles, 16 Power Automate actions, 16 validation checks, plus a PnP provisioning script and validator. `DGO_UserDirectory`, `DGO_PendingWrites`, `DGO_AccessEvents`, `DGO_AccessScopes`, `DGO_EndpointRegistry`, `DGO_AuditLog` are precisely the server-side persistence the enrollment audit recorded as missing. Target site `…/sites/NITDADGO-EAAACTIVITYTRACKING`, environment `pilot`. |
| **`Web - Subsidiary Doc Actions…full_definition.json`** | The deployed flow logic in full — the only artefact that settles what the server actually does. Source of A-1, A-3, A-5, A-6, B-1, B-4. |
| **`power_automate_response_fields-1.csv`** | Empirical field-level profile of real responses: 81 fields with record counts, present/missing counts, JSON types, semantic hints and examples. Useful for hardening proxy response handling against fields that are frequently absent. |
| **`DGO_R11_6_UI_SCREENSHOT_DEFECT_REGISTER-2.md`** | 14 defects (9 High) against `#/correspondence` and `#/home`, with screenshot evidence, probable source files and recommended corrections. **UI-001 is still live** — `core/flow-confirmation.js` still `JSON.stringify`s the payload into the confirmation modal. |
| **Enrollment provisioning audits (2)** | Before/after pair. Most items are closed in current code; `accessScope` (A-4) and authentication (G-04) are not. |
| **`Refe/canvas app (2)/`** (~2.6 MB, 32 files) | Power Apps predecessor. Behavioural reference for screen semantics only — not portable code. |

---

## 5. No platform value

- **`ECMAScript2016-Design-Patterns-master`** (26 files) — an unrelated MIT-licensed tutorial repository. No connection to this platform.
- **`platform-architecture-pack`** (18 files) — generic architecture boilerplate. Its request envelope (`{meta, user, data}`) contradicts both the deployed flow and the verified pilot payload, and it places `user.roles` **in the request body** — the exact anti-pattern `docs/architecture/AUTHENTICATION_CONTRACT.md` §2.3 forbids. **Adopting it would reintroduce the vulnerability we just closed.**
- **`files_sorted_by_type…`** (28 files) — acknowledgement-slip variants, self-labelled `DUPLICATE_GROUP01`–`06`.
- **Firebase key** `AIzaSyB2a6leX8…` — a public Firebase *web* apiKey belonging to an unrelated project (`digital-hub-e9acc.firebaseapp.com`), captured inside a saved MHTML page. Public by design in Firebase web configs; not a secret and not ours.
- **`Notes_260728_213651.pdf`** (4.5 MB, 43% of the payload) — the source screenshots behind the defect register.

---

## 6. Data protection note

`NITDA_DG_Records_2026-07-21(1).csv` — **301 correspondence records** (`Reference_ID, Category, Priority, Status, Sender_MDA, Subject, ReceivedDate, EventDate`). Organisational metadata rather than a personal directory, though subject lines may name individuals. Not currently in the repository, and it should stay out of it.

**Rotation scope, restated precisely:** the archive contains **31 distinct SAS signatures** — the superset to rotate. This does not contradict the standing figure of 22, which counted tracked files before the structural cleanup; the archive additionally holds reference material that was never tracked separately. The tracked-file position is unchanged and correct: **4 signatures in 2 files** (`document-portal/js/data.js`, `newack/config.js`).

---

## 7. Recommended actions

Ordered by value per unit of effort. **No code has been changed by this review.**

| # | Action | Effort | Recommendation |
|---|---|---|---|
| 1 | Send the flat envelope (A-1) and correct the two action values (A-2) | ~1 hour | **Do first.** Without it, live testing returns empty results that look like success. |
| 2 | Add a contract-vocabulary test pinning the 7 verified actions and the flat field set | ~1 hour | **Recommended.** Turns A-1/A-2 into regressions that cannot recur. |
| 3 | Correct the diagnostics dry-run claim; adopt `getz_details` as the probe (A-5) | ~30 min | **Recommended.** Makes `DYNAMIC_ACTIONS` readiness genuinely verifiable. |
| 4 | Enforce `accessScope` in `canAccess()` (A-4) | ~half day | **Recommended**, but a behaviour change — it will restrict what pilot users see. Your call on timing. |
| 5 | Provision the 10 SharePoint lists from the package | ~half day | **Recommended** alongside the proxy — it is the persistence layer the proxy writes to. |
| 6 | Fix the empty `archive` case (A-3) | Power Automate | **Owner-side.** Platform cannot fix a server-side no-op. |
| 7 | Work the 14 UI defects | multi-day | **Defer** until enforcement lands, except UI-001 which is small and still live. |

### On the three standing owner-side items

This snapshot **materially de-risks two of them**. The Entra app-role definitions are now confirmed rather than assumed (B-2), and the SharePoint provisioning package supplies the persistence layer the proxy needs. The rotation scope is now precisely bounded at 31 signatures.

**Recommendation: take items 1–3 before the next live test.** They are inexpensive, they are the difference between a test that proves something and a test that silently proves nothing, and item 1 in particular explains a failure mode that would otherwise be read as "the endpoints are wrong."
