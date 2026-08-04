# Platform Consolidation Analysis — ECM Activity Hub vs the root platform

**Question:** the repository holds two internal applications. §1 of `TARGET_ARCHITECTURE.md`
says *"the root platform is the internal operations system and the single system of record."*
Nothing anywhere records whether `ECM_ActivityHub_Portal/` is kept, merged into the root, or
dropped. This closes that gap so the decision can be made on evidence.

**Method.** Same standard as `docs/forensic/dd2e909/`: every claim traces to a file read or a
command run, counts are measured rather than estimated, and where the repository cannot
answer something it is listed as a limitation rather than guessed. Every number below was
re-derived by script after drafting; four were wrong on the first pass and are corrected here
— contract keys (19, not 17), Activity Hub actions (39, not 40), its entity collections
(15, not 14), and root routes with no equivalent (8, not 13 — the first count double-counted
routes that appear as mapped in §2).

**Scope.** `ECM_ActivityHub_Portal/` (54 files) against the root platform (26 modules,
26 routes). The document portal is out of scope — its disposition is settled and executed.
So was `proxy/`, which has since been removed entirely; nothing in this analysis depends on it.

---

## 1. The decisive facts, before any capability comparison

Three structural facts settle more than the feature matrix does.

### 1.1 They are two systems, not two views of one — `CONFIRMED-PRESENT`

| | Root platform | ECM Activity Hub |
|---|---|---|
| Backend shape | **19 contract keys**, one signed Power Automate URL each (`config/endpoints.config.js`) | **39 action names**, all dispatched to **one** endpoint (`js/core/config.js` `ACTIONS`) |
| Transport | `core/data-client.js` → per-contract URL | `js/api/client.js` → `CONFIG.API_URL` + action name |
| State | 19 collections (`config/state-schema.config.js`) | 15 entity collections (`js/core/store.js`) |
| Identity | `core/auth.js` | `js/core/auth.js` — **a separate implementation** |
| Router | `core/router.js` | `js/core/router.js` — **a separate implementation** |

They share **no backend, no state, no identity model and no code**. Verified by negative
search: nothing under `ECM_ActivityHub_Portal/` imports from the root `core/`, `config/` or
`modules/` — every import resolves inside its own tree.

This is the single most important finding in this document. Two applications that share a
data model are two views of one system and can reasonably coexist. These do not.

### 1.2 The Activity Hub has no backend at all today — `CONFIRMED-PRESENT`

`js/core/config.js:21` — `API_URL: _override.API_URL || ""`.

Its backend was a personal Cloudflare Workers subdomain, removed under **F-023**. With
`API_URL` empty, `js/services/bootstrap.js:21-24` loads `js/data/demo.js` and raises
*"Running in demo mode (API not configured / unavailable)."*

So the Activity Hub is not currently a working second system whose data would need migrating.
It is a **working front end with nothing behind it**. That materially lowers the cost of every
disposition, and it is the reason this decision is cheap now and expensive later.

### 1.3 The role vocabularies are disjoint — `CONFIRMED-PRESENT` (F-025, open)

`config/rbac.config.js`: `systemAdmin · userAdmin · executive · director · operator · viewer`.
`ECM_ActivityHub_Portal/js/core/router.js:12-16`: `SystemAdmin · DGCEO · COS`.

**Zero overlap.** A principal authorised in one is unrecognised by the other. Keeping both
means step 8 must reconcile *two* role models against one identity provider, not one.

---

## 2. Capability matrix — all 19 pages

Every Activity Hub page against its nearest root equivalent. "Root route" names the module
that owns the same capability; `—` means the root has no equivalent.

| # | Activity Hub page | Root route | Overlap | Note |
|---|---|---|---|---|
| 1 | `dashboard` | `home` | **Full** | Both are attention-routing landings |
| 2 | `inbox` | `correspondence` | **Full** | Triage queue; root calls it intake-master |
| 3 | `inward` | `correspondence` | **Full** | `correspondenceType: 'Incoming'` in root's model |
| 4 | `outward` | `correspondence-email` + `dispatch` | **Full** | Root splits drafting from dispatch |
| 5 | `minutes` | `registry` | **Full** | Root's `registryMinutes` + minute/route action |
| 6 | `approvals` | `approvals` | **Full** | Same name, same concept |
| 7 | `tasks` | `orchestrator` + `single-assignment` | **Full** | Root's `operations` collection |
| 8 | `reports` | `reports` | **Full** | Root's is 18 lines here vs a full module there |
| 9 | `audit` | `settings` / `diagnostics` | **Full** | Root keeps `audit` in state, surfaced per module |
| 10 | `directory` | `user-admin` | **Full** | Root also has `departments` reference data |
| 11 | `notifications` | `fasttrack`, `orchestrator`, `acknowledgment` | **Full** | Root surfaces in context rather than as a page |
| 12 | `admin` | `settings` + `user-admin` | **Full** | |
| 13 | `ai` | `assistant` | **Full** | |
| 14 | `kpi` | `statistics` + `executive` | **Full** | |
| 15 | `decisions` | `executive` | **Partial** | Root frames these as "review exceptions" |
| 16 | `notfound` | router built-in | n/a | Not a capability |
| 17 | **`briefs`** | — | **NONE** | Executive briefing pack: create → submit → decide |
| 18 | **`meetings`** | — | **NONE** | Request → approve → convert minutes to tasks |
| 19 | **`projects`** | — | **NONE** | Project list and status update |

