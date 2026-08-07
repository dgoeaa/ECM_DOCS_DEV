# Assessment of "Visual, layout and interaction audit — DGO Digital Ops + NITDA Intelligent Portal"

**Report under assessment:** `Design audit brief - AI input.md` (repository root), the verified
plain-text extraction of `Design audit brief.PDF`. 33 findings (2 blocker, 8 high, 5 medium,
3 low, plus the `H-nn` harmonisation set and an unnumbered "unvalidated" row).
**Report's stated targets:** the main internal platform, build `6422c484efabbb73`, and the
document portal, build `912dd39dae014544`.
**Assessed against:** `main` at `b003acd`, rendered and measured in Chromium.

> **The extraction is sound; this assessment is about the report's claims, not its transcription.**
> `Design audit brief - integrity manifest.json` and `- verification report.txt` assert that the
> Markdown is a byte-for-byte re-extraction of the source PDF, and nothing below depends on
> disputing that. Neither file was modified. Where this document quotes the report it quotes the
> extraction verbatim.

> **Neither audited build identifier appears anywhere in this repository.** `6422c484efabbb73`
> and `912dd39dae014544` occur only inside the report itself. The audit was run against delivered
> packages, not against this tree, so drift between the two is expected and is called out
> wherever it changes a number.

---

## Headline

**The audit is substantially correct and its two blockers are both real.** Twenty-two of the
thirty-three findings reproduce on `main`; five of those need a number or a mechanism corrected,
not a verdict. Eight are half right — the defect exists but the stated cause, scope or evidence
does not survive measurement. Three do not reproduce at all, and one of those three, `P-06`, is
a release-gating blocker in the report's own §10.

The report's central structural claims are exact. Twenty-nine routes, nine in navigation, groups
of 2/2/2/2/1, thirteen navigation labels disagreeing with their page heading — every one of those
counts is right to the unit, and the seven headings the report could not render and marked
*unvalidated* have now been read from the DOM. None of them changes the count.

Where the audit is weakest is where it inferred a cause from a rendered snapshot. `P-04` reads a
count-up animation's start frame as a data contradiction. `P-06` reads a write-only log string as
public copy. `I-11` describes a transition failure that the router demonstrably does not have,
and recommends a fix the router already implements.

The audit also missed the largest divergence between the two platforms, and listed it under
**CONSISTENT — PRESERVE**.

| Verdict | Count | Findings |
|---|---|---|
| Confirmed on `main` | 17 | I-02, I-05, I-06, I-07, I-08, I-10, I-12, I-14, I-15, I-17, I-18, I-19, I-22, P-05, P-07, H-03, H-04 |
| Confirmed, one detail corrected | 5 | I-03, I-04, P-01, H-01, H-02 |
| Half right | 8 | I-01, I-09, I-13, I-16, I-20, I-21, P-02, P-03 |
| Not reproducible | 3 | I-11, P-04, P-06 |
| **Not in the report — found during assessment** | **7** | **V-01 … V-07** |

**Both readiness classifications survive.** The internal platform stays *Not ready* — `I-01`,
`I-02`, `I-05` to `I-08`, `I-12` and `I-17` to `I-19` all hold. The portal stays *Conditionally
ready*, but on three conditions rather than four: `P-01`, `P-04` (for reasons the report did not
give) and `P-07`. `P-06` is not a release gate, and `V-02` below should replace it.

---

## Method

Both platforms were served over HTTP from this tree and driven in Chromium 1194 through
Playwright. The internal platform was entered through its own **"Continue with NITDA SSO (skip
OTP)"** control — the same path the audit used, and itself finding `I-12`. No endpoints were
configured, so this assessment shares the audit's central limitation: **every populated table,
record detail and result state remains unvalidated.** That limitation is correctly stated in the
report and is not disputed here.

Measurements were taken at 1440, 1280, 1024, 768, 414 and 360 px on the five portal pages, and at
1440, 1280, 1180, 1100, 1024, 924 and 924×540 on the internal shell. All twenty-nine internal
routes were navigated by hash and their first heading read from the DOM.

