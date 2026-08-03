# DGO Digital Operations — Target Architecture

**Status:** design, for decision. No code written against it yet.
**Grounded at:** `f9ee82c` · every current-state statement traces to `docs/forensic/dd2e909/`.

---

## 1. The two sentences that decide everything

> **The root platform is the internal operations system and the single system of record.**
> **The document portal is an external intake channel for documents and correspondence — not a service-request desk.**

Every decision below follows from those two. Where the code today contradicts them, that is a defect, not a variant.

---

## 2. What that intent breaks in the current build

Three mismatches, all confirmed in the audit or verified while writing this.

### 2.1 The portal models services, not correspondence — **structural**

`document-portal/js/data.js:47` defines `PF.SERVICES`: *IT Project Clearance* (`IT-CLR`, 14-day SLA), *Data Protection Compliance Filing* (`DPA-CMP`, 10-day SLA), OEM certification, each with its own SLA clock and required-documents checklist.

That is a **service-request catalogue**. A submitter picks a service, the portal starts a per-service SLA, and an officer approves or declines it.

Correspondence is a different shape. A submitter sends **a document addressed to NITDA**; the registry classifies it, assigns a reference, routes it, and minutes it. There is no "service" being requested and no per-service SLA — there is a correspondence category and a registry workflow.

The root platform already models the correct shape (`modules/correspondence.js`):

```
id · referenceId · subject · sender · senderEmail · receivedAt · eventDate
correspondenceType · channel · category · status · priority · confidentiality · description
```

with a vocabulary of `correspondenceType ∈ {Incoming, Email}` and `channel ∈ {Document, Email, Registry}`.

**The portal's submission produces none of these fields.** It produces `serviceName`, `serviceCode`, `unit`, `officer`, `sla`. The two models do not meet.

### 2.2 Documents are lost on submission — **new finding, F-028, High**

The portal's upload UI accepts **5 files, 10 MB each, 50 MB total** (`submit.js:4`). What it transmits (`submit.js:331-347`):

```js
var primary = files[0];
…
if (!primary || !primary.file || primary.size > 4 * 1048576) return send('');
```

- Only `files[0]` is ever sent. **Attachments 2–5 are silently discarded.**
- If that first file exceeds **4 MB**, `send('')` transmits an **empty** `FileContentBase64` — the submission still reports success.

For a service desk this is bad. **For a document intake channel it is the whole purpose failing silently**, and the submitter is told their documents were received.

### 2.3 There is no route from the portal into the record — **F-013**

Confirmed by negative search: `grep -rn "proxy" document-portal/js newack` returns nothing, and the portal's three workflow GUIDs intersect the platform's nine at zero. `PF.flow` (`core.js:277-298`) posts and never reads the response, so all portal state lives in the submitter's own `localStorage`.

An externally submitted document today cannot be assigned, tracked, acknowledged, minuted or archived by the platform meant to govern it.

---

## 3. Target architecture

### 3.1 Zones and trust

| Zone | Contains | Reachable by | Authentication |
|---|---|---|---|
| **Public** | `document-portal/` | Anyone on the internet | None — anonymous submission is the point |
| **Enforcement** | `proxy/` | Public zone + internal zone | Validates every request; the only path onward |
| **Internal** | root platform, ECM Activity Hub | NITDA staff | Entra ID, mandatory |
| **Systems of record** | SharePoint lists + document library, Power Automate | **Enforcement zone only** | Private endpoint / IP-restricted |

**The rule that makes this an architecture rather than a diagram: no client, internal or external, holds a credential for the systems of record.** The proxy is the only component that does. That single rule retires the entire SAS-in-client-code problem class instead of rotating it.

### 3.2 Intake channels — four, converging on one record

| # | Channel | Origin | Status today | Target |
|---|---|---|---|---|
| **A** | **Document portal** | External submitter | ❌ no path | Anonymous submit → proxy → SharePoint + registry record with `channel: 'Portal'` |
| **B** | **Email** | Mailbox | ✅ implemented | Unchanged: `FETCH_ALL` → `state.emails` → email-to-task |
| **C** | **Scan / physical** | Registry counter | ⚠️ metadata only | New internal upload workspace: file → SharePoint → record with the link already attached |
| **D** | **Internal origination** | NITDA staff | ✅ implemented | Unchanged: `modules/correspondence.js` |

