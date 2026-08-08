# Platform Atlas — `docs/visual/`

The complete visual documentation of the DGO Digital Operations platform: architecture,
components, modules, features, data, security, lifecycle, quality and deployment — front
end and back end — in one interactive, navigable page.

**Open it:** double-click `docs/visual/index.html`. No server, no build step, no install.

It needs no hosting because it deliberately uses **classic scripts**, not ES modules. A
`file://` page has an opaque origin and modules are fetched with CORS semantics, so
`<script type="module">` is blocked from disk in every browser — which is why the platform's
own `index.html` does need `npm start`, and why this one does not. All four files sit in
this one directory and nothing references anything outside it, including the favicon, so
the folder can be copied to a memory stick, attached to an email or dropped on a share and
it opens as-is.

Serving it over HTTP works identically if you prefer: `npm start`, then
<http://localhost:8080/docs/visual/>.

---

## Why it can be trusted

Visual documentation is the artefact most likely to be believed and least likely to be
checked. A slide that says *25 routes* is accepted by a room of forty people and nobody
opens `config/routes.config.js` to confirm it. That is why architecture diagrams go stale
faster than anything else in a repository, and why they usually get deleted rather than
maintained.

So the atlas asserts nothing by hand:

| Layer | What it holds | Where it comes from |
|---|---|---|
| `platform-data.js` | Every number, name, count, route, role, field, file and edge | **Generated** by `scripts/visual-docs-data.mjs` from the source tree |
| `app.js` | Every sentence of explanation, and the diagram geometry | Written — these are judgements about the codebase |
| `index.html` | The shell — no figures, no counts | Written |
| `visual.css` | Presentation. Brand values restated from the design system and asserted against it | Written |

Facts are measured; opinions are written; the two never swap places.

`tests/visual-docs.test.mjs` asserts the generated dataset against the **live**
configuration — route list, boundary contracts, the RBAC matrix, endpoint keys, the
lifecycle state set, the file inventories, the data-model totals, the brand tokens and the
CSS cascade order. Add a route without regenerating and the build fails instead of the
picture quietly going wrong.

---

## Keeping it true

```bash
npm run visual        # re-derive docs/visual/platform-data.js from the source tree
npm run test:visual   # assert the atlas against the live configuration
```

`npm run visual` is the only step. Change the code, run it, and every figure moves. Skip it
and `npm test` names the claim that went stale.

The dataset records the **commit**, not a timestamp — a timestamp changes on every run and
makes the generated file churn in every diff; the commit changes only when the code it
describes does.

---

## Using it

### Audience lens

The toolbar switches the page between **Everything · Executive · Architect · Developer ·
Operations**. It *removes* content rather than dimming it — a briefing that still shows an
executive a file inventory in grey has not simplified anything. The choice is remembered.

| Purpose | Lens | Route through the atlas |
|---|---|---|
| Executive briefing | Executive | Sheets 1–3, 12–13, 16. The rule, the zones, the document's journey, the security posture, what remains to decide. ~12 minutes at a walk. |
| Architecture review | Architect | Sheets 2–5, 8–9, 13. Zones, layering, workspace topology, the enforcement tier, the lifecycle. |
| Developer onboarding | Developer | Sheets 4–7, 14. Layer rules, the module contract, the service catalogue, the design system, then the tests that will tell you when you are wrong. |
| Operations & deployment | Operations | Sheets 8, 10, 14–15. The proxy, the portal, what CI proves, the deployment surface. |
| Orientation for anyone new | Everything | Start at sheet 1 and read down. Sheet 17 is the glossary. |

### Search

<kbd>/</kbd> or <kbd>⌘K</kbd> / <kbd>Ctrl</kbd>+<kbd>K</kbd>. It indexes every section,
route, module, core service, config file, proxy module, endpoint key, role, permission,
SharePoint list, **field**, state collection, lifecycle state and component — several
thousand entries, all from the dataset. Selecting a result that the current lens has
removed switches back to *Everything* rather than scrolling to nothing.

### Diagrams

Every figure is computed from the dataset, not drawn: the lifecycle map lays itself out
from the transition table, the workspace map from `workflow-clarity.config.js`, the layer
graph from measured import counts. Nobody has to remember to move a box.

Hovering a node in the workspace, handoff and lifecycle maps isolates its connections —
with 31 states and 20 technical routes, a static picture is a hairball and an isolating one
is a map.

### Printing

The print button expands every collapsed panel first, then prints. The print stylesheet
drops the navigation, toolbar and filters and keeps the diagrams, so *Save as PDF* produces
a real handout rather than a screenshot of a web page.

---

## Constraints this page keeps

- **No network.** No CDN, no remote font, no external script or stylesheet. The platform
  ships that way and its documentation has no business being weaker — a briefing pack that
  needs the internet is one that fails in the room where it matters. The test enforces it.
- **No build step.** Classic scripts, plain CSS. What is in the repository is what runs.
- **Both themes.** Light, dark, and the explicit toggle wins over the system preference in
  both directions. Theme is applied before first paint, so a dark-themed projector gets no
  white flash.
- **Accessible.** Every figure carries `role="img"` and an `aria-label`; every SVG scales
  from a `viewBox` with no fixed width; reduced motion is honoured; the palette is
  keyboard-driven throughout.
- **Escaped.** Every interpolated value — filenames, field names, sender-shaped strings —
  goes through the same escaper the platform's own components use.

---

## Relationship to the other documents

| Document | What it is for |
|---|---|
| **`docs/visual/`** (this) | The whole platform, visually, for any audience. Start here. |
| `docs/architecture/components.html` | The original drift-tested component and relationship sheets. Narrower, still current, still tested. |
| `docs/architecture/architecture.html` | The target-architecture decision sheets, as presented for decision. |
| `docs/architecture/TARGET_ARCHITECTURE.md` | The full architecture narrative and numbered build sequence. |
| `docs/architecture/AUTHENTICATION_CONTRACT.md` | Activation spec and every server-side obligation, clause by clause. |
| `docs/deployment/FLOW-BUILD-WALKTHROUGH.md` | The click-by-click SharePoint and Power Automate build. |
