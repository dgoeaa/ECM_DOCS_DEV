# NITDA Intelligent Portal — deployable package

The **external** intake channel for documents and correspondence addressed to NITDA:
submission, status tracking and helpdesk support. It is not a service-request desk and it
carries no staff-facing function — internal operations live in the root platform, which is
the system of record. Built on the **NITDA Design System v2.1**.

Static files only — no build step, no framework, no CDN dependency. Copy the folder to any
web root (Apache, Nginx, IIS, S3 + CloudFront, GitHub Pages, or any static host) and it runs.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Front door: live registry activity, correspondence types, lifecycle explainer, FAQ, first-visit welcome |
| `submit.html` | Four-step guided submission: correspondence type → sender → document → review, with drag-and-drop attachments, autosaved draft and printable receipt |
| `track.html` | Verified lookup (tracking reference + email) read back from the registry, lifecycle stepper, acknowledgement meter, full timeline |
| `support.html` | Helpdesk: searchable answers, contact channels, portal status, case desk with preview-and-confirm and instant case reference |
| `404.html` | Not-found page in the portal shell |

## Supporting files

```
ds/                 DGO Design System v2.1 (tokens, reset, base, layout, components, fonts, logos, icons)
portal.css          Portal layer — every class namespaced .pf-*, consumes only --dgo-* tokens
js/icons.js         46-symbol icon sprite, injected at runtime
js/data.js          Correspondence taxonomy, status model, FAQ, seed records, endpoint configuration
js/core.js          Store, metrics, themes, toasts, dialogs, command palette, outbox, shell
js/home.js          Home page behaviour
js/submit.js        Submission wizard
js/track.js         Tracking and citizen-side actions
js/support.js       Helpdesk and case desk
sw.js               Offline shell (cache-first assets, network-first navigations)
manifest.webmanifest, favicon.svg, robots.txt, sitemap.xml
```

## Configuration

**Backend** — `config.example.js` → `config.local.js`, which is git-ignored.

The portal calls its Power Automate flows **directly**. There is no proxy, worker or broker
to deploy, run or keep alive, and nothing to operate between this static site and the flows.

Nothing is hardcoded. `js/data.js` previously carried three SAS-signed Power Automate URLs;
committing a signed URL publishes a bearer credential to everyone who can read the
repository, permanently. Every URL now arrives at deploy time instead:

```js
window.PF_CONFIG = {
  endpoints: {
    SUBMISSION:     "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=...",
    UPLOAD:         "...",
    SUPPORT:        "...",
    VERIFY:         "...",
    VERIFY_CONFIRM: "...",
    STATUS:         ""
  }
};
```

Leaving `SUBMISSION` empty puts the portal in **demo mode**: everything stays local and
nothing is transmitted. That is the safe failure for a public channel — it degrades to
visibly doing nothing rather than quietly reaching an unintended host. Any other endpoint
left empty disables just the feature it serves, which reports itself as unconfigured.

### ⚠ What direct operation means for these flows

This is a public site. Every URL configured above is delivered to every visitor's browser
and can be read by anyone who fetches `config.local.js`. Nothing stands between a stranger
and the flow, so **each flow is the only place any control can exist**. Build each one to be
safe when invoked by an anonymous caller, and configure nothing here that does something the
public may not do. Rotate the signatures on a schedule; regenerating a signature is the only
way to revoke one.

### The contract each flow must satisfy

| Endpoint | Method | Request | Response | What the flow must enforce |
| --- | --- | --- | --- | --- |
| `SUBMISSION` | POST | The submission record, plus `verification` when the wizard holds a proof | `{ referenceId, uploads: [ticket, …] }` | Validate every field; restrict `category` to the public subset; apply the Universal Filename Policy to every declared attachment name, keeping what the submitter sent as `originalName`; mint the registry reference; issue one short-lived upload ticket per declared attachment; rate-limit by source. Answer `403 {"error":"verification_required"}` to demand email verification |
| `UPLOAD` | PUT | Raw file bytes, ticket in `X-Upload-Ticket` | `{ stored, attachmentLink, reason }` | Redeem the ticket once and only once; check the bytes against the size and SHA-256 the submission declared; refuse anything oversize or unmatched. Bytes never travel base64-encoded inside a JSON payload — that is what forced the 4 MB ceiling this replaced |
| `SUPPORT` | POST | The helpdesk case | `{ caseRef }` | Validate and rate-limit. A `CASE-` reference; never enters the registry |
| `VERIFY` | POST | `{ email }` | `{ sent, expiresAt }` | Mail a one-time code; rate-limit per address and per source. Report `sent:false` honestly when the mail could not be delivered rather than telling the submitter to check an inbox |
| `VERIFY_CONFIRM` | POST | `{ email, code }` | `{ verification, expiresAt }` | Compare in constant time; expire and single-use the code; return a proof `SUBMISSION` will accept |
| `STATUS` | POST | `{ referenceId, email }` | `{ record }` | See below |

