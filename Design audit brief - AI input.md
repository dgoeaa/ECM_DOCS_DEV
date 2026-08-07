<!-- PDF_PAGE_01_START -->
VISUAL UX & INTERACTION AUDIT
NITDA · DGO DIGITAL OPS + INTELLIGENT PORTAL
A U D I T  R E P O R T
Visual, layout and
interaction audit
Two platforms in scope: the main internal platform (DGO Digital Ops, build
6422c484efabbb73) and the document portal (NITDA Intelligent Portal, build
912dd39dae014544). Both were audited from their delivered packages, rendered
and instrumented in a browser. No new platforms, architecture or workflows
are proposed.
MAIN INTERNAL PLATFORM
Not ready
Navigation reaches 9 of 29 built screens. Developer-
facing configuration and diagnostics are exposed as
user surfaces. Populated data states unvalidated.
DOCUMENT PORTAL
Conditionally ready
Structure, copy and form design are strong. Blocked
on measured mobile layout overflow, contradictory
public metrics and configuration language in the
submission path.
EVIDENCE BASIS AND ITS LIMITS
Both packages were extracted and run in a browser. Findings below are drawn from rendered output and from
direct DOM and computed-style measurement. No Figma frames, design references or prior screenshots were
supplied, so nothing here is judged against an intended design; every finding is an observation of the built artefact.
Endpoints were neutralised before rendering so that the audit could not invoke live government workflows.
Consequence: every populated table, list, record detail, document viewer and result state in both platforms is
UNVALIDATED. Only empty, error, loading and structural states were observed with data. Where a finding depends
on populated content it is marked as such and must be re-audited against a staging environment with
representative records.
1 · Executive summary
Main internal platform — UX readiness
The platform is functionally broad and visually coherent within a screen, but it is not
yet an operator product. Twenty of twenty-nine built screens have no route into them
from the navigation, so most of the delivered capability is unreachable by an ordinary
<!-- PDF_PAGE_01_END -->

<!-- PDF_PAGE_02_START -->
user. Where navigation does reach a screen, the label in the sidebar frequently does
not match the heading on the page, which breaks the basic contract that a user knows
where they landed. Several screens are engineering instruments rather than operator
surfaces: Administration presents raw configuration keys as form fields, Diagnostics
presents provisioning posture and repository file paths, and Scan Intake's empty
state instructs the user to edit a JavaScript configuration file. The sign-in screen
carries a build identifier and offers a control labelled as skipping the one-time-code
step. None of these are suitable for controlled live operationalisation as presented.
Document portal — UX readiness
The portal is markedly more finished. The four-step submission wizard, the field-level
validation copy, the service catalogue and the helpdesk page are well-structured and
written in plain language aimed at the public. Three things stop it being releasable. Its
header action cluster is fixed at 448 pixels, which pushes the page 35 pixels wide of a
414-pixel viewport and 88 pixels wide of a 360-pixel viewport on every content page
— measured, reproducible, and affecting the majority of Nigerian mobile traffic. Its
published performance figures contradict each other on the same page. And its
submission path can surface the phrase "No registry endpoint configured" to a
member of the public at the moment they submit a document.
RECOMMENDED NEXT ACTIONS, IN ORDER
1. Portal, before any release: fix the 448px header cluster (P-01), reconcile or remove the public metrics (P-04),
and replace the endpoint-configuration message in the submission path (P-06).
2. Internal, before pilot: decide for each of the 20 unreachable screens whether it ships, hides or is removed (I-
01), then align every navigation label with its page heading (I-02).
3. Internal, before pilot: move Administration's endpoint editor, Diagnostics and the Operator HUD behind an
explicitly technical role, and rewrite the operator-facing copy that currently names endpoints, payloads,
backends and modules (I-05 to I-08).
4. Both, before sign-off: run a populated-data audit against staging. Every table, record view and document view
in this report is unvalidated.
5. Both, before sign-off: agree one breakpoint scale and one icon set across the two platforms (H-01, H-02).
2 · Screen and experience inventory
Main internal platform
Twenty-nine routes are declared in config/routes.config.js and twenty-nine
matching modules are registered at boot. Navigation is built from a filtered subset.
The Nav column below records whether the route appears in the sidebar.
<!-- PDF_PAGE_02_END -->