All four produce **the same correspondence record**. `channel` is what distinguishes them, and it gains one value: `Portal`. Nothing else in the model changes — which is the test of whether the model was right, and it was.

### 3.3 Documents live in SharePoint; the platform holds metadata and a link

The root platform never handles file bytes. Confirmed in code:

```js
attachmentLink: c.attachmentLink || c.AttachmentLink || c.Link || c.webUrl || c.documentUrl || ''
```

`webUrl` / `documentUrl` are SharePoint shapes, and `DGO_SHAREPOINT_RUNTIME_PACKAGE` provisions the library. **This is already the right design and must be preserved.**

It also dictates the fix for §2.2: file bytes must go to **SharePoint via the proxy**, not base64-inlined into a JSON workflow payload. Base64 in JSON is what forced the 4 MB ceiling and the single-file limit in the first place.

**Submission becomes two phases:**

1. `POST /intake/submission` → proxy validates, mints a reference, returns an upload target per file
2. Client uploads each file directly to that target → proxy confirms → registry record created with N attachment links

This removes the size ceiling, removes the file-count limit, and removes the silent-loss failure mode together.

### 3.4 The portal stops owning state

Today the portal is the system of record for its own submissions — approvals, decisions, SLA and audit trail all live in one browser's `localStorage`.

In target, the portal keeps **exactly one** local responsibility: an **offline outbox** for submissions that could not be delivered, retried on reconnect. Everything else — status, timeline, decisions — is **read back from the platform** by tracking reference. The portal becomes a client.

The staff console (`admin.html`) has no place in an external portal. Triage, decisions and audit belong in the internal platform, where they are already implemented and where identity is enforced. **`admin.html` is retired, not fixed** — that also closes the hardcoded-credentials finding by deleting its reason to exist.

### 3.5 The submission contract

```jsonc
// POST {proxyBaseUrl}/intake/submission        — anonymous, rate-limited, no credential
{
  "channel": "Portal",
  "correspondenceType": "Incoming",
  "subject": "Request to participate as an observer",
  "category": "General Correspondence",      // root's category vocabulary, not a service code
  "sender":       { "name": "…", "organisation": "…", "organisationType": "MDA|Private|NGO|Individual" },
  "senderEmail":  "…",
  "senderPhone":  "…",
  "eventDate":    "2026-08-14",
  "description":  "…",
  "attachments":  [ { "name": "proposal.pdf", "size": 2411920, "sha256": "…" } ],
  "submittedAt":  "2026-08-02T15:03:43Z"
}

// 202 Accepted
{
  "ok": true,
  "referenceId": "NITDA-2026-004182",         // registry reference, the submitter's receipt
  "uploads": [ { "name": "proposal.pdf", "url": "https://…", "expiresAt": "…" } ],
  "trackingUrl": "https://portal…/track.html?ref=NITDA-2026-004182"
}
```

**Deliberate properties.** No `userEmail` and no role — the caller is anonymous by design and identity is irrelevant to an external submission. `sha256` per attachment lets the proxy verify what arrived matches what was declared. The reference is minted **server-side**; a client-generated ID is not a registry reference.

### 3.6 What the proxy must add

It already does token validation, role derivation, per-action authorization, identity stripping, idempotency and audit — correctly, with 66 passing assertions. Intake needs three additions:

| Need | Why |
|---|---|
| **Anonymous intake route** | `/intake/*` is the only unauthenticated path. Rate-limited per IP, size-capped, and it may only ever create — never read, never mutate an existing record |
| **Upload brokering** | Mint short-lived, single-use SharePoint upload URLs so file bytes never traverse a workflow payload |
| **Reference minting** | Server-side registry references, so two submitters cannot collide and a client cannot choose its own |

### 3.7 Role vocabulary — reconcile before activation

`config/rbac.config.js` defines `systemAdmin · userAdmin · executive · director · operator · viewer`, and `proxy/src/authorize.js:10` imports it. `ECM_ActivityHub_Portal/js/core/router.js:12-16` guards on `SystemAdmin · DGCEO · COS`. **Zero overlap.**

Target: **one vocabulary**, `config/rbac.config.js`, with the ActivityHub deriving `ROUTE_ROLES` from it. `DGCEO` and `COS` become *positions* mapped onto roles (`DGCEO → executive`, `COS → director`), not a parallel role system. Left as-is, activation silently locks three ActivityHub routes for every principal.

