# NITDA DGO Platform — complete deployment walkthrough

Follow this from top to bottom. Every step is numbered. Do not skip a step or change its
order; several steps fail in confusing ways if an earlier one was not done.

**How this platform reaches its backend — read this first.** The browser calls each Power
Automate flow **directly**. There is no proxy, Worker or broker in the request path: nothing
to deploy, secret-set, run or keep alive between the page and the flows. The flow trigger
URLs are configured client-side at deploy time (Part E) and are therefore delivered to every
browser that loads the page. Cloudflare Access still sits in front of the internal site and
gates **who is allowed to load the page** — but a static site behind Access has no server of
its own, so it cannot check anything once the page is open. It follows that **each flow is
the only place authentication, authorisation, rate limiting, reference minting, upload
ticketing, filename-policy normalisation and validation can actually be enforced.** A flow
that trusts its caller trusts the whole internet. Everything in Part C depends on this
sentence; do not build a flow until you have taken it in.

**Time required:** Part A 20 minutes · Part B 1 hour · Part C 3–4 hours · Part D 45 minutes ·
Part E 20 minutes · Part F 20 minutes · Part G 30 minutes.

**What you need before starting:** a Cloudflare account (the free plan is enough — Pages
hosting and Access both have free tiers, and nothing here needs Durable Objects or a paid
Workers plan), an account with permission to create and delete flows in your Power Platform
environment, an account with permission to create SharePoint lists and libraries, and a
terminal on a machine with Node.js.

**Recording your values.** Seven values come from your own systems and cannot be printed in
this document. Create a plain text file now called `deployment-values.txt`, somewhere
outside the repository, and record each value as you obtain it. You will need them again.
Delete the file when you finish: it holds V5, the signed flow trigger URLs, and a signed
Power Automate URL is a bearer credential — anyone who reads it can invoke the flow.

```
V1 Cloudflare account ID     =
V2 Access team domain        =
V3 Access AUD tag            =
V4 Access group names        = DGO-SystemAdmin, DGO-UserAdmin, DGO-Executive, DGO-Director, DGO-Operator, DGO-Viewer
V5 Flow trigger URLs         = (24 of them, recorded in Part C)
V6 SharePoint site URL       =
V7 Pages hostname            =
```

---
---

# PART A — Preliminaries

## A1 · Check Node.js

Open a terminal.

**A1.1** Run:

```bash
node --version
```

**A1.2** If the number shown is `v18.0.0` or higher, continue to A2. If the command is not
found or the number is lower, install Node.js 22 from https://nodejs.org (choose the LTS
download for your operating system), then close and reopen the terminal and repeat A1.1.

## A2 · Get the repository and verify it

**A2.1** Change into the repository directory:

```bash
cd /path/to/ECM_DOCS_DEV
```

Replace `/path/to/ECM_DOCS_DEV` with the actual location on your machine. If you do not have
the repository yet, clone it first with `git clone` and then change into it.

**A2.2** Make sure you are on the correct branch:

```bash
git checkout claude/quirky-babbage-1nomt5
git pull origin claude/quirky-babbage-1nomt5
```

**A2.3** Install dependencies:

```bash
npm install
```

**A2.4** Install the browser the tests need:

```bash
npx playwright install --with-deps chromium
```

**A2.5** Run the full test suite:

```bash
npm test
```

**A2.6** Wait for it to finish — it takes about seven minutes. The last line must read
`59 passed`. Every stage before it must show `passed, 0 failed`.

**A2.7** If anything failed, stop here. Do not continue. Record the failing output and
resolve it before deploying.

## A3 · Sign in to Cloudflare from the terminal

You sign in to Cloudflare so that `wrangler` can create and deploy the Pages project in Part
F. That is the only thing `wrangler` is used for now — there is no Worker to deploy and no
secrets to set from the terminal.

**A3.1** Run:

```bash
npx wrangler login
```

**A3.2** A browser window opens. Sign in to Cloudflare and click **Allow**.

**A3.3** Return to the terminal. Run:

```bash
npx wrangler whoami
```

**A3.4** Find the `Account ID` column in the table it prints. Copy the 32-character value.
Paste it into `deployment-values.txt` as **V1**.

---
---

# PART B — SharePoint

## Read this before doing anything in SharePoint

**Do not create new lists.** An earlier version of this document told you to create a
`Correspondence` list with 24 columns. That was wrong, and following it would have left the
platform reading one set of lists while the intake channel wrote to another.

Two schemas already exist:

**1. Your operational lists.** These hold live correspondence today and the platform already
reads them. The proof is in `core/domain.js`, which normalises columns named `RefIDD`,
`Reference_ID`, `RoutedToDSU`, `DSU_KEY`, `CC_x0027_dTo` and `_x0033_rdAssigned` — the last
two being SharePoint internal names for `CC'dTo` and `3rdAssigned`. Nobody invents those.
They came from your lists.

**2. The DGO_* platform lists.** Ten lists and 97 fields, fully specified — including the
exact `SchemaXml` for every field — in `docs/reference/sharepoint-provisioning-spec.json`:

```
DGO_UserDirectory        DGO_RoleCatalogue        DGO_UserRoleHistory
DGO_AuditLog             DGO_PendingWrites        DGO_DepartmentDirectory
DGO_AccessScopes         DGO_PilotCohorts         DGO_EndpointRegistry
DGO_AccessEvents
```

## B1 · Find out what you already have

**B1.1** Open your SharePoint site. Copy the URL from the address bar — everything up to and
including the site name. Record it as **V6**.

**B1.2** Run the report. It changes nothing:

```bash
./scripts/setup-sharepoint.ps1 -SiteUrl "V6" -WhatIf
```