<!-- PDF_PAGE_03_START -->
Route
Nav label
Page heading (observed)
Group
Nav
home
Command Center
Command Center
START HERE
yes
ecm-erp-charter
ERP–ECM Charter
ERP–ECM Scope, Capability &
Operating Boundary Charter
START HERE
yes
correspondence
Intake & Assignment
Correspondence
OPERATIONS
yes
orchestrator
My Work / Departmental Work
Task Orchestrator
OPERATIONS
yes
response-tracking
Tracking & Monitoring
Response Tracking
CONTROL
yes
approvals
Review & Approval
Approvals
CONTROL
yes
dispatch
Dispatch & Archive
Dispatch
CLOSURE
yes
correspondence-email
Email Desk
Correspondence Email Desk
CLOSURE
yes
settings
Administration
Settings
SYSTEM
yes
activities
Activities
Activities
OPERATIONS
no
single-assignment
Assignment Desk
Assignment Desk
OPERATIONS
no
bulk-assignment
Bulk Assignment
unvalidated
OPERATIONS
no
acknowledgment
Acknowledgment Queue
Acknowledgment Queue
OPERATIONS
no
scan-intake
Scan Intake
Registry Scan Intake
OPERATIONS
no
registry
Registry
Registry
OPERATIONS
no
comments
Comments
unvalidated
OPERATIONS
no
lookup
Lookup
Lookup & Direct Action
OPERATIONS
no
fasttrack
FastTrack SLA
FastTrack Web Ops
CONTROL
no
briefs
Briefs & Submissions
Briefs & Submissions
CONTROL
no
meetings
Meetings
Meetings
CONTROL
no
projects
Projects
unvalidated
CONTROL
no
reports
Reports
unvalidated
CONTROL
no
statistics
Statistics
unvalidated
CONTROL
no
executive
Executive Dashboard
DGCEO Correspondence & Decision
Hub
CONTROL
no
archive
Archive
Archive Evidence
CLOSURE
no
assistant
Assistant
unvalidated
SYSTEM
no
operator-hud
Operator HUD
Operator HUD
SYSTEM
no
diagnostics
Diagnostics
Diagnostics
SYSTEM
no
user-admin
User Administration
unvalidated
SYSTEM
no
Shaded rows are routes with no navigation entry. Amber headings differ from their navigation label. "Unvalidated" heading means the module
was not rendered to a heading during the audit and must be checked directly.
<!-- PDF_PAGE_03_END -->

<!-- PDF_PAGE_04_START -->
Main internal platform — shared patterns and states observed
Layout types
Persistent left sidebar (grouped, five groups) + top bar (workspace label, six icon actions, avatar)
+ scrolling main + footer. Two-pane master/detail (Intake, Orchestrator, Approvals, Briefs). KPI
band + content. Full-width document/charter reading view.
Forms
Assignment Desk (source picker), Scan Intake (9 inputs, file upload), Administration (profile +
endpoint override editor), OTP sign-in (identifier, channel, 6-digit code).
Tables and lists
Charter comparison tables (4), FastTrack table, Archive evidence table. All record lists rendered
empty. Populated table layout is unvalidated.
Empty states
"No official records found." · "No records / Nothing to show for the current filter." · "No pending
approvals / Submit a new approval request to begin." · "No briefs in this queue." · "Select
correspondence" · "Select a task / Choose a task row to inspect and update it." · "Select a
request" · "No item selected".
Loading states
Pre-boot: unstyled left-aligned text "Loading DGO Digital Operations…", no brand, no indicator.
Route transition: none observed — the previous screen stays fully rendered during the swap.
Error states
Boot watchdog fatal page (15s). Scan Intake "DEPOSIT UNAVAILABLE". Executive "Click Sync Live
Data to fetch flows."
Success states
"Identity verified — Welcome, {name}. Your NITDA session is secured and ready for Daily
Operations." Post-action confirmations are unvalidated (require live endpoints).
Document portal
Page
Purpose
Views and states observed
index.html
Front door
First-visit welcome dialog · hero + live registry activity panel · three-
route card grid · four-stage explainer · statistics band · service
catalogue (6 cards) · "Before you start" checklist · FAQ accordion ·
footer
submit.html
Four-step submission
Step 1 Type (6 radio cards + handling) · Step 2 Requester (6 fields) ·
Step 3 Document · Step 4 Review · progress rail · validation toast + per-
field errors · draft persistence notice · helpdesk cross-link. Steps 3–4
and the submitted receipt are unvalidated.
track.html
Status lookup
Lookup form (tracking ID + email) · pre-search state. Result timeline,
not-found and error states unvalidated.
support.html
Helpdesk
Hero + three stat tiles · case form · FAQ accordion · contacts. Case-
created confirmation unvalidated.
404.html
Not found
Standalone page. Does not carry the standard header or footer
navigation.
Shared, missing and duplicated screens
Shared patterns. Both platforms use the same design-system token layers and
component stylesheet (tokens.primitive / semantic / component,
components.css) and both use the same status vocabulary (Received, Under
review, Action required, Approved). Both present a persistent chrome with a search
entry point.
<!-- PDF_PAGE_04_END -->

