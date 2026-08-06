# Assessment of "Frontend Design Review — DGO Digital Operations and the NITDA Document Portal"

**Report under assessment:** `Frontend_Review__DGO_Digital_Operations.dc.html`, dated 5 August 2026, 18 findings (3 blocker, 10 major, 5 minor).
**Report's stated target:** `dgoeaa/ECM_DOCS_DEV@main`.
**Assessed against:** `claude/platform-commissioning-live-5vnn9n`, first at `8613358` and re-verified at `7a84fde`.

> **This is the single register.** It was two documents — this assessment, written on
> `claude/platform-commissioning-assessment-h1fhtv`, and `FRONTEND_REVIEW_PARITY_VERDICT.md`,
> written independently on `claude/platform-parity-check-xp2028` (commits `47028bb`, `c2ab900`;
> the file itself is removed by this fold). They were folded here because
> two records of the same review is how a finding gets fixed twice or not at all. Where the two
> agreed the wording is this document's; where only one had something it is marked. The branch
> carrying this file contains all four heads that existed at the time of the fold — `main`,
> `claude/platform-commissioning-live-5vnn9n`, `claude/platform-commissioning-assessment-h1fhtv`
> and `claude/platform-parity-check-xp2028` — verified with `merge-base --is-ancestor`.
>
> **The two assessments were written without knowledge of each other and agree on every
> disputed point:** both find 05 and 09 false on the same evidence, and both correct 13's size
> claim to 11px with the label *smaller* than its items. Independent agreement on the findings
> a reader is most likely to challenge is worth more than either document alone.

> **Implementation status.** Wave 1 — findings 01, 02, 03 and the surviving half of 06 — is
> implemented and covered by `tests/containment.spec.js`, which fails on the pre-fix source and
> passes after. **Finding 19, the portal disclosure defect, is implemented** and covered by four
> tests in `tests/portal.spec.js`, likewise verified in both directions. Waves 2 and 3 are not
> started. See *Assessment of the plan* below for the corrected effort.

---

## Headline

The report reviewed the wrong branch, and it does not matter. `main` and the live
commissioning branch had diverged sharply when this was written — but that divergence was in
the flow estate, role assignment and data contracts. It did not touch the shell, the
stylesheet, or the portal home page: a `git diff` between the two restricted to `styles/`,
`shared/`, `modules/`, `index.html` and `document-portal/` was empty. **Sixteen of the
eighteen findings reproduce on live, verbatim.**

Two findings are wrong, and they are wrong about `main` too — they are mis-reads, not
branch drift. One more is half right. Everything else stands, with the file and line
references intact.

The report also missed two defects, one of them more serious than anything in its register.

| Verdict | Count | Findings |
|---|---|---|
| Confirmed on live | 14 | 01, 02, 03, 04, 07, 08, 10, 11, 12, 14, 15, 16, 17, 18 |
| Half right | 2 | 06, 13 |
| Not reproducible — the code does the right thing | 2 | 05, 09 |
| **Not in the report — found during assessment** | **2** | **19 (blocker), 20 (minor)** |

*Branch state note: the divergence described above is resolved on the branch carrying this
file, which contains all four heads. The commit counts originally cited here were measured
against an earlier `main` and have been removed rather than restated, because they no longer
describe anything a reader can reproduce.*

---

## The two findings that are wrong

### 05 — "Unknown routes silently rewrite to home with no explanation" — **false**

`core/router.js` renders an explicit not-found view:

```js
const fn=handlers.get(p);
if(!fn){out.innerHTML='<div class="empty"><h2>Workspace not found</h2>
  <p>The requested route is unavailable.</p></div>';return}
```

It also renders a distinct **Access denied** view, with three different bodies depending
on whether the user is disabled, unenrolled, or merely out of role.

The likely source of the error: `AppConfig.defaultRoute` (`'home'`) is applied by
`Router.path()` only when the hash is **empty**. An empty hash defaulting to Command
Center is correct behaviour. An *unknown* hash does not reach it. The report appears to
have read the default-route line and inferred the fallback.

`core/router.js` is byte-identical on `main` and on live, so this is not drift.