If PnP.PowerShell is not installed:

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser
```

**B1.3** Read the output. It tells you three things:

- which of the ten DGO_* lists exist and which would be created
- which of your operational lists it found, and under what name
- for each, which columns the platform reads and **which are missing**

**B1.4** Write down the real name of your correspondence list. The script looks for
`Activities`, `Correspondence`, `Documents` or `Records`; if yours is called something else it
will say it found nothing, which is not an error — you simply need its real name for Part C.

## B2 · Provision the DGO_* platform lists

**B2.1** If B1.3 showed DGO_* lists missing, create them:

```bash
./scripts/setup-sharepoint.ps1 -SiteUrl "V6"
```

Everything comes from the specification file. Nothing is hardcoded in the script, and it is
add-only — an existing list or column is reported and left alone.

**B2.2** If all ten already exist, skip this. Nothing to do.

## B3 · Decide about missing operational columns

**B3.1** The report marks with `--` any column the platform reads that your list does not
have. The script does **not** add these. Your operational lists hold live records, and adding
a column to a register is a change to a system of record that a person should approve.

**B3.2** For each one, decide: add the column in SharePoint by hand, or accept that the
platform will show a blank there.

**B3.3** One is worth particular attention. The public channel needs somewhere to record the
**submitter's email address**, because the tracking page matches on reference *and* email —
that pairing is what stops somebody who guesses a reference from reading another person's
correspondence. If your correspondence list has no sender-email column, add one before
opening the public channel. Note its exact internal name; you will map to it in C7.

## B4 · The attachment library

**B4.1** Confirm you have a document library for correspondence attachments, and record its
name.

**B4.2** It needs two columns the upload flow writes. Check whether they exist:

| Column | Type | What it holds |
|---|---|---|
| `ReferenceId` | Single line of text | ties the file to its registry reference |
| `Sha256` | Single line of text | the digest, so you can prove later that the stored file is byte-for-byte what the citizen sent |

**B4.3** Add either one that is missing. A library is not a register — adding a column here
carries none of the risk of B3.

# PART C — Power Automate

This is the longest part. Work through it in order.

## C1 · Open Power Automate and find your environment

**C1.1** Open https://make.powerautomate.com in a browser.

**C1.2** Look at the environment selector in the top right corner. Confirm it names the
environment this platform uses. If it does not, click it and choose the correct one. Every
step below applies to the selected environment only.

**C1.3** In the left sidebar click **My flows**.

**C1.4** Click the **Cloud flows** tab.

## C2 · How to find a flow by its workflow ID

You will do this repeatedly. The workflow ID is the 32-character value in the flow's URL.

**C2.1** Click any flow in the list.

**C2.2** Look at the browser address bar. The URL contains `/flows/` followed by the
workflow ID.

**C2.3** To find a specific ID, click each flow in turn and compare, or paste this directly
into the address bar, replacing `WORKFLOWID` with the 32-character value you are looking
for:

```
https://make.powerautomate.com/environments/ENVIRONMENTID/flows/WORKFLOWID/details
```

Take `ENVIRONMENTID` from the URL of any flow you already opened.

**C2.4** If a workflow ID produces "not found", that flow has already been deleted. Tick it
off and move on — that is a completed item, not a problem.

## C3 · Delete the 9 flows that must be deleted

These have no consumer, or carry two live signatures that regeneration cannot both revoke.
Deleting the flow is the only action that invalidates every signature it has ever had.

**C3.1** For each of these nine workflow IDs, find the flow as described in C2:

```
37642ba3597f4cf58288cc71b5e6b519
3931e2ff995242b6b2c920c8b2209797
ff455c68e9ac493e858fb984bcfd01fb
1ff7714c11a74fa4a876f8f6a79b64d2
3fc71cc29d15481291fd341def327572
5b29edc84b5d4a8db3c885d8441aa977
7995c1eb50d94d5daa2780e71391d874
c43388639d14452faef4ca3042a95b23
ca0bafc172114e0bb4853c135246654c
```

**C3.2** With the flow open, click **···** (More commands) in the top toolbar.

**C3.3** Click **Delete**.

**C3.4** In the confirmation dialog, click **Delete** again.

**C3.5** Repeat C3.1 to C3.4 for all nine. Tick each off as you go.

**C3.6** Also delete this one — a retired endpoint the platform no longer calls:

```
02a3a70f3dec4dcd9a85a244a60c65b9
```

## C4 · Delete and rebuild the 3 flows that carry two signatures

`OTP_GENERATE`, `OTP_VERIFY` and `FETCH_ALL` each have two published signatures. Regenerating
revokes only the newer one. You must delete and rebuild.

**C4.1** Open the flow with workflow ID `4a250f97181b4a28abc1d0fb0f7d4c4d` (this is
`FETCH_ALL`).

**C4.2** Click **Edit**.

**C4.3** Take a screenshot of every action in the flow, or click each action to expand it and
photograph the configuration. You are about to delete it and will rebuild the same logic.

**C4.4** Click **···** → **Save As**. Name it:

```
FETCH_ALL v2
```

Click **Save**. This creates a copy with a brand new trigger URL and no history of the old
signatures.

**C4.5** Open the copy. Click **Edit**. Click the **When an HTTP request is received**
trigger to expand it.

**C4.6** Copy the **HTTP POST URL** shown. Record it in `deployment-values.txt` labelled
`DGO_ENDPOINT_FETCH_ALL`.

**C4.7** Click **Save**. Confirm the flow is turned **On** — if the toolbar shows **Turn on**,
click it.

**C4.8** Go back to the original flow `4a250f97181b4a28abc1d0fb0f7d4c4d` and delete it using
C3.2 to C3.4.

**C4.9** Repeat C4.1 to C4.8 for workflow ID `314aaf27593147089b38322e5ca25936`, naming the
copy `OTP_GENERATE v2` and recording its URL as `DGO_ENDPOINT_OTP_GENERATE`.

**C4.10** Repeat C4.1 to C4.8 for workflow ID `43879c5165de439680055ab4258b3f27`, naming the
copy `OTP_VERIFY v2` and recording its URL as `DGO_ENDPOINT_OTP_VERIFY`.

## C5 · Regenerate the remaining 12 flows

These have one signature each and can be regenerated in place.

**C5.1** For each row in the table below, find the flow by its workflow ID as described in C2.

**C5.2** Click **Edit**.

**C5.3** Click the **When an HTTP request is received** trigger to expand it.

**C5.4** Click **···** inside the trigger card, then click **Regenerate**. Confirm if asked.

**C5.5** The **HTTP POST URL** now shows a new value. Copy the whole URL.

**C5.6** Paste it into `deployment-values.txt` against the secret name in the third column.

**C5.7** Click **Save**.

**C5.8** Move to the next row and repeat.

| Workflow ID | This flow is | Record the URL as |
|---|---|---|
| `1154b50e1d17420dadb3b012e7e2a02c` | Bulk assignment | `DGO_ENDPOINT_BULK_ASSIGNMENT` |
| `6b3bad3005b44bf6bced0f8074d3f2ed` | Single assignment | `DGO_ENDPOINT_SINGLE_ASSIGNMENT` |
| `7e71fffe770a45ccb93bf216bb53786e` | Bulk assignment direct | `DGO_ENDPOINT_BULK_ASSIGNMENT_DIRECT` |
| `818ec4053f1e4f0b87845114241d8b74` | Get documents | `DGO_ENDPOINT_GET_DOCS` |
| `20e3b003a57f47febae8a24ad5b9acd4` | AI document analysis | `DGO_ENDPOINT_AI_DOC_ANALYSIS` |
| `20e6340941ce4b1bbb87b43c9102a777` | Fetch email attachments | `DGO_ENDPOINT_FETCH_EMAIL_ATTACHMENTS` |
| `85c556f10b8244ba9d839a2ebe240b91` | Fetch activities | `DGO_ENDPOINT_FETCH_ACTIVITIES` **and** `DGO_ENDPOINT_SUBSIDIARY_ACTIONS` — record the same URL twice, under both names |
| `a13c8b577bd44f8787c50d095ea3faf9` | AI chat | `DGO_ENDPOINT_AI_CHAT` |
| `a942d230337c4ddfa9a386e92bbd048b` | Email related task | `DGO_ENDPOINT_EMAIL_RELATED_TASK` |
| `bc83d98acf474a088832d78f50085388` | Dynamic actions | `DGO_ENDPOINT_DYNAMIC_ACTIONS` **and** `DGO_ENDPOINT_EMAIL` — record the same URL twice, under both names |
| `d67f2acb3708449490eed561ee56efbe` | Reference data | `DGO_ENDPOINT_REFERENCE_DATA` |
| `fe794e0139784ac694768e5a716e0be7` | AI email analysis | `DGO_ENDPOINT_AI_EMAIL_ANALYSIS` |

**C5.9** Count the entries in `deployment-values.txt`. You should now have 17 URLs recorded
(12 flows, two of which are recorded under two names each, plus the three rebuilt in C4).

## C6 · Understand what the browser sends to these flows

The browser calls each flow above **directly**. There is no proxy in front of them to verify
a token, inject a trustworthy identity, or restrict who may connect. Every flow receives a
POST with `Content-Type: application/json`, an `X-Correlation-Id` header, and this body:

```json
{
  "action": "the contract action name",
  "payload": { },
  "userEmail": "officer@nitda.gov.ng",
  "requestId": "a UUID",
  "timestamp": "2026-08-04T09:15:22.431Z"
}
```

`userEmail` is asserted by the browser from the signed-in profile **only while platform
authentication is inert**, which is the pilot posture (see `docs/architecture/AUTHENTICATION_CONTRACT.md`).
Anyone who holds the flow URL can send this same request with any address in `userEmail` and
any values in `payload`, because nothing stands between them and the flow. **Treat
`userEmail` and everything in `payload` as attacker-controlled.**

When you later activate authentication (`AuthConfig.enabled = true` in `config/auth.config.js`),
the browser stops sending `userEmail` and instead attaches `Authorization: ******
At that point the flow must validate the token against the identity provider's JWKS and
derive both identity and role from its claims — never from the body. That obligation is set
out in `docs/architecture/AUTHENTICATION_CONTRACT.md §2`, and with the proxy gone the flow is the only thing
that can honour it.

**A flow you can no longer restrict to a proxy.** In the proxy design these flows could be
reached only from the proxy's egress. That is no longer achievable, and pretending otherwise
would hide the risk: the trigger URL is delivered to the browser, so the flow is reachable by
anyone who has loaded the page or read the URL. Cloudflare Access limits who can load the
internal page; it cannot limit who can POST to a Power Automate URL. Rotate these signatures
on a schedule — regenerating the signature is the only way to revoke a leaked one — keep them
out of Git, and assume every governed flow is directly reachable from the public internet.

## The public intake flows — read before building C7 to C11