---

## The three findings that do not reproduce

### P-06 — "the submission path can surface *No registry endpoint configured* to a member of the public" — **not reproducible**

This is the report's third portal release gate and one of its four §10 clearance conditions. The
string exists. It cannot reach a citizen.

`document-portal/js/submit.js:361`:

```js
function dispatchToWorkflow(rec) {
  if (!PF.backendConfigured()) {
    PF.store.log('integration', rec.id, 'No registry endpoint configured — submission held locally');
    return;
  }
```

`PF.store.log` (`js/core.js:224`) appends to a localStorage key capped at 200 entries. Its only
reader is `PF.store.audit()` — and **`PF.store.audit()` has no caller anywhere in the portal.**
The operations console that once rendered it was deleted along with `PF.STAFF`; the comment three
lines below the store says so. The same applies to the two sibling strings, `"Registry unreachable
— submission queued for delivery"` and `"Registry refused the submission (HTTP n)"`.

What a citizen actually sees on submit is `PF.toast('success', 'Submission received', 'Tracking ID
' + rec.id)` — which is the real defect, and is **V-02** below. The submission is reported as
received whether or not it reached the registry. Replacing an invisible string does not fix that;
the report's recommended replacement copy ("We could not reach the registry. Your answers are
saved on this device…") is the right copy for the wrong surface.

### P-04 — "two statistics blocks on one public page contradict each other" — **not reproducible as stated; a worse defect underneath**

Both blocks read one object. `js/home.js` calls `PF.metrics()` once, at line 3, and uses it for
the hero panel (`#liveCounts`) and the mid-page band (`#heroStats`). They cannot disagree.

The hero figures the report quotes are exactly right. Replaying the seed installer and
`PF.metrics()` in Node reproduces them:

```
HERO  (#liveCounts, rendered immediately):  9 In progress · 2 Action needed · 0% On time
MID   (#heroStats, initial markup):         0 · 0% · 0 · 0
MID   (#heroStats, after intersection):     16 Requests in the registry · 0% Closed within target
                                            · 8 Correspondence types · 6 Received in the last 7 days
```

`#heroStats` renders each tile as literal `0` and stores the real value in `data-count`. An
`IntersectionObserver` at `threshold: 0.4` counts it up **only when the band scrolls into view**.
The audit measured the DOM without scrolling and recorded the start frame. "0 correspondence
types" was the tell: the catalogue on the same page renders eight.

Three genuine defects sit under the false one, and two of them are worse than it:

1. **The zeros are real for anyone who does not scroll** — print, screenshot, a short session, any
   crawler. Four zeros on the front door of the agency's document service.
2. **Every public figure is computed from shipped demonstration data.** `PF.store.all()` calls
   `install()` on first read, writing **16 fabricated records** into the visitor's localStorage
   (`js/core.js:127`). The 9, the 2 and the 16 are seed records, not registry activity. The audit
   treated the numbers as unreliable; they are invented. This is **V-01**.
3. **On a genuinely empty register the portal publishes 100% on time.**
   `m.onTimeRate = m.closed ? Math.round(m.onTime / m.closed * 100) : 100` — the fallback is a
   perfect score with no basis. This is **V-03**.

The report's recommended fix — "source both blocks from one figure" — is already the case. The
fix that is needed is to suppress unavailable tiles, drop the count-up gate, and stop deriving
public statistics from seed data.

### I-11 — "route changes leave the previous screen on display with no transition feedback" — **not reproducible**

Three separate claims, and the router contradicts two of them.

```js
// core/router.js
const PENDING_AFTER_MS = 140;
const setPending = on => { ... s.toggleAttribute('data-route-pending', !!on);
                           out.setAttribute('aria-busy', on ? 'true' : 'false'); };
...
const timer = setTimeout(() => { if (token === generation) setPending(true); }, PENDING_AFTER_MS);
...
out.replaceChildren(stage); out.scrollTop = 0;
...
shell()?.active(p);
```