**Consequence for the plan:** Wave 2's "Unknown route resolves to an explained not-found
view, not a silent redirect (05)" is already shipped. Remove it — 0.5 d recovered.

### 09 — "The public portal has no NITDA logo asset and no icon set" — **false**

The portal ships three real logo assets:

```
document-portal/ds/logo/nitda-symbol.png        (56 KB)
document-portal/ds/logo/nitda-lockup.png       (112 KB)
document-portal/ds/logo/nitda-lockup-white.png  (12 KB)
```

and `document-portal/index.html:23` uses one:

```html
<img class="pf-brand__mark" src="ds/logo/nitda-symbol.png" alt="" width="38" height="38">
```

Icons come from `document-portal/ds/icons/sprite.svg`, injected inline at runtime by
`PF.shell()` (`js/core.js:776`), which then re-parses every `<use href="#i-…">` authored
in the markup so late-bound references resolve:

```js
holder.innerHTML = PF.SPRITE;
document.body.insertBefore(holder, document.body.firstChild);
PF.$$('svg > use[href^="#i-"]').forEach(function (u) {
  var s = u.parentNode; s.innerHTML = s.innerHTML;
});
```

The report's own recreation at §1b draws the trust chips and the search glyph as empty
tinted rectangles, and finding 15 then describes those rectangles as a platform defect
("Four trust claims rendered as blank squares"). That is the recreation's artifact — the
page was rendered without executing `PF.shell()`. The sprite is not in the static HTML
because it is inserted by script.

**Consequence for the plan:** Wave 3's "Ship the NITDA logo asset and an icon set to the
portal (09)" is not work that exists. 1 d recovered. The related claim in the §1b
annotation — that the internal tool is better branded than the public portal — inverts:
both load real marks (`assets/dgo-mark.svg` in the shell, `nitda-symbol.png` in the
portal).

---

## The two findings that are half right

### 06 — Loading, empty and error states

The **loading** half stands. Nothing calls `core/loading-state.js` on navigation —
`LoadingState` is imported by `boot.js`, `data-client.js`, `data-loader.js`,
`fetch-manager.js`, `operator-hud.js` and `diagnostics.js`, but not by the router or the
shell. `Router.render()` `await`s the module function with no pending indicator.

The **empty and error** halves do not. The router has three terminal states — not found,
access denied, and a caught `Module failed` that prints the error — plus a generation
token that discards stale renders when the user navigates during an await:

```js
const token=++generation; …
try{ await fn(stage); if(token!==generation)return; out.replaceChildren(stage); … }
catch(e){ if(token!==generation)return; … out.innerHTML=`…<h2>Module failed</h2>…` }
```

The sub-claim "Routes swap innerHTML directly" is also inaccurate for the success path:
the router builds a `.route-stage` element and calls `replaceChildren`.

**Revised finding:** *No loading state on navigation.* Major, ~0.5 d, not 1.5 d.

### 13 — Inverted type hierarchy

The specific size claim is false. `styles/app.css:281` sets, unconditionally:

```css
.dgo-nav-group__label{font-size:11px}
```

with the comment *"Targeted a11y polish: slightly more legible nav-group / footer
chrome."* Group labels are **11px**, not the inherited 14px the report cites; nav items
are 13.5px (12.5px only in landscape ≤980px). The label is smaller than the destinations
beneath it. What survives is weight and tracking — 800 / `.13em` on the label against 650
on the item — which is a real but much weaker version of "the label shouts over the
destination."

The rest of finding 13 is exact:

- `.dgo-route-title b{font-size:13px;white-space:nowrap;…text-overflow:ellipsis}` capped
  by `.dgo-route-title{max-width:220px}` — `app.css:224-226`, unconditional, and it
  overrides the 17px declared at `app.css:193`. The only wayfinding text on screen is
  13px and truncates.
- `.action-card.cc-action p{font-size:clamp(10.5px,1.1vw,13px);line-height:1.35}` against
  `.kpi-inline{font:800 clamp(18px,2.5vw,28px)}` — `app.css:144`. At ≤900px height the
  copy drops to `var(--dgo-type-floor)` at 1.25 and the count locks to 20px.

**Revised finding:** *Route title is 13px and truncated; card copy is outweighed by its
own count.* Still Major. Drop the group-label size claim; keep the weight claim.