The five flows in C7 to C11 receive traffic from the **public** portal: submission, status,
upload, email verification and the help desk. In the proxy design the proxy did the security
work in front of them — it minted the registry reference, issued and redeemed single-use
upload tickets, verified uploaded bytes against the declared size and SHA-256, applied the
Universal Filename Policy, generated and checked email verification codes, and rate-limited by
source. **That proxy is gone.** Each of these flows is now invoked directly by a stranger's
browser, so each must do all of that work itself.

The click-by-click steps below build a working **skeleton** for each flow — trigger, storage,
response — so traffic runs end to end. They are deliberately not the finished control. The
full request and response contract, and every guarantee each flow must enforce, is the table
under **"The contract each flow must satisfy"** in `document-portal/README.md`. Build to that
table, not only to the skeleton. In particular:

- the `SUBMISSION` flow (C7) mints the `NITDA-YYYY-<sequence>` reference (unpadded — the live
  flow issues `NITDA-2026-217`) and must **never** restart the sequence within a year; issues
  one short-lived, single-use upload ticket per
  declared attachment; applies the Universal Filename Policy
  (`config/filename-policy.config.js`, `docs/policies/universal-filename-policy/`) to every
  attachment name while keeping what the submitter sent as `originalName`; and rate-limits by
  source;
- the `STATUS` flow (C8) returns a **byte-identical** `404` for an unknown reference and for a
  wrong email, so it cannot be used to discover whether a reference exists;
- the `UPLOAD` flow (C9) redeems each ticket once and only once and checks the bytes against
  the size and SHA-256 the submission declared;
- the email-verification flows (C10) generate a one-time code, rate-limit it per address and
  per source, and compare it in constant time as a single-use value.

Nothing above can be delegated to an intermediary any more, because there is no intermediary.

## C7 · Build the intake submission flow

This flow does not exist yet. It receives public submissions from the portal, and it is the
**single most important flow to get right**: with no proxy in front of it, it is the only place
the reference can be minted, the filename policy applied, the rate limit enforced, verification
required and the upload tickets issued. Build it to the `SUBMISSION` row of the contract in
`document-portal/README.md`; the SharePoint steps below only cover storing the record.

**C7.1** In the left sidebar click **Create**.

**C7.2** Click **Instant cloud flow**.

**C7.3** In **Flow name**, type exactly:

```
DGO Intake Submission
```

**C7.4** In the trigger list, scroll to and click **When an HTTP request is received**.

**C7.5** Click **Create**.

**C7.6** The flow designer opens with the trigger. Click the trigger card to expand it.

**C7.7** Click **Use sample payload to generate schema**.

**C7.8** Paste this exactly into the box, then click **Done**. This is what the browser
actually sends now (see `document-portal/js/submit.js`): note there is **no** `referenceId`,
`declaredBytes`, `source` or renamed-filename fields — the proxy used to add those, and the
flow must produce them itself. Each attachment carries only its name, size and SHA-256, and a
`verification` proof is present only when the submitter has completed the email challenge:

```json
{
  "localId": "draft-000000",
  "channel": "Portal",
  "correspondenceType": "Incoming",
  "subject": "Request for policy clarification",
  "category": "General Correspondence",
  "senderEmail": "citizen@example.org",
  "sender": {
    "name": "A Citizen",
    "organisation": "Example Organisation",
    "organisationType": "Private"
  },
  "senderPhone": "+2348000000000",
  "eventDate": "",
  "description": "The body of the correspondence.",
  "attachments": [
    {
      "name": "letter_to_the_dg.pdf",
      "size": 24576,
      "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  ],
  "submittedAt": "2026-08-04T09:15:22.431Z",
  "verification": ""
}
```

**C7.9** Set **Method** to `POST`. If there is no Method field visible, click **Show advanced
options** first.

**C7.9a** Before you store anything, this flow must do the work the proxy used to do. None of
it is optional now, because nothing else runs between the anonymous browser and this trigger:

- **Rate-limit by source.** Refuse a caller who submits too often in a window. The trigger URL
  is public (Part E), so an unthrottled flow is an open relay into the register.
- **Enforce verification when you require it.** If your posture requires a verified email,
  reject a submission whose `verification` proof is missing or spent by returning HTTP `403`
  with body `{"error":"verification_required"}` — the portal recognises exactly that shape and
  asks the submitter for a code rather than queuing a doomed retry.
- **Mint the registry reference.** Generate `NITDA-YYYY-<sequence>` yourself, monotonic within
  the year, and **never restart the sequence inside a year** — a collision reuses a citizen's
  reference. Do not zero-pad: the register's own shape is `NITDA-2026-217`. This is the value
  you return and store, not anything the browser sent.
- **Apply the Universal Filename Policy** to each attachment name, keeping the submitter's
  original name as `originalName`. See `config/filename-policy.config.js` and
  `docs/policies/universal-filename-policy/` for the exact normalisation rules.
- **Issue one single-use upload ticket per declared attachment.** You return these in the
  response; the portal redeems each against the upload flow (C9). Bind each ticket to the
  reference, the declared size and the declared SHA-256 so C9 can verify the bytes.

**C7.10** Click **+ New step**.

**C7.11** In the search box type `Create item`. Click the **SharePoint** connector, then
click the **Create item** action.

**C7.12** Set **Site Address** to your SharePoint site (V6).

**C7.13** Set **List Name** to **your existing correspondence list** — the real name you
wrote down in B1.4. Do not create a new list for this. The platform loads the register from
this list through `FETCH_ALL`; a submission written anywhere else is invisible to every
officer.

**C7.14** Map the fields. The left column below is what `core/domain.js` actually reads, so
these are the names that matter. Your list may use slightly different ones — use the report
from B1.3 to confirm each, and map to what you actually have.

| Column the platform reads | Set it to |
|---|---|
| `Title` | Dynamic content: `subject` |
| `RefIDD` — or `Reference_ID` if that is what your list uses | The reference you minted in C7.9a, **not** an inbound field |
| `Description` | Dynamic content: `description` |
| `Category` | Dynamic content: `category` |
| `AssignmentStatus` | Type the literal text: `Not Assigned` |
| your sender-email column from B3.3 | Dynamic content: `senderEmail` |

Leave `RoutedToDSU`, `AssignedTo` and `AttachmentLink` empty. Routing and assignment are
decided by a registry officer during triage — filling them here would pre-empt a decision
that belongs to a person. `AttachmentLink` is written by the upload flow in C9.

**C7.14a** If your list has columns for the submitter's name, organisation or phone, map
them from `sender/name` using an expression such as:

```
triggerBody()?['sender']?['name']
```

and from `senderPhone` for the phone. If it does not have them, skip this — the platform does
not read them, and the full submission is preserved in the audit trail either way.

**C7.14b** `Created` is set by SharePoint automatically. Do not map `submittedAt` onto it.

**C7.15** Click **+ New step**.

**C7.16** Search for `Response`. Click the **Request** connector, then **Response**.

**C7.17** Set **Status Code** to `200`.

**C7.18** In **Body**, return the reference you minted and one ticket per declared attachment.
The portal reads `referenceId` and `uploads` from exactly this shape (see
`document-portal/js/submit.js`); returning `{"ok":true}` would leave the submitter with no
reference and no way to upload their files:

```json
{
  "referenceId": "@{outputs('Compose_reference')}",
  "uploads": "@{outputs('Compose_upload_tickets')}"
}
```

**C7.19** Click **Save**.

**C7.20** Click the trigger card to expand it. Copy the **HTTP POST URL**. Record it in
`deployment-values.txt` as `DGO_ENDPOINT_INTAKE_SUBMISSION`.

## C8 · Build the status read-back flow

**C8.1** Create → **Instant cloud flow** → name it exactly:

```
DGO Intake Status
```

**C8.2** Trigger: **When an HTTP request is received**. Click **Create**.

**C8.3** Expand the trigger. Click **Use sample payload to generate schema**. Paste exactly,
then click **Done**:

```json
{
  "referenceId": "NITDA-2026-000001",
  "email": "citizen@example.org"
}
```

**C8.4** Set **Method** to `POST`.

**C8.5** Click **+ New step**. Search `Get items`. Choose **SharePoint** → **Get items**.

**C8.6** Set **Site Address** to V6. Set **List Name** to **your existing correspondence
list** — the same one you used in C7.13, not a new one.