- **"no spinner, skeleton or disabled state"** — false. After 140 ms the shell gains
  `data-route-pending`, which `styles/app.css:919` renders as an animated 3px progress bar pinned
  under the top bar, with a static reduced-motion variant. The outlet is marked `aria-busy`.
- **"Only the top-bar workspace label changes immediately"** — inverted. `shell().active(p)`, which
  writes the top-bar label, runs *after* `out.replaceChildren(stage)`. The body changes first. The
  report's recommended fix — "do not update the top-bar label until the module has mounted" — is
  what the code already does.
- **"the outgoing screen remains fully rendered"** — true, and deliberate. The comment above the
  mount says so: *"Blanking the outlet first would trade 'no feedback' for 'a flash of nothing'."*
  That is a design decision to argue with, not an oversight.

Sampling four route changes at 100/300/600/900/1200/2000 ms showed the incoming heading present at
100 ms in every case. The report flags itself *"Partly unvalidated — timings were taken offline"*;
they cannot be reproduced here either, and the stale window it describes would have to be measured
on staging. The mechanism it blames, however, is not the mechanism in this build.

---

## The eight half-right findings

### I-01 — "navigation reaches 9 of 29 built screens" — **counts exact, discoverability claim false**

The arithmetic is right to the unit. `config/routes.config.js` declares 29 routes;
`VisibleWorkspaces` in `config/workflow-clarity.config.js` holds 9; rendered group counts are
**2/2/2/2/1**, exactly as reported; all 29 render when addressed by hash.

But *"no entry in the sidebar and no other discoverable link"* is wrong twice:

- `shared/workspace-guide.js:3` — `allWorkspaceCommands()` returns the 9 workspaces **and all 20
  hidden routes**, and `shared/shell.js:168` renders that list in the command palette. The report
  itself notes in §9 that a command palette exists in both platforms on the same shortcut.
- The Command Center ships a *"Guided internal routes"* panel with direct links to Activities,
  FastTrack and Assistant.

The 20 are also not undeclared: `HiddenTechnicalRoutes` gives each one a `visibleThrough` and a
reason. The report's triage recommendation stands on its merits, but it is arguing with a decision
the codebase documents, not with an omission. And the palette's own labelling is a fresh defect —
see **V-05**.

### I-09 — "Intake toolbar crowds its primary action against the viewport edge" — **placeholder truncation real, everything else false**

Measured at the report's own geometry (924 px window, 700 px main pane, left edge 224 px):

| Row | Controls | Right edge |
|---|---|---|
| 1 | search · status select · category select · **Log New Memo** | 910 of 924 |
| 2 | **Tracker** · Emails (0) · ⋯ | 446 |

The toolbar **already wraps onto two rows, filters above actions** — precisely the fix the finding
recommends. "Tracker" is not at the pane edge; it is the leftmost control on row 2. The control
nearest the boundary is "Log New Memo", with 14 px clear.

There is no tab strip. `Tracker` and `Emails (0)` are labelled buttons, both visible; the `⋯`
disclosure (`<details class="cc-more">`) holds *Force Sync* and *Export*, not hidden record views.
The claim that "the available record views are hidden behind an anonymous control" is false.

The truncation is real but marginal: the input's content box is 240 px and the placeholder measures
242 px at its computed font, so it clips by about a character.

### I-13 — "empty states name the problem but not the next step" — **the pattern holds, one exemplar does not exist**

Confirmed verbatim: `"No official records found."` (correspondence), `"No pending approvals"`
(approvals), `"No briefs in this queue."` (briefs). The Approvals pattern is as described and is
the right model.

`"Nothing to show for the current filter."` — the finding's second good example, attributed to
Orchestrator — **appears nowhere in `modules/`.** Orchestrator's empty state is
`"Select a task / Choose a task row to inspect and update it."`, which the report lists correctly
in its own §2 table. The inconsistency the finding describes is real; the evidence for the good
half of it is not.