---

## The fourteen that stand

Verified line by line on live. Citations are to the live tree.

**01 · No scroll container — blocker, confirmed.** `shared/shell.js:48` renders
`<main id="main" class="dgo-main dgo-scroll" data-outlet …>`. `.dgo-scroll` is defined in
no stylesheet in the repository — the class name appears exactly once, in that line.
`.dgo-main` carries `overflow:hidden!important` twice (`app.css:195`, `app.css:333`), and
`.dgo-main>.route-stage>.workspace` carries it again (`app.css:348`), under a block
headed *"Screen containment remediation — footer-visible, no page/main scroll,
independent bounded panes."* `html, body, #app, dgo-shell` are `overflow:hidden !important`
with `contain:layout size` on `dgo-shell`. Overflow is clipped in silence at four
nesting levels.

**02 · Content deleted rather than reflowed — blocker, confirmed.** Every rule the report
names is present and unconditional within its query:

| Query | Rule | Line |
|---|---|---|
| `max-width:1500px` | `.cc-source-strip{display:none}` | `app.css:145` |
| `max-height:760px and min-width:1000px` | `.cc-support-panels{display:none}` · `.cc-source-strip{display:none}` · `.footer{display:none}` | `app.css:149` |
| `max-height:640px and min-width:1000px` | `.action-card.cc-action:nth-child(n+5){display:none}` · `.action-card.cc-action p{display:none}` · `.cc-workspace .pagehead .subtitle{display:none}` | `app.css:150` |
| `max-width:720px` | `.cc-support-panels details:not(:first-child){display:none}` | `app.css:147` |
| `@container (max-width:760px)` | `.cc-source-strip{display:none}` | `app.css:151` |

The 1500px rule is the one to lead with: `.cc-source-strip` is the `aria-label="Four
ingestion sources"` panel (`modules/home.js:18`). It is gone at 1440px. It has never been
seen on a laptop.

**03 · One 4.2-second toast is the whole feedback channel — blocker, confirmed.**

```js
toast(message,tone='info'){ … host.appendChild(node);
  setTimeout(()=>node.remove(),4200); }
```

`shared/shell.js:106`. No history, no dismiss, no persistence, no queue. `core/ui.js:25`
routes every module's `toast()` here. The `notifications` array in `core/state.js` is a
domain entity — reminders queued against tasks — not a UI channel; nothing renders it as
one. `modules/correspondence-email.js:14` says so explicitly: *"It is not a
task-notification center."*

**04 · 20 of 29 routes carry no way back — major, confirmed.** `config/routes.config.js`
declares 29 paths. `config/workflow-clarity.config.js` declares 9 `VisibleWorkspaces`,
and `shared/shell.js:57` builds the sidebar from those 9 alone. The other 20 are
registered, deep-linkable and reachable from the command palette, and appear in no
persistent navigation. There is no breadcrumb in the shell.

One correction in the platform's favour, which changes the estimate: the design system
**already ships a breadcrumb component** — `styles/dgo-design-system/components.css:702`,
section *16 · BREADCRUMB*. Wave 2's breadcrumb is a wiring job against
`visibleWorkspaceForRoute()` (`workflow-clarity.config.js:243`) and the `handoffs` arrays
already declared per workspace, not a build. Closer to 1 d than 2 d.

**07 · Four overlay implementations, plus a dead shell — major, confirmed.**
`shell.dialog()` (`shell.js:107`) and `shell.confirm()` (`shell.js:108`) each hand-build a
`.dgo-dialog-backdrop`; `CommandPalette()` is a third; `PF.dialog` (`document-portal/js/core.js:563`)
is a fourth. The dead-shell claim is exact: `app.css:3-8` still carries complete
`.ministry`, `.top`, `.shell`, `.nav`, `.footer` rulesets, and **no markup in the
repository emits any of those class names** — the shell renders `.dgo-ministry-bar`,
`.dgo-topbar`, `.dgo-shell-grid`, `.dgo-sidebar`, `.dgo-footer`.