**C8.7** Click **Show advanced options**. In **Filter Query**, paste this, replacing
`RefIDD` with whichever reference column your list uses and `SenderEmail` with the
sender-email column you identified in B3.3:

```
RefIDD eq '@{triggerBody()?['referenceId']}' and SenderEmail eq '@{toLower(triggerBody()?['email'])}'
```

Both must match. The reference alone is not enough — requiring the pair is what stops
somebody who guesses a reference from reading another person's correspondence.

**C8.8** Set **Top Count** to `1`.

**C8.9** Click **+ New step**. Search `Condition`. Choose **Control** → **Condition**.

**C8.10** On the left side of the condition, click the box and use **Expression**:

```
length(body('Get_items')?['value'])
```

**C8.11** Set the operator to **is greater than** and the right side to `0`.

**C8.12** In the **If yes** branch, click **Add an action**. Search `Response`. Choose
**Request** → **Response**.

**C8.13** Set **Status Code** to `200`. In **Body**, paste the following, then correct each
column name on the right to match your list — `RefIDD`, `Status`, `Category` and the rest are
the names `core/domain.js` reads, but your list is the authority. Any name that does not
exist simply returns blank, which is why a mistake here is invisible until a citizen sees an
empty tracking page:

```json
{
  "referenceId": "@{first(body('Get_items')?['value'])?['ReferenceId']}",
  "status": "@{first(body('Get_items')?['value'])?['Status']?['Value']}",
  "statusLabel": "@{first(body('Get_items')?['value'])?['StatusLabel']}",
  "category": "@{first(body('Get_items')?['value'])?['Category']?['Value']}",
  "subject": "@{first(body('Get_items')?['value'])?['Subject']}",
  "receivedAt": "@{first(body('Get_items')?['value'])?['ReceivedAt']}",
  "acknowledgedAt": "@{first(body('Get_items')?['value'])?['AcknowledgedAt']}",
  "updatedAt": "@{first(body('Get_items')?['value'])?['UpdatedAt']}",
  "closedAt": "@{first(body('Get_items')?['value'])?['ClosedAt']}",
  "actionRequired": "@{first(body('Get_items')?['value'])?['ActionRequired']}",
  "timeline": @{if(empty(first(body('Get_items')?['value'])?['Timeline']), '[]', first(body('Get_items')?['value'])?['Timeline'])}
}
```

**C8.14** In the **If no** branch, click **Add an action**. Search `Response`. Choose
**Request** → **Response**.

**C8.15** Set **Status Code** to `404`. In **Body**, paste exactly:

```json
{
  "ok": false
}
```

This same 404 must answer **both** an unknown reference and a correct reference with the wrong
email — byte for byte, with no hint of which was wrong. The single `and` filter in C8.7 gives
you that for free: both cases produce an empty result and fall into this one branch. Do not add
a distinct "no such reference" message, or you hand an enumerator a way to discover which
references exist. The proxy used to guarantee this uniformity; now the flow is the only thing
that can (see the `STATUS` row of `document-portal/README.md`).

**C8.16** Click **Save**. Expand the trigger, copy the **HTTP POST URL**, record it as
`DGO_ENDPOINT_INTAKE_STATUS`.

**About the timeline.** Each entry the `STATUS` flow returns to a citizen has an `at`,
`status`, `label` and `note`. Return the `note` only when the entry also carries
`"public": true`. Registry officers can therefore keep internal minutes on the same timeline;
anything not explicitly marked public must be withheld. There is no proxy to strip internal
notes on the way out any more, so this filter has to live in the flow — when you add timeline
entries later, set `public` deliberately, and confirm the projection never returns an
unmarked `note`.

## C9 · Build the attachment upload flow

This one receives raw file bytes, not JSON, and it now serves **two direct callers** that the
proxy used to normalise into one:

- the public portal `UPLOAD` — a `PUT` of one attachment's raw bytes with a single-use
  `X-Upload-Ticket` header that the `SUBMISSION` flow issued (see the `UPLOAD` row in
  `document-portal/README.md`);
- the internal registry counter deposit `SCAN_INTAKE` — a `PUT` of raw bytes with
  `X-DGO-Filename`, `X-DGO-Size` and `X-DGO-Sha256` headers, driven by
  `core/scan-intake-service.js` (see `config/config.example.js`).

With the proxy gone, **nothing verifies the bytes before this flow runs.** The flow must
redeem the ticket exactly once, recover the reference, filename, declared size and SHA-256 it
stands for, compute the SHA-256 of what actually arrived, and refuse anything oversize or
mismatched. The steps below build the storage skeleton only; the ticket redemption and byte
verification are yours to add, to the contract in `document-portal/README.md`.

**C9.1** Create → **Instant cloud flow** → name it exactly:

```
DGO Intake Upload
```

**C9.2** Trigger: **When an HTTP request is received**. Click **Create**.

**C9.3** Expand the trigger. **Leave the schema box empty.** Do not click "Use sample payload
to generate schema". The body is binary, and a JSON schema would corrupt every non-text file.

**C9.4** Set **Method** to `PUT`. Both callers use `PUT`; the browser's `fetch` in
`document-portal/js/core.js` sends the bytes with `PUT` and `Content-Type: application/octet-stream`.

**C9.5** Click **Show advanced options**. If a **Content-Type** field appears, set it to:

```
application/octet-stream
```

**C9.6** Click **+ New step**. Search `Create file`. Choose **SharePoint** → **Create file**.

**C9.7** Set **Site Address** to V6.

**C9.8** Set **Folder Path** to your correspondence attachment library, the one you
confirmed in B4.1. For example:

```
/Shared Documents/Correspondence
```

**C9.9** In **File Name**, click **Expression**. The name must combine the registry reference
with the original filename so two citizens who both send `letter.pdf` do not overwrite each
other. For the registry counter path that is:

```
concat(triggerOutputs()['headers']?['X-DGO-Reference'], '_', decodeUriComponent(triggerOutputs()['headers']?['X-DGO-Filename']))
```

For the public path the reference and filename come from the redeemed `X-Upload-Ticket`, not
from a header — substitute the values you recover when you redeem it. Decode any name that was
percent-encoded in transit before you store it.

**C9.10** In **File Content**, click **Expression** and paste exactly:

```
triggerBody()
```

**C9.11** Click **+ New step**. Search `Update file properties`. Choose **SharePoint** →
**Update file properties**.

**C9.12** Set **Site Address** to V6. Set **Library Name** to the same library as C9.8.

**C9.13** Set **Id** to the dynamic content **ItemId** from the Create file step.

**C9.14** Set `ReferenceId` to the reference you recovered — from the redeemed ticket on the
public path, or from the registry counter deposit on the scan path.

**C9.15** Set `Sha256` to the digest you computed and verified against what the caller
declared. Storing the digest lets you prove later that the stored file is byte-for-byte what
the citizen sent.

**C9.16** Click **+ New step**. Search `Response`. Choose **Request** → **Response**.

**C9.17** Set **Status Code** to `200`. In **Body**, paste exactly:

```json
{
  "stored": true,
  "attachmentLink": "@{body('Create_file')?['{Link}']}"
}
```

The portal reads `attachmentLink` (and `stored`) from your response, per the `UPLOAD` row in
`document-portal/README.md`; the registry counter path reads the same `attachmentLink`. If you
return neither, the file is stored but nothing links to it from the register.

**C9.18** Click **Save**. Expand the trigger, copy the **HTTP POST URL**, and record it under
**both** of these names in `deployment-values.txt`:

```
DGO_ENDPOINT_INTAKE_UPLOAD
DGO_ENDPOINT_SCAN_UPLOAD
```

One library serves both the public channel and registry counter deposits. Set them to
different flows later only if counter deposits must be filed separately.

**Headers this flow receives:**

| Caller | Header | Contents |
|---|---|---|
| Public portal | `X-Upload-Ticket` | The single-use ticket the `SUBMISSION` flow issued; redeem once |
| Registry counter | `X-DGO-Filename` | The filename, percent-encoded |
| Registry counter | `X-DGO-Size` | Declared byte length, to check against what arrived |
| Registry counter | `X-DGO-Sha256` | SHA-256 the caller declared, 64 lowercase hex characters |

Nothing has verified that the bytes match the declared SHA-256 and size before this flow
runs. The proxy used to; it is gone. Hash the received bytes here and refuse any mismatch, or
you will file whatever anyone chooses to send.