### I-16 — "CHECKS PASSING 6/9 with no indication of which three fail" — **the fraction is real, the concealment is not**

Rendered: **`Checks passing 5/9`** (this build; nine checks either way, so the denominator is
exact). The *Runtime checks* panel immediately below names every check with a badge:

```
Application boot                                              PASS
Routes registered                                             PASS
Endpoints configured                                          ATTENTION
Endpoint targets injected at deployment                       PASS
Backend load                                                  ATTENTION
Schema current                                                ATTENTION
Viewport API                                                  PASS
Ack endpoint configured                                       ATTENTION
Ack deeplink route                                            PASS
```

"Adjacent rows all read PASS" is false — four read ATTENTION, and each names itself. What survives
is the smaller point: the KPI tile states a bare fraction with no consequence, and failures are not
sorted first. The recommended fix is still worth doing; the user impact ("a number that cannot be
acted on") is overstated.

### I-20 — "two adjacent unlabelled selects; overflow control '···'" — **visually true, programmatically false**

```html
<select data-status   aria-label="Filter by status">  <option>All</option>…
<select data-category aria-label="Filter by category"><option>All</option>…
<summary class="btn ghost cc-more-btn" aria-label="More actions">⋯</summary>
```

Both selects and the overflow control carry accessible names. A sighted user still sees two
identical "All" controls and a bare `⋯`, so the visible-labelling recommendation stands — but
"controls with no name" is not accurate, and a screen-reader user is not affected.

### I-21 — "KPI tiles carry a coloured left accent that varies per tile" — **misuse confirmed, accent claim false**

The accent does not vary. Every `.kpi` on Command Center, Executive, Scan Intake, Diagnostics,
FastTrack, Archive, Briefs and Response Tracking computes the identical
`border-left: 3px rgb(23, 178, 85)`. There is no per-tile colour to give meaning to or remove.

The other half is confirmed exactly, and is the substantive half — KPI tiles carry non-numeric
values across four screens: `Role / EA`, `Byte path / Not configured`, `Checks passing / 5/9`,
`Endpoints / 0/19`.

### P-02 — "404 page drops the site chrome" — **true below 768 px, false above it**

`document-portal/404.html:20-28` ships `<header class="pf-top">` with a four-link `<nav
class="pf-nav">`. Measured:

| Width | 404 nav links | 404 burger | Other pages |
|---|---|---|---|
| 1440 / 1280 / 1024 | **4** | 0 | 4 nav links |
| 768 / 414 / 360 | **0** | **0** | 0 nav links, 1 burger |

So *"0 visible nav links and 0 mobile menu controls at every width"* is wrong at desktop widths and
right at tablet and phone. The cause is precise and worth stating that way: 404.html ships the
desktop nav but **not** `.pf-burger` and not the `.pf-mobile` drawer, so when
`@media (max-width:900px)` hides `.pf-nav` there is nothing to replace it. Its footer is a reduced
bar without the footer navigation columns at every width.

The finding's severity (LOW) and its fix are both right. Its evidence line needs replacing.

### P-03 — "wizard shows a summary toast but does not move the user to the first error" — **true on step 1 only**

`js/submit.js:88`:

```js
if (bad.length) {
  var first = PF.$('#' + bad[0]);
  if (first && first.focus) first.focus();
  PF.toast('error', 'Check the highlighted fields', …);
```

Focus **is** moved, and focusing scrolls the control into view. The finding's recommended fix is
already implemented for steps 2 and 3.

It fails on step 1, for a reason the report did not identify: step 1 pushes `serviceList`, and
`#serviceList` is a `<div role="radiogroup">` with no `tabindex`. `focus()` on it is a no-op. The
same line also calls `err('service', …)`, which looks for `#service` — an id that does not exist,
because the choices are radios named `service`. So step 1 sets no `aria-invalid` either. That
second half is **V-07**.

---

## The five confirmed findings that need a number corrected

### P-01 — mobile overflow — **confirmed, and worse than reported**

| Width | Report | Measured on `main` |
|---|---|---|
| 1440 / 1280 / 1024 / 768 | 0 px | **0 px** |
| 414 | 35 px | **75 px** |
| 360 | 88 px | **128 px** |
| 404.html, all widths | 0 px | **0 px** |

Identical on index, submit, track and support; 404.html, which omits `.pf-top__acts`, is clean at
every width — the isolation the report used is sound and reproduces exactly. The mechanism is
`portal.css:59`:

```css
.pf-top__acts{display:flex;align-items:center;gap:6px;flex:none}
```

`flex:none` sets `flex-shrink:0`, so the cluster never compresses. The recommended fix, including
`min-inline-size:0` on the flex children and a `scrollWidth === clientWidth` regression check at
360 px, is correct.

One claim to drop: *"The element's right edge sits at 448px regardless of viewport."* Measured
right edges are 1290 / 1210 / 984 / 503 / 489 / 488 across the six widths. The cluster is
right-aligned in the wrap above 768 px and hits a floor of roughly 490 px below it. The floor is
the defect; "regardless of viewport" is not what happens.

### I-03 — Command Center KPI band — **confirmed at ≤ 1024 px only**

At the report's own geometry (924 px window, 700 px pane) the layout reproduces almost exactly:

| | Report | Measured |
|---|---|---|
| Tiles 1–4 | x = 224 / 402 / 579 / 757, w = 168 | x = 238 / 409 / 579 / 750, w = 161 |
| Tile 5 "Dispatched" | second row, x = 224 | second row, x = 238 |
| Empty row to its right | 530 px | ~529 px |

The inert declaration is confirmed live: `.cc-kpi-band` computes `display: block` while declaring
`grid-template-columns: repeat(3, 1fr)` at this width. It is dead CSS and should go.

The qualification the finding omits: **at 1280 and 1440 all five tiles sit on one row** (y = 116,
219 px each). The orphan appears at 1024 and below. It is a breakpoint defect on "the platform's
most-used screen", not an unconditional one, and `repeat(auto-fit, minmax(160px, 1fr))` remains
the right fix.

### I-04 — Executive Dashboard — **confirmed; the heading structure is described wrongly**

`modules/executive.js:18` confirms both halves:

```js
${kpis([['Overdue',over.length],['Awaiting Decision',awaiting.length],
        ['On Track',rows.length-awaiting.length],['Role',r]])}
…
<span class="tag overdue">Overdue: …</span><span class="tag awaiting">Awaiting Decision: …</span>
<span class="tag ok">On Track: …</span>
```

The fourth KPI slot holds a role, and `role()` returns `'EA'` for the default
`dgsregistry@nitda.gov.ng` profile — so "ROLE / EA" in a counter slot is exactly right.

The report says *"top bar 'Executive Dashboard' above H1 'Executive Dashboard'"*. Measured, the top
bar reads "Executive Dashboard" and the page H1 reads **"DGCEO Correspondence & Decision Hub"**.
The duplicate is an `<h2>` inside the inbox panel. The words do appear twice; the structure does
not. The fix — drop the in-page duplicate, move the role beside the user identity — is unaffected.

### H-01 — breakpoint scales — **confirmed; "only 900px is shared" is wrong**

The portal figure is exact: **600, 640, 900, 960, 1080** — five values, no more.

The internal figure is 15 `max-width` values, not fourteen: 480, 520, 560, 600, 720, 768, **820**,
900, 980, 1000, 1024, 1100, 1180, 1280, 1500. The report's list omits 820 px, which sits inside an
orientation rule and was probably counted there. Three height values (640, 760, 900) and three
orientation rules — both exact.

**600 px is shared as well as 900 px**, and shared for the reason the finding is about: both
platforms ship the same `styles/base.css` and `styles/layout.css`, each carrying
`@media (max-width: 600px)`. Two of five, not one. The finding's direction is unchanged.

### H-02 — icon system — **confirmed, and understated**

Read from the live DOM, the nine navigation glyphs are exactly the report's list —
`⌂ ⚖ ✉ ⌘ ↔ ✓ ➤ • ⚙` — and **"Email Desk" is a bullet**, because `correspondence-email` has no
entry in the icon map and falls through to the `'•'` default. `◎ ▧ ◉` are confirmed in
`config/source-views.config.js`. The portal sprite is 8,017 bytes, to the byte.

The inventory is larger than 17. The shell and source-view configs alone contain **21 distinct
symbol characters** — the report's list plus `▣ ▤ ◇ ◌ ✦` — and six routes are iconified with bare
ASCII letters (`R`, `∑`, `E`, `O`, `D`, `U`). Two routes share `▣`. See **V-06**.

---

## The seventeen findings confirmed as written

Quoted strings below were found verbatim; measurements reproduce the report's own.

| Ref | Confirmation |
|---|---|
| **I-02** | 13 of 29 navigation labels differ from their page heading — **exact**. Every route navigated, every heading read from the DOM. The mismatches are `ecm-erp-charter`, `correspondence`, `response-tracking`, `orchestrator`, `fasttrack`, `approvals`, `dispatch`, `scan-intake`, `executive`, `lookup`, `settings`, `archive`, `correspondence-email`. **All seven headings the report marked *unvalidated* now resolve, and all seven match their labels** — `bulk-assignment`, `comments`, `projects`, `reports`, `statistics`, `assistant`, `user-admin`. The count does not move |
| **I-05** | `modules/scan-intake.js` — KPI tile `['Byte path', 'Not configured']`, eyebrow "Deposit unavailable", and *"No scan endpoint is configured. Set `SCAN_INTAKE` in `config/config.local.js` under `window.DGO_CONFIG.endpoints`"* — verbatim, on a screen with no navigation entry |
| **I-06** | `index.html:52-56` — *"DGO could not start"*, *"an ES module in the graph most likely failed to resolve"*, *"Serve the app over HTTP (not `file://`) and confirm every module under `config/`, `core/`, `modules/`"*, 15-second watchdog — verbatim |
| **I-07** | All four quoted strings present: *"Runtime data synchronization requested"* (`acknowledgment.js`), *"the analysis endpoint could not be reached"* and *"Synchronize current DG/CEO correspondence records…"* (`correspondence.js`), *"Review report email payload before backend execution."* (`reports.js`), *"Clear all endpoint fields? Live backend calls will be unavailable after Save until URLs are restored."* (`settings.js`) |
| **I-08** | `modules/settings.js:13` — `<label>MAX_BULK_ASSIGN`, every one of the 19 endpoint keys used verbatim as its own field label, `placeholder="Override URL (optional)"`, persona select over `['admin','executive','registry','general']`, and `<b>19</b> total endpoints`. This build renders **19 total · 0 configured**; the audited package rendered 19/19, which corroborates the report's closing security note about packaged endpoint URLs |
| **I-10** | Confirmed and **understated**. At 924×540 the identity block starts at y = 452 and **five of the nine navigation items sit at or below it** — beginning with `Tracking & Monitoring`, the CONTROL group's first item, exactly as reported. CONTROL, CLOSURE and SYSTEM are all out of reach with no scroll affordance |
| **I-12** | `core/welcome-experience.js:46` — `<button class="wel-btn secondary" data-sso>Continue with NITDA SSO (skip OTP)</button>`, directly beneath `Send Verification Code`, above the note *"Sessions are logged for auditability."* — verbatim. The handler waits 650 ms and calls `setPhase('verified')`; it authenticates nothing |
| **I-14** | `modules/executive.js:18` — `'<div class="empty">Click Sync Live Data to fetch flows.</div>'` — verbatim |
| **I-15** | `index.html:17` renders `<div class="boot">Loading DGO Digital Operations…</div>`; the only rule that matches it in the entire stylesheet is `.boot,.fatal{padding:30px}`. No brand, no indicator, no centering |
| **I-17** | `<title>DGO Digital Operations — R11.6 Obsidian Harmonized Design System Runtime</title>`, and `document.title` is never assigned at runtime — measured identical on all 29 routes. The sign-in success panel also reads *"Your **R11.6** session is secured"* (the report quotes "NITDA" here — build drift, and it strengthens the finding) |
| **I-18** | Rendered live on Diagnostics: *"Posture: PROVISIONED — INERT"*, *"Identity: client-asserted (localStorage profile) · Role source: local"*, *"missing configuration: OTP_GENERATE, OTP_VERIFY"*, *"Activation procedure: see `docs/architecture/AUTHENTICATION_CONTRACT.md`."* — all four verbatim |
| **I-19** | `core/state.js:3` — `profile:{name:'Registry', email:'dgsregistry@nitda.gov.ng', persona:'admin'}`. Rendered in the sidebar identity block, the top-bar avatar cluster and the Administration persona select — three places, as reported |
| **I-22** | **Confirmed, and this settles the question the report left open.** It flagged this as needing computed-style confirmation. The four source cards are `<a class="source-guidance-card">` with computed `text-decoration-line: underline` on the anchor; decoration propagates across the whole decoration box, so the `<b>` title and the `<span>` prose are both underlined despite computing `none` themselves. Non-interactive prose is styled as a link |
| **P-05** | **Exact.** `index`, `track` and `support` footers list *Regulatory or compliance filing*; `submit.html` lists *Proposal or EOI* in the same slot. The catalogue's name for it is *Proposal or expression of interest* |
| **P-07** | The sovereignty line needs 312 px and has 312 px at ≥ 768 — **exactly at the truncation threshold**, as reported — then 259 px at 414 and 208 px at 360, truncating at both. Mechanism: `.pf-ribbon__in{white-space:nowrap;overflow:hidden}` with `text-overflow:ellipsis` on the sovereignty span and `flex:none` on `.pf-ribbon__end`, which refuses to yield the space |
| **H-03** | Byte-exact. `assets/dgo-mark.svg` is **329 bytes** and is the internal package's only brand asset. The portal ships `ds/logo/nitda-lockup.png` (112,180), `nitda-lockup-white.png` (12,383), `nitda-symbol.png` (56,669) |
| **H-04** | Byte-exact. `document-portal/ds/fonts/CascadiaMono-Regular.woff2` is **143,932 bytes**; the internal package contains no font files at all |

§9's remaining "consistent" claims also check out: both platforms ship the same
primitive / semantic / component / density / theme-dark / theme-light / theme-hc token layers,
several byte-identical; `components.css` is **39,333** (portal) against **39,791** (internal), to
the byte; and the command palette is bound to Ctrl/Cmd+K on both sides
(`shared/accessibility.js:4`, `document-portal/js/core.js:788`).

One is not true — see V-04.

---

## Seven defects the report did not record

### V-01 · The portal publishes statistics derived from shipped demonstration data — **blocker**

`document-portal/js/core.js:127` installs **16 fabricated correspondence records** into every
visitor's localStorage the first time the store is read, complete with named submitters, employer
organisations, email addresses, officer assignments and decision notes. Every public figure on the
front door — the "9 in progress", the "2 action needed", the registry activity panel, the
per-category counts on the service catalogue — is computed from them.

This is the finding `P-04` was reaching for. The report concluded the panel was untrustworthy
because it contradicted itself; it is untrustworthy because it is fiction. Removing the seed
installer from the deployed build is a prerequisite for anything else in `P-04`.

### V-02 · A submission is reported as received when it was never dispatched — **blocker**

`submit.js:498` fires `PF.toast('success', 'Submission received', 'Tracking ID ' + rec.id)` on the
local write. `dispatchToWorkflow()` returns silently when no endpoint is configured (`P-06`'s
string is the only trace, and nothing reads it). The citizen gets a success toast and a tracking ID
for a document the registry never received, and `track.html` will then resolve that ID against the
local store and show them a timeline for it.

This is the citizen-facing consequence the report attributed to a message it could not have seen.
It should replace `P-06` as the portal's third release gate.

### V-03 · An empty register publishes 100% on-time performance — **high**

`m.onTimeRate = m.closed ? Math.round(m.onTime / m.closed * 100) : 100`. With demonstration data
this reads 0%, which the report saw and correctly objected to. With the seed data removed — the fix
`V-01` requires — it reads **100%**. Suppressing a tile whose value is unavailable, which `P-04`
recommends, is the right fix for both directions; the fallback constant is the bug.

### V-04 · The two platforms do not share a status vocabulary — **high**

§9 lists *"Status vocabulary: Received · Validation · Under review · Action required · Approved
reads the same on both sides"* under **CONSISTENT — PRESERVE**, and Shared UX Standard 6 asks for
it to be held as a governed list. It is not consistent, and it is the largest unreported divergence
between the two platforms.

| | Values |
|---|---|
| Portal (`js/data.js:48`) | Received · Validation · Under review · Action required · Approved · Declined · Withdrawn |
| Internal (`modules/correspondence.js:21`) | Pending · Accepted · Declined · Delegated · Archived |

**Only "Declined" is common to both.** A submission arriving from the portal is normalised to
`Pending` by `trackerShape()`, and there is no mapping layer in either direction. A citizen reading
"Under review" and the registry officer holding the same record are looking at different words for
different states, and the shared design system makes them look like one vocabulary.

### V-05 · The command palette exposes the 20 hidden routes under raw slugs — **medium**

`shared/workspace-guide.js:6` labels every hidden technical route
`route.replace(/-/g, ' ')` — so the palette lists *"scan intake"*, *"user admin"*, *"operator
hud"*, *"bulk assignment"* in lower case beside the nine properly-named workspaces. This is the
discoverability path `I-01` said did not exist, and it violates `I-02`'s own principle — one name
per screen, used everywhere — in the one surface that reaches all 29.

### V-06 · Two routes share an icon, and six use ASCII letters as icons — **medium**

`shared/shell.js:15`: `single-assignment` and `registry` are both `▣`. `reports`, `statistics`,
`executive`, `operator-hud`, `diagnostics` and `user-admin` are `R`, `∑`, `E`, `O`, `D`, `U` — bare
characters standing in for icons. `H-02`'s remedy covers this, but the collision and the letter
glyphs are worth naming so they are not carried across in a sprite migration.

### V-07 · Step 1 of the submission wizard marks no invalid field — **low**

`submit.js:70` calls `err('service', …)`, which resolves `#service-err` for the message but
`#service` for the `aria-invalid` flag. No element has that id — the choices are radios named
`service` inside `#serviceList`. So on step 1 the error text appears with no programmatic
association to the control, and, as `P-03` covers, focus does not move either. Steps 2 and 3 are
correct.

---

## What this changes in the report's recommended actions

The report's ordering is sound. Three substitutions:

1. **Portal, before any release** — `P-01` and `P-07` stand as written. `P-04` stands, but the work
   is `V-01` (stop shipping seed data), `V-03` (the 100% fallback) and removing the count-up gate,
   not reconciling two blocks that already share a source. **`P-06` should be struck and `V-02`
   put in its place** — the citizen-facing defect is the false success receipt, not an unreachable
   log string.
2. **Internal, before pilot** — `I-01` and `I-02` stand exactly as written; the counts are right and
   nothing in this assessment softens them. Add `V-05`, because the palette is where `I-02`'s
   one-name rule will be tested across all 29 routes.
3. **Both, before sign-off** — `H-01` and `H-02` stand. Add `V-04` to the harmonisation list, and
   move the status vocabulary out of the CONSISTENT column.

`I-11` should be withdrawn or rewritten against staging. `I-09`, `I-13`, `I-16`, `I-20`, `I-21`
and `P-02` keep their fixes and need their evidence lines replaced.

The report's two limitations are correctly stated and both survive: **every populated-data state in
both platforms remains unvalidated**, and the closing note about packaged endpoint URLs acting as
bearer credentials is a real security matter that this assessment did not examine beyond confirming
the 19-endpoint registry it refers to.