**08 · Brand fonts never load — major, confirmed.**
`--dgo-family-display: 'Outfit', 'Alwyn New', 'Inter', system-ui, sans-serif`
(`tokens.primitive.css:100`) and `--font-display: "Outfit", "Alwyn New", …`
(`colors_and_type.css:109`). There is no `@font-face` for either family, no Google Fonts
link in `index.html`, and the only webfont in the tree is
`document-portal/ds/fonts/CascadiaMono-Regular.woff2` — a mono face, for the portal.
`brand-type.css` documents the removal of the last one and states the condition for
restoring it. The runtime renders in whatever sans the OS supplies, on both apps.

**10 · The portal shows local storage as a national registry — major, confirmed, with a
correction that narrows it.** `PF.metrics()` (`js/core.js:469`) reads `PF.store.all()`,
which is `localStorage`. The ribbon counter is `live.textContent = PF.metrics().open`
(`js/core.js:822`). The "Registry activity" panel, the pulse dot and "57% on time" are
computed from the same source, seeded from `PF.SEEDS` (`js/data.js:169`).

But the **tracking page is no longer local**. `PF.api.status()` (`js/core.js:445`) reads
back from the registry and returns one of three resolutions — `found`, `denied`,
`unavailable` — with the local store demoted to "a cache of last resort", and a comment
that names the exact failure the report is describing:

> *"showing device data as though it came from the registry is the failure this replaces,
> so it must never be silent."*

So the platform has already articulated the principle and applied it to Track. Finding 10
is the home page not having caught up. That reframes it from "the portal misleads" to
"one page on the portal contradicts the rule the portal set for itself" — smaller, and
much easier to argue for internally.

**11 · Two status vocabularies — major, confirmed.** `document-portal/js/data.js:49-53`
defines `received` / `validation` / `action-required` / `approved` / `declined`, with
`PF.STAGES = ['Received','Validated','Under review','Decision']`. The runtime's lifecycle
lives in `core/lifecycle.js` and does not use those terms. Customer Service translates by
hand, as reported.

**12 · 19 stylesheets before first paint — major, confirmed.** `index.html:10` links one
sheet; `styles/index.css` then `@import`s eighteen more, in a declared `@layer` order.
`@import` serializes. `styles/app.css` is 77,466 bytes.

Worth adding to this finding: the 17-line comment at the head of `styles/index.css`
justifies the single shared `overrides` layer by citing measurements from
`tests/tools/cascade-snapshot.mjs`, a budget in `tests/static/css-contract.mjs`, and an
accepted-debt entry in `tests/baseline.json`. **None of those three files exist in the
tree**, and `tests/` has no `static/` or `tools/` directory. The reasoning may well be
sound, but nothing currently enforces or reproduces it — which matters directly, because
Wave 1 has to edit `app.css` and the comment is the only stated account of what that
edit can break.

**14 · 130px of fixed chrome, 40px of it a frozen clock — major, confirmed.**
`--dgo-shell-ministry-h: 26px`, `--dgo-shell-footer-h: 40px` (`app.css:287-288`); topbar
is `calc(var(--dgo-density-row) + var(--dgo-s-4))` = 64px at comfortable density. All
three are pinned with matching `min-` and `max-block-size`. The footer timestamp is
`fmtDateTime(new Date().toISOString())` interpolated into the template string at
`shared/shell.js:49` — evaluated once, at shell render, never again.

**15 · Guidance copy on the DG/CEO's dashboard; KPIs indistinguishable from a failed
fetch — major, confirmed.** `modules/home.js:16` passes five raw array lengths to
`kpis()`. There is no skeleton, no "not yet loaded", no timestamp, and no read of
`runtime.loadingState` — which `core/loading-state.js` publishes into state and nothing on
this screen consumes. The two `<details>` disclosures are `.cc-progressive` panels
carrying workflow documentation.

**16 · Four unlabelled glyph buttons — minor, confirmed.** `? ↻ ↕ ◐` at
`shared/shell.js:41-44`. Each carries both `aria-label` and `title`, so this is a
visual-affordance finding and not an accessibility one — which is exactly how the report
grades it. The substantive half of the point holds: `data-sync` mutates shared state and
looks identical to `data-density`, which sets a personal preference.

