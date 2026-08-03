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

**Backend** — `config.example.js` → `config.local.js`, which is git-ignored.

The portal holds **no credential**. It previously carried three SAS-signed Power Automate
URLs in `js/data.js`; a signed URL is a bearer credential, and those were delivered to every
browser that opened any page, cached by the service worker, and readable by anyone who could
fetch a static asset. They are gone.

It now talks only to the **authenticating proxy**, which is the one component that holds a
credential. Two routes:

| Route | Purpose |
| --- | --- |
| `POST /intake/submission` | Registers the correspondence, returns a registry reference and one short-lived upload ticket per attachment |
| `PUT /intake/upload` | Redeems one ticket with the raw file. Bytes never travel base64-encoded inside a JSON payload |
| `POST /intake/support` | Opens a helpdesk case. A create, but not correspondence — it gets a `CASE-` reference and never enters the registry |

```js
window.PF_CONFIG = { proxyBaseUrl: "https://dgo-proxy.nitda.gov.ng" };
```

Leaving `proxyBaseUrl` empty puts the portal in **demo mode**: everything stays local and
nothing is transmitted. That is the safe failure for a public channel — it degrades to
visibly doing nothing rather than quietly reaching an unintended host.

**Status tracking is local for now.** The old tracking call was fire-and-forget — it never
read a response, so every result shown already came from this browser's own store. Genuine
read-back from the registry is step 6 of `docs/architecture/TARGET_ARCHITECTURE.md`.

**Service catalogue** — `js/data.js` → `PF.SERVICES`: code, owning unit, working-day target and
required documents per service. Adding an entry adds it to the submission form, the home
catalogue, the command palette and the console filters automatically.

**Staff accounts** — `js/data.js` → `PF.STAFF`. Shipped demonstration accounts:

| Username | Password | Role | Scope |
| --- | --- | --- | --- |
| `admin` | `password` | Registry supervisor | Whole registry |
| `reviewer` | `reviewer` | Reviewing officer | Standards, Guidelines & Regulation |
| `compliance` | `compliance` | Compliance officer | Digital Economy & Compliance |

Sign-in also accepts the dotted form of the officer's name (`a.bello`). Replace this list with
your identity provider before production use — the console is a client-side gate, and
`robots.txt` excludes `admin.html` from indexing.

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
