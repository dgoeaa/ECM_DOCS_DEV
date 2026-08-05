# Commissioning for live usage

**Status as at 5 August 2026: the platform is healthy and NOT commissioned.**

Those are two different statements and the distinction is the whole point of this
document. The code works — 17 Node suites, 78 browser tests, every route rendering, all
green. Nothing here is broken. But nothing is wired to a flow, nothing is deployed, no
credential has been rotated, and no enforcement exists on the server side. A platform in
that state boots, renders and transmits nothing. That is what "doesn't seem to be active"
looks like from the outside, and it is the correct, safe state for an uncommissioned
system.

Run the gate at any point to see exactly where you stand:

```bash
npm run commission
```

It exits non-zero until the platform may be declared live, names each blocker, and
separates what it can verify from what only a person can sign.

---

## Why it wasn't running

Three of the commands this repository documented did not exist.

`README.md` told you to run `npm install && npm run go`. `.devcontainer/devcontainer.json`
ran `npm install && npm run setup` on every Codespace create. Neither script was in
`package.json` — they were written on a branch (PR #5, "One-command setup and Codespaces
support") that was closed rather than merged, and only the documentation half was carried
forward. So:

- every Codespace failed its `postCreateCommand`,
- every reader following the README hit `npm error Missing script: "go"`,
- and `npm run serve:portal` was equally absent.

All three now exist and are covered by `tests/commissioning.test.mjs`, which asserts that
every `npm run` referenced by the README or the devcontainer resolves — so this
particular failure cannot return silently.

---

## What is in this repository, and what is not

This is the boundary that governs everything below.

| | Where it lives | Who can do it |
|---|---|---|
| Runtime, portal, routing, RBAC surface, themes | this repository | done |
| Endpoint wiring, auth activation, readiness gate | this repository | `npm run setup`, `npm run commission` |
| **Flow token validation, role derivation, per-action authorisation, rate limiting, reference minting, upload ticketing** | **Power Automate** | **only you** |
| SAS signature rotation | Power Automate | only you |
| SharePoint lists and columns | your tenant | only you |
| Cloudflare Pages + Access | your Cloudflare account | only you |
| Entra tenant and client IDs | your tenant | only you |

The middle row is gap **G-04**, and it is the one that matters most. An authenticating
proxy used to discharge it; that proxy has been removed. Every obligation it carried now
belongs to the individual flow, because the browser calls each flow directly with no
intermediary. **No amount of work in this repository can close G-04.** The gate is honest
about this: it reports the server half as unverifiable, never as done, no matter how
completely the client half is configured.

---

## The path

### 0 · See where you are

```bash
npm install
npm run setup          # scaffolds both config files; demo mode, transmits nothing
npm run commission     # tells you what stands between here and live
```

`npm run setup` with no values is not a failure — it is the correct state for a fresh
clone or a Codespace. The platform boots and runs locally with nothing transmitted.

### 1 · Decide the posture

Two genuinely different products. Choose before you build flows, because the flows differ.

**Pilot** — Cloudflare Access gates who may *load* the interface. Authentication stays
inert: caller identity is a client-asserted `userEmail` from `localStorage`, and RBAC is
advisory, so editing one storage key escalates a viewer to `systemAdmin`. Access does not
sit between the page and the flows, so a flow called directly answers whoever calls it.

> Fit for an internal pilot on correspondence you accept being readable by anyone holding
> a URL. **Not fit for the personal data of ~785 individuals** (finding R-01) — the pilot
> posture does not protect it.

**Enforced** — `auth.enabled: true`, Entra tenant supplied, roles read from token claims,
**and each flow validating that token itself**. The client half is here and ready. The
server half is the row you cannot delegate.

```bash
npm run commission -- --posture pilot
npm run commission -- --posture enforced
```

### 2 · Rotate every exposed signature

**59 signed Power Automate trigger URLs are committed to this repository**, across 39
tracked files — largely the reference corpus under `docs/reference/foundational/`, which
documents the deployed flow estate verbatim by explicit decision (D5).

A SAS-signed URL is a bearer credential: possession alone authorises invoking the flow.
Anyone who can read this repository holds all 59 right now.

**Deleting a file revokes nothing. Rewriting history revokes nothing. Only regenerating
the signature in Power Automate revokes anything.**

`docs/deployment/MINIMAL-PILOT.md` §3a takes the stronger route for the flows you are not
using: delete them outright. Deletion invalidates every signature a flow has ever had,
including older ones that regeneration leaves live.

The gate catches the failure mode that matters here. If you wire an endpoint whose
signature also appears anywhere in this repository, it was never rotated, and
`npm run commission` blocks go-live and names the file the signature was published in.
Nothing else in the repository performs that check.

### 3 · Build the flows

Follow `docs/deployment/MINIMAL-PILOT.md` — about 75 minutes, six endpoints rather than
twenty-four, because every governed write goes through `DYNAMIC_ACTIONS`.

Each flow you keep is the only place its own validation, rate limiting, reference minting
and upload verification can happen. For the public channel specifically: `SUBMISSION`
must mint the `NITDA-YYYY-<sequence>` reference itself (unpadded, monotonic, never
restarting within a year), rate-limit by source, and issue one single-use upload ticket
per attachment; `UPLOAD` must redeem that ticket once and verify the received bytes
against the declared size and SHA-256.

### 4 · Wire the endpoints

Collect the regenerated URLs into a values file outside the repository, then:

```bash
npm run setup -- --values ~/dgo-values.txt --force
```

Accepted keys are `DGO_ENDPOINT_<KEY>` for the runtime and `PF_ENDPOINT_<KEY>` for the
portal (the bare key works too). For the enforced posture, add:

```
DGO_AUTH_ENABLED=true
DGO_AUTH_TENANT_ID=...
DGO_AUTH_CLIENT_ID=...
DGO_AUTH_ROLE_SOURCE=claims
```

Both target files are git-ignored and the gate blocks go-live if either becomes tracked.
Delete `~/dgo-values.txt` when you are done — every line in it is a credential.

### 5 · Deploy

```bash
npx wrangler pages project create nitda-dgo-platform --production-branch main
npx wrangler pages deploy . --project-name nitda-dgo-platform
```

`wrangler pages deploy .` uploads the working directory as-is, so both config files must
exist on disk first. Confirm the hostname matches the Access application domain, or the
internal interface is reachable without a sign-in.

### 6 · Verify, then declare

```bash
npm run commission     # must exit 0
npm test               # full suite
npm run test:smoke     # once more against the deployed hostname
```

Then the checks a script cannot make, from `MINIMAL-PILOT.md` §7: submit twice and
confirm the references are different and consecutive; confirm both land in SharePoint;
call `FETCH_ALL` anonymously with `curl` and understand what the status code tells you;
have one officer from each group sign in and check `#/diagnostics`; confirm two officers
on different machines see the same register.

Before real correspondence arrives, delete the test records and confirm the routing table
in Part H of `CLOUDFLARE.md` — nobody has approved it yet.

---

## What the gate cannot tell you

`npm run commission` exiting 0 means no automated blocker stands. It does not mean the
platform is safe to run, and it is written not to imply that. Four obligations always
remain, and they always require a person:

1. **The flows enforce what they claim to.** Untestable from here. Verify each against an
   anonymous caller and an under-privileged caller before trusting any governance control.
2. **The routing table is approved.** `CLOUDFLARE.md` Part H decides which desk each kind
   of correspondence lands on.
3. **Test records are cleared** and the reference sequence does not continue from them.
4. **The data protection position is accepted** for the posture you chose. Finding R-01
   concerns the personal data of ~785 individuals; the repository being private closed the
   exposure, but live usage puts that data through a channel whose enforcement you have
   just selected.

---

## Reference

- `docs/deployment/MINIMAL-PILOT.md` — the 75-minute path
- `docs/deployment/CLOUDFLARE.md` — the full walkthrough, 229 numbered steps
- `AUTHENTICATION_CONTRACT.md` — what the server half must do
- `STATUS_REPORT.md` — the finding register
- `CAPABILITY_ASSESSMENT_R11.6.md` — the gap analysis behind G-03 and G-04