**17 · Identity duplicated, defaults to a placeholder — minor, confirmed.**
`core/state.js:3` seeds `profile:{name:'Registry', email:'dgsregistry@nitda.gov.ng',
persona:'admin'}`. The shell renders it twice, at `shell.js:34` (`.dgo-sidebar__identity`)
and `shell.js:46` (`.dgo-persona-button`, avatar letter derived from the same name).

**18 · One control below the touch floor — minor, confirmed.** `#themeBtn` is
`dgo-btn--sm dgo-btn--icon`; `--dgo-btn-h-sm: 32px` (`ds/tokens/tokens.component.css:11`,
and 28px at compact density in `tokens.density.css:27`). `.dgo-btn--icon` sets
`inline-size: var(--_h)`, so it is 32×32. There is no `pointer: coarse` override anywhere
in the portal's CSS. The report is right that this is the only such control — the
runtime's `--dgo-control-target-min` governs the rest.

---

## The dimension the report grades "Strong" — verified

Every accessibility claim checks out, and it is the correct call to fence this off:
`core/focus-trap.js` is real and used by both `dialog()` and `confirm()`;
`shared/shell.js:74-76` handles `inert` on the mobile drawer with a documented reason for
*not* applying it above the breakpoint; `tokens.theme-hc.css` ships; three
`prefers-reduced-motion` blocks in `app.css`; skip link at `index.html:16` and
`document-portal/index.html:16`; `aria-live` region at `shell.js:52`. The instruction that
Waves 1 and 2 must not regress this is the right constraint to put in writing.

---

## The two findings the report did not make

*From the parity assessment folded into this register. Finding 19 outranks everything in the
report's own register; both were re-verified against the merged tree, after Wave 1 rewrote `app.css`.*

### 19 · The public portal published the register, and the lookup page handed out its key — blocker, now fixed

The portal is unauthenticated, so everything it renders is published. Two places were
publishing records the visitor did not submit.

`document-portal/js/home.js:25` built the "Registry activity" feed from `PF.store.all()` —
unfiltered, every record, newest first, each row carrying a tracking ID and deep-linking to
`track.html?id=`. The visitor's own submissions had their own panel directly below, at `:34`,
from `PF.store.mine()`. The two sets were distinguished deliberately and the public one was
given the hero panel, so the list was never how anyone found their own request. The record
behind each ID holds submitter name, email, organisation, org type, state, assigned officer,
file names, priority and the full event history including reviewer notes
(`js/core.js:135-150`).

`document-portal/js/track.js:16` rendered "Or open a sample record" chips from
`PF.store.all().filter(seeded)` through the same `chip()` helper, so each carried
`data-email` — another submitter's address — and the handler at `:26-30` filled both fields
and called `lookup()`. The gate in `lookup()` is careful work: `:110` requires the ID and the
email together, and `:123-129` deliberately refuses to say which of the two was wrong so the
register cannot be enumerated. These chips handed a visitor the pair, on the page that
enforces it.

Underneath both, a posture that is internally inconsistent. `VERIFY` and `VERIFY_CONFIRM`
exist and gate *submission* — `js/core.js:401`, `:418`, with a `403 verification_required` at
`:332`. But `PF.intake.status()` at `:445` posts `{referenceId, email}` and no proof. The
portal proves a citizen owns an address before accepting a document from them, then serves the
case file to anyone who knows an address. Email is used as a bearer secret and is not one.

**Scope, stated precisely.** The chips filtered on `r.seeded`, so that half exposed demo
records. The store is `localStorage`, so nothing crossed between citizens. That is the reason
this was urgent rather than academic: an unauthenticated page was coded to render an
unfiltered register, and wiring `STATUS` to the live registry is the step that would have made
it real.

**Why both review passes missed it.** Finding 10 examines the same panel and asks whether its
numbers are *true* — a data-provenance question, correctly answered "no, they come from
`localStorage`". Neither pass asked whether the panel should be visible at all, which is the
authorization question. Finding 11 likewise treats two status vocabularies as a translation
cost for Customer Service rather than as disclosure. The question class was wrong and was
applied consistently, so the redesign built on those answers inherited the blind spot: the
prototype's `liveFeed: recs.slice().sort(...)` is the same all-records panel.

