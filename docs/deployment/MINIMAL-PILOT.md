# Minimal pilot — the short path

About 90 minutes, most of it waiting for deploys.

This gets correspondence flowing end to end: a citizen submits, the registry sees it, an
officer triages, assigns, approves, dispatches and closes. Nothing else.

Use [`CLOUDFLARE.md`](./CLOUDFLARE.md) instead if you want every feature at once. Come back to
it later to add the ones you skip here — each is one command, no redeploy.

## Why this is so much smaller

Every governed write in the platform — register, triage, treat, approve, dispatch, close,
archive — goes through **one** endpoint, `DYNAMIC_ACTIONS`. The platform needs six endpoints,
not twenty-three. The other seventeen are AI analysis, one-time passcodes, the email desk,
the help desk, scan intake and email verification. All can wait.

That also simplifies the security work. Rather than carefully regenerating twenty-odd
triggers, you **delete everything you are not using** — 21 flows — and regenerate the three
you are. Deleting is faster than regenerating and it is the stronger action: it invalidates
every signature a flow has ever had, including the older ones that regeneration leaves live.

---

## 1 · Prepare — 10 minutes

```bash
cd /path/to/ECM_DOCS_DEV
git checkout claude/quirky-babbage-1nomt5 && git pull
npm install
npx wrangler login
```

Confirm you are on the Cloudflare **Workers Paid** plan. Durable Objects are not on the free
plan and the registry counter needs one. Dashboard → Compute (Workers) → Plans.

Create your values file, outside the repository:

```bash
cp scripts/worker-secrets.example.env ~/dgo-secrets.env
```

Leave it open. You will fill it in as you go.

## 2 · SharePoint — 2 minutes

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser      # first time only
./scripts/setup-sharepoint.ps1 -SiteUrl "https://YOURTENANT.sharepoint.com/sites/YOURSITE"
```

Creates both lists, the document library and all 33 columns. Safe to re-run.

If you have no site yet: office.com → SharePoint → Create site → Team site.

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

| Workflow ID | Paste the URL into `~/dgo-secrets.env` as |
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

These do not exist yet. Follow **C7** and **C9** in [`CLOUDFLARE.md`](./CLOUDFLARE.md) — every
field value and expression is given there, ready to copy.

- **C7** builds `DGO Intake Submission` → paste its URL as `DGO_ENDPOINT_INTAKE_SUBMISSION`
- **C9** builds `DGO Intake Upload` → paste its URL as `DGO_ENDPOINT_INTAKE_UPLOAD`

Skip C8, C10 and C11 for now — those are tracking, verification and the help desk.

Also generate the upload signing secret and paste it as `DGO_UPLOAD_SECRET`:

```bash
openssl rand -base64 48
```

## 4 · Cloudflare Access — 20 minutes

Dashboard → **Zero Trust**.

**4a** **Settings → Custom Pages.** Copy your team domain (`something.cloudflareaccess.com`).
Paste it into `~/dgo-secrets.env` as `DGO_TENANT_ID`, and as `DGO_ISSUER` with `https://` in
front, and as `DGO_JWKS_URI` with `https://` in front and `/cdn-cgi/access/certs` on the end.

**4b** **Settings → Authentication → Login methods → Add new.** Add your organisation's
provider. Then **Edit** it and turn on **Add groups to the JWT**. Click **Test** — the result
must list your groups. If the list is empty, nobody will be able to approve anything.

**4c** **Access → Groups.** Create six groups with exactly these names, putting the right
people in each:

```
DGO-SystemAdmin    DGO-UserAdmin    DGO-Executive
DGO-Director       DGO-Operator     DGO-Viewer
```

Everyone must be in exactly one.

**4d** **Access → Applications → Add an application → Self-hosted.**
Name `NITDA DGO Platform`, domain `nitda-dgo-platform.pages.dev`, session 8 hours.
Policy name `DGO pilot access`, action **Allow**, include **Access groups** → all six.

**4e** Open the application → **Overview** → copy the **Application Audience (AUD) Tag**.
Paste it as `DGO_AUDIENCE`.

## 5 · Deploy the Worker — 10 minutes

Turn on the flag that stops duplicate references. Edit `proxy/wrangler.toml`, in `[vars]`:

```toml
DGO_REQUIRE_DURABLE_REFERENCES = "true"
```

Deploy, set every secret from your file, deploy again:

```bash
cd proxy && npx wrangler deploy && cd ..
./scripts/set-worker-secrets.sh ~/dgo-secrets.env
cd proxy && npx wrangler deploy && cd ..
```

Note the Worker URL from the deploy output. Check it:

```bash
curl -s https://YOUR-WORKER-URL/healthz
```

**`"referenceSequenceDurable":true` must appear.** If it says `false`, stop — the register
will hand two citizens the same reference. Re-check the flag above and redeploy.

Then put the Worker behind Access: **Zero Trust → Access → Applications → Add an
application → Self-hosted**, domain = your Worker hostname, same `DGO pilot access` policy.

## 6 · Deploy the front end — 5 minutes

Create `config/config.local.js`, replacing the URL with your Worker's:

```javascript
window.DGO_CONFIG = {
  endpoints: {},
  auth: {
    enabled: true,
    provider: 'cloudflare-access',
    roleSource: 'claims',
    rolesClaim: 'groups',
    allowClientAssertedIdentity: false,
    proxyBaseUrl: 'https://YOUR-WORKER-URL',
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

Create `document-portal/config.local.js` — beside `index.html`, not in `js/`:

```javascript
window.PF_CONFIG = { proxyBaseUrl: 'https://YOUR-WORKER-URL' };
```

Both files are already git-ignored. Deploy:

```bash
npx wrangler pages project create nitda-dgo-platform --production-branch main
npx wrangler pages deploy . --project-name nitda-dgo-platform
```

If the hostname it prints differs from `nitda-dgo-platform.pages.dev`, go back to 4d and
correct the application domain.

## 7 · Check it works — 10 minutes

**Submit twice.** Replace the URL with your Worker's:

```bash
curl -s -X POST https://YOUR-WORKER-URL/intake/submission \
  -H 'Content-Type: application/json' \
  -d '{"subject":"Check one","category":"General Correspondence","senderEmail":"registry@nitda.gov.ng","sender":{"name":"Registry"},"description":"First check."}'
```

Run it again with `Check two`. You need `"delivered":true` both times, and **two different
reference numbers**. If a number repeats, the registry counter is not working — go back to
step 5.

**Look in SharePoint.** The `Correspondence` list must hold both, with `Received` in Status.

**Confirm the authenticated side is closed:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://YOUR-WORKER-URL/FETCH_ALL \
  -H 'Content-Type: application/json' -d '{}'
```

`401` or `302`. If it says `200`, the Worker is not behind Access.

**Have officers sign in.** One from each group opens the Pages URL, signs in, and adds
`#/diagnostics` to the address bar. Each must see their own email and their real role. If
someone shows `viewer` unexpectedly, go back to 4b — the groups claim is missing.

**Confirm the register is shared.** One officer registers a correspondence; a second, on a
different machine, finds it under `#/lookup`. If they cannot, `FETCH_ALL` is not reaching its
flow.

## 8 · Before real correspondence arrives

Delete the test records from the `Correspondence` list, and delete `~/dgo-secrets.env`.

Confirm the routing table in **Part H** of [`CLOUDFLARE.md`](./CLOUDFLARE.md). It decides which
desk each kind of correspondence lands on, and nobody has approved it yet.

---

## What you skipped, and how to add it

Each is one `wrangler secret put` and takes effect immediately. No redeploy.

| To add | Build the flow | Then set |
|---|---|---|
| Citizens tracking their submission | C8 in `CLOUDFLARE.md` | `DGO_ENDPOINT_INTAKE_STATUS` |
| Outward correspondence email | new flow | `DGO_ENDPOINT_EMAIL` |
| Email verification before a reference is issued | C10 | `DGO_ENDPOINT_INTAKE_VERIFY_EMAIL` and `DGO_VERIFY_SECRET`, then set `DGO_REQUIRE_VERIFICATION = "true"` |
| The public help desk | C11 | `DGO_ENDPOINT_INTAKE_SUPPORT` |
| Registry counter scan deposits | reuse the upload flow | `DGO_ENDPOINT_SCAN_UPLOAD` |
| AI analysis and one-time passcodes | new flows | the matching `DGO_ENDPOINT_*` |

Build these fresh rather than restoring the flows you deleted in 3a. Those all had published
credentials, which is why they were deleted.

## Two limits while the pilot runs

Upload tickets and rate limits are counted per server instance, and Cloudflare may run
several. A ticket could in principle be reused, and the limit of 5 submissions per minute per
address is looser in practice. Neither affects whether the register is correct. Fine for a
supervised pilot; fix before opening to the general public.
