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
| **C** | **Scan / physical** | Registry counter | ✅ **step 7** | `modules/scan-intake.js` → `PUT /documents/scan` → document library → record with `channel: 'Registry'` and the link attached |
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

The staff console (`admin.html`) has no place in an external portal. Triage, decisions and audit belong in the internal platform, where they are already implemented and where identity is enforced. **`admin.html` is retired, not fixed** — that also closes the hardcoded-credentials problem by deleting its reason to exist. Recorded as **F-029**, which the original 29 findings missed: the audit caught the service-worker consequence of the console (F-020) but never the three credentials themselves.

**Implemented at step 6.** `admin.html`, `js/admin.js` and `js/admin-panels.js` are deleted; `PF.STAFF` and `PF.store.admin` are gone; every nav link, the command-palette entry, the `robots.txt` disallow and the service-worker precache entries went with them. `PF.intake.status()` reads a request back through `POST /intake/status`, and the tracking page states which source it is showing — a device-store fallback is labelled rather than passed off as the registry's answer.

Two things are deliberately **not** done at step 6 and remain open:

- **Citizen write-back.** Respond, add-a-note and withdraw still write only to `localStorage`. Rather than leave buttons that render "Response sent" for something never sent, they are offered only on a device-sourced record; a registry-sourced record routes the submitter to the helpdesk, which *is* delivered. A write-back route is a later step.
- **Reference entropy.** See §3.8.

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

**The status contract** (step 6). The pair is the credential; there is no token and no session.

```jsonc
// POST {proxyBaseUrl}/intake/status           — anonymous, rate-limited 10/min per source
{ "referenceId": "NITDA-2026-004182", "email": "sender@example.org" }

// 200 OK — the ONLY fields that ever leave the proxy
{
  "ok": true,
  "record": {
    "referenceId": "…", "status": "review", "statusLabel": "Under review",
    "category": "General Correspondence", "subject": "…",
    "receivedAt": "…", "acknowledgedAt": "…", "updatedAt": "…", "closedAt": "",
    "actionRequired": false,
    "timeline": [ { "at": "…", "status": "received", "label": "…", "note": "" } ]
  }
}

// 404 — unknown reference AND wrong email, byte-identical in both cases
{ "ok": false, "error": "not_found" }
// 503 — no read-back configured. NOT a 404: this proxy has nowhere to ask, which is not
//       a statement that the submission does not exist.
{ "ok": false, "error": "status_not_available" }
```

**POST, not GET** — the email must not land in an access log, a `Referer` header or browser history. **The projection is an allow-list**, so a field the registry adds later cannot leak by omission from a blocklist. A timeline `note` is carried only when the upstream marks the entry `public: true`; internal deliberation shares that timeline in most case systems and the default for anything unmarked must be to withhold it. The proxy **re-checks the email itself** rather than trusting the upstream to have honoured the parameter. See §3.8 for what this design does not solve.

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

### 3.8 What the status route does not solve

The lookup pair is `referenceId` + `senderEmail`. References are sequential (`NITDA-<year>-<seq>`), so the reference is guessable and **the email is the only real secret** — one that submitters routinely publish. Three controls narrow the exposure and none of them fixes that:

| Control | What it buys |
|---|---|
| Uniform denial | Unknown reference and wrong email return byte-identical responses, so the route is not an oracle for "does this reference exist?" |
| Allow-listed projection | A successful guess yields status and dates. The description, attachments, assigned officer and handling unit are never in the response. |
| Dedicated rate limit | 10/min per source, separate from the submission budget, which is what makes online guessing impractical. |

The durable fix is a **high-entropy lookup token** minted at submission and sent in the acknowledgement email, used in place of — or alongside — the reference. That is owner-side work, recorded as **F-030** rather than assumed away.

### 3.9 Channel C — registry counter deposit

A document arrives physically. A clerk scans it, and before step 7 that was where the trail
stopped: the platform could record that a document existed but had nowhere to put it, so the
record and the paper lived in different places.