**Fixed.** The landing panel renders a status mix — counts against status labels, no
identifier, no timestamp, nothing that resolves to a person or a submission. Quick picks are
the visitor's own device history only, with guidance where the chips were. Four tests in
`tests/portal.spec.js` assert the property rather than the removed strings: no ID from the
store may appear in the landing page's text or in any `href`, no submitter email may appear on
`index` or `track`, the aggregate panel must still say something and every row must be a
status label, and a fresh visit must get no prefilled chips. All four fail on the pre-fix
source.

**Still open — the contract change.** `document-portal/README.md` carries the drafted shape,
marked proposed because the client does not send it yet: `STATUS` takes
`{ referenceId, verification }` and resolves the address from the proof `VERIFY_CONFIRM`
already issues, instead of authorising on a field printed inside the record it returns. Three
properties are easy to lose in implementation and are written down there — the email must
leave the request body entirely, expired and replayed proofs must share the one byte-identical
`404`, and an unreachable verification service must still surface as `unavailable` rather than
as a denial. `keepUrl()` must stop writing the address into `location.search` at the same
time, or the disclosure moves into the URL bar, history and `Referer`. **Estimate: 1 d
client-side, plus the flow change. Must land with or before the `STATUS` wiring.**

### 20 · The sidebar's own nav items are below the touch floor — minor, open

`styles/app.css` declares `.dgo-sidebar__item` twice. The first carries
`min-height:var(--dgo-control-target-min)`; a later rule overrides it with `min-height:36px`.
`--dgo-control-target-min` is `44px` (`tokens.enhanced.css:3`). Every navigation item in the
internal shell is therefore 36px, not 44px — 29 controls, on the one surface every user
touches on every visit. Verified still present after Wave 1, which rewrote `app.css` around it
without touching it.

This corrects the scope of finding 18 and of this document's own note on it. Finding 18 credits
the runtime with honouring the 44px floor and blames the portal's single 32px theme toggle;
the assessment above repeats that — *"the runtime's `--dgo-control-target-min` governs the
rest"*. It governs the declaration and is then overridden. The portal toggle is the smaller
instance of the two.

**Estimate: 0.25 d** — delete the override, or state why 36px is accepted and record it against
the touch-target budget rather than leaving it as a silent contradiction.

---

## The attachment's prototypes, judged as a build

*From the parity assessment folded into this register. The report shipped alongside two redesigned
prototypes, and the question asked of them was whether they are at par with the platform. They
are not, and they do not claim to be — but the gap should be on the record before anyone
schedules against them.*

`Root Platform — DGO Digital Operations.dc.html` declares all 29 routes with names matching
`config/routes.config.js` 1:1, and implements **9**. The other 20 render an explainer card —
label, reason, "visible through", and an *Open owning workspace* button — where the platform
renders a working module. `modules/registry.js` alone carries registry files, custody chain,
movements, minutes, queues, closure and archive control; the prototype has no Registry screen.

| Dimension | Platform | Prototype |
|---|---|---|
| Screens implemented | 29 modules, 317 KB | 9 view methods, one file |
| Governed actions | 61 (`config/action-ownership.config.js`) | ~11 local mutations |
| Core services | 60 files, ~4,000 lines | none |
| Endpoint contracts | 19 registered keys | none |
| Network / persistence / auth | write manager, offline queue, idempotency, receipt ledger | zero `fetch`, zero `localStorage`; `NOW()` hardcoded to `2026-08-05T09:20` |

`Document Portal — NITDA Intelligent Portal.dc.html` covers 4 of 4 portal pages.

Two divergences matter beyond scope, because importing the prototype would carry them in:

- **RBAC.** Same six role ids and labels; different route tables. `director` 25 routes against
  the platform's declared 15, `operator` 20 against 16, `executive` gains `ecm-erp-charter`.
  The prototype also implements role-table-only gating, while `canAccess()` falls through to a
  persona check when the table misses — so a `director` actually reaches everything except
  `user-admin`. The prototype is simultaneously more permissive than the declared table and
  more restrictive than the effective behaviour.