**Result: 15 of 19 pages fully overlap. 1 partially. 3 are genuinely unique.**

### 2.1 Confirming the three are genuinely unique

Negative search across `modules/`, `config/` and `core/`:

- **`briefs`** — `0` files mention it. No root concept whatsoever.
- **`meetings`** — 4 incidental mentions only: the document kind `'Meeting Request'`, an email
  template, a `MeetingPack` dynamic action, and one line in the ERP–ECM charter. **No meetings
  capability.**
- **`projects`** — 3 incidental mentions. **No projects capability.**

None of the three is a root state collection.

**Size of the unique surface:** `briefs` + `meetings` + `projects` pages *and* services total
**249 lines**.

### 2.2 What the root has that the Activity Hub does not

Two distinct things, kept separate because conflating them overstates the gap.

**Eight root routes have no Activity Hub equivalent at all** (18 of 26 are mapped in §2):

`ecm-erp-charter` · `response-tracking` · `bulk-assignment` · `scan-intake` ·
`comments` · `lookup` · `operator-hud` · `archive`

**Four more are only partially covered** — the Activity Hub page maps to one part of a root
route that does considerably more:

| Root route | Activity Hub covers | Root additionally owns |
|---|---|---|
| `registry` | `minutes` | File jacket, custody chain, movement, receipt, closure |
| `dispatch` | `outward` listing | Prepare, send/no-dispatch, capture receipt, close, hand off to archive |
| `fasttrack` | `notifications` | SLA ageing and escalation |
| `acknowledgment` | — (implicit in `inbox`) | Acknowledgement as a governed work state |

The root is substantially the larger system, and it owns everything the correspondence
lifecycle needs **after** triage — custody, dispatch, closure, archive. The Activity Hub
stops at triage and approval.

---

## 3. Data model comparison

| Root collection | Activity Hub equivalent |
|---|---|
| `correspondence` | `inward` + `outward` |
| `registryMinutes` | `minutes` |
| `approvals` | `approvals` |
| `operations` | `tasks` |
| `notifications` | `notifications` |
| `audit` | `audit` |
| `users` + `departments` | `directory` |
| `tracking` | `sla` |
| `activities` | `inbox` |
| `registryFiles`, `fileMovements`, `escalations`, `dispatches`, `correspondenceEmails`, `comments`, `categories`, `emails`, `pending` | **none** |
| **none** | `briefs`, `decisions`, `meetings`, `projects`, `kpi` |

The root model is a superset of the Activity Hub's on the correspondence lifecycle, and the
Activity Hub adds an executive layer the root does not model.

---

## 4. Cost of each disposition

### Option A — Keep both

| Cost | Detail |
|---|---|
| Two auth implementations | Step 8 must enable, test and operate `core/auth.js` **and** `ECM_ActivityHub_Portal/js/core/auth.js` |
| Two role models | F-025 stays open permanently; disjoint vocabularies against one IdP |
| Two backends at cutover | 19 Power Automate contracts **plus** a 39-action gateway that does not currently exist |
| Two records of the same correspondence | `inward`/`outward` and `correspondence` diverge with no reconciliation path |
| Contradicts §1 | "Single system of record" becomes untrue the moment the Activity Hub gets a backend |

**Cost is not one-off — it is recurring, and it grows.** Every future change to the
correspondence model must be made twice.

### Option B — Merge the three unique capabilities into the root, retire the shell

