# Minimal pilot — the short path

About 55 minutes, most of it building flows.

This gets correspondence flowing end to end: a citizen submits, the registry sees it, an
officer triages, assigns, approves, dispatches and closes. Nothing else.

Hosting the front end and gating who may load it are handled outside this repository — not
covered here. See [`FLOW-BUILD-WALKTHROUGH.md`](./FLOW-BUILD-WALKTHROUGH.md) instead if you want
every SharePoint/Power Automate feature built at once (all 24 flows, not just the pilot's six).
Come back to it later to add the ones you skip here — each is one line in your config file and a
redeploy of the static site.

## Why this is so much smaller

Every governed write in the platform — register, triage, treat, approve, dispatch, close,
archive — goes through **one** endpoint, `DYNAMIC_ACTIONS`. The platform needs six endpoints,
not twenty-four. The other eighteen are AI analysis, one-time passcodes, the email desk,
the help desk, scan intake and email verification (which is now two flows). All can wait.

That also simplifies the security work. Rather than carefully regenerating twenty-odd
triggers, you **delete everything you are not using** — 21 flows — and regenerate the three
you are. Deleting is faster than regenerating and it is the stronger action: it invalidates
every signature a flow has ever had, including the older ones that regeneration leaves live.

**One thing you cannot skip, however small the pilot.** The browser now calls every flow
directly — there is no proxy, Worker or broker in between. The flow trigger URLs are shipped
to every visitor's browser, so they are public. That means each flow you keep is the only place
its own validation, rate limiting, reference minting and upload verification can happen. A
minimal pilot is still a public endpoint on the open internet; build the flows accordingly.

---

## 1 · Prepare — 10 minutes

```bash
cd /path/to/ECM_DOCS_DEV
git checkout main && git pull
npm install
```

Then see where you stand before changing anything:

```bash
npm run commission
```

It lists every obligation between this repository and a live deployment, and exits
non-zero until they are met. Re-run it after each step below.

Create a plain values file by hand, outside the repository, to hold the flow URLs as you
collect them:

```bash
printf '# DGO pilot flow URLs — delete when deployed\n' > ~/dgo-values.txt
```

Leave it open. You will fill it in as you go. Every URL in it is a bearer credential, which is
why it lives outside the repository and is deleted at the end.

## 2 · SharePoint — 10 minutes

**Do not create new lists.** Your correspondence lists already exist and the platform already
reads them. First find out what you have — this changes nothing:

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser     # first time only
./scripts/setup-sharepoint.ps1 -SiteUrl "https://YOURTENANT.sharepoint.com/sites/YOURSITE" -WhatIf
```

The report tells you three things:

1. Which of the ten `DGO_*` platform lists exist. If any are missing, run the same command
   without `-WhatIf` to create them from `docs/reference/sharepoint-provisioning-spec.json`.
2. The real name of your correspondence list. **Write it down** — you need it in step 3d.
3. Which columns the platform reads that your lists do not have. These are reported, never
   added: those lists hold live records.

One missing column matters before you open the public channel: somewhere to store the
**submitter's email**. The tracking page matches reference *and* email, and that pairing is
what stops somebody who guesses a reference from reading another person's correspondence. If
your list has no such column, add it by hand and note its internal name.

Your attachment library also needs `ReferenceId` and `Sha256` columns. Add them if absent —
a library is not a register, so there is no risk in doing so.

## 3 · Power Automate — 45 minutes

Open https://make.powerautomate.com and check the environment selector in the top right is
the right environment.

### 3a · Delete the 21 flows you are not using — 20 minutes

To open a flow by ID, paste this in the address bar, replacing `WORKFLOWID` — take
`ENVIRONMENTID` from the URL of any flow you already have open:

```
https://make.powerautomate.com/environments/ENVIRONMENTID/flows/WORKFLOWID/details
```

Then **···** → **Delete** → **Delete**.

```
02a3a70f3dec4dcd9a85a244a60c65b9    d67f2acb3708449490eed561ee56efbe
7e71fffe770a45ccb93bf216bb53786e    fe794e0139784ac694768e5a716e0be7
818ec4053f1e4f0b87845114241d8b74    20e3b003a57f47febae8a24ad5b9acd4
20e6340941ce4b1bbb87b43c9102a777    a13c8b577bd44f8787c50d095ea3faf9
314aaf27593147089b38322e5ca25936    a942d230337c4ddfa9a386e92bbd048b
43879c5165de439680055ab4258b3f27    85c556f10b8244ba9d839a2ebe240b91
37642ba3597f4cf58288cc71b5e6b519    3931e2ff995242b6b2c920c8b2209797
ff455c68e9ac493e858fb984bcfd01fb    1ff7714c11a74fa4a876f8f6a79b64d2
3fc71cc29d15481291fd341def327572    5b29edc84b5d4a8db3c885d8441aa977
7995c1eb50d94d5daa2780e71391d874    c43388639d14452faef4ca3042a95b23
ca0bafc172114e0bb4853c135246654c
```

"Not found" means it is already gone. Tick it off.

This is the security half of the whole deployment. Every one of these has a published trigger
URL that works right now, and nothing in the platform calls it.

### 3b · Regenerate the 3 you keep — 10 minutes

For each: open it → **Edit** → click the **When an HTTP request is received** trigger →
**···** inside the trigger → **Regenerate** → copy the new **HTTP POST URL** → **Save**.

| Workflow ID | Paste the URL into `~/dgo-values.txt` as |
|---|---|
| `bc83d98acf474a088832d78f50085388` | `DGO_ENDPOINT_DYNAMIC_ACTIONS` |
| `6b3bad3005b44bf6bced0f8074d3f2ed` | `DGO_ENDPOINT_SINGLE_ASSIGNMENT` |
| `1154b50e1d17420dadb3b012e7e2a02c` | `DGO_ENDPOINT_BULK_ASSIGNMENT` |

### 3c · Rebuild FETCH_ALL — 5 minutes

Workflow `4a250f97181b4a28abc1d0fb0f7d4c4d` carries **two** live signatures, so regenerating
revokes only the newer one.

1. Open it → **···** → **Save As** → name it `FETCH_ALL v2` → **Save**.
2. Open the copy → **Edit** → click the trigger → copy the **HTTP POST URL** → **Save**.
3. Make sure it is turned **On**.
4. Paste the URL as `DGO_ENDPOINT_FETCH_ALL`.
5. Go back and **delete the original**.

### 3d · Build the two intake flows — 10 minutes

These do not exist yet. Follow **C7** and **C9** in
[`FLOW-BUILD-WALKTHROUGH.md`](./FLOW-BUILD-WALKTHROUGH.md) — every
field value and expression is given there, ready to copy.

- **C7** builds `DGO Intake Submission` → paste its URL as `DGO_ENDPOINT_INTAKE_SUBMISSION`
- **C9** builds `DGO Intake Upload` → paste its URL as `DGO_ENDPOINT_INTAKE_UPLOAD`

With no proxy in front of them these two flows carry the whole security burden of the public
channel. C7 must mint the `NITDA-YYYY-<sequence>` reference itself (unpadded, monotonic, never
restarting within a year), rate-limit by source and issue one single-use upload ticket per
attachment;
C9 must redeem that ticket once and verify the received bytes against the declared size and
SHA-256. The steps in C7.9a and C9 spell this out. Do not treat it as optional polish — it is
the only thing standing between the register and an anonymous stranger with the URL.

Skip C8, C10 and C11 for now — those are tracking, verification and the help desk. There is no
signing secret to generate any more; the ticket is issued and redeemed inside the flows.

## 4 · Gate who may load the internal page

Whatever keeps the internal interface off the open internet is set up and operated outside
this repository. The platform has exactly six roles — `DGO-SystemAdmin`, `DGO-UserAdmin`,
`DGO-Executive`, `DGO-Director`, `DGO-Operator`, `DGO-Viewer` — and every pilot officer needs to
land in exactly one of them, however your access gate models that. Nothing here sits between
the loaded page and the flows (step 3), so in this pilot an officer's role inside the app is
advisory regardless of which gate you choose (see step 6). That gate is what you build real
authorisation on later per `docs/architecture/AUTHENTICATION_CONTRACT.md`.

## 5 · Configure the endpoints — 5 minutes

There is no Worker to deploy and no secrets to set. The flow URLs you collected go into two
git-ignored files that ship with the static site.

Create `config/config.local.js` with the four platform endpoints the minimal pilot uses,
pasting each URL from `~/dgo-values.txt`:

```javascript
window.DGO_CONFIG = {
  endpoints: {
    FETCH_ALL:         "DGO_ENDPOINT_FETCH_ALL",
    DYNAMIC_ACTIONS:   "DGO_ENDPOINT_DYNAMIC_ACTIONS",
    SINGLE_ASSIGNMENT: "DGO_ENDPOINT_SINGLE_ASSIGNMENT",
    BULK_ASSIGNMENT:   "DGO_ENDPOINT_BULK_ASSIGNMENT",
  },
};
```

Create `document-portal/config.local.js` — beside `index.html`, not in `js/` — with the two
intake endpoints:

```javascript
window.PF_CONFIG = {
  endpoints: {
    SUBMISSION: "DGO_ENDPOINT_INTAKE_SUBMISSION",
    UPLOAD:     "DGO_ENDPOINT_INTAKE_UPLOAD",
  }
};
```

Or let the setup script write both from the values file you have been filling in — it uses
exactly the `DGO_ENDPOINT_*` / `PF_ENDPOINT_*` names recorded above:

```bash
npm run setup -- --values ~/dgo-values.txt --force
```

Both files are already git-ignored. Confirm before you deploy:

```bash
npm run commission
```

It must exit 0. Beyond checking that nothing is staged, it fails if any endpoint you just
wired carries a signature that is still published in this repository — meaning that trigger
was never regenerated, and going live on it means going live on a credential anyone with
repository access already holds. A signed flow URL committed to Git is a leaked credential
that outlives deleting the file. Every URL in these two files is delivered to every
visitor's browser, so treat them as public and rotate them on a schedule.

## 6 · Deploy the static site — 5 minutes

Both config files must exist on disk first — whatever you use to deploy needs to publish the
working directory as-is, config files included. How you host the front end and how you gate
who may load it are decisions made outside this repository; make sure the deployed hostname
matches whatever application domain your access gate is configured against, or the internal
interface is reachable without a sign-in.

## 7 · Check it works — 10 minutes

**Submit twice.** Replace `SUBMISSION_URL` with the URL you recorded as
`DGO_ENDPOINT_INTAKE_SUBMISSION`:

```bash
curl -s -X POST SUBMISSION_URL \
  -H 'Content-Type: application/json' \
  -d '{"subject":"Check one","category":"General Correspondence","senderEmail":"registry@nitda.gov.ng","sender":{"name":"Registry"},"description":"First check."}'
```

Run it again with `Check two`. Each response must contain a `"referenceId":"NITDA-` value, and
the two must be **different, consecutive numbers**. If a number repeats, your `SUBMISSION` flow
is restarting the sequence — go back to C7.9a and fix the minting. (If you built the flow to
require a verified email it answers `403 verification_required` instead; test through the
portal with a verified address.)

**Look in SharePoint.** The `Correspondence` list must hold both, with `Received` in Status.

**Understand what the authenticated side does for a stranger.** Replace `FETCH_ALL_URL` with
the URL you recorded as `DGO_ENDPOINT_FETCH_ALL`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST FETCH_ALL_URL \
  -H 'Content-Type: application/json' -d '{}'
```

There is no Worker to refuse this. If your `FETCH_ALL` flow does not verify a token — the
inert pilot default — it will answer `200` and hand the register to an anonymous caller. That
is a known limitation of the pilot posture, not a misconfiguration: the URL is only shielded by
being unadvertised and by whatever gates the interface, never the flow. If a `200` here is
unacceptable for your data, build token verification into the flow before going live.

**Have officers sign in.** One from each group opens the deployed URL, signs in through
whatever gates the interface, and adds `#/diagnostics` to the address bar. Each sees their
email and a role — but in the inert pilot that role is **advisory**, read from the profile the
interface holds, not verified against any group claim. Use it to confirm the interface renders
per role, not as proof that privilege is enforced anywhere.

**Confirm the register is shared.** One officer registers a correspondence; a second, on a
different machine, finds it under `#/lookup`. If they cannot, `FETCH_ALL` is not reaching its
flow — check it is set in `config/config.local.js` and that the deployed site includes that
file.

## 8 · Before real correspondence arrives

Delete the test records from the `Correspondence` list, and delete `~/dgo-values.txt` — it
holds the signed flow URLs, and each one is a bearer credential.

Confirm the routing table below. It decides which desk each kind of correspondence lands on,
and nobody has approved it yet.

**H1** Open `config/correspondence-categories.config.js` in the repository.

**H2** Read this table:

| Document kind | Currently routes to |
|---|---|
| Ministerial Directive | Executive Correspondence |
| Policy Submission | Policy / Regulation |
| Compliance Filing | Policy / Regulation |
| Application | Operations |
| Proposal | Operations |
| Project Proposal | Operations |
| Report | Operations |
| Meeting Request | General Administration |
| Event Invitation | General Administration |
| Official Correspondence | General Administration |
| General Correspondence | General Administration |

**H3** Confirm each row with whoever owns registry policy, or write down the corrections.

**H4** Confirm which kinds the public may choose on the portal. Currently seven of the eleven
are offered: General Correspondence, Application, Proposal, Report, Compliance Filing, Policy
Submission, Event Invitation.

**H5** To change a routing destination, edit the `DocumentKindRouting` object in that file so
the kind points at the correct destination, then run:

```bash
node tests/categories.test.mjs
```

It fails if any kind is left without a routing rule.

**H6** If you change the list of kinds, update the `Category` choices in the SharePoint
`Correspondence` list (step 2) to match exactly.

---

## What you skipped, and how to add it

Each is one line added to your config file and a redeploy of the front end (step 6).

| To add | Build the flow | Then set the key |
|---|---|---|
| Citizens tracking their submission | C8 in `FLOW-BUILD-WALKTHROUGH.md` | `STATUS` in `PF_CONFIG` |
| Outward correspondence email | new flow | `EMAIL` in `DGO_CONFIG` |
| Email verification before a reference is issued | C10 — both the verify and confirm flows | `VERIFY` and `VERIFY_CONFIRM` in `PF_CONFIG`, then have the `SUBMISSION` flow require the proof |
| The public help desk | C11 | `SUPPORT` in `PF_CONFIG` |
| Registry counter scan deposits | reuse the upload flow | `SCAN_INTAKE` in `DGO_CONFIG` |
| AI analysis and one-time passcodes | new flows | the matching key in `DGO_CONFIG` |

Build these fresh rather than restoring the flows you deleted in 3a. Those all had published
credentials, which is why they were deleted. Whether verification is required is now a decision
the `SUBMISSION` flow makes for itself — there is no server flag to flip.

## The flow URLs are public — treat them so

There is no per-instance ticket or rate-counter caveat any more, because there is no Worker.
What replaces it matters more: every signed flow URL in your two config files is delivered to
every visitor's browser and can be read straight out of the page. Assume a hostile caller has
each one from the moment you deploy. Two consequences you cannot pilot your way around:

- **Each flow must be safe when a stranger calls it** — it must validate its own input,
  rate-limit its own callers, mint its own reference and verify its own uploads. Whatever
  fronts the interface never sees a flow call, so it cannot help.
- **Rotate the URLs on a schedule** — regenerate the SAS signature in Power Automate, paste the
  new URL into the config file, and redeploy. That is the only way to revoke an exposed URL.
