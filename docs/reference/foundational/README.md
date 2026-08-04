# Foundational Reference — the on-ground platform of record

The curated corpus of the systems that gave birth to this platform: the deployed
Power Automate flow estate, the live SharePoint data estate, the source SPAs, the
Canvas application, and the runtime lineage. Uploaded 2026-08-04, studied and
organised the same day. This is **reference material of record** — it documents
what runs, not what was planned.

The corpus was originally assembled under a Phase A/B/C fidelity programme
(SHA-256-verified, coverage- and authority-matrixed); see
`flows/EXECUTION_RUNBOOK_phaseC_flow_fidelity_reconciliation.txt`.

---

## Layout

| Folder | Contents |
|---|---|
| `flows/` | The Power Automate estate: the deduplicated 12-flow canonical specification, full definitions with trigger schemas and run records, the E01–E16 Control Deck details, response samples, the R5 extraction matrix (18 endpoint keys · 39 action-routing · 50 action-ownership records), the portal submission flow, and the Gemini direct-assign build. |
| `flows/definitions/` | Full JSON definitions + trigger schemas + run records per flow (Fetch_Emails, Fetch_Tasks ×2, Fetch_References, Create Task, Bulk Create, Dynamic Multi-Actions, OTP Generate/Verify). |
| `flows/run-records/` | Captured run records, including **DGSO INCOMING AI PROCESSING** — the 100-action, 1-minute-recurrence pipeline (Gemini text extraction → structured classification → DDOPS registration → rename → deep link → notification), captured live 2026-08-04 15:55 UTC, "Lists Validated". |
| `lists-and-data/` | The SharePoint estate: operational list schemas (DGOOPS 112 cols · GEC 200 · GTQ 136 · Task Comments · Categories Matrix · DSU_Matrix), the 10-list `DGO_*` governance provisioning documentation (97 fields, 18-step Excel-driven flow), the SP audit-flow guides, and the **Power Automate Data Structure Matrix** — dataset census, evidence-ranked relationships, 10-entity target model, 82-row mapping blueprint, and field-level data-quality flags. |
| `spas/` | The 20 source single-page applications the platform's 29 modules consolidate, plus the DGCEO Correspondence & Decision Hub and the SPA manifest schema. |
| `canvas/` | The Power Apps Canvas application: screen definitions (Power Fx) and its endpoint bindings. |
| `lineage/` | Runtime ancestry: R11.1.3 Content-Governance and Viewport-Compliant runtimes (SHA-summed), Obsidian Pro v7, the Obsidian consolidated design-system reference, and the R11.6 canvas-parity implementation. |

Curation notes: one of two byte-identical R11.1 copies kept; `desktop.ini` and
`.js.map` litter dropped; the image-only Implementation Plan PDF removed on
instruction (no text layer; superseded by the decision register below).

---

## What the study established

### The flow estate

Twelve deduplicated HTTP flows form the canonical estate (see
`flows/powerautomate_flows_deduplicated.docx` for IDs), plus the OTP pair, the
portal submission flow, Email-Task-Created, and two AI flows (incoming-document
processing; email-to-task summary). Every workflow ID referenced by the 20 SPAs
resolves into this estate. Four flows — Get Tasks, Get Emails, Get Docs, Dynamic
Multi-Actions — serve 11 of the 20 SPAs each and are the load-bearing spine.
The runtime's 19 endpoint contract keys are the same estate under stable names
(`flows/DGO_R11_6_R5_Full_Flow_Extraction_Matrix 2.xlsx`, sheet Endpoint_URLs).

### The intake reality

Documents converge as **library drops**: watched libraries (`NITDA DOCUMENT
ROUTING LIBRARY`, `E-DOCUMENT STATION`, `ALL EMAIL BACKUPS`, …) feed the
1-minute AI poller, which extracts, classifies (type · date · sender · recipient
· subject · summary · 2–5 key points; nulls for unknowns, fabrication forbidden),
registers in DDOPS, renames, deep-links and notifies — with error states written
back at every stage. The executive surface (`spas/DGCEO Correspondence &
Decision Hub.html`) shows the standing human-in-the-loop pattern: AI
classification is a **preview** a person applies, beside fully manual routing
and decision controls.

### The data estate

Two list families on `NITDADGO-EAAACTIVITYTRACKING`: the **operational** family
the live flows read and write (DGOOPS, GEC, GTQ, Task Comments, Categories
Matrix, DSU_Matrix — plus Office 365 users and Outlook messages as external
datasets), and the **governance** family (10 `DGO_*` lists) provisioned
additively by the Excel-driven flow. The Data Structure Matrix carries the
evidence-based bridge between them.

### Findings that drive the work

| # | Finding | Consequence |
|---|---|---|
| F1 | `tasks.Reference_ID → docs.ID` matches **0/300** live values | Task↔document linkage must be repaired in the convergence layer (`Task.DocumentID` standardisation per the blueprint) |
| F2 | Relationship confidence is quantified per join (categories 108/108; people 90–99%; category→department 3/44) | The unifier/adapter worklist is evidence-ranked, not guessed |
| F3 | 23 fields carry specific quality flags (0-populated columns, person-as-text, nested JSON) | Normaliser specs are field-level and already written |
| F4 | Live references are issued **unpadded** (`NITDA-2026-217`) | The platform's minter conforms to the register (decision D1) |
| F5 | Provisioning and its **verification** are both flow-automated (18-step provisioner; Copilot-buildable audit flows) | Audit reports are first-class platform inputs |
| F6 | Every flow trigger accepts client-asserted `userEmail` | The runtime's identity posture mirrors the deployed contracts |

---

## Decision register (as approved, with amendments)

| # | Decision | Ruling |
|---|---|---|
| D1 | Reference format | **Adopt live unpadded `NITDA-YYYY-N`.** |
| D2 | AI and human triage | **At par — dual spine.** Neither drowns the other; AI is always human-in-the-loop (the "apply suggestions" pattern), and AI unavailability must never cripple any process. |
| D3 | Data estate | **Staged (C)** — operational lists remain the system of record; the Mapping Blueprint becomes the platform's mapping layer with well-crafted relationships, interoperability, unifiers, normalisers and adapters; `DGO_*` lists provision additively; migration deferred as its own decision. |
| D4 | Entry-point feeds | **Each entry point keeps its own dedicated first-line feed** (portal · email · scan/library · internal), converging afterwards through the unifiers/normalisers/adapters and any further processing decided. |
| D5 | This corpus | Curated here, on `main`. |
| D6 | Work landing | `main` (the no-proxy line), mirrored to `platform/with-proxy` at sync points. |

---

## Reading order for a newcomer

1. `flows/powerautomate_flows_deduplicated.docx` — the estate in one document
2. `lists-and-data/Power_Automate_Data_Structure_Matrix.xlsx` — the data truth
3. `flows/run-records/` (DGSO INCOMING AI PROCESSING) — the intake spine
4. `spas/DGCEO Correspondence & Decision Hub.html` — the human-in-loop pattern
5. `lists-and-data/DGO_POWER_AUTOMATE_PROVISIONING_FULL_VISUALIZATION.html` — provisioning
6. `spas/` at large — the feature surface the 29 modules must honour
