# NITDA DGO Platform — complete deployment walkthrough

Follow this from top to bottom. Every step is numbered. Do not skip a step or change its
order; several steps fail in confusing ways if an earlier one was not done.

**Time required:** Part A 30 minutes · Part B 1 hour · Part C 3–4 hours · Part D 45 minutes ·
Part E 45 minutes · Part F 20 minutes · Part G 30 minutes.

**What you need before starting:** an account with Cloudflare (Workers Paid plan — Durable
Objects are not on the free plan), an account with permission to create and delete flows in
your Power Platform environment, an account with permission to create SharePoint lists and
libraries, and a terminal on a machine with Node.js.

**Recording your values.** Nine values come from your own systems and cannot be printed in
this document. Create a plain text file now called `deployment-values.txt`, somewhere
outside the repository, and record each value as you obtain it. You will need them again.
Delete the file when you finish. It will contain V6 and V7, which are secrets.

```
V1 Cloudflare account ID     =
V2 Access team domain        =
V3 Access AUD tag            =
V4 Access group names        = DGO-SystemAdmin, DGO-UserAdmin, DGO-Executive, DGO-Director, DGO-Operator, DGO-Viewer
V5 Flow trigger URLs         = (23 of them, recorded in Part C)
V6 DGO_UPLOAD_SECRET         =
V7 DGO_VERIFY_SECRET         =
V8 SharePoint site URL       =
V9 Pages hostname            =
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

## A3 · Generate the two signing secrets

**A3.1** Run:

```bash
openssl rand -base64 48
```

**A3.2** Copy the whole line it prints. Paste it into `deployment-values.txt` as **V6**.

**A3.3** Run the same command a second time:

```bash
openssl rand -base64 48
```

**A3.4** Copy that line. Paste it as **V7**. It must be different from V6 — if you
accidentally pasted the same value twice, run the command again.

These two values sign upload tickets and email verification proofs. Anyone holding V6 can
forge a grant to write into your document library. Do not put them in email, chat or any
file inside the repository.

## A4 · Sign in to Cloudflare from the terminal

**A4.1** Run:

```bash
npx wrangler login
```

**A4.2** A browser window opens. Sign in to Cloudflare and click **Allow**.

**A4.3** Return to the terminal. Run:

```bash
npx wrangler whoami
```

**A4.4** Find the `Account ID` column in the table it prints. Copy the 32-character value.
Paste it into `deployment-values.txt` as **V1**.

## A5 · Confirm you are on the Workers Paid plan

**A5.1** Open https://dash.cloudflare.com in a browser and sign in.

**A5.2** In the left sidebar click **Compute (Workers)**.

**A5.3** Click **Plans** near the top of the page.

**A5.4** If it shows **Workers Free**, click **Upgrade to Paid** and complete the purchase.
Durable Objects — which the registry sequence requires — are not available on the free plan.
Without this, the deployment in Part E will fail.

---
---

# PART B — SharePoint

The flows you build in Part C write into these. Create them first or the flow steps will
have nothing to point at.

## B1 · Open or create the site

**B1.1** Open your SharePoint site in a browser. If you do not have one for this platform,
go to https://www.office.com, click **SharePoint**, click **Create site**, choose **Team
site**, name it `NITDA DGO Registry`, and finish the wizard.

**B1.2** Copy the site URL from the browser address bar — everything up to and including the
site name, for example the part ending in `/sites/NITDADGORegistry`. Paste it into
`deployment-values.txt` as **V8**.

## B2 · Create the Correspondence list

**B2.1** On the site home page, click **+ New** in the top bar, then click **List**.

**B2.2** Click **Blank list**.

**B2.3** In **Name**, type exactly:

```
Correspondence
```

**B2.4** Leave **Description** empty. Leave **Show in site navigation** ticked. Click
**Create**.

**B2.5** The new empty list opens. You now add columns. For each row in the table below,
click **+ Add column**, choose the type given, type the name exactly as written, then click
**Save**.

Type the names exactly. The flows reference them by these names and a different spelling
will silently write nothing.

| Column name | Type | Additional settings |
|---|---|---|
| `ReferenceId` | Single line of text | Under **More options**, set **Enforce unique values** to **Yes** |
| `Subject` | Multiple lines of text | Set **Number of lines for editing** to `3` |
| `Category` | Choice | Enter the 11 choices listed in B2.6 below, one per line |
| `CorrespondenceType` | Single line of text | none |
| `Channel` | Single line of text | none |
| `SenderName` | Single line of text | none |
| `SenderEmail` | Single line of text | none |
| `SenderOrganisation` | Single line of text | none |
| `SenderOrganisationType` | Single line of text | none |
| `SenderPhone` | Single line of text | none |
| `EventDate` | Single line of text | none |
| `Description` | Multiple lines of text | Set **Number of lines for editing** to `10` |
| `Status` | Choice | Enter the 6 choices listed in B2.7 below |
| `StatusLabel` | Single line of text | none |
| `ReceivedAt` | Single line of text | none |
| `AcknowledgedAt` | Single line of text | none |
| `UpdatedAt` | Single line of text | none |
| `ClosedAt` | Single line of text | none |
| `ActionRequired` | Yes/No | Set **Default value** to **No** |
| `AttachmentManifest` | Multiple lines of text | Set **Number of lines for editing** to `6` |
| `AttachmentLink` | Hyperlink | none |
| `DeclaredBytes` | Number | none |
| `CorrelationId` | Single line of text | none |
| `Timeline` | Multiple lines of text | Set **Number of lines for editing** to `10` |

The date fields are **Single line of text**, not Date and Time, on purpose. The platform
sends and reads ISO 8601 strings such as `2026-08-04T09:15:22.431Z`. A SharePoint date column
converts these to a local-time serial value and the exact instant is lost.

**B2.6** The 11 choices for `Category`, one per line, exactly:

```
Official Correspondence
Ministerial Directive
Application
Proposal
Project Proposal
Report
Compliance Filing
Policy Submission
Event Invitation
Meeting Request
General Correspondence
```

Untick **Can add values manually**. A category outside this list matches no routing rule and
the correspondence lands nowhere.

**B2.7** The 6 choices for `Status`, one per line, exactly:

```
Received
Under Review
In Treatment
Awaiting Response
Completed
Closed
```

Untick **Can add values manually**.

## B3 · Create the document library

**B3.1** Return to the site home page. Click **+ New**, then **Document library**.

**B3.2** In **Name**, type exactly:

```
CorrespondenceDocuments
```

**B3.3** Click **Create**.

**B3.4** Open the new library. Click **+ Add column**, choose **Single line of text**, name
it exactly `ReferenceId`, click **Save**.

**B3.5** Click **+ Add column** again, choose **Single line of text**, name it exactly
`Sha256`, click **Save**.

`Sha256` is how you verify later that the file in the library is byte-for-byte the file the
citizen sent.

## B4 · Create the Support Cases list

**B4.1** Site home page → **+ New** → **List** → **Blank list**.

**B4.2** Name it exactly:

```
SupportCases
```

**B4.3** Click **Create**, then add these columns:

| Column name | Type | Additional settings |
|---|---|---|
| `CaseRef` | Single line of text | **Enforce unique values** = **Yes** |
| `Name` | Single line of text | none |
| `Email` | Single line of text | none |
| `Topic` | Single line of text | none |
| `Message` | Multiple lines of text | **Number of lines for editing** = `10` |
| `AboutReference` | Single line of text | none |
| `ReceivedAt` | Single line of text | none |

---
---

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

## C6 · Understand what the proxy sends to these flows

Every flow above receives a POST with `Content-Type: application/json` and this body:

```json
{
  "action": "the contract action name",
  "payload": { },
  "requestId": "a UUID",
  "timestamp": "2026-08-04T09:15:22.431Z",
  "_identity": {
    "subject": "the token subject claim",
    "email": "officer@nitda.gov.ng",
    "name": "Officer Name",
    "role": "director"
  }
}
```

`_identity` is injected by the proxy after it has verified the token. It is the only
trustworthy statement of who is calling. **Your flows must read the caller's identity from
`_identity` and from nowhere else.** If a flow reads an email from anywhere in `payload`, a
caller can put any address there.

## C7 · Build the intake submission flow

This flow does not exist yet. It receives public submissions from the portal.

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

**C7.8** Paste this exactly into the box, then click **Done**:

```json
{
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
      "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "originalName": "Letter to the DG.PDF",
      "renamed": ["lowercased", "separators_normalised"]
    }
  ],
  "declaredBytes": 24576,
  "referenceId": "NITDA-2026-000001",
  "receivedAt": "2026-08-04T09:15:22.431Z",
  "source": "document-portal"
}
```

**C7.9** Set **Method** to `POST`. If there is no Method field visible, click **Show advanced
options** first.

**C7.10** Click **+ New step**.

**C7.11** In the search box type `Create item`. Click the **SharePoint** connector, then
click the **Create item** action.

**C7.12** Set **Site Address** to your SharePoint site (V8). It appears in the dropdown; if
not, choose **Enter custom value** and paste V8.

**C7.13** Set **List Name** to `Correspondence`.

**C7.14** The list's columns now appear as fields. Fill each one by clicking the field and
selecting the matching item from the dynamic content panel. Where the table says an
expression, click **Expression** in the dynamic content panel, paste the expression, and
click **OK**.

| Field | What to put in it |
|---|---|
| `Title` | Dynamic content: `referenceId` |
| `ReferenceId` | Dynamic content: `referenceId` |
| `Subject` | Dynamic content: `subject` |
| `Category` | Dynamic content: `category` |
| `CorrespondenceType` | Dynamic content: `correspondenceType` |
| `Channel` | Dynamic content: `channel` |
| `SenderName` | Expression: `triggerBody()?['sender']?['name']` |
| `SenderEmail` | Dynamic content: `senderEmail` |
| `SenderOrganisation` | Expression: `triggerBody()?['sender']?['organisation']` |
| `SenderOrganisationType` | Expression: `triggerBody()?['sender']?['organisationType']` |
| `SenderPhone` | Dynamic content: `senderPhone` |
| `EventDate` | Dynamic content: `eventDate` |
| `Description` | Dynamic content: `description` |
| `Status` | Type the literal text: `Received` |
| `StatusLabel` | Type the literal text: `Received and awaiting registry review` |
| `ReceivedAt` | Dynamic content: `receivedAt` |
| `ActionRequired` | Choose **No** |
| `AttachmentManifest` | Expression: `string(triggerBody()?['attachments'])` |
| `DeclaredBytes` | Dynamic content: `declaredBytes` |
| `CorrelationId` | Expression: `triggerOutputs()['headers']?['X-Correlation-Id']` |
| `Timeline` | Expression: `string(createArray(json(concat('{"at":"', triggerBody()?['receivedAt'], '","status":"Received","label":"Received by the registry","public":true,"note":"Your correspondence has been received and given a reference."}'))))` |

Leave `AcknowledgedAt`, `UpdatedAt`, `ClosedAt` and `AttachmentLink` empty.

**C7.15** Click **+ New step**.

**C7.16** Search for `Response`. Click the **Request** connector, then **Response**.

**C7.17** Set **Status Code** to `200`.

**C7.18** In **Body**, paste exactly:

```json
{
  "ok": true,
  "stored": true
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

**C8.6** Set **Site Address** to V8. Set **List Name** to `Correspondence`.

**C8.7** Click **Show advanced options**. In **Filter Query**, paste this expression exactly:

```
ReferenceId eq '@{triggerBody()?['referenceId']}' and SenderEmail eq '@{toLower(triggerBody()?['email'])}'
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

**C8.13** Set **Status Code** to `200`. In **Body**, paste exactly:

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

**C8.16** Click **Save**. Expand the trigger, copy the **HTTP POST URL**, record it as
`DGO_ENDPOINT_INTAKE_STATUS`.

**About the timeline.** Each entry the proxy returns to a citizen has an `at`, `status`,
`label` and `note`. The `note` is only shown if the entry also has `"public": true`. Registry
officers can therefore keep internal minutes on the same timeline; anything not explicitly
marked public is withheld. When you add timeline entries later, set `public` deliberately.

## C9 · Build the attachment upload flow

This one receives raw file bytes, not JSON.

**C9.1** Create → **Instant cloud flow** → name it exactly:

```
DGO Intake Upload
```

**C9.2** Trigger: **When an HTTP request is received**. Click **Create**.

**C9.3** Expand the trigger. **Leave the schema box empty.** Do not click "Use sample payload
to generate schema". The body is binary, and a JSON schema would corrupt every non-text file.

**C9.4** Set **Method** to `POST`.

**C9.5** Click **Show advanced options**. If a **Content-Type** field appears, set it to:

```
application/octet-stream
```

**C9.6** Click **+ New step**. Search `Create file`. Choose **SharePoint** → **Create file**.

**C9.7** Set **Site Address** to V8.

**C9.8** Set **Folder Path** to:

```
/CorrespondenceDocuments
```

**C9.9** In **File Name**, click **Expression** and paste exactly:

```
concat(triggerOutputs()['headers']?['X-DGO-Reference'], '_', decodeUriComponent(triggerOutputs()['headers']?['X-DGO-Filename']))
```

The proxy percent-encodes the filename in the header, so it must be decoded here. Prefixing
the reference keeps two citizens who both send `letter.pdf` from overwriting each other.

**C9.10** In **File Content**, click **Expression** and paste exactly:

```
triggerBody()
```

**C9.11** Click **+ New step**. Search `Update file properties`. Choose **SharePoint** →
**Update file properties**.

**C9.12** Set **Site Address** to V8. Set **Library Name** to `CorrespondenceDocuments`.

**C9.13** Set **Id** to the dynamic content **ItemId** from the Create file step.

**C9.14** Set `ReferenceId` using **Expression**:

```
triggerOutputs()['headers']?['X-DGO-Reference']
```

**C9.15** Set `Sha256` using **Expression**:

```
triggerOutputs()['headers']?['X-DGO-Sha256']
```

**C9.16** Click **+ New step**. Search `Response`. Choose **Request** → **Response**.

**C9.17** Set **Status Code** to `200`. In **Body**, paste exactly:

```json
{
  "webUrl": "@{body('Create_file')?['{Link}']}"
}
```

The proxy reads `webUrl`, `documentUrl` or `link` from your response and writes it onto the
correspondence record. If you return none of these, the file is stored but nothing links to
it from the register.

**C9.18** Click **Save**. Expand the trigger, copy the **HTTP POST URL**, and record it under
**both** of these names in `deployment-values.txt`:

```
DGO_ENDPOINT_INTAKE_UPLOAD
DGO_ENDPOINT_SCAN_UPLOAD
```

One library serves both the public channel and registry counter deposits. Set them to
different flows later only if counter deposits must be filed separately.

**Headers this flow receives:**

| Header | Contents |
|---|---|
| `X-DGO-Reference` | The registry reference, e.g. `NITDA-2026-000001` |
| `X-DGO-Filename` | The filename, percent-encoded |
| `X-DGO-Sha256` | SHA-256 of the bytes, 64 lowercase hex characters |
| `X-Correlation-Id` | Ties this upload to the submission in the audit log |

The proxy has already verified that the bytes match the declared SHA-256 and size before
calling you.

## C10 · Build the email verification flow

**C10.1** Create → **Instant cloud flow** → name it exactly:

```
DGO Intake Verify Email
```

**C10.2** Trigger: **When an HTTP request is received**. Click **Create**.

**C10.3** Expand the trigger, click **Use sample payload to generate schema**, paste exactly,
click **Done**:

```json
{
  "to": "citizen@example.org",
  "code": "000000",
  "expiresAt": "2026-08-04T09:30:22.431Z"
}
```

**C10.4** Set **Method** to `POST`.

**C10.5** Click **+ New step**. Search `Send an email`. Choose **Office 365 Outlook** →
**Send an email (V2)**.

**C10.6** Set **To** to the dynamic content `to`.

**C10.7** Set **Subject** to exactly:

```
Your NITDA correspondence verification code
```

**C10.8** Click **</>** (Code view) in the Body toolbar, then paste exactly:

```html
<p>Your verification code is <strong>@{triggerBody()?['code']}</strong></p>
<p>Enter this code on the NITDA document portal to complete your submission. The code expires at @{triggerBody()?['expiresAt']}.</p>
<p>If you did not request this code, ignore this message. No submission has been made.</p>
<p>Directorate of Digital Operations<br>National Information Technology Development Agency</p>
```

**C10.9** Click **+ New step**. Search `Response`. Choose **Request** → **Response**. Set
**Status Code** to `200`. In **Body**, paste exactly:

```json
{
  "sent": true
}
```

**C10.10** Click **Save**. Expand the trigger, copy the **HTTP POST URL**, record it as
`DGO_ENDPOINT_INTAKE_VERIFY_EMAIL`.

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
Set **Site Address** to V8, **List Name** to `SupportCases`.

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

**C12.1** Open `deployment-values.txt`. Count the recorded URLs. You must have exactly 23
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
DGO_ENDPOINT_SCAN_UPLOAD
```

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

# PART E — Deploy the Worker

## E1 · Turn on the two required flags

**E1.1** In your terminal, from the repository root, open the configuration file in a text
editor:

```
proxy/wrangler.toml
```

**E1.2** Find the `[vars]` section. It contains this line:

```toml
DGO_REQUIRE_DURABLE_REFERENCES = "false"
```

**E1.3** Change `"false"` to `"true"` so it reads:

```toml
DGO_REQUIRE_DURABLE_REFERENCES = "true"
```

This makes the Worker refuse to serve if the registry counter is ever unbound. Without it, a
cold start reissues `NITDA-2026-000001` and two citizens hold a receipt for one reference.

**E1.4** Find this line in the same section:

```toml
DGO_REQUIRE_VERIFICATION = "false"
```

**E1.5** Change it to:

```toml
DGO_REQUIRE_VERIFICATION = "true"
```

**E1.6** Leave every other line in `[vars]` exactly as it is. Save and close the file.

## E2 · First deploy

**E2.1** In the terminal, change into the proxy directory:

```bash
cd proxy
```

**E2.2** Deploy:

```bash
npx wrangler deploy
```

**E2.3** Watch the output. It must include a line confirming the migration
`v1` and the `ReferenceCounter` class. This creates the registry counter.

**E2.4** The output ends with the Worker's URL, in the form
`https://nitda-dgo-proxy.SOMETHING.workers.dev`. Copy the whole URL and record it in
`deployment-values.txt` as `PROXY_URL`.

**E2.5** If you visit that URL now it answers `503 proxy_not_configured`. That is correct —
no secrets are set yet.

## E3 · Set the identity secrets

Each command below prompts you to paste a value. Paste it and press Enter. Nothing is written
to a file.

**E3.1** Run:

```bash
npx wrangler secret put DGO_TENANT_ID
```

Paste **V2** — your team domain, exactly as recorded, with no `https://` prefix.

**E3.2** Run:

```bash
npx wrangler secret put DGO_AUDIENCE
```

Paste **V3** — the 64-character AUD tag.

**E3.3** Run:

```bash
npx wrangler secret put DGO_ISSUER
```

Paste `https://` followed immediately by **V2**, with no trailing slash. For example, if V2 is
`nitda-dgo.cloudflareaccess.com`, paste `https://nitda-dgo.cloudflareaccess.com`.

**E3.4** Run:

```bash
npx wrangler secret put DGO_JWKS_URI
```

Paste `https://` followed by **V2** followed by `/cdn-cgi/access/certs`. For the example
above that is `https://nitda-dgo.cloudflareaccess.com/cdn-cgi/access/certs`.

E3.3 and E3.4 are not optional. If they are unset the proxy builds Microsoft login URLs from
the tenant ID and every token fails verification with no useful error.

## E4 · Set the role mapping

**E4.1** Run:

```bash
npx wrangler secret put DGO_ROLES_CLAIM
```

Paste exactly:

```
groups
```

**E4.2** Run:

```bash
npx wrangler secret put DGO_ROLE_MAP
```

Paste this entire line, as one line with no line breaks:

```json
{"DGO-SystemAdmin":"systemAdmin","DGO-UserAdmin":"userAdmin","DGO-Executive":"executive","DGO-Director":"director","DGO-Operator":"operator","DGO-Viewer":"viewer"}
```

The names on the left must match your Access group names character for character. If you
named a group differently in D3, change it here to match.

## E5 · Set the signing secrets

**E5.1** Run:

```bash
npx wrangler secret put DGO_UPLOAD_SECRET
```

Paste **V6**.

**E5.2** Run:

```bash
npx wrangler secret put DGO_VERIFY_SECRET
```

Paste **V7**.

## E6 · Set the 23 flow URLs

Run each command in turn. When prompted, paste the URL you recorded against that name in
`deployment-values.txt`.

```bash
npx wrangler secret put DGO_ENDPOINT_FETCH_ALL
npx wrangler secret put DGO_ENDPOINT_FETCH_ACTIVITIES
npx wrangler secret put DGO_ENDPOINT_SUBSIDIARY_ACTIONS
npx wrangler secret put DGO_ENDPOINT_REFERENCE_DATA
npx wrangler secret put DGO_ENDPOINT_GET_DOCS
npx wrangler secret put DGO_ENDPOINT_FETCH_EMAIL_ATTACHMENTS
npx wrangler secret put DGO_ENDPOINT_SINGLE_ASSIGNMENT
npx wrangler secret put DGO_ENDPOINT_BULK_ASSIGNMENT
npx wrangler secret put DGO_ENDPOINT_BULK_ASSIGNMENT_DIRECT
npx wrangler secret put DGO_ENDPOINT_DYNAMIC_ACTIONS
npx wrangler secret put DGO_ENDPOINT_EMAIL
npx wrangler secret put DGO_ENDPOINT_EMAIL_RELATED_TASK
npx wrangler secret put DGO_ENDPOINT_AI_EMAIL_ANALYSIS
npx wrangler secret put DGO_ENDPOINT_AI_DOC_ANALYSIS
npx wrangler secret put DGO_ENDPOINT_AI_CHAT
npx wrangler secret put DGO_ENDPOINT_OTP_GENERATE
npx wrangler secret put DGO_ENDPOINT_OTP_VERIFY
npx wrangler secret put DGO_ENDPOINT_INTAKE_SUBMISSION
npx wrangler secret put DGO_ENDPOINT_INTAKE_UPLOAD
npx wrangler secret put DGO_ENDPOINT_INTAKE_STATUS
npx wrangler secret put DGO_ENDPOINT_INTAKE_SUPPORT
npx wrangler secret put DGO_ENDPOINT_INTAKE_VERIFY_EMAIL
npx wrangler secret put DGO_ENDPOINT_SCAN_UPLOAD
```

**E6.1** Confirm all 29 secrets are set:

```bash
npx wrangler secret list
```

Count the entries. There must be **31**: eight identity and signing secrets
(`DGO_TENANT_ID`, `DGO_AUDIENCE`, `DGO_ISSUER`, `DGO_JWKS_URI`, `DGO_ROLES_CLAIM`,
`DGO_ROLE_MAP`, `DGO_UPLOAD_SECRET`, `DGO_VERIFY_SECRET`) plus the 23 endpoints.

If the count is lower, compare the printed list against the 23 names in C12.1 and the eight
above, and set whichever is missing.

## E7 · Redeploy and check

**E7.1** Run:

```bash
npx wrangler deploy
```

**E7.2** Check the Worker's health. Replace `PROXY_URL` with the value from E2.4:

```bash
curl -s PROXY_URL/healthz
```

**E7.3** The response must contain all of these:

```
"ok":true
"host":"cloudflare-worker"
"referenceSequence":"durable-object"
"referenceSequenceDurable":true
```

**E7.4** **If `referenceSequenceDurable` is `false`, stop.** The registry counter is not
bound and the register will issue duplicate references. Go back to E1.3 and E2.2.

**E7.5** The response also contains `"unconfigured":[...]`. That list must contain exactly
two entries: `DISPATCH_OUTBOUND` and `ARCHIVE_REFERENCE`. Anything else in that list is a
secret you missed in E6 — set it and repeat E7.1.

## E8 · Put the Worker behind Access

**E8.1** Return to the Cloudflare dashboard → **Zero Trust** → **Access** → **Applications**.

**E8.2** Click **Add an application**, then **Self-hosted**.

**E8.3** In **Application name**, type exactly:

```
NITDA DGO Proxy
```

**E8.4** In **Application domain**, enter the Worker hostname from E2.4 without the
`https://` — for example `nitda-dgo-proxy.something.workers.dev`.

**E8.5** Set **Session Duration** to **8 hours**. Click **Next**.

**E8.6** In **Policy name** type exactly:

```
DGO pilot access
```

Set **Action** to **Allow**. Under **Include**, select **Access groups** and select all six
groups. Click **Next**, then **Add application**.

**E8.7** Add a bypass so health checks keep working. On the application, click **Policies**,
then **Add a policy**.

**E8.8** In **Policy name** type exactly:

```
Health check bypass
```

**E8.9** Set **Action** to **Bypass**. Under **Include**, choose **Everyone**.

**E8.10** Click **Add rule group** and set a path rule for `/healthz` if the interface offers
one. If it does not, skip this policy — you will simply need to be signed in to read
`/healthz`.

**E8.11** Click **Save**.

---
---

# PART F — Deploy the front end

## F1 · Write the platform configuration

**F1.1** In the repository, create a new file at exactly this path:

```
config/config.local.js
```

**F1.2** Paste this into it, then replace `PROXY_URL_HERE` with the Worker URL from E2.4:

```javascript
window.DGO_CONFIG = {
  endpoints: {},
  auth: {
    enabled: true,
    provider: 'cloudflare-access',
    roleSource: 'claims',
    rolesClaim: 'groups',
    allowClientAssertedIdentity: false,
    proxyBaseUrl: 'PROXY_URL_HERE',
    roleClaimMap: {
      'DGO-SystemAdmin': 'systemAdmin',
      'DGO-UserAdmin': 'userAdmin',
      'DGO-Executive': 'executive',
      'DGO-Director': 'director',
      'DGO-Operator': 'operator',
      'DGO-Viewer': 'viewer',
    },
  },
};
```

**F1.3** Save the file.

`endpoints: {}` is correct and deliberate. With `auth.enabled` set to `true` the platform
routes every request through `proxyBaseUrl`, so any flow URL placed here would be unused —
and would be a credential sitting in a file a browser downloads.

**F1.4** This file is already listed in `.gitignore`. Confirm with:

```bash
git status --short config/config.local.js
```

It must print nothing. If it prints the filename, do not commit it.

## F2 · Write the portal configuration

**F2.1** Create a new file at exactly this path — beside `index.html`, not inside `js/`:

```
document-portal/config.local.js
```

**F2.2** Paste this, replacing `PROXY_URL_HERE` with the same Worker URL:

```javascript
window.PF_CONFIG = {
  proxyBaseUrl: 'PROXY_URL_HERE',
};
```

**F2.3** Save the file.

The portal is the public channel and stays unauthenticated — citizens have no account. It
reaches only `/intake/*`, the one unauthenticated path through the proxy.

## F3 · Deploy

**F3.1** Return to the repository root:

```bash
cd ..
```

**F3.2** Create the Pages project:

```bash
npx wrangler pages project create nitda-dgo-platform --production-branch main
```

**F3.3** Deploy:

```bash
npx wrangler pages deploy . --project-name nitda-dgo-platform
```

**F3.4** The output ends with the deployed URL. Copy it. Record it in
`deployment-values.txt` as **V9**.

## F4 · Correct the Access application domain

**F4.1** If V9 differs from `nitda-dgo-platform.pages.dev`, go to the Cloudflare dashboard →
**Zero Trust** → **Access** → **Applications**.

**F4.2** Click **NITDA DGO Platform**.

**F4.3** Click **Configure**, then **Application**.

**F4.4** Change **Application domain** to V9 without the `https://`.

**F4.5** Click **Save application**.

---
---

# PART G — Verify before anyone uses it

Run all eight checks. Every one must give the stated result.

## G1 · The public channel accepts a submission

**G1.1** Run this, replacing `PROXY_URL` with the value from E2.4:

```bash
curl -s -X POST PROXY_URL/intake/submission \
  -H 'Content-Type: application/json' \
  -d '{"subject":"Deployment verification one","category":"General Correspondence","senderEmail":"registry@nitda.gov.ng","sender":{"name":"Registry"},"description":"First verification submission."}'
```

**G1.2** The response must contain `"referenceId":"NITDA-2026-` followed by six digits, and
`"delivered":true`.

**G1.3** If `"delivered":false` appears, the intake submission flow is not reachable. Check
that `DGO_ENDPOINT_INTAKE_SUBMISSION` was set in E6 and that the flow is turned on.

## G2 · The reference sequence does not restart

**G2.1** Run the same command from G1.1 three more times, changing `verification one` to
`two`, `three`, `four`.

**G2.2** Write down all four references. They must be four different, consecutive numbers.

**G2.3** If any number repeats, stop. The registry counter is not working. Return to E7.3.

## G3 · The record reached SharePoint

**G3.1** Open the `Correspondence` list in SharePoint.

**G3.2** Confirm four new items exist, one per submission, each with the reference from G2.2
in the `ReferenceId` column and `Received` in `Status`.

## G4 · Status read-back works

**G4.1** Run, replacing `NITDA-2026-000001` with the first reference from G2.2:

```bash
curl -s -X POST PROXY_URL/intake/status \
  -H 'Content-Type: application/json' \
  -d '{"referenceId":"NITDA-2026-000001","email":"registry@nitda.gov.ng"}'
```

**G4.2** The response must contain the subject and `"status":"Received"`.

**G4.3** Now run the same command with a wrong email:

```bash
curl -s -X POST PROXY_URL/intake/status \
  -H 'Content-Type: application/json' \
  -d '{"referenceId":"NITDA-2026-000001","email":"someone.else@example.org"}'
```

**G4.4** This must **not** return the record. If it does, the filter query in C8.7 is wrong —
fix it before going further, because it means anyone who guesses a reference can read
somebody's correspondence.

## G5 · The authenticated path refuses anonymous callers

**G5.1** Run:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST PROXY_URL/FETCH_ALL \
  -H 'Content-Type: application/json' -d '{}'
```

**G5.2** The result must be `401` or `302`. If it is `200`, the Worker is answering without
authentication — return to E8.

## G6 · A forged identity header is refused

**G6.1** Run:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST PROXY_URL/FETCH_ALL \
  -H 'Content-Type: application/json' \
  -H 'Cf-Access-Jwt-Assertion: forged.token.value' -d '{}'
```

**G6.2** The result must be `401`.

## G7 · Officers get their real role

**G7.1** Ask one officer from each of the six groups to open V9 in a browser.

**G7.2** Each is redirected to a Cloudflare sign-in page. They sign in.

**G7.3** Each then navigates to the diagnostics workspace by adding `#/diagnostics` to the
URL.

**G7.4** Each must see their own email address and the role their group maps to.

**G7.5** If someone shows `viewer` when they should not, the groups claim is missing — return
to D2.6.

**G7.6** If someone shows `systemAdmin` when they should not, `auth.enabled` is not `true` in
`config/config.local.js` — return to F1.2 and redeploy with F3.3.

## G8 · The register is shared, not per-browser

**G8.1** Have one officer register a correspondence in the platform.

**G8.2** Have a second officer, on a different computer, open `#/lookup` and search for it.

**G8.3** They must find it. If they cannot, `FETCH_ALL` is not reaching its flow and each
officer is working on a private copy in their own browser. Check `unconfigured` in E7.5.

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

**I1.3** Delete `deployment-values.txt`. It contains V6 and V7.

**I1.4** Tell your pilot officers the platform URL (V9) and that they sign in with their
normal work account.

## I2 · Two limits that remain during the pilot

**I2.1 Upload tickets and verification codes are single-use per server instance, not
globally.** Cloudflare may run several instances. A ticket used on one could in principle be
used again on another. `/healthz` reports this as `"singleUseScope":"isolate"`. It does not
affect the correctness of the register. Acceptable for a supervised pilot; fix before opening
to the general public.

**I2.2 Rate limits count per instance.** The limit of 5 submissions per address per minute is
therefore looser in practice. To add a hard limit, go to the Cloudflare dashboard →
**Security** → **WAF** → **Rate limiting rules**, and add a rule matching path
`/intake/*` at 10 requests per minute per IP.

## I3 · Rolling back the Worker

**I3.1** List recent deployments:

```bash
cd proxy
npx wrangler deployments list
```

**I3.2** Roll back:

```bash
npx wrangler rollback --message "why you are rolling back"
```

**I3.3** Secrets and the registry counter survive a rollback. The reference sequence is not
reset and must never be reset manually — reissuing a number already printed on a citizen's
receipt is precisely the failure this design prevents.

## I4 · Closing the public channel without taking the platform down

**I4.1** Run:

```bash
cd proxy
npx wrangler secret delete DGO_ENDPOINT_INTAKE_SUBMISSION
```

**I4.2** Submissions then receive a `202` response saying `"delivered":false`, and are
recorded in the audit log. Nothing is silently lost.

**I4.3** To reopen, set the secret again with the same URL:

```bash
npx wrangler secret put DGO_ENDPOINT_INTAKE_SUBMISSION
```

## I5 · Reading the logs

**I5.1** Live tail:

```bash
cd proxy
npx wrangler tail
```

**I5.2** Every line is a single JSON object. The `event` field says what happened. These are
the ones worth knowing:

| `event` value | Meaning |
|---|---|
| `intake:accepted` | A submission was validated and given a reference |
| `intake:rejected` | A submission failed validation; `reason` says why |
| `intake:forwarded` | Sent to the flow; `delivered` says whether it arrived |
| `intake:rate-limited` | An address exceeded its submission allowance |
| `intake:upstream-unreachable` | The flow could not be reached at all |
| `proxy:auth-rejected` | A token failed verification; `reason` says why |
| `proxy:reference-sequence-not-durable` | The registry counter is in memory — must never appear once E1.3 is done |
| `scan:accepted` | A registry officer deposited a counter scan |
| `upload:upstream-unreachable` | Attachment bytes could not be filed |

**I5.3** No log line ever contains a file's contents, a correspondence description, a
verification code or a token. If you see one, treat it as a defect and report it.
