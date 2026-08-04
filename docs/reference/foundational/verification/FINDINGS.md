# Verification of the Power Automate Data Structure Matrix

**Every relationship and data-quality claim in the matrix, re-tested independently against
the payload the matrix was itself built from.** Run 2026-08-04. Scripts in this directory
reproduce every number below.

The matrix was about to drive the design of the platform's convergence layer. It should not
have. **Its central method is unsound, and its headline relationship verdict is wrong.**

---

## 0 · Provenance of the evidence

The canonical payload is `flows/definitions/Copy of - Fetch_All_Data_&_References_Matrix-POST__…CU95__flow_run_record.json`
(23 MB), at JSON path `.response_record.body_sent.data`. It carries all seven datasets in
one export and matches the matrix's own record/field census exactly on six of seven — which
identifies it as the matrix's source beyond reasonable doubt.

| dataset | matrix | measured | |
|---|---|---|---|
| taskComments | 2 rec / 6 fld | 2 / 6 | confirmed |
| docs | 300 / 12 | 300 / 12 | confirmed |
| tasks | 300 / 20 | 300 / 20 | confirmed |
| categories | 45 / 14 | 45 / 14 | confirmed |
| departments | 50 / 7 | 50 / 7 | confirmed |
| emails | 50 / 18 | 50 / 18 | confirmed |
| **users** | **794 / 4** | **785 / 4** | **9 records unaccounted** |

Wider tests pool **500 distinct tasks** and **741 distinct document IDs** across all 10 task
exports and 7 docs exports in the corpus.

---

## 1 · The method flaw — sentinel contamination

**The flows coalesce nulls into human-readable placeholders.** The select mapping is
`@coalesce(item()?['RefIDD'], 'No RefIDD')`, and the same pattern applies across the task
projection. Every field therefore arrives as a non-empty string whether or not it holds
data.

Any census that measures "non-empty" is measuring the placeholder. In the matrix's own
source payload:

| field | records | non-blank | **genuinely populated** | placeholder |
|---|---|---|---|---|
| `tasks.RefIDD` | 300 | 300 | **0** | `'No RefIDD'` |
| `tasks.Reference_ID` | 300 | 300 | **0** | `'No Reference ID'` |
| `tasks.AssignedTo` | 300 | 300 | **0** | `'Unassigned'` |
| `tasks.Priority` | 300 | 300 | **0** | `'----'` |
| `tasks.DueDate` | 300 | 300 | **0** | `'No Due Date'` |
| `docs.AssignedTo` | 300 | 300 | **70** | `'N/A'` |

Six of the matrix's fourteen data-quality rows are wrong for exactly this reason — they
report the non-blank count where the real population is lower (`docs.Category`,
`docs.Status`, `docs.RoutedToDSU`, `docs.CC'dTo` each claim 108 where **66** is real;
`docs.Assigned` claims 35 where **25** is real). The eight rows describing genuinely empty
columns are **confirmed** (`tasks.CoAssigneeDSU` 0, `tasks.DSULookUp` 0,
`departments.DSU_Email` 0, `emails.bccRecipients` 0, `users.department` 70,
`users.jobTitle` 47, `categories.INFORMDSU3` 4, `categories.Default Supporting Dept` 12).

---

## 2 · The headline verdict is wrong

> **Matrix:** `tasks.Reference_ID → docs.ID` and `tasks.RefIDD → docs.ID` — *Low confidence,
> 0/300 non-empty values match.* Recommended action: standardise as a `Task.DocumentID`
> foreign key.

**REFUTED.** The 0/300 is arithmetically true and analytically empty: in that export,
**all 300 tasks carry placeholders in both fields**. The matrix measured the absence of
data and reported it as the absence of a relationship.

Tested across the whole corpus, the relationship is real and carried three ways:

| carrier | form | populated where present |
|---|---|---|
| `tasks.RefIDD` | `"20361"` — the parent document ID as a string | 558/720 resolve to a known document |
| `tasks.Reference_ID` | `"20260123-18106-GOV-REA-14143"` — composite `{date}-{docID}-{classCode}-{taskID}` | 215/242 resolve |
| `tasks.Title` prefix | `"20361 -2026-06-11 -SENDER (SUBJECT).PDF"` | present on 99% of all tasks |

**Where both are populated, `Title` prefix and `RefIDD` agree 300/300 with zero conflicts.**
In the one export where docs and tasks were captured together with data intact, the match is
**100%**. `Reference_ID` is not a broken foreign key — it is a self-describing composite
business key that already encodes document, date, classification and task.