```jsonc
// PUT {proxyBaseUrl}/documents/scan   — AUTHENTICATED. Bearer token, ROUTE_MANAGE required.
// Headers carry the metadata; the body is the raw file.
//   X-DGO-Filename, X-DGO-Sha256, X-DGO-Size, X-DGO-Reference (optional)

// 201 Created
{
  "ok": true,
  "referenceId": "NITDA-2026-000318",       // minted server-side
  "attachmentLink": "https://…/library/…",
  "stored": true,
  "depositedBy": "clerk@nitda.gov.ng",      // from the VERIFIED TOKEN, never the request
  "sha256": "…", "bytes": 240112
}
```

**It is deliberately not in the `/intake/` namespace.** That namespace is documented as the
anonymous one. A staff route inside it would make the trust boundary something you learn by
reading code rather than by reading a path.

**There is no ticket.** A ticket exists so an *anonymous* caller can be granted exactly one
narrow thing. An authenticated clerk has already presented a verified token and passed a role
check; re-issuing them a ticket would add a round trip and no security, and the token carries
an identity a ticket never could. What the two paths must **not** differ on is what happens
to the bytes — same ceiling, same declared-size check, same digest check — so both call
`verifyBytes` and `relayToLibrary`.

**Two rules the workspace is built around:**

1. **No record without a deposit.** If the bytes did not reach the library, no correspondence
   record is created. `ok: true` means the proxy verified the bytes; `stored: true` means the
   library confirmed the write; only both together justify a record. A registry record
   pointing at an unfiled document is a broken custody record — F-028's silent loss wearing
   an internal badge. Failed deposits stay in the tray, visible, retryable, and explained.
2. **Custody is attributed by the server.** `depositedBy` comes from the token. A
   client-asserted depositor is not a custody record.

The record gains no new field for this channel — only `channel: 'Registry'`, plus the custody
facts (`depositedBy`, `depositedAt`, `documentSha256`). The digest is what lets a record be
checked against the library later.

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
| ~~**5**~~ | ~~Point the portal at the proxy~~ — **DONE**: `PF.ENDPOINTS` deleted, `PF.flow` replaced by `PF.intake`, portal holds no credential | **F-013**, **F-001** (portal) | — | — |
| ~~**6**~~ | ~~Portal reads status back; retire `admin.html` and `PF.STAFF`~~ — **DONE**: `/intake/status` with uniform denial and an allow-listed projection; console deleted with its three hardcoded credentials; three step-2 render defects fixed along the way | **D-C2**, **F-029**, F-010, F-020 | — | — |
| ~~**7**~~ | ~~Registry scan-intake workspace~~ — **DONE**: authenticated `PUT /documents/scan`, server-attributed custody, and no correspondence record unless the document actually reached the library | Channel C | — | — |
| **8** | Reconcile role vocabulary; enable auth; restrict flows to proxy egress | **F-012**, **F-025** | ~1 week | steps 3–6 |
| **10** | High-entropy lookup token issued at submission, replacing the guessable reference as the status credential | **F-030** | ~2 days | step 6 |
| ~~**12**~~ | ~~One reference minter, one reference format~~ — **DONE**: `core/reference-minter.js`; the browser no longer mints a colliding six-digit timestamp | **F-031** | — | — |
| ~~**13**~~ | ~~Separate document kind from routing domain~~ — **DONE**: unmatched categories no longer default to the executive queue at urgent priority | **F-032** | — | — |
| **14** | Confirm the provisional document-kind → routing-domain mapping against registry reference data | **F-032** (owner half) | owner-side | — |
| ~~**9**~~ | ~~Retire `newack/`~~ — **DONE**: tree deleted, credential recorded in `ROTATION_REGISTER.md` first | **F-009** | — | — |
| **11** | **Cutover** — decommission all 25 development/pilot workflows, provision replacements behind proxy egress only | **F-001** | owner-side | steps 8, 10 |

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
