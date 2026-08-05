# Parity verdict — `ECM_platform_frontend_review_1` against `claude/platform-commissioning-live-5vnn9n`

Assessed 5 August 2026. Target of comparison: `origin/claude/platform-commissioning-live-5vnn9n`
at `8613358`. Attachment: `ECM_platform_frontend_review_1.zip`, 79 files, 2.6 MB.

## Verdict

**No. The attachment is not at par with the platform on that branch, and it does not claim to
be.** It is a design review plus a redesign prototype, not a build of the platform. Judged as a
representation of the platform it reaches roughly a third of it. Judged as a review *of* the
platform — which is what it is — it is right about 13 of its 18 findings and wrong or overstated
on 5.

Three separate things are in the zip and they score differently:

| Artefact | What it is | Parity |
| --- | --- | --- |
| `uploads/document-portal/` (33 files) | Verbatim copy of the branch's `document-portal/` | **Exact.** `diff -rq` reports zero differing files |
| `Document Portal — NITDA Intelligent Portal.dc.html` | Redesign prototype of the public portal | 4 of 4 pages present; no data layer |
| `Root Platform — DGO Digital Operations.dc.html` | Redesign prototype of the internal runtime | **9 of 29 screens**, ~11 of 61 actions |
| `Frontend Review — DGO Digital Operations.dc.html` | 18-finding review written against `@main` | 13 hold, 2 wrong, 3 overstated |

## 1. The review's target is still current

The review states it read `dgoeaa/ECM_DOCS_DEV@main`. That does not weaken it:

```
git diff --stat origin/main origin/claude/platform-commissioning-live-5vnn9n \
  -- styles shared modules index.html document-portal core config
 core/boot.js         |  10 +++
 core/current-user.js |  24 +++++-
 core/data-loader.js  |  36 ++++++++-
 core/domain.js       |  47 +++++++++++-
 core/otp-identity.js | 202 +++++++++++++++++++++++++++++++++++++++++++++++++++
 5 files changed, 314 insertions(+), 5 deletions(-)
```

Zero changes under `styles/`, `shared/`, `modules/`, `document-portal/`, or `index.html`. The
commissioning branch's four commits harden identity, role resolution and the readiness gate. They
touch no frontend file, so every frontend finding transfers to this branch unchanged. **None of
the 18 findings has been addressed here.**

## 2. Where the prototype falls short of the platform

| Dimension | Branch | Prototype | Ratio |
| --- | --- | --- | --- |
| Routes declared | 29 (`config/routes.config.js`) | 29 (`WS()` + `GUIDED()`) | 29/29 — names match 1:1 |
| Screens implemented | 29 modules, 317 KB (`modules/`) | 9 view methods, one file | **9/29** |
| Governed actions | 61 (`config/action-ownership.config.js`) | ~11 `this.patch()` mutations | **11/61** |
| Core services | 60 files, ~4,000 lines (`core/`) | none | 0 |
| Endpoint contracts | 19 registered keys | none | 0 |
| Network / persistence | `fetch`, write manager, offline queue, idempotency, receipt ledger | zero `fetch`, zero `localStorage`; `NOW()` hardcoded to `2026-08-05T09:20` | 0 |

The 20 guided internal routes are declared but not built. Navigating to one renders an explainer
card — label, reason, "visible through", and an **Open owning workspace** button — where the
branch renders a working module. `modules/registry.js` alone (11 KB) carries registry files,
custody chain, movements, minutes, queues, closure and archive control; the prototype has no
Registry screen at all. Same for Activities, Briefs, Meetings, Projects, Scan Intake, Bulk
Assignment, Lookup, Executive, FastTrack, Archive, Reports, Statistics, Diagnostics, Operator HUD
and User Administration.

### Two divergences that are drift, not scope

**RBAC.** Both sides declare the same six role ids and labels. The route tables do not match:

| Role | Branch `RoleRouteAccess` | Prototype `ROLES()` |
| --- | --- | --- |
| `director` | 15 routes | 25 routes |
| `operator` | 16 routes | 20 routes |
| `executive` | 12 routes | 13 routes (adds `ecm-erp-charter`) |
| `userAdmin`, `viewer`, `systemAdmin` | — | identical |

The prototype also implements role-table-only gating. The branch's `canAccess()` falls through to
a **persona** check when the role table misses, so a `director` (persona `registry`) actually
reaches every route except `user-admin`, and an `executive` reaches everything except `settings`,
`operator-hud` and `user-admin`. So the prototype is simultaneously more permissive than the
branch's declared table and more restrictive than its effective behaviour. Neither matches.