## C10 · Build the email verification flows

The portal verifies an email address in two calls, and the proxy used to sit between them:
it generated the one-time code, held it, rate-limited the requests and checked the answer.
That logic is gone. You now need **two** flows — one to issue a code (`VERIFY`) and one to
check it (`VERIFY_CONFIRM`) — and the code generation, storage, expiry, single-use semantics
and rate limiting all have to live inside them. Build them to the `VERIFY` and `VERIFY_CONFIRM`
rows of the contract in `document-portal/README.md`.

**C10.1** Create → **Instant cloud flow** → name it exactly:

```
DGO Intake Verify Email
```

**C10.2** Trigger: **When an HTTP request is received**. Click **Create**.

**C10.3** Expand the trigger, click **Use sample payload to generate schema**, paste exactly,
click **Done**. The browser sends only the address; it does **not** send the code, because the
flow is what invents it now:

```json
{
  "email": "citizen@example.org"
}
```

**C10.4** Set **Method** to `POST`.

**C10.5** Generate a one-time code and an expiry inside the flow — the browser no longer
supplies them. Add a **Compose** (or your preferred store) that produces a six-digit code and
a short-lived `expiresAt`, and persist the pair against the address (a SharePoint list keyed by
email, or Dataverse) so the confirm flow in C10.11 can read it back. Rate-limit here: refuse to
mint more than a few codes per address and per source in a window, or the flow becomes a free
mail relay for anyone who knows the URL.

**C10.6** Click **+ New step**. Search `Send an email`. Choose **Office 365 Outlook** →
**Send an email (V2)**.

**C10.7** Set **To** to the dynamic content `email`.

**C10.8** Set **Subject** to exactly:

```
Your NITDA correspondence verification code
```

**C10.9** Click **</>** (Code view) in the Body toolbar, then paste exactly, substituting the
code and expiry you generated in C10.5:

```html
<p>Your verification code is <strong>@{outputs('Compose_code')}</strong></p>
<p>Enter this code on the NITDA document portal to complete your submission. The code expires at @{outputs('Compose_expiresAt')}.</p>
<p>If you did not request this code, ignore this message. No submission has been made.</p>
<p>Directorate of Digital Operations<br>National Information Technology Development Agency</p>
```

**C10.10** Click **+ New step**. Search `Response`. Choose **Request** → **Response**. Set
**Status Code** to `200`. In **Body**, return whether the mail was sent and when the code
expires — the portal shows the countdown from `expiresAt`:

```json
{
  "sent": true,
  "expiresAt": "@{outputs('Compose_expiresAt')}"
}
```

Click **Save**. Expand the trigger, copy the **HTTP POST URL**, record it as
`DGO_ENDPOINT_INTAKE_VERIFY_EMAIL`.

**C10.11** Now build the companion **confirm** flow. Create → **Instant cloud flow** → name it
exactly `DGO Intake Verify Confirm`. Trigger **When an HTTP request is received**, method
`POST`, with this sample payload:

```json
{
  "email": "citizen@example.org",
  "code": "000000"
}
```

Read back the code you stored in C10.5, compare it in constant time as a **single-use** value —
delete or mark it spent on first use so a code cannot be replayed — honour the expiry, and
return the verification proof that the `SUBMISSION` flow will later accept:

```json
{
  "verification": "@{outputs('Compose_proof')}",
  "expiresAt": "@{outputs('Compose_expiresAt')}"
}
```

Click **Save**, copy the **HTTP POST URL**, and record it as
`DGO_ENDPOINT_INTAKE_VERIFY_CONFIRM`. This value has no row in the recorded set the proxy left
behind — the proxy performed the check itself — so it is a genuine gap you are filling now.
Note it in your value register (Part E) so nobody assumes the portal's `VERIFY_CONFIRM`
endpoint can be left blank.

## C11 · Build the support case flow

**C11.1** Create → **Instant cloud flow** → name it exactly:

```
DGO Intake Support
```

**C11.2** Trigger: **When an HTTP request is received**. Click **Create**.

**C11.3** Expand the trigger, click **Use sample payload to generate schema**, paste exactly,
click **Done**:

```json
{
  "name": "A Citizen",
  "email": "citizen@example.org",
  "topic": "Tracking a submission",
  "message": "I cannot find my reference.",
  "aboutReference": "NITDA-2026-000001",
  "caseRef": "CASE-2026-000001",
  "receivedAt": "2026-08-04T09:15:22.431Z",
  "source": "document-portal"
}
```

**C11.4** Set **Method** to `POST`.

**C11.5** Click **+ New step**. Search `Create item`. Choose **SharePoint** → **Create item**.
Set **Site Address** to V6, **List Name** to `SupportCases`.

Unlike the correspondence flows, this list genuinely is new. A support case is a question
about the platform, not a piece of correspondence, and putting the two in one list would mean
help-desk queries appearing in the register as though somebody had written to the agency.
Create it with a `CaseRef` (unique), `Name`, `Email`, `Topic`, `Message`, `AboutReference` and
`ReceivedAt` column — or skip this flow entirely, since the help desk is optional.

**C11.6** Fill the fields with the matching dynamic content:

| Field | Dynamic content |
|---|---|
| `Title` | `caseRef` |
| `CaseRef` | `caseRef` |
| `Name` | `name` |
| `Email` | `email` |
| `Topic` | `topic` |
| `Message` | `message` |
| `AboutReference` | `aboutReference` |
| `ReceivedAt` | `receivedAt` |

**C11.7** Click **+ New step**. Search `Response`. Choose **Request** → **Response**. Set
**Status Code** to `200`, **Body** to exactly:

```json
{
  "ok": true
}
```

**C11.8** Click **Save**. Expand the trigger, copy the **HTTP POST URL**, record it as
`DGO_ENDPOINT_INTAKE_SUPPORT`.

## C12 · Check your list of URLs

**C12.1** Open `deployment-values.txt`. Count the recorded URLs. You must have exactly 24
entries under these names:

```
DGO_ENDPOINT_FETCH_ALL
DGO_ENDPOINT_FETCH_ACTIVITIES
DGO_ENDPOINT_SUBSIDIARY_ACTIONS
DGO_ENDPOINT_REFERENCE_DATA
DGO_ENDPOINT_GET_DOCS
DGO_ENDPOINT_FETCH_EMAIL_ATTACHMENTS
DGO_ENDPOINT_SINGLE_ASSIGNMENT
DGO_ENDPOINT_BULK_ASSIGNMENT
DGO_ENDPOINT_BULK_ASSIGNMENT_DIRECT
DGO_ENDPOINT_DYNAMIC_ACTIONS
DGO_ENDPOINT_EMAIL
DGO_ENDPOINT_EMAIL_RELATED_TASK
DGO_ENDPOINT_AI_EMAIL_ANALYSIS
DGO_ENDPOINT_AI_DOC_ANALYSIS
DGO_ENDPOINT_AI_CHAT
DGO_ENDPOINT_OTP_GENERATE
DGO_ENDPOINT_OTP_VERIFY
DGO_ENDPOINT_INTAKE_SUBMISSION
DGO_ENDPOINT_INTAKE_UPLOAD
DGO_ENDPOINT_INTAKE_STATUS
DGO_ENDPOINT_INTAKE_SUPPORT
DGO_ENDPOINT_INTAKE_VERIFY_EMAIL
DGO_ENDPOINT_INTAKE_VERIFY_CONFIRM
DGO_ENDPOINT_SCAN_UPLOAD
```

`DGO_ENDPOINT_INTAKE_VERIFY_CONFIRM` is the one the proxy used to cover itself (C10.11); it now
needs a real flow and a recorded URL like the rest.

**C12.2** If any is missing, go back and complete that flow before continuing.

**C12.3** Two endpoint names are deliberately absent: `DGO_ENDPOINT_DISPATCH_OUTBOUND` and
`DGO_ENDPOINT_ARCHIVE_REFERENCE`. No flow exists for them and the platform is built to work
without them. Do not create them for the pilot.

---
---

# PART D — Cloudflare Access

## D1 · Open Zero Trust

**D1.1** Open https://dash.cloudflare.com and sign in.

**D1.2** In the left sidebar click **Zero Trust**.

**D1.3** If this is your first time, you are asked to choose a team name. Enter:

```
nitda-dgo
```

