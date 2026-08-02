# NITDA Intelligent Portal — deployable package

A single, unified portal for document submission, status tracking, helpdesk support and
registry operations. It merges the two source portals (`digitaldocs.page.gd` and
`intelhub.page.gd`) into one product built on the **NITDA Design System v2.1**.

Static files only — no build step, no framework, no CDN dependency. Copy the folder to any
web root (Apache, Nginx, IIS, S3 + CloudFront, GitHub Pages, Azure Static Web Apps) and it runs.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Front door: live registry activity, service catalogue, lifecycle explainer, FAQ, first-visit welcome |
| `submit.html` | Four-step guided submission: service → requester → document → review, with drag-and-drop attachments, autosaved draft and printable receipt |
| `track.html` | Verified lookup (tracking ID + email), lifecycle stepper, working-day SLA meter, full timeline, respond / note / withdraw |
| `support.html` | Helpdesk: searchable answers, contact channels, portal status, case desk with preview-and-confirm and instant case reference |
| `admin.html` | Operations console: staff sign-in, KPIs, filterable queue, bulk triage, record drawer with decisions, support inbox, performance, audit trail, CSV export |
| `404.html` | Not-found page in the portal shell |

## Supporting files

```
ds/                 DGO Design System v2.1 (tokens, reset, base, layout, components, fonts, logos, icons)
portal.css          Portal layer — every class namespaced .pf-*, consumes only --dgo-* tokens
js/icons.js         46-symbol icon sprite, injected at runtime
js/data.js          Service catalogue, status model, staff accounts, FAQ, seed records, workflow endpoints
js/core.js          Store, metrics, themes, toasts, dialogs, command palette, outbox, shell
js/home.js          Home page behaviour
js/submit.js        Submission wizard
js/track.js         Tracking and citizen-side actions
js/support.js       Helpdesk and case desk
js/admin-panels.js  Console panels: support inbox, performance, audit, CSV
js/admin.js         Console shell, queue, record drawer, decisions
sw.js               Offline shell (cache-first assets, network-first navigations)
manifest.webmanifest, favicon.svg, robots.txt, sitemap.xml
```

## Configuration

**Workflow endpoints** — supplied at deploy time through `config.local.js`, never committed.
Copy `config.example.js` → `config.local.js` and fill in `PF_CONFIG.endpoints`. The file is
git-ignored and each page loads it with an `onerror` guard, so it is genuinely optional: with
no config the portal runs end to end and `PF.flow()` reports `not-configured`.

> **The three signed URLs that used to be hardcoded in `js/data.js` were credentials.**
> A SAS-signed Power Automate URL authorises invocation by possession alone, and they were
> served in plaintext to every anonymous visitor of a public portal. They have been removed
> from `js/data.js`, but **removal revokes nothing** — they remain valid, and readable, in
> Git history and inside the tracked `ECM_DOCS_DEV.zip`. **They must be rotated in Power
> Automate.** Until then, treat the submission, tracking and support flows as compromised.

The payload schemas are unchanged, so rotated URLs drop straight in:

| Key | Payload |
| --- | --- |
| `submission` | `UserId`, `SubmitterName`, `EmailAddress`, `CompanyName`, `DocumentType`, `FileName`, `FileContentBase64` |
| `tracking` | `emailAddress`, `trackingId` |
| `support` | `emailAddress`, `Comments` |

Set any value to `''` to disable that integration. Delivery never blocks the user: the portal
records everything locally first, and anything a flow refuses (or that was sent while offline)
is queued in the outbox and retried on the next page load, up to five attempts. Every attempt
writes a line to the audit trail, and the support page reports the queue depth under
*Portal status*.

**Service catalogue** — `js/data.js` → `PF.SERVICES`: code, owning unit, working-day target and
required documents per service. Adding an entry adds it to the submission form, the home
catalogue, the command palette and the console filters automatically.

**Operations console roles** — `js/data.js` → `PF.STAFF`, overridable via
`PF_CONFIG.console.accounts`.

| Role | Scope |
| --- | --- |
| Registry supervisor | Whole registry |
| Reviewing officer | Standards, Guidelines & Regulation |
| Compliance officer | Digital Economy & Compliance |