- **Design system.** The bundled `_ds/` snapshot predates the accessibility remediation in
  `styles/dgo-design-system/`. Five of seven shared token files differ; `tokens.enhanced.css`
  and `tokens.legacy-bridge.css` are absent. Missing: the SC 1.4.11 border strengthening (dark
  `--dgo-color-border-strong` is `#2D3F36` in the snapshot against `#6E8A7C`, *"4.48:1 on the
  dark card"*, in the tree), the HC theme's own surfaces — the snapshot's HC file sets
  `color-scheme: light` — the dark sidebar/topbar/tooltip bindings, and the 11px type floor.
  **Rendering the prototype shows weaker contrast than the platform.** `platform-authority.css`
  is the one stylesheet that is byte-identical.

Treat the prototypes as a design target for the 9 workspaces, not a candidate build. Adopting
their decisions means re-implementing across 29 modules against the current design system.
Refresh `_ds/` from `styles/dgo-design-system/` before the next design pass, so the work is
done against the tokens the platform ships.

**Bundle triage.** `uploads/document-portal/` in the attachment is a byte-identical copy of
`document-portal/` — 33 files, `diff -rq` clean — as are the root-level `styles/` and
`assets/` copies. Those are duplication. The two `.dc.html` prototypes, the review itself and
`screenshots/` are the unique content; `screenshots/portal-icons.png` is what disproves finding
09, showing the mark and the trust-chip icons rendering. `_ds/` and `support.js` are what make
the prototypes render, so they cannot be deleted — but `_ds/` must not be treated as the design
system of record.

---

## Assessment of the plan

The sequencing logic is correct and I would not reorder it. Nothing downstream is worth
designing while the platform clips content without telling anyone.

### First, the report's own totals do not reconcile

Before adjusting anything, the stated wave figures should be checked against the register
they are drawn from.

| Wave | Findings scheduled | Register sum | Card states |
|---|---|---|---|
| 1 | 01 (0.5) · 02 (3) · 03 (2) · 06 (1.5) | **7.0 d** | ≈6 d |
| 2 | 04 (2) · 05 (0.5) · 07 (2) + 12 (1.5) · 11 (1) · 13 (1) · 14 (1) | **9.0 d** | ≈9 d ✓ |
| 3 | 08 (0.5) · 09 (1) · 10 (1) · 15 (2) · 18 (0.25) | **4.75 d** | ≈5 d ✓ |
| | | **20.75 d** | ≈20 d |

Wave 1 understates its own listed items by a full day. Waves 2 and 3 are sound.

Two findings — **16** (0.5 d, unlabelled topbar glyphs) and **17** (0.5 d, duplicated
placeholder identity) — appear in the register and in **no wave at all**. The register
totals 21.75 d; the waves schedule 20.75 d of it. Whether those two are deliberately
deferred or simply dropped in transcription is not stated, and should be.

### Then, the four adjustments

**Wave 1 · 7.0 d → 7.5 d — now implemented.** What shipped: `.dgo-main` is the single
scroller (`.dgo-scroll` is defined, and the `overflow:hidden !important` that made the
markup's request unanswerable is gone from every content container, while the frame —
`html`/`body`/`#app`/`dgo-shell`, `.dgo-shell-grid`, `.dgo-workarea`, `.dgo-topbar` —
stays contained so the footer is still pinned); every `display:none` viewport rule on the
Command Center is replaced with reflow; `core/notification-center.js` gives every toast a
durable, dismissable, severity-tagged record that survives route changes and reload; and
`core/router.js` publishes route mounts through the existing `LoadingState` with a
140 ms-delayed progress bar and a retry on the failure view. Finding 01 at 0.5 d is the one
materially optimistic
estimate. Writing `.dgo-scroll` is thirty minutes. Deciding *which* of the nested
`overflow:hidden !important` levels — `dgo-shell` / `.dgo-shell-grid` / `.dgo-workarea` /
`.dgo-main` / `.workspace` — becomes the scroller, without breaking the footer-visible
contract that block was written to guarantee, is the work; `contain:layout size` on
`dgo-shell` interacts with it. **01: 0.5 → 2.0 d.** Against that, finding 06 reduces to
the loading state alone, since the empty and error states already exist: **06: 1.5 →
0.5 d.** Findings 02 and 03 stand as estimated — though expect 02 to come in under its
3 d, since the deletion rules are five discrete blocks.

**Wave 2 · 9.0 d → 7.0 d.** Drop **05** entirely (already shipped, −0.5 d). Reduce **04**
to wiring the design system's existing breadcrumb component against
`visibleWorkspaceForRoute()` and the declared `handoffs` arrays, rather than building one
(2 → 1 d). Reduce **13** to the route-title and card-copy halves, dropping the
group-label size claim (1 → 0.5 d). Findings 07, 12, 11 and 14 stand.

**Wave 3 · 4.75 d → 3.25 d.** Drop **09** entirely (−1 d); the logo assets and the icon
sprite ship today. Rescope **10** from "the portal" to the home ribbon and the Registry
activity panel only, reusing the `found`/`denied`/`unavailable` contract `PF.api.status`
already establishes rather than inventing a second one (1 → 0.5 d). Findings 08, 15 and
18 stand.

**One item to add, at Wave 1 or before it.** `styles/index.css` justifies its cascade
architecture with measurements from three files that are not in the repository. Wave 1
edits `app.css` inside that architecture. Either restore the tooling or replace the
comment with what is actually true, before someone relies on it to size a change. Not
estimated here — it is a decision before it is a task.

### Corrected total

| | Stated | Register sum | Corrected | Status |
|---|---|---|---|---|
| **Wave 0 · finding 19, portal disclosure** | — | — | **1.0 d** | client fixed; contract change open |
| Wave 1 · stop losing information | ≈6 d | 7.0 d | **7.5 d** | implemented |
| Wave 2 · make the journey legible | ≈9 d | 9.0 d | **7.0 d** | not started |
| Wave 3 · earn public trust | ≈5 d | 4.75 d | **3.25 d** | not started |
| **Scheduled total** | **≈20 d** | **20.75 d** | **18.75 d** | |
| Unscheduled minors (16, 17, 20) | — | 1.0 d | 1.25 d | not started |
| **Full register** | — | **21.75 d** | **20.0 d** | |

Finding 19 is entered as Wave 0 rather than folded into Wave 3 because it is not the same kind
of work: Waves 1–3 improve a platform that behaves correctly, and 19 was a platform publishing
records to people not entitled to them. Its client half is done; what remains is the `STATUS`
contract change, and that has a hard ordering constraint the other waves do not — it must land
with or before the wiring of `STATUS` to the live registry, because that wiring is what turns a
shape problem into a disclosure.

**≈18.75 days of scheduled frontend work, or ≈20 with the three unscheduled minors.** Call it
four weeks for one developer — the same calendar shape the report gives, because the day count
was never the binding constraint. Wave 1 is serial by nature: one person deciding one
containment model. Waves 1 and 0's client half are already spent, leaving ≈10.5 d scheduled.

---

## Bottom line

Use it. Sixteen of eighteen findings are real on the branch being commissioned, the file
references are accurate, and the three blockers are correctly identified and correctly
ordered — a platform that clips content without a scrollbar and deletes panels at common
laptop dimensions is not ready to be put in front of a DG/CEO, and no amount of the work
in Waves 2 and 3 changes that.

Correct 05 and 09 before circulating, because both assert an absence that is not there
and both are checkable in under a minute — a reader who spots either will discount the
other sixteen. Trim 06 and 13 to the halves that hold. Fix Wave 1's card, which
understates its own listed items by a day, and say what happened to findings 16 and 17.

The corrected plan is **≈18.75 days scheduled** against the ≈20 stated — and the near-parity
is a coincidence of two movements, not a small correction. Waves 2 and 3 lose work that is
already done, Wave 1 costs more than budgeted, and Wave 0 adds a day the report never
identified. That is the right shape to be wrong in: the blockers cost more, the polish costs
less.

The one thing the report got wrong that its own method could not have caught: it audited the
platform's *presentation* thoroughly and its *authorization* not at all. Finding 19 was sitting
in the same panel as finding 10, one question away — "should this be visible?" rather than "is
this number true?" — and neither review pass asked it. Both prototypes reproduce the panel.
Before Wave 2 is scheduled, the register is worth a second pass with that question applied to
every surface the public can reach.
