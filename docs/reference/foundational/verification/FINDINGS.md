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

**This is the item to escalate.** It is invisible in the matrix precisely because sentinel
contamination made every field look 100% present.

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