| Work | Detail |
|---|---|
| Port `briefs`, `meetings`, `projects` | ~249 lines of pages and services, onto the pattern established by `scan-intake` |
| Add 3 state collections | `briefs`, `meetings`, `projects` to `config/state-schema.config.js` |
| Add 3 routes + boundaries + RBAC | The governance scaffolding already exists and is enforced |
| Decide `decisions` | Either fold into `executive` or port as a fourth |
| Delete | 54 files: the duplicate auth/config/store/router, the 39-action contract, the Cloudflare Worker dependency |
| Removes | F-023 (already fixed), F-025 (role divergence), and one of the two auth surfaces step 8 must cover |

**Cheapest moment to do this is now,** because §1.2 — there is no live backend and no
production data to migrate.

### Option C — Drop it entirely

Cheapest in effort. Loses executive briefs, meetings and projects — three capabilities the
root does not have and that look deliberate rather than incidental (each has a full
create → submit → decide lifecycle, not just a list view).

---

## 5. Recommendation — accepted and implemented

> **OUTCOME.** Option B was chosen and executed. `briefs`, `meetings` and `projects` are now
> root modules over `core/executive-register.js`; `ECM_ActivityHub_Portal/` is deleted (53
> tracked files, plus one untracked local config recorded as **F-033**). F-023 and F-024 are
> closed by deletion and F-025 is halved. Three defects were fixed in the port rather than
> transcribed — see §5.1.

**Option B — merge the three unique capabilities into the root platform and retire the
Activity Hub shell.**

The reasoning, in order of weight:

1. **§1 is either true or it is not.** A second internal application with its own record of
   correspondence makes "single system of record" false. Either the architecture principle
   changes or the second system goes.
2. **The overlap is 15 of 19 pages.** This is not two complementary products; it is one
   product built twice, and the second one stops before the hard half — custody, dispatch,
   closure, archive.
3. **The unique surface is small and portable.** 249 lines against a root that already has
   the routing, governance, RBAC and audit scaffolding to receive it.
4. **There is nothing to migrate.** The Activity Hub has no backend today. This is the
   cheapest this decision will ever be.
5. **It removes work from step 8** rather than adding it: one auth implementation to enable,
   one role vocabulary to reconcile, one egress surface to restrict.

**What I would not claim.** Option C is defensible if briefs, meetings and projects are not
actually wanted — I have no evidence either way about whether they are used or merely built.
That is the one input this repository cannot supply, and it is the question worth asking
before committing to B over C.

### 5.1 What the port changed rather than copied

A straight transcription would have carried three defects across. Each is now covered by a
test in `tests/executive-register.test.mjs`.

| Defect in the Activity Hub | In the port |
|---|---|
| `decideBrief` rewrote status from **any** state, so a rejected brief could be re-decided and a draft approved without ever being submitted | Transitions are guarded; an illegal one is refused |
| `updateProject` spread an arbitrary patch onto the record (`{...p, ...patch}`), so a caller could overwrite `id` or invent fields | Allow-listed patch of four fields |
| `minutesToTasks` was a remote call only — with no backend it told the user to create tasks by hand | Conversion happens locally and produces real `operations` records linked back to the meeting |

Also changed: the Activity Hub reported success whether or not the call succeeded, recording
the failure on the record as `_local` while still toasting "saved". The ported modules follow
this platform's convention — local state is authoritative, and a failed sync says so.

---

## 6. Limitations

| # | Limitation |
|---|---|
| L1 | I assessed **capability**, not **quality of fit to NITDA's process**. Whether the Activity Hub's briefs/meetings model matches how the DG's office actually works is not knowable from source. |
| L2 | Its 40-action gateway contract is not in this repository — only the action *names*. If a Power Automate or Worker implementation exists elsewhere, its cost is not counted here. |
| L3 | Usage data does not exist. "Unique capability" means unique in code, not proven valuable. |
| L4 | `Q-15` from the forensic addendum is still open: whether the receiving flow reads the nested `payload` object. Unchanged by this analysis. |
| L5 | "Full overlap" in §2 means *the same capability exists on both sides*, not that the two implementations are equivalent in depth. Where the root is materially deeper the difference is called out in §2.2 rather than hidden inside a Full. |

---

## 7. Related unresolved dispositions

Found while establishing scope; recorded so they are not lost.

| Item | State |
|---|---|
| **D4** — email verification before a reference is issued | Recommended in `TARGET_ARCHITECTURE.md` §6, **never executed**. Intake is fully anonymous. |
| **D5** — move `ECM_DOCS_DEV.zip` out of the repository | Recommended, **never executed**. Still present at 16.7 MB, and it holds the 9 signatures found nowhere else. |
| `universal_filename_policy_deliverables/` | 6 documents (SOP, memo, handbook, `.docx`). Unrelated to the platform. **No disposition has ever been considered.** |