<!-- PDF_PAGE_05_START -->
Missing or unclear. The internal platform has no sign-out screen, no session-expiry
state and no not-found screen equivalent to the portal's 404 — an unknown hash
currently has undefined behaviour and was not validated. The portal has no account
or saved-requests view, though track.html states requests "will appear here for one-
tap access", implying one.
Duplicated or overlapping. Three internal routes cover assignment (single-
assignment, bulk-assignment, plus assignment inside correspondence). Archive
appears both as its own route and inside the "Dispatch & Archive" navigation label.
Lookup, Registry and Activities all present record-search surfaces.
3 · Layout and visual structure findings
Severity: Blocker stops release · High fix before pilot · Medium fix before wide rollout · Low backlog.
P-01 · Header action cluster forces horizontal overflow on every mobile viewport
BLOCKER
Platform · Screen
Document portal · index, submit, track, support (all pages carrying the standard header)
Section
Top bar — search + theme + command-palette cluster, .pf-top__acts
Issue
The cluster does not shrink below a fixed width, so the document is wider than the viewport at common
phone sizes.
Evidence
Measured in-browser across six viewport widths. The element's right edge sits at 448px regardless of
viewport. Document overflow: 0px at 1440/1280/1024/768; 35px at 414px; 88px at 360px. Identical on
index, submit, track and support. 404.html, which omits the header, measures 0px overflow at every
width — isolating the cause.
User impact
The page scrolls sideways on a phone. Content is clipped at the right edge, the layout drifts as the user
scrolls vertically, and form fields can be pushed partly off-screen. This is the primary access route for the
public.
Recommended fix
Below the 640px breakpoint, collapse the cluster to a single search icon that opens the existing command
palette, and move the theme control into the mobile menu. Set min-inline-size:0 on the flex children
so they can compress, and add a regression check asserting scrollWidth === clientWidth at 360px
on every page.
<!-- PDF_PAGE_05_END -->

<!-- PDF_PAGE_06_START -->
I-03 · Command Center KPI band orphans its fifth tile
HIGH
Platform · Screen
Main internal platform · Command Center (home)
Section
KPI band — .cc-kpi-band > .kpis
Issue
Five metrics are laid into a four-column grid, leaving one tile alone on a second row beside three columns
of dead space. Separately, the outer band declares grid-template-columns: repeat(3, 1fr) while
computing display: block — the declaration is inert and contradicts the four-column grid that actually
renders.
Evidence
Measured: tiles 1–4 at y=64, x=224/402/579/757, each 168px wide; tile 5 ("Dispatched") at y=166,
x=224, 168px wide, with 530px of empty row to its right.
User impact
Dispatched reads as a lesser or separate metric than the other four. The dead row costs vertical space on
the platform's most-used screen and weakens the sense that these five numbers are one set.
Recommended fix
Use repeat(auto-fit, minmax(160px, 1fr)) on the tile grid so five tiles fill one row at desktop
widths and wrap evenly below. Delete the inert grid-template-columns on the outer band.
I-04 · Executive Dashboard states the same three metrics twice, and mixes a role label into the
metric band
HIGH
Platform · Screen
Main internal platform · Executive Dashboard (executive)
Section
KPI band, action row, page header
Issue
Overdue, Awaiting Decision and On Track appear as large KPI tiles at the top and again as small chips
below the in-page heading. The fourth KPI slot holds "ROLE / EA" — a text attribute styled exactly like a
count. The workspace name also appears twice, once in the top bar and once as an in-page H1.
Evidence
Rendered screen: KPI row "OVERDUE 0 · AWAITING DECISION 0 · ON TRACK 0 · ROLE EA"; below it,
chips "Overdue: 0 · Awaiting Decision: 0 · On Track: 0"; top bar "Executive Dashboard" above H1
"Executive Dashboard".
User impact
A director scanning for exceptions reads the same three numbers in two typographic registers and cannot
tell which is authoritative. "EA" in a counter slot reads momentarily as a value.
Recommended fix
Keep the KPI tiles, delete the duplicate chips. Move the role indicator next to the user identity in the top
bar. Drop the in-page H1 wherever the top bar already names the workspace — this applies platform-
wide, not only here.
<!-- PDF_PAGE_06_END -->

<!-- PDF_PAGE_07_START -->
I-09 · Intake & Assignment toolbar crowds its primary action against the viewport edge
MEDIUM
Platform · Screen
Main internal platform · Intake & Assignment (correspondence)
Section
Filter toolbar and tab strip
Issue
Search, two unlabelled "All" selects, the primary "Log New Memo" button and a secondary "Tracker"
button share one row with no wrapping rule; at a 700px content width "Tracker" reaches the pane edge.
The search placeholder is cut mid-word. Below, a tab strip shows one tab plus a "···" overflow control, so
most tabs are hidden behind an unlabelled menu.
Evidence
Rendered at 700px main width: placeholder truncates to "Search records, IDs, sender or referen";
"Tracker" abuts the right boundary; tab strip renders "Emails (0)" and "···".
User impact
On a laptop or a split screen the registry officer's main action sits at the edge of the pane and the
available record views are hidden behind an anonymous control.
Recommended fix
Allow the toolbar to wrap onto two rows below ~900px: filters on one row, actions on the next. Label the
two selects ("Status", "Source") rather than repeating "All". Show tab labels down to the pane's minimum
width and reserve the overflow menu for genuine excess.
I-10 · Sidebar labels clip at the fold
MEDIUM
Platform · Screen
Main internal platform · all screens (shell)
Issue
The sidebar's scrollable region ends above a fixed identity footer; at a 540px-tall viewport the CONTROL
group's first item renders half-cut with no scroll affordance visible.
Evidence
Rendered on every internal screenshot: "Tracking &" is visible, its second line is clipped by the identity
block.
User impact
On a laptop the user cannot tell that further navigation exists below the fold, compounding I-01.
Recommended fix
Add a scroll shadow or fade at the boundary and ensure the nav list clips on a whole row. Shorten multi-
line labels (see I-02) so items occupy one line.
P-02 · 404 page drops the site chrome
LOW
Platform · Screen
Document portal · 404.html
Evidence
Measured: 0 visible nav links and 0 mobile menu controls at every width, against 4–5 nav links on all
other pages.
User impact
A user who mistypes a URL loses the header and footer navigation and has no route to Submit, Track or
Support other than the page's own body links.
Recommended fix
Render 404.html inside the same header/footer shell as every other page. It is the one page where
wayfinding matters most.
4 · User experience and interaction findings
<!-- PDF_PAGE_07_END -->