> **The console gate is not an authentication boundary, and no credential ships in the tree.**
> This portal has no server. Every record the console displays lives in the visitor's own
> `localStorage`, and the signed-in session is a `sessionStorage` key any visitor can set from
> the developer console. A previous build published a username *and* password for each role in
> `js/data.js` — worse than no gate at all, because it advertised a protection that did not
> exist. The gate now presents itself honestly as role selection and says so on screen.
>
> Real staff authentication belongs behind the authenticating proxy (`proxy/`, and
> `AUTHENTICATION_CONTRACT.md`), which validates a JWT against the provider's JWKS and derives
> the role from token claims server-side. A client-side comparison in this folder can never
> provide it. `PF_CONFIG.console.requireCredentials` restores a password form for a closed
> demonstration on a private host — those values are still readable by anyone who fetches
> `config.local.js`, so it is not a production posture.

## Data

Records, support cases, the audit trail, the device history, the draft and the outbox live in
`localStorage` under `nitda.portal.*`; the console session lives in `sessionStorage`. A fresh
browser installs sixteen seed records and two support cases, dated relative to the day of
first load, so a new deployment always looks current. *Reset data* in the console reinstalls
the demonstration set.

To connect a real back end, replace the five `PF.store` methods (`all`, `get`, `add`, `update`,
`tickets`) with fetch calls; every page reads the registry only through them.

## Built in

- Three themes — light, dark, high contrast — persisted per browser.
- Command palette on `Ctrl/⌘ K` or `/`: navigate, start any service, jump to your own requests.
- Working-day arithmetic for every service-level target, with overdue detection.
- Print stylesheets: submission receipt, request record and support case print as clean A4
  documents with the endorsed NITDA logotype.
- Offline shell via service worker; installable as a PWA with submit/track/support shortcuts.
- Accessibility: skip link, labelled fields with inline errors, `aria-live` status regions,
  focus-trapped dialogs, keyboard-navigable palette and drawer, 44 px minimum targets,
  visible focus rings, reduced-motion support.
- Responsive from 360 px to ultrawide; tables scroll horizontally rather than reflow.

## Feature parity with the sources

Every capability of both source portals is preserved: mobile navigation, theme toggle,
first-visit welcome, submission form with file validation and confirm-before-send, tracking by
ID with status history, support form with preview modal and workflow POST, admin sign-in with
session persistence, dashboard statistics and the submissions table. Each was rebuilt on the
design system and extended — guided multi-step submission, email-verified tracking, SLA
meters, real case references, a working queue with bulk triage and decisions, performance
analytics, an audit trail and CSV export.

## Deployment checklist

1. Copy the folder contents to the web root (or a subdirectory — all paths are relative).
2. Serve over HTTPS; the service worker and clipboard both require a secure context.
3. Set `Cache-Control: no-cache` on `sw.js`, long-lived caching on `ds/` and `js/`.
4. Point `sitemap.xml` at the live host and confirm `robots.txt` still excludes `admin.html`.
5. Confirm the three flow URLs are reachable from the browser origin (CORS must allow it),
   or clear them to run the portal standalone.

## Deployment headers

Every page ships a `<meta http-equiv="Content-Security-Policy">` and
`<meta name="referrer" content="strict-origin-when-cross-origin">`. Two gaps cannot be closed
from HTML alone and need edge configuration:

| Header | Value | Why |
| --- | --- | --- |
| `Content-Security-Policy` | `frame-ancestors 'none'` | `frame-ancestors` is **ignored** in a meta CSP. Without the real header the portal can be framed, which is a clickjacking path onto the submission and withdrawal actions. |
| `X-Content-Type-Options` | `nosniff` | Stops MIME sniffing on the uploaded-document previews. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | The portal collects personal data under the NDPA; downgrade must not be possible. |

The meta CSP keeps `'unsafe-inline'` for `script-src`/`style-src` because each page carries an
inline theme bootstrap and inline style attributes. That is weaker than a nonce or hash policy
and is a known, deliberate limitation — it still removes third-party script origins and, via
`connect-src`, restricts outbound requests to Power Automate origins only.