**Design system.** The bundled `_ds/…` snapshot predates the branch's accessibility remediation.
Five of seven shared token files differ; `tokens.enhanced.css` and `tokens.legacy-bridge.css` are
absent entirely. Missing from the snapshot: the SC 1.4.11 border strengthening
(`--dgo-color-border-strong` dark `#2D3F36` in the zip vs `#6E8A7C`, "4.48:1 on the dark card", on
the branch), the HC theme's own surfaces, disabled text, focus and brand borders — the zip's HC
file instead sets `color-scheme: light` — the dark-theme sidebar/topbar/tooltip bindings, and the
`--dgo-size-11` type floor. The prototype papers over the gap with a local shim,
`--dgo-color-fg-subtle: var(--dgo-color-fg-muted)`. **Rendering the prototype shows weaker
contrast than the live platform.** `platform-authority.css` is the one stylesheet that is
byte-identical.

Minor label drift: the branch calls the workspace "Correspondence Email Desk"; the prototype says
"Email Desk".

## 3. Where the review is wrong

Verified against the branch, file by file.

**Confirmed (13):** 01 `.dgo-scroll` requested at `shared/shell.js:48` and defined nowhere, while
`styles/app.css:195` sets `.dgo-main{overflow:hidden!important}` · 02 33 `display:none` rules
across 45 media queries in `app.css` · 03 `toast()` at `shared/shell.js:106`, 4200 ms, sole
channel · 04 no breadcrumb or parent control anywhere in `shared/`, `core/`, `modules/`, `styles/`
· 07 four overlays (`dialog`, `confirm`, `dgo-cmdk`, `PF.dialog` at `document-portal/js/core.js:563`)
· 08 `brand-type.css` documents its own missing `@font-face`; the only woff2 in the repo is
Cascadia Mono · 10 portal ribbon and "registry activity" read `localStorage` · 11 portal
Received/Validation/Decision issued vs `core/lifecycle.js` registered/triaged/assigned/…/archived
· 12 17 chained `@import`s, `app.css` exactly 77,466 B, dead `.ministry/.top/.shell/.nav/.footer`
shell present while the runtime renders `dgo-*` · 15 two `<details>` disclosures on
`modules/home.js` and no loaded/empty distinction on the KPIs · 16 four `dgo-iconbtn` glyphs with
no visible label · 17 `bootstrapAdmin()` returns `fullName: 'Registry'`, role `systemAdmin` ·
18 32px in `document-portal/portal.css`.

**Wrong (2):**

- **05 — "unknown routes silently rewrite to home."** They do not. `core/router.js` renders
  `<h2>Workspace not found</h2>` for an unregistered route and an explained `<h2>Access denied</h2>`
  for a denied one. Only an *empty* hash falls back to `AppConfig.defaultRoute`. Wave 2's proposed
  fix already exists.
- **09 — "the public portal has no NITDA logo asset and no icon set."** It ships
  `ds/logo/nitda-lockup.png`, `nitda-lockup-white.png` and `nitda-symbol.png`, referenced from
  `index.html`, `submit.html`, `track.html`, `support.html` and `404.html`. `js/icons.js` (14 KB)
  is loaded by every page and `<use href>` resolves against `ds/icons/sprite.svg`. The
  attachment's own `screenshots/portal-icons.png` shows the mark and the trust-chip check icons
  rendering correctly.

**Overstated (3):**

- **06** — the router does have error (`Module failed`) and not-found states, and
  `core/loading-state.js` *is* invoked, by `boot.js`, `data-client.js`, `data-loader.js` and
  `fetch-manager.js`. What survives: no loading state during route mount.
- **13** — the weight inversion is real (label 800 vs item 650), the sizes are not.
  `app.css` declares `.dgo-nav-group__label` twice and the later rule wins at **11px**;
  `.dgo-sidebar__item` likewise resolves to **12.5px**. The label is smaller than its items, not
  larger.
- **14** — the frozen clock is real (`fmtDateTime(new Date().toISOString())` written once at shell
  render, `shared/shell.js:49`). The ministry bar is 11px, not 14px, and the topbar is
  `calc(var(--dgo-density-row) + var(--dgo-s-4))`, not a fixed 64px.