**Reference format.** Every reference the `SUBMISSION` flow issues must have the registry
shape `NITDA-YYYY-<sequence>` — the agency prefix, the four-digit year, and a sequence the
flow holds and never restarts within a year. The sequence is **not zero-padded**: the live
flow issues `NITDA-2026-217`, not `NITDA-2026-000217`. The workspace mints provisional
references in the same shape (`core/reference-minter.js`); a flow that issues any other
shape leaves the registry holding two key formats at once, which is the defect F-031 closed.

**Filenames.** The agency's Universal Filename Policy
(`docs/policies/universal-filename-policy/`, implemented in
`config/filename-policy.config.js`) applies to every file that enters the registry. The
`SUBMISSION` flow must normalise each declared attachment name rather than reject it — a
citizen must not be turned away because their phone named the scan `IMG_20260101(1).jpg` —
and must keep what they sent as `originalName`, because storing only the normalised name
quietly rewrites their submission. The registry counter route applies the same policy in
`core/scan-intake-service.js`; the two must not drift.

**Status read-back.** `STATUS` takes the tracking reference and the email it was submitted
under. Unknown reference and wrong email must return a byte-identical `404` — telling a
caller which it was would answer "does this reference exist?" for anybody who asks — and the
response must be an allow-listed projection carrying status, dates and the public timeline,
never the description, the attachments, the assigned officer or the handling unit.

When the registry cannot be reached the page falls back to the copy this browser saved at
submission **and says so on the record**. Presenting device data as the registry's answer is
the failure this replaced; an unreachable registry is also never reported as "not found",
because it is not evidence the submission was never received.

**Verified read-back — the CLIENT HALF IS IMPLEMENTED AND DORMANT. The flow decides.** Where
`STATUS` authorises on `{ referenceId, email }`, possession of the two fields *is* the
authorisation. Both are printed inside the record the call returns, and the email is the least
secret field a submitter has: it appears on their letterhead, in the CC line of every thread about
the matter, and in any correspondence the agency itself sends onward. The portal already proves
ownership of an address properly for `SUBMISSION` — `VERIFY` mails a code, `VERIFY_CONFIRM`
returns a proof, and the intake flow answers `403 {"error":"verification_required"}` when the
proof is absent. The read path asks for no such proof. So the portal is stricter about accepting a
document from a citizen than about handing that citizen's file to a stranger, which is backwards.

The mechanism that already exists is reused rather than a second one invented. **The portal
now sends a proof when the flow asks for one**: a `STATUS` flow that answers
`403 {"error":"verification_required"}` triggers the same code round-trip the submission
wizard runs, and the page retries with the proof. A flow that does not ask is unaffected and
nothing changes for it — which is why turning this on is a flow-side configuration event
rather than a development one, the same pattern as `auth.enabled`.

| Endpoint | Method | Request | Response | What the flow must enforce |
| --- | --- | --- | --- | --- |
| `STATUS` | POST | `{ referenceId, verification }` | `{ record }` | Resolve the address from the proof, not from the request body. Reject an expired, unknown or replayed proof with the same byte-identical `404` as a wrong reference. Return the allow-listed projection only when the reference was submitted under the proof's address |

Three properties this must keep, each of which is easy to lose in implementation:

1. **The email leaves the request body.** If the flow accepts both `email` and `verification`
   it will be called with `email` alone by something, and the old path survives. Resolve the
   address from the proof and reject a body that carries an `email` field at all.
2. **One denial, still.** Unknown reference, wrong address, expired proof and replayed proof
   must be indistinguishable — the same `404`, the same bytes. Adding a distinct
   `proof_expired` is the natural thing to do for usability and it reintroduces the oracle:
   "this reference exists, your proof is just stale." Expiry is reported by the *proof* flow
   on the next `VERIFY_CONFIRM`, never by `STATUS`.
3. **Unavailable is still not denied.** A verification service that cannot be reached must
   surface as `unavailable`, so the page keeps saying "status is unavailable right now" rather
   than "no request matches" — an outage is not evidence a submission was never received. This
   is the distinction `PF.intake.status()` already draws and it must not narrow to two states.

### What is done, and what is left

Client-side, `PF.intake.status(referenceId, email, { verification })` sends
`{ referenceId, verification }` when a proof is present and `{ referenceId, email }` when it is
not — so property 1 holds by construction: **the email leaves the body the moment a proof
enters it.** On a verified lookup `keepUrl()` writes only the reference, because a verified
session that leaves the address in the URL bar, the browser history and the `Referer` header has
moved the disclosure rather than closed it.