<!-- PDF_PAGE_08_START -->
I-01 · Navigation reaches 9 of 29 built screens
BLOCKER
Platform · Screen
Main internal platform · shell navigation
Issue
Twenty routes are registered and render correctly when addressed directly, but have no entry in the
sidebar and no other discoverable link. Among them: Activities, Assignment Desk, Bulk Assignment,
Registry, Acknowledgment Queue, Scan Intake, Briefs, Meetings, Projects, Reports, Statistics, Executive
Dashboard, Archive, Lookup, User Administration.
Evidence
29 entries in routes.config.js; 9 in the five navigation groups derived from VisibleWorkspaces.
Each of the 20 was reached by hash and rendered its module. Group counts in the sidebar are 2/2/2/2/1.
User impact
The product's stated principle — that a user can register, minute, assign, track, review, dispatch, close and
archive a matter without confusion — cannot be satisfied, because most of the steps have no route. Scan
Intake in particular is one of the four declared ingestion sources and is unreachable.
Recommended fix
Triage each of the 20 into ship / defer / delete. Add the shipped ones to their declared groups. For
deferred ones, remove the route registration so an addressable but unsupported screen cannot be
reached by a shared link. Where a screen is genuinely a sub-view of another (Assignment Desk within
Intake, Archive within Dispatch), link it from its parent rather than the sidebar and say so in the parent's
UI.
I-02 · Thirteen navigation labels disagree with the heading of the screen they open
HIGH
Platform · Screen
Main internal platform · 13 of 29 routes (marked amber in §2)
Issue
Several are not abbreviations but different concepts: "Intake & Assignment" opens "Correspondence";
"My Work / Departmental Work" opens "Task Orchestrator"; "Administration" opens "Settings";
"Executive Dashboard" opens "DGCEO Correspondence & Decision Hub"; "Dispatch & Archive" opens
"Dispatch" while a separate "Archive" route opens "Archive Evidence".
Evidence
Each route was navigated and its first heading read from the DOM; 13 of 29 differed from the configured
label.
User impact
Users cannot build a reliable mental model of the platform, cannot refer to screens consistently in
training or handover, and cannot tell whether "Dispatch & Archive" and "Archive" are the same place.
Recommended fix
Agree one name per screen and use it in the sidebar, the top bar, the page heading, the browser title and
all documentation. Where the longer form carries meaning ("DGCEO Correspondence & Decision Hub"),
make it the single name and let the sidebar wrap.
<!-- PDF_PAGE_08_END -->

<!-- PDF_PAGE_09_START -->
I-11 · Route changes leave the previous screen on display with no transition feedback
HIGH
Platform · Screen
Main internal platform · all routed screens
Issue
Modules are code-split and loaded on first visit. During the swap the outgoing screen remains fully
rendered — including its heading and its KPI values — with no spinner, skeleton or disabled state. Only the
top-bar workspace label changes immediately.
Evidence
Measured with endpoints neutralised: at 900ms and at 1200ms after a hash change, the DOM still
returned the previous module's heading for several routes; at 2000ms all resolved correctly. Reproduced
on registry, meetings, dispatch and acknowledgment.
User impact
For roughly a second the top bar names one workspace while the body shows another. An operator acting
quickly can read a number from the wrong screen, or click an action believing the new screen has loaded.
Recommended fix
Clear the main region and show a skeleton matching the incoming layout as soon as the route changes.
Do not update the top-bar label until the module has mounted, or update both at once.
Status
Partly unvalidated — timings were taken offline. On a real network with data the window will be longer,
not shorter, but must be measured on staging.
I-12 · Sign-in offers a control that names itself as skipping the one-time code
HIGH
Platform · Screen
Main internal platform · welcome / sign-in
Issue
Beneath "Send Verification Code" sits a full-width secondary button reading "Continue with NITDA SSO
(skip OTP)". Whatever it does technically, the label tells every user that the verification step is optional,
and it was the path used to enter the platform during this audit.
Evidence
Rendered sign-in screen. Diagnostics separately reports "Posture: PROVISIONED — INERT · Identity:
client-asserted (localStorage profile) · Role source: local · Authentication is provisioned but INERT."
User impact
On a platform whose own copy says sessions are logged for auditability, an advertised bypass
undermines user trust in the audit trail and invites staff to use the weaker path by default.
Recommended fix
Rename to "Continue with NITDA single sign-on" and remove the parenthetical. If the control exists only
for pre-production convenience, gate it behind a build flag so it is absent from any live posture. This is a
UX finding about the label; the underlying authentication posture is outside this audit's scope and should
be reviewed separately.
I-13 · Empty states name the problem but not the next step
MEDIUM
Platform · Screen
Main internal platform · Intake & Assignment, Task Orchestrator, Briefs, Lookup
Issue
"No official records found." and "No briefs in this queue." state a fact and stop. Neither says whether the
cause is an active filter, an empty queue or a failed load, and neither offers an action. Approvals does it
well — "No pending approvals / Submit a new approval request to begin." — and Orchestrator names the
filter — "Nothing to show for the current filter." The pattern is inconsistent.
Evidence
Empty states read directly from each rendered screen.
User impact
During the offline audit every list was empty for the same reason — no data had loaded — yet no empty
state said so. An operator would conclude the queue is clear when in fact the platform failed to reach its
data.
Recommended fix
Adopt one empty-state contract: a cause line, a distinct treatment for "load failed" versus "genuinely
empty" versus "filtered to nothing", and one action — clear filters, retry, or create. Apply the Approvals
pattern everywhere.
<!-- PDF_PAGE_09_END -->