The three numeric errors share one cause: `app.css` declares `.dgo-topbar` and
`.dgo-ministry-bar` three times each, and `.dgo-nav-group__label` and `.dgo-sidebar__item` twice
each. The review quoted the first declaration and missed the later override in the same 77 KB
file. That does not rescue the sheet — a stylesheet that overrides itself three times is the
finding — but the reported figures are not what renders.

**And one finding the review missed.** `app.css` sets `.dgo-sidebar__item{min-height:36px}`,
overriding `--dgo-control-target-min: 44px` from `tokens.enhanced.css`. Every sidebar navigation
item in the internal runtime is below the touch floor. Finding 18 credits the runtime with
honouring 44px and blames the portal's single 32px toggle; the runtime has 29 controls under it.

## 4. The finding neither the review nor this assessment made — and it outranks all 18

The public portal's landing view discloses the register, and its lookup page dispenses the
credential that guards it. This is an authorization defect, not a presentation one, and it is the
most serious thing in either application.

**The landing feed is not the visitor's feed.** `js/home.js:25` builds the "Registry activity"
panel from `PF.store.all()` — unfiltered, every record, sorted by `updatedAt`. The visitor's own
submissions are a separate panel at `:34` from `PF.store.mine()`. The distinction is drawn
deliberately and the public set is the one given the hero panel. Each row emits tracking ID,
category, last event label, status and timestamp, deep-linked to `track.html?id=`. The record
behind that ID carries submitter name, email, organisation, org type, state, assigned officer,
file names, priority and the full event history including reviewer notes (`js/core.js:135-150`).

**The gate is well built and then undermined.** `js/track.js:110` requires tracking ID *and*
submitter email to match, and `:123-129` deliberately refuses to distinguish "unknown ID" from
"wrong email" so the register cannot be enumerated. That is correct, deliberate work. Then
`js/track.js:16` renders "Or open a sample record" chips carrying `data-email`, and the handler at
`:26-30` fills the email field and calls `lookup()`. The page hands out the credential its own
gate checks.

**The posture is internally inconsistent.** `VERIFY` and `VERIFY_CONFIRM` exist and gate
*submission* — `js/core.js:401`, `:418`, with a 403 `verification-required` at `:332`. But
`PF.intake.status()` at `:445` posts `{referenceId, email}` and no verification proof. The portal
proves a citizen owns an email before accepting a document from them, then serves the case file to
anyone who knows an email. Email is used as a bearer secret and is not one.

**Scope, stated precisely.** The sample chips filter on `r.seeded`, so that leak is demo data
today. The store is `localStorage`, so the feed currently shows a visitor only their own device's
records plus the seeds — nothing crosses between citizens yet. That is why this is urgent rather
than academic: an unauthenticated page is coded to render an unfiltered register, and
commissioning `STATUS` against the live registry is the step that makes it real. **Fix before
wiring, not after.**

**The redesign carries it forward.** The prototype's `liveFeed: recs.slice().sort(...)` is the
same all-records panel from the same source, and its seeds pair named organisations with plausible
submitter emails. The design pass corrected layout and feedback and left the disclosure model
untouched.

**Why it was missed.** Finding 10 examined the same panel and asked whether its numbers were
*true* — a data-provenance question, answered "no, they come from `localStorage`". It never asked
whether the panel should be visible at all, which is the authorization question. Finding 11 treated
two status vocabularies as a translation cost for Customer Service rather than as disclosure. The
question class was wrong and was applied consistently, so a redesign built on those answers
inherited the blind spot.

Remediation, in order: filter the landing feed to `PF.store.mine()` or replace it with aggregate
counts carrying no per-record identifiers; delete the `data-email` chips outright; and gate
`STATUS` on a `VERIFY_CONFIRM` token rather than on email equality, so ownership is proved once
per session instead of asserted by knowing a field that appears in the record.

## 5. What follows

- Section 4 comes first, and before `STATUS` is wired to the live registry.
- The review is worth acting on. 13 findings hold as written, three blockers among them
  (01, 02, 03), and none is fixed on this branch. None of the 18 is the defect in section 4.
- Correct the register before scheduling: drop 05 and 09, rescope 06, 13 and 14, and add the
  36px sidebar target.
- The prototype is a design target, not a candidate build. Adopting its visual decisions means
  re-implementing them across 29 modules against the branch's current design system — not
  importing the `.dc.html`, whose token snapshot would regress contrast.
- Before either, refresh `_ds/` from `styles/dgo-design-system/` so subsequent design work is
  done against the tokens the platform actually ships.