`PF.intake.verificationAvailable()` requires *both* `VERIFY` and `VERIFY_CONFIRM`. Where the flow
demands a proof and the deployment cannot send a code, the page says the lookup cannot be
completed here rather than starting a round-trip it cannot finish — a code with nowhere to
redeem it leaves the submitter waiting for an outcome that will never arrive.

Covered by five assertions in `tests/hardening.test.mjs` and three in `tests/portal.spec.js`:
a demand for proof is answered and never rendered as a denial; a flow that does not ask sees
exactly one call and the submitter is asked for nothing; an unsendable code is reported
honestly; the proof is carried on the retry; the email is absent from that request; and the
address does not reach the URL.

**What is left is the flow half, and only the flow half.** Until the `STATUS` flow answers
`403 verification_required` and resolves the address from the proof, the read path is still
authorised by a pair the submitter's own correspondent may hold. No client change can close
that, which is why this is specified here as the flow's obligation rather than fixed in the
browser.

Sequencing: land the flow half with, or before, the wiring of `STATUS` to the live registry.
While the store is `localStorage` the current contract discloses nothing between citizens, which
is exactly the window in which the flow can be built to the stricter shape at no cost.

Respond / add-a-note / withdraw still write only to `localStorage`, so they are offered on a
device-sourced record only. A registry-sourced record routes the submitter to the helpdesk,
which *is* delivered. Citizen write-back to the registry is a later step — a button that
renders "Response sent" for something never sent is worse than no button.

**Correspondence taxonomy** — `js/data.js` → `PF.CORRESPONDENCE_TYPES`: eight public-facing
types, each mapped to the internal registry category the operations platform already uses.
Adding an entry adds it to the submission form, the home page and the command palette
automatically. Confirm the `category` strings against the registry reference data before
go-live.

**There are no staff accounts.** `PF.STAFF` held `admin`/`password`, `reviewer`/`reviewer`
and `compliance`/`compliance` in this JavaScript file, served by an unauthenticated static
site, and the console compared the typed password against it in the browser. The console and
the credentials are both deleted — an external submission channel must not carry staff
triage, and the internal platform already implements it with server-side identity. See
`docs/forensic/dd2e909/findings.json` **F-029**.

## Data

Demonstration records, the device history, the draft and the offline outbox live in
`localStorage` under `nitda.portal.*`. A fresh browser installs sixteen seed records dated
relative to the day of first load, so a new deployment always looks current.

With endpoints configured, the registry is authoritative: `PF.store` serves the demonstration
set and the offline fallback, not the truth about a live submission.

## Built in

- Three themes — light, dark, high contrast — persisted per browser.
- Command palette on `Ctrl/⌘ K` or `/`: navigate, start any correspondence type, jump to your own requests.
- Working-day arithmetic for the acknowledgement target, with overdue detection.
- Print stylesheets: submission receipt, request record and support case print as clean A4
  documents with the endorsed NITDA logotype.
- Offline shell via service worker; installable as a PWA with submit/track/support shortcuts.
- Accessibility: skip link, labelled fields with inline errors, `aria-live` status regions,
  focus-trapped dialogs, keyboard-navigable palette and drawer, 44 px minimum targets,
  visible focus rings, reduced-motion support.
- Responsive from 360 px to ultrawide; tables scroll horizontally rather than reflow.

## Feature parity with the sources

The external-facing capability of both source portals is preserved: mobile navigation, theme
toggle, first-visit welcome, submission with file validation and confirm-before-send,
tracking by reference with status history, and a helpdesk with preview modal and a real case
reference. Each was rebuilt on the design system and extended — guided multi-step
submission, email-verified tracking read back from the registry, acknowledgement meters and
an offline outbox.

**Deliberately not preserved:** the staff console. Queue triage, decisions, performance
analytics, the audit trail and CSV export were browser-side functions over one device's
`localStorage`, gated by a password held in a public file. They belong in the internal
platform, which implements them against the system of record.

## Deployment checklist

1. Copy the folder contents to the web root (or a subdirectory — all paths are relative).
2. Serve over HTTPS; the service worker and clipboard both require a secure context.
3. Set `Cache-Control: no-cache` on `sw.js`, long-lived caching on `ds/` and `js/`.
4. Point `sitemap.xml` at the live host.
5. Set the endpoint URLs in `config.local.js` and confirm each flow allows this origin
   (CORS). Leave them empty to run the portal standalone in demo mode.
6. Bump `CACHE` in `sw.js` on every release — asset requests are cache-first, so a stale
   entry survives a redeploy.