Choose the **Free** Zero Trust plan (up to 50 users) unless you need more seats. Complete the
setup.

**D1.4** In the left sidebar click **Settings**, then **Custom Pages**. Near the top the page
shows your team domain in the form `something.cloudflareaccess.com`. Copy it. Record it in
`deployment-values.txt` as **V2**.

## D2 · Connect your identity provider

**D2.1** In the left sidebar click **Settings**, then **Authentication**.

**D2.2** Under **Login methods**, click **Add new**.

**D2.3** Choose your organisation's provider. For Microsoft 365, click **Azure AD**.

**D2.4** Fill in the fields your provider requires and click **Save**.

**D2.5** Click **Edit** on the login method you just created.

**D2.6** Find the setting **Add groups to the JWT** — for Azure AD it may be labelled
**Support groups**. Turn it **on**. Click **Save**.

This step is not optional. Without it the assertion carries no group membership, every
officer resolves to `viewer`, and nobody can approve or dispatch anything.

**D2.7** Click **Test** on the login method. Sign in when prompted. The result page must show
your email address and a list of your groups. If the groups list is empty, D2.6 did not take
effect — repeat it.

## D3 · Create the six Access groups

The platform has exactly six roles. Create one Access group per role.

**D3.1** In the left sidebar click **Access**, then **Groups**.

**D3.2** Click **Add a group**.

**D3.3** In **Group name**, type exactly:

```
DGO-SystemAdmin
```

**D3.4** Under **Create additional rules** → **Include**, set the selector to **Emails** and
enter the email addresses of the officers who should hold this role, one per line.

**D3.5** Click **Save**.

**D3.6** Repeat D3.2 to D3.5 five more times, with these names typed exactly:

| Group name | Give this to |
|---|---|
| `DGO-UserAdmin` | Officers who create accounts and assign roles |
| `DGO-Executive` | The DG's office — briefs, meetings, projects, executive approvals |
| `DGO-Director` | Directors who approve, reject, dispatch, close and archive |
| `DGO-Operator` | Registry staff who log, triage, assign and treat correspondence |
| `DGO-Viewer` | Anyone who should read but change nothing |

**D3.7** Every pilot user must be in exactly one group. A user in no group cannot sign in. A
user in two groups gets whichever the platform maps first, which is not predictable — check
your six group memberships for anyone listed twice.

## D4 · Create the platform Access application

**D4.1** In the left sidebar click **Access**, then **Applications**.

**D4.2** Click **Add an application**.

**D4.3** Click **Self-hosted**.

**D4.4** In **Application name**, type exactly:

```
NITDA DGO Platform
```

**D4.5** Set **Session Duration** to **8 hours**.

**D4.6** Under **Application domain**, you need the hostname the front end will run on. You
do not have it yet — it is created in Part F. For now enter:

```
nitda-dgo-platform.pages.dev
```

You will correct this in F4 if the actual hostname differs.

**D4.7** Click **Next**.

**D4.8** On the policy screen, in **Policy name** type exactly:

```
DGO pilot access
```

**D4.9** Set **Action** to **Allow**.

**D4.10** Under **Configure rules** → **Include**, set the selector to **Access groups** and
select all six groups you created in D3.

**D4.11** Click **Next**, then click **Add application**.

**D4.12** The application page opens. Click the **Overview** tab.

**D4.13** Find **Application Audience (AUD) Tag**. It is 64 hexadecimal characters. Click the
copy icon. Record it in `deployment-values.txt` as **V3**.

---
---

# PART E — Configure the flow endpoints

There is no Worker to deploy, no secrets to set with `wrangler secret put`, and no Durable
Object to bind. The flow trigger URLs you recorded in Part C are handed to the two front ends
at deploy time, in two git-ignored files. The browser then calls each flow directly.

**Read this before you write either file.** These files are JavaScript that a browser
downloads. Every URL you paste into them is delivered, in full, to every visitor who loads the
page — signature and all. A signed Power Automate URL is a bearer credential, so you are
publishing bearer credentials on purpose. That is only safe because each flow you built in
Part C authenticates, authorises, validates, rate-limits and reference-mints **for itself**.
There is nothing else left to do it. Configure a URL here only for a flow that is safe when an
anonymous stranger invokes it, and rotate these URLs on a schedule (I2).

## E1 · Write the platform configuration

**E1.1** In the repository, create a new file at exactly this path:

```
config/config.local.js
```

**E1.2** Paste this skeleton into it. Each value is a placeholder naming the URL you recorded
under that exact name in Part C — replace every right-hand string with the matching URL from
`deployment-values.txt`:

```javascript
window.DGO_CONFIG = {
  endpoints: {
    FETCH_ALL:               "DGO_ENDPOINT_FETCH_ALL",
    FETCH_ACTIVITIES:        "DGO_ENDPOINT_FETCH_ACTIVITIES",
    SUBSIDIARY_ACTIONS:      "DGO_ENDPOINT_SUBSIDIARY_ACTIONS",
    REFERENCE_DATA:          "DGO_ENDPOINT_REFERENCE_DATA",
    GET_DOCS:                "DGO_ENDPOINT_GET_DOCS",
    FETCH_EMAIL_ATTACHMENTS: "DGO_ENDPOINT_FETCH_EMAIL_ATTACHMENTS",
    SINGLE_ASSIGNMENT:       "DGO_ENDPOINT_SINGLE_ASSIGNMENT",
    BULK_ASSIGNMENT:         "DGO_ENDPOINT_BULK_ASSIGNMENT",
    BULK_ASSIGNMENT_DIRECT:  "DGO_ENDPOINT_BULK_ASSIGNMENT_DIRECT",
    DYNAMIC_ACTIONS:         "DGO_ENDPOINT_DYNAMIC_ACTIONS",
    EMAIL:                   "DGO_ENDPOINT_EMAIL",
    EMAIL_RELATED_TASK:      "DGO_ENDPOINT_EMAIL_RELATED_TASK",
    AI_EMAIL_ANALYSIS:       "DGO_ENDPOINT_AI_EMAIL_ANALYSIS",
    AI_DOC_ANALYSIS:         "DGO_ENDPOINT_AI_DOC_ANALYSIS",
    AI_CHAT:                 "DGO_ENDPOINT_AI_CHAT",
    OTP_GENERATE:            "DGO_ENDPOINT_OTP_GENERATE",
    OTP_VERIFY:              "DGO_ENDPOINT_OTP_VERIFY",
    SCAN_INTAKE:             "DGO_ENDPOINT_SCAN_UPLOAD",
  },
};
```

**E1.3** Two things in that list are easy to get wrong:

- `SCAN_INTAKE` takes the URL you recorded as **`DGO_ENDPOINT_SCAN_UPLOAD`**. The names differ
  because one upload flow serves both the public channel and the registry counter (C9.18); the
  platform reads the key `SCAN_INTAKE`, so that is the key here.
- Do **not** add `DISPATCH_OUTBOUND` or `ARCHIVE_REFERENCE`. No flow serves them (C12.3), and
  the platform is built to run without them. Leaving a key out is the supported way to mark an
  endpoint unconfigured; the feature it serves reports itself unconfigured rather than failing.

The full key list, and the request/response shape of each flow, is in
`config/config.example.js` and `config/endpoints.config.js` (`EndpointUrls`). Keep the two in
step: a key the platform expects but you omit here is a feature quietly switched off.

**E1.4** Save the file. The pilot runs with authentication **inert** — the platform does not
mint or attach a token, and there is no proxy to verify one, so identity and role are
client-asserted and advisory, and the only thing actually stopping an anonymous person from
loading the internal interface is Cloudflare Access in front of the Pages site (Part D and F).
Do not read more into it than that. Turning real authentication on is out of scope for this
walkthrough: it needs a registered token provider wired into `core/auth.js`, which this
document does not set up. `docs/architecture/AUTHENTICATION_CONTRACT.md` is the authority on that posture; follow
it before you rely on any role for anything but presentation.

## E2 · Write the portal configuration

**E2.1** Create a new file at exactly this path — beside `index.html`, not inside `js/`:

```
document-portal/config.local.js
```

**E2.2** Paste this skeleton, then replace each right-hand string with the matching URL from
`deployment-values.txt`:

```javascript
window.PF_CONFIG = {
  endpoints: {
    SUBMISSION:     "DGO_ENDPOINT_INTAKE_SUBMISSION",
    UPLOAD:         "DGO_ENDPOINT_INTAKE_UPLOAD",
    SUPPORT:        "DGO_ENDPOINT_INTAKE_SUPPORT",
    VERIFY:         "DGO_ENDPOINT_INTAKE_VERIFY_EMAIL",
    VERIFY_CONFIRM: "DGO_ENDPOINT_INTAKE_VERIFY_CONFIRM",
    STATUS:         "DGO_ENDPOINT_INTAKE_STATUS",
  }
};
```

**E2.3** Two notes on the portal keys:

- `VERIFY_CONFIRM` is the confirm flow you built in **C10.11**. It has no place in the old
  recorded set because the proxy performed the check itself; if you leave it blank the wizard
  can request a code but can never redeem it, and no verified submission will ever complete.
- Leaving **`SUBMISSION`** blank keeps the whole portal in **demo mode** — everything stays in
  the browser and nothing is transmitted. That is the safe failure for a public channel, so an
  incomplete portal config fails closed rather than leaking. The request/response contract each
  of these flows must satisfy is in `document-portal/README.md`; do not point a key at a flow
  that has not met it.

**E2.4** Save the file.

## E3 · Confirm nothing secret is committed

**E3.1** Both files are already listed in `.gitignore`. Confirm neither is tracked:

```bash
git status --short config/config.local.js document-portal/config.local.js
```

It must print nothing. If it prints either filename, stop — do not commit it. A signed flow URL
in Git history is a leaked credential that survives deleting the file, and you would have to
rotate every URL it contained.

**E3.2** There are no Worker secrets to list or verify. The only place a flow URL now lives is
these two git-ignored files and your out-of-band `deployment-values.txt`. That is the whole of
the endpoint configuration; the security of the system rests entirely on the flows themselves
and on Access gating who can load the internal page.

---
---

# PART F — Deploy the front end

Both config files from Part E must already exist on disk before you deploy — `wrangler pages
deploy .` uploads the working directory as-is, so `config/config.local.js` and
`document-portal/config.local.js` are published as part of the site. If either is missing the
deploy still succeeds, but the platform loads with no endpoints and the portal falls back to
demo mode. There is no Worker to deploy in this part any more; the front end is the only thing
that ships.

## F1 · Deploy

**F1.1** From the repository root, create the Pages project:

```bash
npx wrangler pages project create nitda-dgo-platform --production-branch main
```

**F1.2** Deploy:

```bash
npx wrangler pages deploy . --project-name nitda-dgo-platform
```

**F1.3** The output ends with the deployed URL. Copy it. Record it in
`deployment-values.txt` as **V7**.

**F1.4** This is a public URL. Access does not protect it yet — you attached the Access policy
to the hostname `nitda-dgo-platform.pages.dev` in D4.6, and if your deployed hostname differs,
the internal interface is reachable without sign-in until you correct it in F2. Do that now,
before you tell anyone the address.

## F2 · Correct the Access application domain

**F2.1** If V7 differs from `nitda-dgo-platform.pages.dev`, go to the Cloudflare dashboard →
**Zero Trust** → **Access** → **Applications**.

**F2.2** Click **NITDA DGO Platform** — the application you created in D4.

**F2.3** Click **Configure**, then **Application**.

**F2.4** Change **Application domain** to V7 without the `https://`.

**F2.5** Click **Save application**. Confirm by opening V7 in a private window: you must be sent
to your identity provider before the interface loads. If the page loads without a sign-in
prompt, the domain does not match and Access is gating nothing — recheck V7.

Remember what this does and does not achieve. Access decides **who may load the internal
page**. It does not stand between the loaded page and the flows: once the interface is in an
officer's browser it calls each Power Automate flow directly, carrying no proof of who the
officer is beyond what the page asserts about itself. Every guarantee about who may *do* a
thing, as opposed to *see the page*, lives in the flows.

---
---

# PART G — Verify before anyone uses it

Run all eight checks. Every one must give the stated result.

## G1 · The public channel accepts a submission

**G1.1** Run this, replacing `SUBMISSION_URL` with the URL you recorded as
`DGO_ENDPOINT_INTAKE_SUBMISSION`:

```bash
curl -s -X POST SUBMISSION_URL \
  -H 'Content-Type: application/json' \
  -d '{"subject":"Deployment verification one","category":"General Correspondence","senderEmail":"registry@nitda.gov.ng","sender":{"name":"Registry"},"description":"First verification submission."}'
```

**G1.2** One of two responses is correct, and both prove the flow is reachable:

- If your `SUBMISSION` flow does not require a verified email, the body contains
  `"referenceId":"NITDA-2026-` followed by six digits, and an `"uploads"` array.
- If it does require verification, the body is HTTP `403` with `{"error":"verification_required"}`.
  That is the flow working as intended — a raw `curl` has not verified an address. Test the
  happy path through the portal instead, or supply a proof from C10.11.

**G1.3** If neither appears — a timeout, a 404, or `502` — the flow is not reachable. Check that
the URL you pasted is the one you recorded for `DGO_ENDPOINT_INTAKE_SUBMISSION`, that
`config/config.local.js` was published with the site (F1.2), and that the flow is turned on.

## G2 · The reference sequence does not restart

**G2.1** Run the same command from G1.1 three more times, changing `verification one` to
`two`, `three`, `four`. If your flow requires verification and returns 403, exercise this
check through the portal with a verified address instead.

**G2.2** Write down all four references. They must be four different, consecutive numbers.

**G2.3** If any number repeats, stop. Your `SUBMISSION` flow is restarting the sequence — the
single most damaging fault it can have, because two citizens then hold a receipt for one
reference. Return to C7.9a and fix the minting so it is monotonic within the year and never
resets. Nothing else in the platform can compensate for this; only the flow mints the number.

## G3 · The record reached SharePoint

**G3.1** Open the `Correspondence` list in SharePoint.

**G3.2** Confirm four new items exist, one per submission, each with the reference from G2.2
in the `ReferenceId` column and `Received` in `Status`.

## G4 · Status read-back works

**G4.1** Run, replacing `STATUS_URL` with the URL you recorded as
`DGO_ENDPOINT_INTAKE_STATUS`, and `NITDA-2026-000001` with the first reference from G2.2:

```bash
curl -s -X POST STATUS_URL \
  -H 'Content-Type: application/json' \
  -d '{"referenceId":"NITDA-2026-000001","email":"registry@nitda.gov.ng"}'
```

**G4.2** The response must contain the subject and `"status":"Received"`.

**G4.3** Now run the same command with a wrong email:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST STATUS_URL \
  -H 'Content-Type: application/json' \
  -d '{"referenceId":"NITDA-2026-000001","email":"someone.else@example.org"}'
```

**G4.4** This must return `404`, and the body must be byte-for-byte the `404` an unknown
reference returns (C8.15) — no subject, no hint that the reference exists. If it returns the
record, the filter query in C8.7 is wrong; fix it before going further, because it means
anyone who guesses a reference can read somebody's correspondence. There is no proxy to catch
this now — the flow is the only guard.

## G5 · Decide what the authenticated flows do for an anonymous caller

This check used to confirm the Worker refused an unauthenticated request. There is no Worker.
An officer flow such as `FETCH_ALL` is now a public URL invoked directly by the browser, so
what happens here depends entirely on what you built into the flow.

**G5.1** Run, replacing `FETCH_ALL_URL` with the URL you recorded as `DGO_ENDPOINT_FETCH_ALL`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST FETCH_ALL_URL \
  -H 'Content-Type: application/json' -d '{}'
```

**G5.2** Understand the result honestly:

- If the flow is built to require and verify a token, an anonymous `curl` must come back `401`
  or `403`. That is the posture `docs/architecture/AUTHENTICATION_CONTRACT.md` describes for a hardened
  deployment.
- In the pilot, authentication is **inert** (E1.4). This flow will very likely answer `200`
  and return the register to an anonymous caller, because nothing is checking who is asking.
  That is a known, accepted limitation of the pilot, not a misconfiguration — but you must
  record it as accepted risk (Part I) and keep the URL out of public reach. It is only
  shielded at all because it is not advertised and the interface that calls it sits behind
  Access; the URL itself is not.

Do not tell yourself this is refused when it is not. If a `200` here is unacceptable for your
data, you cannot go live on the inert posture — build token verification into the flow first.