---

## 4. Target request path

```
External submitter                Internal operator
      │                                  │
      │ anonymous                        │ Entra ID token
      ▼                                  ▼
document-portal ─────────►  A U T H E N T I C A T I N G   P R O X Y  ◄───── root platform
                            • /intake/*  anonymous, create-only              ECM Activity Hub
                            • /{contract} token + RBAC required
                            • sole holder of every credential
                                         │
                        ┌────────────────┴────────────────┐
                        ▼                                 ▼
                 SharePoint                        Power Automate
              documents + lists                     orchestration
```

Compare with today, where all four clients hold signed URLs and reach Power Automate directly, and the proxy stands beside the path rather than on it.

---

## 5. Sequence

Each step is independently deployable and leaves the platform working.

| # | Step | Closes | Effort | Depends on |
|---|---|---|---|---|
| ~~**1**~~ | ~~Fix silent document loss~~ — **DONE**: every file dispatched, oversize queued and surfaced | **F-028** | — | — |
| ~~**2**~~ | ~~Replace the service catalogue~~ — **DONE**: `PF.CORRESPONDENCE_TYPES` maps 8 public types onto registry categories; per-service SLAs replaced by a 3-day acknowledgement target | §2.1 | — | — |
| ~~**3**~~ | ~~Build `/intake/*`~~ — **DONE**: `proxy/src/intake.js`, create-only, 5/min per address, server-minted references, 36 assertions | — | — | — |
| ~~**4**~~ | ~~Upload brokering~~ — **DONE**: signed single-use tickets, byte verification, relayed through the proxy. Departs from §3.3 deliberately — see `proxy/README.md` | F-028 fully | — | — |
| **5** | Point the portal at the proxy; delete `PF.ENDPOINTS` | **F-013**, **F-001** (portal) | ~2 days | steps 3–4 |
| **6** | Portal reads status back; retire `admin.html` and `PF.STAFF` | **D-C2**, F-010 | ~3 days | step 5 |
| **7** | Registry scan-intake workspace in the root platform | Channel C | ~1 week | step 4 |
| **8** | Reconcile role vocabulary; enable auth; restrict flows to proxy egress | **F-012**, **F-025** | ~1 week | steps 3–6 |
| ~~**9**~~ | ~~Retire `newack/`~~ — **DONE**: tree deleted, credential recorded in `ROTATION_REGISTER.md` first | **F-009** | — | — |

**Steps 1 and 2 are worth doing regardless of everything else** — step 1 stops losing citizens' documents today, and step 2 is the model correction you asked for. Neither depends on any infrastructure decision.

---

## 6. Open decisions — mine to recommend, yours to make

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | Correspondence category vocabulary for external submitters | (a) reuse root's `categories` reference data · (b) a simplified public-facing subset mapped to it | **(b)** — a submitter should not choose from an internal taxonomy, but every value must map to one |
| **D2** | `newack/` | (a) retire · (b) adopt and wire | **(a) retire** — orphaned, unowned, untested, and it holds a live credential. If acknowledgement is needed, the root platform already implements it |
| **D3** | Portal SLA display | (a) keep per-service SLAs · (b) show a registry acknowledgement target only | **(b)** — per-service SLAs belong to a service desk. A correspondence channel acknowledges receipt and reports status |
| **D4** | Anonymous or verified submission | (a) fully anonymous · (b) email verification before reference is issued | **(b)** — one round-trip stops trivial abuse of an unauthenticated create endpoint and gives the submitter a real receipt |
| **D5** | `ECM_DOCS_DEV.zip` | (a) keep and scan · (b) move out of the repository | **(b)** — it is 87% of repository bytes and holds 9 credentials found nowhere else. It is a reference archive, not source |

---

## 7. What this architecture deliberately does not change

- **The correspondence record model.** It was already right; it gains one `channel` value.
- **Attachment-by-link.** Already correct and matches the SharePoint provisioning package.
- **The proxy's authorization core.** Verified sound; intake is additive.
- **The root platform's module and route structure.** 25 routes, clean boundaries, ownership assertions that throw.
- **The ECM Activity Hub's layering.** `actions → services → Store → pages` is cleaner than the root platform's own.

The architecture is not a rewrite. **Most of it already exists and is correct.** What is missing is the connective tissue between the external channel and the record, and the enforcement point sitting beside the request path instead of on it.
