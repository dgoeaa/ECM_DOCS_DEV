# SharePoint and Power Automate — the flow build walkthrough

Click-by-click steps for the two things this platform actually depends on: your SharePoint
site and your Power Automate environment. Hosting the front end and gating who may load it
are handled outside this repository — not covered here.

Follow this from top to bottom. Every step is numbered. Do not skip a step or change its
order; several steps fail in confusing ways if an earlier one was not done.

**How this platform reaches its backend — read this first.** The browser calls each Power
Automate flow **directly**. There is no proxy, Worker or broker in the request path: nothing
to deploy, secret-set, run or keep alive between the page and the flows. The flow trigger
URLs are configured client-side at deploy time and are therefore delivered to every
browser that loads the page. Whatever gates who is allowed to load the page, that gate has
no server of its own once the page is open. It follows that **each flow is
the only place authentication, authorisation, rate limiting, reference minting, upload
ticketing, filename-policy normalisation and validation can actually be enforced.** A flow
that trusts its caller trusts the whole internet. Everything in Part C depends on this
sentence; do not build a flow until you have taken it in.

**Time required:** Part B 1 hour · Part C 3–4 hours.

**What you need before starting:** an account with permission to create and delete flows in
your Power Platform environment, an account with permission to create SharePoint lists and
libraries, and a terminal on a machine with Node.js.

**Recording your values.** The signed flow trigger URLs cannot be printed in this document.
Create a plain text file now called `deployment-values.txt`, somewhere
outside the repository, and record each value as you obtain it. You will need them again.
Delete the file when you finish: a signed Power Automate URL is a bearer credential —
anyone who reads it can invoke the flow.

```
V6 SharePoint site URL       =
Flow trigger URLs            = (24 of them, recorded in Part C)
```

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
anyone who has loaded the page or read the URL. Whatever gates who can load the
internal page cannot limit who can POST to a Power Automate URL. Rotate these signatures
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