The residual mismatches are snapshot-boundary artefacts: task exports reference documents
newer than the docs export's ceiling. Zero genuinely-absent links were found within any
comparable range.

**Consequence: there is no linkage repair project.** The adapter needs a typing rule
(`RefIDD` is a string, `docs.ID` an integer — `'18106' == 18106` is false, which is the
whole of the matrix's zero) and a parser for the composite key. Hours, not weeks.

---

## 3 · The finding that actually matters — two task cohorts

Profiling every field across 500 pooled tasks separates them cleanly into two populations:

| field | linked cohort (300) | **shell cohort (200)** |
|---|---|---|
| ID, Created, Progress, Title | 100% | 100% |
| Classification | 100% | 99% |
| **AssignedTo** | 100% | **0%** |
| **Assigned** | 59% | **0%** |
| **Description** | 100% | **0%** |
| **DueDate** | 98% | **0%** |
| **StartDate** | 99% | **0%** |
| **Priority** | 98% | **0%** |
| **GDSUROUT** (routing) | 97% | **0%** |
| **RefIDD** | 100% | **0%** |
| **Reference_ID** | 67% | **0%** |

**200 task records exist carrying only an ID, a timestamp, a classification, a progress
value and a title — no assignee, no dates, no priority, no routing, no document linkage.**

This is not a schema question. It is either a population failure in the creating pipeline or
a distinct record type that no documentation in the corpus describes. By creation month:
2026-01 is 100% populated, **2026-05 is 0%**, 2026-06 recovers to 74% on `RefIDD` but only
3% on `Reference_ID` — which never recovers.

### Precisely which 200 — and a fingerprint that identifies the writer

Register: **`verification/shell-tasks.csv`** — 200 rows, checkable against the live list.

| | |
|---|---|
| Task IDs | **15127 – 15326 — a contiguous, unbroken block** |
| Created | 2026-05-11T15:33:26Z – 2026-06-03T13:25:52Z |
| Appears in | one export only: the `…CU95` Fetch_All run record |
| Interleaved with | the fully-populated cohort (IDs 13902–15426), so not a separate list |
| Carry | valid `Title` with document ID, valid `Classification` (198/200) |
| Lack | assignee, both date fields, priority, routing, and both linkage fields |

**The decisive evidence is a capitalisation difference.** `Progress` reads:

| cohort | value | n |
|---|---|---|
| shell | `'Not Started'` — capital S | 200 |
| every other task | `'Not started'` — lower-case s | 300 |

Two different writers. A pipeline that stopped populating fields would keep writing the same
string; a **different creating process** produces a different literal. Combined with the
unbroken ID block and the three-week window, this reads as a **bulk creation by a distinct
route** — an import, a migration, or a second application — that writes only title,
classification and progress, leaving assignment to be done later.

That reframes it: most likely **not corruption but an unassigned backlog created in bulk**,
and every one of them is `Not Started`, which is consistent. It still needs confirming by
whoever knows what ran between 11 May and 3 June 2026 — but it should not be escalated as
data loss without that answer.

**Correction to §5 of this report.** The earlier "0/198 resolve" is now explained: these
tasks point at documents **18987–20174**, a band the corpus's docs exports barely cover
(50 documents across a 1,187-wide range). The non-resolution is a sampling gap, not evidence
of orphaned tasks. That line in the Limits section is superseded by this paragraph.

---

## 4 · Remaining claims

| claim | matrix | measured | verdict |
|---|---|---|---|
| `docs.Category → categories.Category` | High, 108/108 | **66/66 = 100%** | relationship confirmed; denominator wrong |
| `tasks.Classification → categories.Category` | Medium, 299/300 | **298/298 = 100%** | confirmed; **should be High, not Medium** |
| `categories.DSU_KEY → departments.DSU_KEY` | Medium, 3/44 | **2/42 = 4%** | genuinely weak — confirmed as a real gap |
| `docs.AssignedTo → users` | High, 105/108 | 69/70 = 98% | confirmed |
| `docs.CC'dTo → users` | High, 212/213 | **137/137 = 100%** | confirmed (multi-value, `;`-delimited) |
| `docs.Assigned → users` | High, 32/35 | **18/25 = 72%** | weaker than claimed |
| `departments.DSU_HeadEmail → users` | High, 42/48 | 42/48 = 87% | confirmed |
| `emails.fromAddress → users` | High, 44/50 | 44/50 = 88% | confirmed |

`categories.DSU_KEY → departments.DSU_KEY` at 4% is the one relationship the matrix flagged
as weak that **is** genuinely weak. It needs a mapping decision, not an adapter.

---

## 5 · Limits of this verification — stated, not hidden

- The **users census gap** (785 measured vs 794 claimed) is unexplained. Nine records.
- The docs universe is **741 distinct IDs across a 2,773-wide range** — sparse and gapped
  (the 18500–18999 band is entirely absent). Percentages against it understate.
- Consequently, whether the **shell cohort's** title-prefixed document IDs point at real
  documents **could not be settled**: they resolve 0/198, but they concentrate in ranges
  where docs coverage is thinnest. This must be checked against the live list before
  anyone concludes those tasks are orphaned.
- All of this rests on **exported samples**, not the live lists. Every conclusion is a
  statement about the corpus.

---

## 6 · What this changes

1. **Do not use the matrix's confidence column as a design input.** Use the mapping
   blueprint's field pairs — those are sound — with the evidence re-derived here.
2. **Sentinel-stripping is the first duty of the normalising layer,** ahead of every other
   transformation. A platform that treats `'No RefIDD'`, `'Unassigned'`, `'----'` and
   `'N/A'` as values will show a fully-populated register that is substantially empty, and
   will do so convincingly.
3. **Document linkage resolves from `Title` prefix as primary** (99% present, 300/300
   agreement with `RefIDD` where both exist), corroborated by `RefIDD` and the parsed
   `Reference_ID`. Never from `Reference_ID` alone — it is 3% populated in recent records.
4. **Escalate the 200 shell tasks** to whoever owns the task-creation pipeline.

---

# Part II — Sheets 02 (Field Matrix) and 07 (JSON Paths)

The two sheets the adapters consume directly. Re-run: `verification/sheets_02_07.py`.

**These are in far better shape than sheets 03 and 06** — the structural facts are sound.
The same sentinel flaw corrupts one column of sheet 02, and there are two encoding traps.

## Sheet 02 — Field Matrix (82 rows)

| column | confirmed | differs |
|---|---|---|
| Observed JSON type | **79** | **0** |
| Present count | 75 | 4 |
| Non-empty count | 48 | **31** |

**Types are perfect — 79/79.** Use this column with confidence; it is the most reliable
thing in the whole workbook.

**Non-empty is corrupted by sentinels in 23 rows**, and the damage is not merely a count:
the *recommended SharePoint column type* was inferred from placeholder-bearing values.

| field | claimed non-empty | real | recommended column type | hazard |
|---|---|---|---|---|
| `tasks.RefIDD` | 300 | **0** | Single line of text | it is a **numeric document ID** — typing it as text is what makes the join fail |
| `tasks.Reference_ID` | 300 | **0** | Single line of text | composite key; needs parsing, not free text |
| `tasks.Priority` | 300 | **0** | Choice / Lookup | **no real values exist to derive the choice set from** |
| `tasks.DueDate` / `StartDate` | 300 | **0** | Date and time | correct by inference from the name, not from data |
| `tasks.AssignedTo` / `Assigned` / `AssignedToDSU` / `EditorEmail` / `AuthorTitle` | 300 | **0** | Person or Group | no addresses present to validate against |
| `docs.AssignedTo` | 300 | **70** | Person or Group | 230 are `'N/A'` |
| **all three `taskComments` text fields** | 2 | **0** | various | the entire 2-record dataset is placeholders — the **TaskComment target entity rests on no data at all** |

## Sheet 07 — JSON Paths (130 rows)

| result | count |
|---|---|
| resolve with the claimed occurrence count | **122** |
| resolve with a different count | 5 |
| do not resolve | 2 |

**Correction to this report's own method.** The first run of the harness tested against a
reconstructed root `{ok, data}` and reported 22 envelope paths as unresolvable. That was the
harness's fault, not the sheet's. Against the genuine `body_sent` they all resolve. The
script now loads the real envelope; the numbers above are the corrected ones.

That correction surfaced something architecturally important — **there is a versioned
response contract**:

```
ok · status{http,code,message} · request{requestId,trackingId,action,operation,mode,
requestedBy,source} · timing{receivedAtUtc,completedAtUtc,durationMs} · data{…} ·
errors[] · meta{ts,runId,flowName,contractVersion}
```

with `meta.contractVersion = "2026-03-23.5"` and `request.source = "DGO_FAST_Track_WEB_OPS"`.
The platform's `core/contracts.js` should be validated against this envelope, and
`contractVersion` gives a real compatibility handle.

### The two genuine failures — SharePoint internal-name encoding

| sheet says | payload actually has |
|---|---|
| `$.data.docs[].CC'dTo` | `CC_x0027_dTo` |
| `$.data.tasks[].3rdAssigned` | `_x0033_rdAssigned` |

SharePoint encodes apostrophes and leading digits into internal names. The sheet used
display names throughout. **Any adapter written from these paths silently returns nothing
for those two fields** — and `CC'dTo` is one of the strongest person joins in the data
(137/137). A decoder for `_x00XX_` sequences belongs in the normalising layer.

### The users discrepancy, now settled

Five paths claim 794 users; the payload holds **785**. The literal `794` appears **nowhere**
in the source file. The matrix's user count therefore did not come from this export — it is
from another capture. Not reconcilable from the corpus; verify against the live directory.

## Net position on the workbook

| sheet | verdict |
|---|---|
| 01 Dataset Matrix | Sound except the users count |
| 02 Field Matrix — types | **Sound. 79/79. Use it.** |
| 02 Field Matrix — non-empty & recommended types | **Corrupted for 23 fields by sentinels** |
| 03 Relationships | **Headline verdict refuted**; confidence column unusable |
| 04 Target Model | Structurally reasonable; `TaskComment` rests on zero real data |
| 05 Mapping Blueprint | **Field pairs sound** — the workbook's most usable output |
| 06 Data Quality | 8 of 14 confirmed; 6 wrong via sentinels |
| 07 JSON Paths | **122/130 sound**; two encoding traps; users count unexplained |

---

# Module parity — what the consolidation carried across

`parity.py` reconciles the capability surface of the 20 source SPAs against the 29 modules
declared in `config/module-boundaries.config.js`. A SPA's surface is read from what it
**binds** — `data-action` attributes, named handler functions, `onclick` targets — rather
than from its prose, because a heading is a claim and a binding is a fact.

## Read the gaps, not the percentage

The script reports 65 of 181 capability strings matched. **That number should not be
quoted.** Function names in these SPAs are mostly internal wiring — `updateBreadcrumb`,
`saveStateDebounced`, `attachEventListeners` — so the denominator measures the harvester's
vocabulary, not the platform's completeness. 51 further strings were widget-level and
excluded before matching; of the 116 unmatched, hand review found 88 to be helpers.

What survives review is nine capabilities the source SPAs bind and no module declares.

| gap | bindings | SPAs | why it matters |
|---|---|---|---|
| Category cascade | 5 | 3 | Choosing a category populates sub-category and downstream defaults. It drives the same taxonomy the AI classifier writes into, so a divergence here desynchronises human and AI intake — directly load-bearing for D2. |
| People picker (co-assignee / CC) | 7 | 3 | Type-ahead directory filtering with multi-select CC. The assignment modules declare assignment but not the recipient-selection surface that makes it usable; 66 documents in the live payload carry CC addresses. |
| Report generation per list family | 3 | 2 | Separate builders bound to the operational families. `reports` owns `print` and declares no generation surface. |
| Flow-graph authoring | 6 | 2 | The Orchestrator SPA edits the routing graph — nodes, edges, import, dispatch. `orchestrator` declares runtime verbs only. **Scope decision:** authoring in-platform, or left in Power Automate. |
| Cross-navigation document → assignment | 3 | 3 | Jumping from a document or email into its assignment carrying context. A contract *between* modules — exactly what a per-module ownership list omits and users notice at once. |
| Reassignment | 1 | 1 | Changing an existing assignment. Both assignment modules declare creation only. |
| DG marking | 1 | 1 | `executive` declares approve/escalate/return/clarify, not marking. |
| Meeting agenda construction | 1 | 1 | `meetings` declares request/decide, not agenda assembly. |
| Client telemetry | 1 | 2 | The two largest SPAs instrument themselves. `diagnostics` covers service health, not client instrumentation. |

The classification lives in `GAPS` in `parity.py`, and the script asserts every string in it
is still unmatched — so if a module later declares one, the run fails loudly rather than
leaving a stale gap in this table.

## The reverse direction is not evidence

`parity.py` also lists module capabilities with no detected SPA binding. It is bounded, not
answered: `archive hash` and `closure check` would never surface as a SPA function name
however faithfully implemented. Absence there is weak evidence of new ground. Full data in
`parity.json`.

## Consequence for the approved decisions

Two gaps sit on the critical path and are not cosmetic. **Category cascade** is shared
ground between the human and AI spines — D2 puts them at par, which is only true if both
write the same taxonomy the same way. **Cross-navigation** is a contract between modules
rather than a capability inside one, so no amount of per-module completeness produces it;
it has to be designed at the boundary. The other seven are additive and can be scheduled.
