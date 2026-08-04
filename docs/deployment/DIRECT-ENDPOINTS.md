# Running the platform against your own flows — no proxy

**What this is:** the browser calls your signed Power Automate URLs directly. No
authenticating proxy, no Cloudflare Worker, no Entra tenant, no SharePoint provisioning.
It is how this application worked before the proxy existed, and it is the shortest path
from a clone to the real registry on your screen.

```bash
cp scripts/endpoints.example.env ~/dgo-endpoints.env
#   fill in your rotated trigger URLs, then:
node scripts/setup-endpoints.mjs --from ~/dgo-endpoints.env

npx http-server . -p 8080 --cors -c-1
#   open http://localhost:8080/
```

Or paste them one at a time:

```bash
node scripts/setup-endpoints.mjs
```

Needs Node 20+. That is the whole setup.

---

## Read this before you wire anything

**A SAS-signed flow URL is a bearer credential.** Possession alone authorises invoking the
flow — there is no second factor, no identity check, and no audit of who called it. Wiring
one here puts it in `config/config.local.js`, which is delivered to the browser, where
anyone with the developer console or a network trace can take it and invoke that flow
against the live registry, as anyone, from anywhere.

That is precisely the problem [`proxy/`](../../proxy/README.md) exists to solve: it holds
the signatures server-side so no browser ever sees one, and it checks who is calling before
it forwards.

So be clear about which one you are doing:

| | Direct (this document) | Proxy ([`MINIMAL-PILOT.md`](./MINIMAL-PILOT.md)) |
|---|---|---|
| Setup | minutes | ~90 minutes |
| Signatures in the browser | **yes** | no |
| Who may invoke a flow | anyone holding the URL | authenticated, role-checked callers |
| RBAC | advisory — a UX affordance | enforced server-side |
| Fit | development, review, a demonstration on a machine you control | real correspondence, shared or public deployment |

Nothing here stops you going direct. It is a legitimate and useful posture. It is just not
the one to put a government registry behind on a shared host.

Two consequences worth stating plainly:

- **Rotate the signatures when you are finished with them.** They were in the browser.
- `config/config.local.js` is git-ignored and written `0600`. Keep it that way, and do not
  paste its contents into an issue, a chat or a screenshot.

---

## Wiring

`scripts/endpoints.example.env` lists all 17 endpoints that take a URL, grouped so the ones
the platform needs to boot come first. Leave a line blank to skip it — skipped endpoints
simply do not resolve, and the modules that need them say so, so you can bring the flows up
a few at a time rather than all at once.

**Keep the filled-in file outside the repository.** `setup-endpoints.mjs` refuses to read a
filled-in copy from inside the working tree, because that is how a signature ends up in a
commit. Delete it once the endpoints are wired.

Two of the 19 contract keys take no URL of their own:

| Contract | Reaches the registry through |
|---|---|
| `DISPATCH_OUTBOUND` | `DYNAMIC_ACTIONS` |
| `ARCHIVE_REFERENCE` | `DYNAMIC_ACTIONS` |

They are distinguished by the action in the request body, not by address, so wiring
`DYNAMIC_ACTIONS` wires all three.

---

## Checking

```bash
node scripts/check-endpoints.mjs
```

```
Checking 8 endpoints…

  ✗ FETCH_ACTIVITIES   401  109ms  signature rejected — rotate this one
  ✓ FETCH_ALL          200    5ms  226 records
  ✓ REFERENCE_DATA     200    2ms  226 records
  ✗ GET_DOCS           200    1ms  flow run failed
  ✓ SINGLE_ASSIGNMENT  405    1ms  signature accepted, not invoked
  ✓ DYNAMIC_ACTIONS    405    2ms  signature accepted, not invoked

5 of 17 endpoints live.  No proxy involved.
DISPATCH_OUTBOUND and ARCHIVE_REFERENCE reach the registry through DYNAMIC_ACTIONS.
```

**It does not run your write flows.** A connectivity check that invokes `dispatchEmail`
sends real email; one that invokes `singleassignment` writes to the live registry. That is
not a test, it is a change made by a diagnostic. So the two kinds of contract are probed
differently:

- **Read contracts** (5) are POSTed with their real action and an empty payload. They read;
  that is safe, and it is the only probe that proves a flow works end to end.
- **Write contracts** (14) get a `GET`, which a POST-only trigger refuses. The gateway still
  validates the signature first, so `405` means "URL and signature good, flow not run" and
  `401`/`403` means "signature rejected". Weaker evidence, deliberately — the alternative is
  side effects.

`--probe-writes` overrides this and POSTs to everything. **It will run those flows.** There
is a four-second warning and it is not the default.

Useful flags: `--only FETCH_ALL,EMAIL`, `--timeout 30000`, `--no-check` (on setup).

---

## The one that will catch you out

Every endpoint green, the registry loads — and then every workspace says:

> **Access denied.** This profile is not enrolled for the pilot.

This is not a SharePoint permissions problem, and the message does not point at its cause.

The runtime **replaces** its user list with whatever the flows return, then gates every
workspace on the signed-in profile's email appearing in that list. The profile a fresh
install starts with is `dgsregistry@nitda.gov.ng`. If your flow's staff list does not
contain that address, the platform loads all your data and then refuses every screen.

`check-endpoints.mjs` reports this before you hit it:

```
Staff enrolment — the flow returned 12 users.
  ! dgsregistry@nitda.gov.ng is NOT among them.
    …
    Addresses it returned: a.bello@nitda.gov.ng, c.okonkwo@nitda.gov.ng, …
```

Fix it either way round:

- **Change the local profile** to an address the flow returns — open the app, go to
  Settings, and change the profile email; or
- **Add your own address** to the staff list the flow reads.

Either works. Once the profile resolves to an enrolled user, its role comes from that record
and the workspaces open.

---

## Other things worth knowing

**Your flows must allow browser calls.** Going direct makes every request cross-origin from
the page to `*.api.powerplatform.com`. Power Automate HTTP triggers do send permissive CORS
headers, so this works — but if you have put anything in front of them that does not, the
browser will block the response and the platform will look offline while the network panel
shows the requests succeeding.

**Authentication stays off, and must.** The generated config sets `auth.enabled: false`.
Turning it on routes every governed request through `auth.proxyBaseUrl` instead of at these
URLs and makes the client demand an Entra token — that is the proxy deployment, not this
one. So RBAC here is advisory: the platform's role checks shape what a user sees, and
nothing enforces them.

**Endpoints you skip degrade rather than break.** An unconfigured endpoint reports itself in
Diagnostics, and the modules that need it say so. `FETCH_ALL` is the one that matters most —
without it the platform has no data at all, though it will fall back to `FETCH_ACTIVITIES`.

**A first load straight into a deep route can show empty counters.** Opening
`/#/correspondence` directly renders the module before the data arrives, and it does not
re-render when the data lands. Navigate within the app and it is fine. Existing runtime
behaviour, not something this path introduces.

---

## Going back

```bash
rm config/config.local.js
```

That returns the platform to demo mode — no endpoints, nothing transmitted. From there:

- [`LOCAL-DEV.md`](./LOCAL-DEV.md) — a local backend that answers all 19 endpoints from a
  seeded registry, so the platform runs with nothing external at all
- [`MINIMAL-PILOT.md`](./MINIMAL-PILOT.md) — the proxy deployment, for real correspondence