## G6 · A forged identity is only refused if the flow checks it

The old check sent a forged `Cf-Access-Jwt-Assertion` header and expected the proxy to reject
it. Nothing now inspects that header: the browser talks to the flow directly, and any header
or `userEmail` in the request body is whatever the caller chose to send.

**G6.1** Run:

```bash
curl -s -X POST FETCH_ALL_URL \
  -H 'Content-Type: application/json' \
  -d '{"action":"list","userEmail":"director@nitda.gov.ng"}'
```

**G6.2** Whatever comes back, take the lesson, not a pass/fail: a `userEmail` in the body is an
unauthenticated assertion. If your flow trusts it to decide what to return, anyone can name any
officer and be treated as them. Every authenticated flow must derive identity from a token it
verifies itself, never from a field in the request, before it is allowed to make an
authorisation decision. Until it does, treat the identity on every call as attacker-controlled.

## G7 · Officers can load the interface; their role is advisory in the pilot

**G7.1** Ask one officer from each of the six groups to open V7 in a browser.

**G7.2** Each is redirected to a Cloudflare sign-in page. They sign in. This is Access doing
the one thing it does here: deciding who may load the page.

**G7.3** Each then navigates to the diagnostics workspace by adding `#/diagnostics` to the
URL.

**G7.4** Each sees an email address and a role. In the inert pilot posture this role is
**advisory** — it comes from the profile the interface holds, not from a token the platform
verified against the Access groups claim, because no token provider is wired up (E1.4). Use it
to confirm the interface loads and renders per role, not as proof that privilege is enforced.

**G7.5** If you need role to actually gate what an officer can do — not merely what they see —
that is the enforced posture in `docs/architecture/AUTHENTICATION_CONTRACT.md`: every officer flow must verify a
token and read the role from its claims, and you must wire a token provider into the front end.
Neither is done by this walkthrough. Do not launch to a wider audience assuming the role shown
here restricts anything server-side.

## G8 · The register is shared, not per-browser

**G8.1** Have one officer register a correspondence in the platform.

**G8.2** Have a second officer, on a different computer, open `#/lookup` and search for it.

**G8.3** They must find it. If they cannot, `FETCH_ALL` is not reaching its flow and each
officer is working on a private copy in their own browser. Confirm `FETCH_ALL` is set in
`config/config.local.js` (E1.2) and that the deployed site includes that file.

---
---

# PART H — Confirm the routing

Do this before real correspondence arrives. The current mapping was written as a starting
point and has never been approved.

**H1** Open `config/correspondence-categories.config.js` in the repository.

**H2** Read this table. It decides which desk each kind of correspondence lands on:

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
`Correspondence` list (B2.6) to match exactly.

---
---

# PART I — Go live, and what to do if something breaks

## I1 · Before letting the public in

**I1.1** Confirm all eight checks in Part G passed.

**I1.2** Delete the four test records created in G1 and G2 from the `Correspondence` list.

**I1.3** Delete `deployment-values.txt`. It holds V5 — the 24 signed flow URLs — and each of
those is a bearer credential.

**I1.4** Tell your pilot officers the platform URL (V7) and that they sign in with their
normal work account.

## I2 · The flow URLs are public — treat them so

There is no per-instance ticket or rate-counter caveat any more, because there is no Worker to
run instances. What replaces it is more important, and it is a property of the new design
rather than a temporary limit.

**I2.1 Every signed flow URL is published to the public.** The two files you wrote in Part E
are downloaded, in full, by every browser that loads either site — and the portal is open to
anyone. A signed Power Automate URL is a bearer credential, so you are handing those
credentials to every visitor by design. Anyone who opens the page can read them out of the
downloaded JavaScript and call the flow themselves, from anywhere, with no involvement from
your front end.

**I2.2 So each flow must be safe when a stranger calls it.** Assume every URL is known to a
hostile caller from the moment you deploy. The flow, and only the flow, can defend itself:
validate its own input, rate-limit its own callers by source, authorise the action, mint the
reference, redeem the ticket once and verify the bytes. Cloudflare cannot help here — the
flows live on the Power Platform domain, not behind your Pages site, so Access and the
Cloudflare WAF never see a flow call. A rate limit you want enforced has to be built into the
flow itself.

**I2.3 Rotate the URLs on a schedule.** Because they are public, treat them like any exposed
credential and regenerate them regularly, and immediately if you suspect one has been abused.
For each flow: regenerate its SAS signature in Power Automate (which invalidates the old URL),
paste the new URL into the matching key in `config/config.local.js` or
`document-portal/config.local.js`, and redeploy the site (Part F). Old URLs stop working the
moment they are regenerated, so rotate the config and redeploy in the same maintenance window
to avoid a gap.

## I3 · Rolling back

There is no Worker to roll back. A rollback now means reverting the deployed site and, if a
credential is implicated, rotating the flow signatures.

**I3.1** Roll the Pages deployment back to the last good one. In the Cloudflare dashboard, open
**Workers & Pages** → your Pages project → **Deployments**, find the previous known-good
deployment, and choose **Rollback**. Or redeploy a known-good working tree from your machine:

```bash
npx wrangler pages deploy . --project-name nitda-dgo-platform
```

**I3.2** If you are rolling back because a flow URL leaked or a flow misbehaved, rolling the
site back is not enough — the old URL is still live. Regenerate that flow's SAS signature in
Power Automate, update the matching key in the relevant `config.local.js`, and redeploy
(I2.3). Rotating the signature is what actually revokes the exposed URL.

**I3.3** The reference sequence lives in your `SUBMISSION` flow and the SharePoint list, not in
anything you roll back or redeploy, and it must never be reset manually — reissuing a number
already printed on a citizen's receipt is precisely the failure this design prevents.

## I4 · Closing the public channel without taking the platform down

**I4.1** Blank the `SUBMISSION` endpoint in `document-portal/config.local.js` so the portal
falls back to demo mode, then redeploy:

```javascript
window.PF_CONFIG = {
  endpoints: {
    SUBMISSION:     "",
    UPLOAD:         "DGO_ENDPOINT_INTAKE_UPLOAD",
    SUPPORT:        "DGO_ENDPOINT_INTAKE_SUPPORT",
    VERIFY:         "DGO_ENDPOINT_INTAKE_VERIFY_EMAIL",
    VERIFY_CONFIRM: "DGO_ENDPOINT_INTAKE_VERIFY_CONFIRM",
    STATUS:         "DGO_ENDPOINT_INTAKE_STATUS",
  }
};
```

**I4.2** With `SUBMISSION` blank the portal keeps every submission local and transmits nothing
— the safe, fail-closed state for a public channel. Citizens can still complete the form; their
drafts wait in the browser until you reopen the channel. Redeploy with F1.2 for the change to
take effect.

**I4.3** A firmer closure is to regenerate the `SUBMISSION` flow's SAS signature in Power
Automate without updating the config. The published URL then stops working immediately, for
your portal and for anyone who scraped it alike. Reopen by pasting the new signed URL back into
`SUBMISSION` and redeploying. Prefer this if you are closing the channel because the URL was
being abused, not merely for maintenance.

## I5 · Reading the logs

There is no `wrangler tail` and no single event stream any more. Observability is now spread
across the places the calls actually land, and you should know each one.

**I5.1 Per-flow run history.** In the Power Automate portal, open each flow and read its **run
history**: every invocation, its inputs, its outputs and whether it succeeded. This is where
you see a rejected submission, a rate-limited caller or a failed upload — but only per flow,
one flow at a time. There is no longer a proxy log that stitches them into one request story,
so correlate by the reference and by timestamp.

**I5.2 Access logs.** In the Cloudflare dashboard, **Zero Trust** → **Logs** → **Access** shows
who loaded the internal interface and when. That is the limit of what Cloudflare can tell you
now: it sees the page load, not the flow calls the page makes afterwards.

**I5.3 The front-end audit trail.** The platform and portal both keep their own audit entries
for what a user did in the browser, including submissions queued when a flow was unreachable.
Treat these as a per-device record, not an authoritative server log.

**I5.4** No log line anywhere should contain a file's contents, a correspondence description, a
verification code or a token. If a flow's run history is capturing one of these in its inputs
or outputs, treat it as a defect: tighten the flow so it does not echo secrets, and scrub the
captured runs.