<!-- PDF_PAGE_10_START -->
P-03 · Submission wizard shows a summary toast but does not move the user to the first error
LOW
Platform · Screen
Document portal · submit.html, steps 1 and 2
Issue
On a failed Continue, a toast appears bottom-right — "Check the highlighted fields / 5 fields need
attention." — while the invalid fields may be off-screen. The per-field messages themselves are excellent.
Evidence
Reproduced on both steps. Field messages observed: "Enter a valid email address — this is where your
acknowledgement goes.", "Choose the kind of correspondence you are submitting.", "Enter the
organisation this submission is for."
User impact
On a long step the user is told a count but must hunt for the fields. On mobile, where the toast spans the
full width, it can obscure content.
Recommended fix
Move focus to the first invalid control on failed validation and scroll it into view. Keep the toast as a count
only, or replace it with an inline error summary at the top of the step listing each field as a link.
5 · UI feedback findings
Ref
Platform ·
Screen
Message
type
Issue
User impact · recommended fix
P-06
Portal · submit
Inline /
status
The submission path can display "No
registry endpoint configured —
submission held locally" to a member
of the public.
The citizen is told an internal configuration fact
and cannot tell whether their document was
received. Replace with a plain outcome and an
action: "We could not reach the registry. Your
answers are saved on this device — try again,
or contact the helpdesk quoting the time." Log
the technical cause server-side only.
I-05
Internal · Scan
Intake
Empty
state
"DEPOSIT UNAVAILABLE — No scan
endpoint is configured. Set
SCAN_INTAKE in
config/config.local.js under
window.DGO_CONFIG.endpoints." A
KPI tile reads "BYTE PATH / Not
configured".
A registry clerk is given a developer instruction
they cannot act on, on a screen that is itself
unreachable from navigation. Show "Scan
deposit is not yet switched on for this site.
Contact IT support." and move the
configuration detail to Diagnostics. Remove
"BYTE PATH" from the operator KPI band.
I-06
Internal · boot
Fatal error
"DGO could not start … an ES module in
the graph most likely failed to resolve
… Serve the app over HTTP (not
file://) and confirm every module
under config/, core/, modules/ …".
Reproduced during this audit.
The screen a user sees when the platform is
down speaks only to a developer. Show a plain
failure notice with a retry button and a support
contact; keep the diagnostic text behind a
"technical details" disclosure.
I-07
Internal ·
multiple
Confirm /
toast
Operator-facing strings name internals:
"Runtime data synchronization
requested" · "the analysis endpoint
could not be reached" · "Synchronize
current DG/CEO correspondence
records through the governed endpoint
path?" · "Review report email payload
before backend execution." · "Clear all
endpoint fields? Live backend calls will
be unavailable after Save until URLs are
restored."
Confirmation dialogs are where a user decides
whether to proceed; jargon at that moment
causes either paralysis or unconsidered clicks.
Rewrite in terms of the record and the
outcome: "Send this report by email? It will go
to 4 recipients." Reserve "endpoint", "payload",
"backend" and "runtime" for Diagnostics.
<!-- PDF_PAGE_10_END -->

<!-- PDF_PAGE_11_START -->
Ref
Platform ·
Screen
Message
type
Issue
User impact · recommended fix
I-14
Internal ·
Executive
Empty
state
"Click Sync Live Data to fetch flows."
The dashboard loads empty and
requires a manual action; "flows" is
Power Automate terminology.
A director opening their dashboard sees zeros
and an instruction. Load data automatically on
entry and keep refresh as a secondary control;
if a manual step is required, say "No data
loaded yet — select Refresh to load today's
correspondence."
I-15
Internal · boot
Loading
Pre-boot state is unstyled left-aligned
body text, no logo, no progress
indicator, on a white page. The 15-
second watchdog is the only feedback
until it fires.
Fifteen seconds of an apparently blank page
reads as a broken link. Show the brand mark
and an indeterminate progress indicator
immediately, and surface a "still loading"
message at 5 seconds.
I-16
Internal ·
Diagnostics
Status
"CHECKS PASSING 6/9" is presented
with no indication of which three fail or
what the consequence is; adjacent
rows all read PASS.
A number that cannot be acted on. List failing
checks first, with a plain consequence per
failure.
—
Both · all
Success /
progress
Post-action confirmations, submission
receipts, upload progress and status-
badge behaviour on real records could
not be exercised.
Unvalidated. Must be audited on staging
before sign-off.
What works. The portal's field-level validation is a model the internal platform should
copy: each message names the field, states the rule and gives the reason ("Enter
a valid email address — this is where your acknowledgement goes"). Its toast
component, status badges and helpdesk reply-target tile are consistent and
plainly worded.
6 · Content and terminology findings
Ref
Platform ·
Screen
Current text
Issue
Recommended
replacement · reason
P-04
Portal · index,
support
Hero: "9 IN PROGRESS · 2 ACTION NEEDED · 0% ON
TIME". Mid-page: "0 REQUESTS IN THE REGISTRY ·
0% CLOSED WITHIN TARGET · 0 CORRESPONDENCE
TYPES · 0 RECEIVED IN THE LAST 7 DAYS". Support:
"REQUESTS CLOSED 0% on time".
Two statistics blocks
on one public page
contradict each
other — nine
requests in progress
against zero
requests in the
registry and zero
correspondence
types. Both publish
0% on-time
performance.
Source both blocks from
one figure, and suppress
any tile whose value is
unavailable rather than
rendering zero. A citizen
reading "0% on time" on
the front door of the
agency's document service
draws a conclusion the
agency did not intend, and
the internal contradiction
makes the whole panel
untrustworthy. If these are
placeholders, remove them
before release.
<!-- PDF_PAGE_11_END -->

<!-- PDF_PAGE_12_START -->
Ref
Platform ·
Screen
Current text
Issue
Recommended
replacement · reason
I-08
Internal ·
Administration
Field labels "MAX_BULK_ASSIGN", "FETCH_ACTIVITIES",
placeholder "Override URL (optional)"; "Persona:
admin"; "19 total endpoints · 19 configured".
Configuration
constants used
verbatim as user-
facing labels;
lowercase role slug;
endpoint editor
presented as an
ordinary settings
form.
"Maximum records per bulk
assignment", "Role:
Administrator". Move the
endpoint fields to a
separate, clearly technical
screen restricted to IT. A
named field is editable by
anyone who reaches the
screen; a screaming-snake-
case label gives no clue
what changing it will do.
I-17
Internal ·
browser tab,
sign-in
Title: "DGO Digital Operations — R11.6 Obsidian
Harmonized Design System Runtime". Sign-in:
"DIGITAL OPERATIONS · R11.6"; footer of sign-in
panel "R11.6 / Obsidian".
Internal release
codename and
design-system
version exposed as
the product name,
and repeated in the
tab title of every
screen.
Title should be "{Screen} —
DGO Digital Operations",
matching the portal's own
pattern ("Track a request —
NITDA Intelligent Portal").
Remove "R11.6" and
"Obsidian" from all user-
facing surfaces; keep them
in Diagnostics. A tab title is
how a user finds the right
window among ten.
I-18
Internal ·
Diagnostics
"Posture: PROVISIONED — INERT" · "Identity: client-
asserted (localStorage profile)" · "missing
configuration: OTP_GENERATE, OTP_VERIFY" ·
"Activation procedure: see
docs/architecture/AUTHENTICATION_CONTRACT.md".
A repository file
path is given as an
instruction inside
the running product.
Acceptable for a screen
explicitly scoped to IT, but it
must be labelled as such
and role-restricted. Replace
the file path with a link to
the internal runbook.
Rename the screen
"System health (IT only)".
P-05
Portal · footer
index footer SUBMIT list: Official letter · Application or
request · Regulatory or compliance filing · Other
correspondence. submit.html footer: Official letter ·
Application or request · Proposal or EOI · Other
correspondence.
The same footer list
differs by page, and
"Proposal or EOI"
abbreviates a type
the catalogue calls
"Proposal or
expression of
interest".
Use one fixed footer list and
the catalogue's full names.
A footer that changes
between pages reads as an
error and undermines
confidence that the six
correspondence types are a
fixed, published set.
P-07
Portal · all
pages
Sovereignty ribbon: "An official portal of the Federal
Republic of Nigeria".
The ribbon is a
single non-wrapping
line with ellipsis
truncation.
Measured at 297px
available against
297px required — it
sits exactly at the
truncation
threshold, and
truncates at every
viewport at or below
414px.
Below 640px show a short
form ("Official Nigerian
government portal") rather
than truncating. The clipped
string reads "…the Federal
Republic of Niger…", naming
a different country on a
national identity statement.
<!-- PDF_PAGE_12_END -->

<!-- PDF_PAGE_13_START -->
Ref
Platform ·
Screen
Current text
Issue
Recommended
replacement · reason
I-19
Internal ·
sign-in, shell
"Good morning, Registry" · identity block "Registry /
admin · dgsregistry@nitda.gov.ng" · Persona select
value "admin".
A mailbox name is
used as a person's
name in a greeting,
and the role is
shown as a
lowercase system
slug in three places.
Greet by the signed-in
person's name, or drop the
greeting for shared
accounts. Display roles in
title case with their full
name ("Administrator").
Users read the identity
block to confirm they are
acting as the right person.
I-20
Internal ·
Intake toolbar
Two adjacent unlabelled selects both reading "All"; tab
overflow control "···".
Controls with no
name.
Label the selects ("Status",
"Source") and give the
overflow control a visible
name ("More views"). A
user cannot filter by
something they cannot
identify.
7 · Branding and visual consistency findings
Ref
Platform ·
Component
Issue
Evidence
Recommended fix
H-02
Internal · icon
system
The internal platform has no
icon set. Navigation, top-bar
actions and source filters are
drawn with Unicode typographic
characters, rendered in
whatever glyph the user's
system font provides. "Email
Desk" is a bullet.
Collected from the live DOM:
⌂ ⚖ ✉ ⌘ ↔ ✓ ➤ • ⚙ ☰ ⌕ ↻ ↕
◐, plus ◎ ▧ ◉ in source-view
filters — 17 distinct
characters. The portal ships a
proper SVG sprite at
ds/icons/sprite.svg
(8,017 bytes).
Adopt the portal's sprite in the
internal platform and map every
navigation item and action to a
real icon. Glyph icons vary by
operating system, sit off the text
baseline, cannot be sized or
coloured reliably, and carry no
shared meaning — ⌘ for "My
Work" and • for "Email Desk" are
not legible as icons.
H-03
Both · logo and
product name
The portal uses the full NITDA
lockup (three PNG assets,
including a white variant). The
internal platform uses a generic
circular mark and a wordmark
reading "DGO Digital Ops" with a
coloured letter, subtitled "AN
INITIATIVE OF NITDA". Two
different agency identities.
Portal package:
ds/logo/nitda-lockup.png,
nitda-lockup-white.png,
nitda-symbol.png. Internal
package: assets/dgo-
mark.svg (329 bytes) only.
Decide whether DGO Digital Ops
is a NITDA-branded product or a
sub-brand, then apply one
lockup to both. Ship the real
NITDA assets in the internal
package. A 329-byte
placeholder mark is not a brand.
H-04
Both · typography
The portal ships a bundled
display and monospace pairing
(Cascadia Mono, 144KB, used
for reference codes and
metadata). The internal platform
ships no fonts and inherits the
system stack, so the same
design system renders in
different typefaces on the two
platforms.
Portal:
ds/fonts/CascadiaMono-
Regular.woff2. Internal: no
font files in the package.
Ship the same font files with
both packages, or remove the
webfont from the portal and
standardise on a system stack in
both. Reference numbers and
tracking IDs should render in the
same face in the portal and in
the internal record.
<!-- PDF_PAGE_13_END -->

<!-- PDF_PAGE_14_START -->
Ref
Platform ·
Component
Issue
Evidence
Recommended fix
I-21
Internal · KPI tile
KPI tiles carry a coloured left
accent bar that varies per tile
with no stated meaning, and are
used interchangeably for counts,
percentages, text attributes
("ROLE / EA") and configuration
status ("BYTE PATH / Not
configured").
Observed on Command
Center, Executive, Scan
Intake, Diagnostics,
FastTrack, Archive, Briefs,
Response Tracking.
Restrict the KPI tile to numeric
measures. Give the accent
colour one defined meaning
(severity) or remove it. Move
status and attribute values to a
separate, visually distinct
treatment.
I-22
Internal ·
Assignment Desk
The four source cards render
with underlines on both the card
title and the descriptive body
text, so non-interactive prose is
styled as a link.
Observed in the rendered
screen. Needs confirmation
in a live browser — the
observation comes from a
rendered capture and was
not measured against
computed styles.
If confirmed, remove the
underline from card body text
and reserve it for links.
Underlined prose invites clicks
that do nothing.
8 · Responsiveness design intent
No design references defining responsive behaviour were supplied for either
platform, so intent was inferred from the shipped stylesheets and, for the portal,
verified by measurement at six viewport widths. Nothing in this section should be
read as runtime-validated except where a measurement is quoted.
Viewport
Document portal
Main internal platform
Wide / desktop
1440 · 1280
Design intent defined; runtime clean. Measured: 0px
overflow, 0 truncated strings, 4–5 nav links visible on
all pages.
Design intent defined; runtime validation required.
Breakpoints exist at 1500, 1280, 1180, 1100, 1024 and
1000px, plus three height-based rules. Not validated —
the platform could not be resized behind its sign-in gate
during this audit.
Laptop
1024
Defined; runtime clean. 0px overflow. Full nav
retained.
Defined; validation required. Content pane measured
at 700px inside a 924px window, at which the intake
toolbar and tab strip already crowd (I-09) and sidebar
labels clip (I-10).
Tablet
768
Defined; runtime clean. Desktop nav gives way to a
menu control on every page. 0px overflow.
Defined; validation required. Rules exist at 900 and
768px including a sidebar collapse and two landscape-
orientation rules. Behaviour of the two-pane
master/detail screens at this width is unknown.
Mobile
414 · 360
Defined but broken at runtime. Measured: 35px
overflow at 414px and 88px at 360px on index,
submit, track and support (P-01). One string truncates
(P-07). 404.html is clean.
Design intent partially defined; unvalidated. Rules
exist at 600, 560, 520 and 480px. There is no evidence
the platform is intended for phone use, and no mobile
design reference was supplied. Decide explicitly
whether it is a desktop-only product and state so.
Touch targets
Runtime measured. At 414px: 32 controls below
40px tall on submit, 27 on support, 20 on track, 18 on
index. Includes the header search control (36px) and
the brand link (38px).
Unvalidated. At desktop width all 25 shell controls
measured at or above 32px.
<!-- PDF_PAGE_14_END -->

<!-- PDF_PAGE_15_START -->
H-01 · The two platforms use unrelated breakpoint scales
Internal stylesheets declare width breakpoints at 480, 520, 560, 600, 720, 768, 900, 980, 1000, 1024, 1100, 1180, 1280
and 1500px — fourteen values, several within 24px of each other, plus three height-based and three orientation-based rules.
The portal declares 600, 640, 900, 960 and 1080px. Only 900px is shared.
Impact. The same shared component reflows at a different width in each platform, so no reflow behaviour can be reasoned
about or tested once. Fix. Agree one scale (for example 640 / 900 / 1200 / 1536), express it as design-system tokens
alongside the existing colour and type tokens, and migrate both platforms to it.
9 · Cross-platform harmonisation
CONSISTENT — PRESERVE
Token architecture: both ship the same primitive /
semantic / component / density / theme layers and the
same light, dark and high-contrast themes.
Component stylesheet: components.css is near-
identical (39,333 vs 39,791 bytes), so buttons, cards,
badges, modals and toasts share one definition.
Status vocabulary: Received · Validation · Under
review · Action required · Approved reads the same on
both sides.
A command palette exists in both, on the
same shortcut.
Deep-green primary and the correspondence-type
taxonomy are consistent.
INCONSISTENT — CORRECT
Icons. SVG sprite in the portal, Unicode glyphs in the
internal platform (H-02).
Logo. Full NITDA lockup versus a 329-byte placeholder
mark (H-03).
Typography. Bundled webfont in the portal, system
stack in the internal platform (H-04).
Breakpoints. Fourteen values versus five, one shared
(H-01).
Page titles. "Track a request — NITDA Intelligent
Portal" versus a single build-codename title on every
internal screen (I-17).
Register. The portal writes for the public in plain
language; the internal platform writes in
implementation terms (I-05 to I-08).
Screen naming. The portal's nav labels match its page
headings exactly; thirteen internal ones do not (I-02).
Differences to preserve
Information density — the internal platform is a working tool and should stay denser than the
portal. Navigation model — a grouped sidebar for 20+ operator workspaces against a four-
item public top nav. Tone — the portal addresses a citizen, the internal platform addresses a
trained officer. Authentication — a one-time code gate belongs on the internal platform and
not on public browsing.
Differences to correct
Everything in the right-hand column above. None of these is a considered product decision;
each is drift between two packages built from a shared design system.
<!-- PDF_PAGE_15_END -->

<!-- PDF_PAGE_16_START -->
RECOMMENDED SHARED UX STANDARDS
1. One name per thing. Every screen has one name used in navigation, page heading, browser title and documentation.
Every correspondence type uses the catalogue's full name everywhere.
2. One icon set. The portal's SVG sprite, extended as needed, in both platforms. No typographic characters as icons.
3. One breakpoint scale, expressed as tokens next to the colour and type tokens.
4. One message contract. Every user-facing message states what happened and what to do next, in the user's terms.
Endpoint, payload, backend, module, runtime, posture and flow do not appear outside the IT-only screens.
5. One empty-state contract. Distinguish "nothing here", "filtered to nothing" and "could not load", each with an action.
6. One status vocabulary, already largely achieved — hold it as a governed list rather than duplicated strings.
10 · Final UX readiness classification
Platform
Classification
Conditions
Main internal platform
Not ready
Clears to conditionally ready on: I-01 (navigation reaches every shipped
screen), I-02 (labels match headings), I-05 to I-08 and I-17 to I-19
(developer language removed from operator surfaces; Diagnostics,
Operator HUD and the endpoint editor role-restricted), I-12 (sign-in label),
and a completed populated-data audit on staging.
Document portal
Conditionally ready
Clears to ready on: P-01 (mobile overflow), P-04 (contradictory public
metrics), P-06 (endpoint language in the submission path), P-07
(truncated sovereignty ribbon), and validation of the submitted-receipt,
tracking-result and not-found states on staging.
Both — populated data
states
Unvalidated
Every table, record detail, document view, search result, upload progress
state and post-action confirmation. Endpoints were neutralised so that this
audit could not invoke live workflows. These must be audited against a
staging environment carrying representative records before either
platform is signed off.
Nothing is classified Blocked: no finding depends on an external party. All thirty-three findings are within the two teams' control.
One note outside UX scope, recorded because it was unavoidable while reading the packages: both bundles carry a written warning that
every endpoint URL they contain is a signed trigger acting as a bearer credential, delivered unredacted to every browser. That is a security
matter, not a design one, and is flagged here only so it is not lost.
<!-- PDF_PAGE_16_END -->
