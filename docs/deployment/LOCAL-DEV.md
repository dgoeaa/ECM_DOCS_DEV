# Running the platform locally

**One command, no accounts, no cloud.**

```bash
npm run dev
```

Then open <http://localhost:8080/>.

That is the whole setup. There is nothing to provision, nothing to sign up for and nothing
to paste into a config file. It needs Node 20 or newer and no other software — the server
has zero dependencies, so `npm install` is only needed if you also want to run the browser
tests.

| | |
|---|---|
| Operations platform | <http://localhost:8080/> |
| Document portal | <http://localhost:8080/portal/> |
| Health and endpoint status | <http://localhost:8080/healthz> |
| What the platform "sent" | <http://localhost:8080/api/dev/outbox> |

---

## What this replaces

The deployed platform needs a lot standing behind it: an Entra tenant to issue tokens, 23
Power Automate flows each with its own signed URL, a SharePoint site with 33 columns, a
Cloudflare Worker holding 31 secrets, and the authenticating proxy tying them together.
[`CLOUDFLARE.md`](./CLOUDFLARE.md) walks through it in 273 numbered steps and
[`MINIMAL-PILOT.md`](./MINIMAL-PILOT.md) cuts that to about 90 minutes.

Ninety minutes is the right price for a pilot that real correspondence flows through. It is
the wrong price for reading the code, reviewing a screen or reproducing a bug.

`npm run dev` starts a single Node process that serves both applications and answers every
endpoint they call:

```
                    ┌──────────────────────────────────────┐
  browser ─────────▶│  scripts/dev-server.mjs   :8080      │
                    │                                      │
   /                │   both apps, one origin              │
   /portal/         │                                      │
   /api/dgo/<KEY>   │   19 endpoint contracts              │
   /api/intake/*    │   anonymous intake, uploads, status  │
   /api/documents/  │   registry scan deposits             │
                    │                                      │
                    │   seeded store, kept OUTSIDE     │
                    │   the repository, and it persists │
                    └──────────────────────────────────────┘
```

No Entra. No Power Automate. No SharePoint. No Cloudflare. No signed URLs anywhere, because
there is nothing to sign.

---

## What you get

**A registry with data in it.** 16 correspondence records, 12 tasks, 8 categories, 8
directorates, 10 users, plus comments, approvals and emails. Every module has something to
render, so the platform reads like a working system rather than an empty shell.

**Writes that stick.** Assign a record, minute it, transition it, archive it — the change is
written to the store and it is still there after a restart.

**Both applications wired to each other.** A letter submitted on the public portal is minted
a reference, lands in the registry, and appears in Correspondence in the operations app. The
submitter can then track it. That path is the product; running the two halves as separate
demos would not show it.

**The endpoints, all of them.** All 19 contract keys in `config/endpoints.config.js`, the
five anonymous intake routes, and the authenticated scan deposit.

### Things worth knowing

| | |
|---|---|
| Step-up OTP code | `000000` |
| Portal email verification code | `123456` |
| Reset the data | `npm run dev:reset`, or `curl -X POST localhost:8080/api/dev/reset` |
| Skip the welcome splash | add `?skipWelcome=1` |

**Nothing is emailed or dispatched.** A local server cannot send mail, so it does not
pretend to: every send returns `delivered: false` and is recorded in the dev outbox at
`/api/dev/outbox`. Check there for anything the platform would have transmitted. Reporting
`delivered: true` would be a lie an operator only discovers when a recipient says they never
got it.

**The AI endpoints have no model behind them.** `AI_CHAT`, `AI_EMAIL_ANALYSIS` and
`AI_DOC_ANALYSIS` return a clearly-labelled deterministic summary built from the record they
were given, so the surfaces that render a result work. They are marked `devServer: true` and
carry `confidence: 0`. Do not read them as analysis.

---

## What this is NOT

**It is not the authenticating proxy, and it does not replace it.**

The proxy in [`proxy/`](../../proxy/README.md) validates a bearer token, derives a role from
its claims, authorizes each action against `config/rbac.config.js`, and strips
client-asserted identity. That is what makes the platform's governance enforced rather than
advisory, and it is the component that holds the signed flow URLs so a browser never sees
one.

The dev server does none of that. It answers whatever it is asked, from anybody who asks. On
a loopback interface with fabricated data that is exactly right; anywhere else it is an open
write path into a registry. Two guards keep it there:

- it binds `localhost` and refuses any other interface unless `DGO_DEV_ALLOW_EXPOSE=1`
- it refuses to start under `NODE_ENV=production`

Every response it sends carries `meta.devServer: true` and an `X-DGO-Dev-Server` header, so
a captured response can never be mistaken for a real one.

**Client-side auth stays off.** The generated config sets `auth.enabled: false`, which is
the development posture the platform already ships with: local profile, local RBAC, no
token. Turning it on would make the client demand an Entra token the dev server has no
tenant to validate, and the app would sit at a sign-in it cannot complete. So RBAC in local
development is advisory — a UX affordance, not a control. That is true of the deployed
platform too until the proxy is in front of it, and it is the reason the proxy exists.

**The security properties that are reproduced.** Where leaving something out would teach the
wrong lesson about how the portal behaves, the dev server implements it:

- a client-supplied `referenceId` never survives; the server mints it
- `channel` and `correspondenceType` are fixed, so a submitter cannot mislabel where a
  document came from
- upload tickets are HMAC-signed, expiring and single-use
- declared size and SHA-256 are verified against the bytes that actually arrive
- status read-back denies uniformly — an unknown reference and a wrong email return a
  byte-identical 404
- the status projection is allow-listed, so the phone number and description never leave

What is deliberately absent is token validation, role authorization and identity stripping.
Those need a tenant, and they are the proxy's job.

---

## Configuration

There is none to do, and nothing is written into your checkout.

The two applications each load an optional, git-ignored config file — `config/config.local.js`
and `document-portal/config.local.js`. The dev server **answers for those paths from memory**
rather than creating them, so:

- nothing appears in `git status`, there is no cleanup, and no generated file can be committed
- a real `config.local.js` holding rotated Power Automate URLs is never clobbered — the
  server checks disk first and serves the file if it is there
- the repository's own browser suite becomes deterministic. Several of its tests reach a
  governed action, and `core/data-client.js` throws "Endpoint … is not configured" *before*
  the flow-confirmation gate those tests wait for — so they used to pass only on a machine
  where someone had run setup, and fail on a clean checkout

The store lives outside the repository too, under your system temp directory.

Both config paths are origin-relative (`/api/...`), so the apps work at whatever hostname
you opened them with; `localhost` and `127.0.0.1` are different origins to a browser, and
an absolute URL here turns that into a CORS failure for no reason.

**The property worth keeping:** running against the dev server and running against Power
Automate differ only by configuration. No code moves.

If you want the config as a real file — to use with a plain static host, say — write it:

```bash
npm run setup:dev             # write config.local.js for both apps
npm run setup:dev -- --force  # replace a config the script did not write
npm run dev:reset             # discard the store; it reseeds on next start
npm run test:devserver        # 38 assertions on the contract shapes
```

`setup:dev` will not overwrite a config it did not generate, so a real one is left alone
and reported.

Environment variables:

| | |
|---|---|
| `PORT` | default `8080` |
| `DGO_DEV_HOST` | default `localhost` |
| `DGO_DEV_DATA` | default: a per-checkout path under the system temp directory |
| `DGO_DEV_ALLOW_EXPOSE` | required to bind anything but loopback |

---

## Going back, and going forward

**To point at real flows instead:** delete `config/config.local.js`, copy
`config/config.example.js` over it and fill in your rotated Power Automate URLs.

**To point at the proxy:** set `auth.enabled: true` and `auth.proxyBaseUrl` and leave
`endpoints` empty, so the browser holds no credential at all. See
[`MINIMAL-PILOT.md`](./MINIMAL-PILOT.md).

Both are configuration changes. No code moves.

---

## Two things that will look like bugs

**A hard page load straight into a deep route can show empty counters.** Loading
`/?skipWelcome=1#/correspondence` directly renders the module before the deferred data load
returns, and the module does not re-render when it lands, so the tiles read 0 until you
navigate. Navigating within the app is fine, and so is the normal path — the welcome splash
takes long enough that the data is there by the time the shell mounts. This is existing
runtime behaviour, not something the dev server introduces; it is just easier to hit when
the backend answers instantly.

**The portal's shipped demo records are trackable, deliberately.** The portal installs 16
demonstration records into `localStorage`, but its tracking page asks the registry and treats
a 404 as authoritative — it will not dress device data up as a registry answer. So the dev
store seeds those same 16 records, read out of `document-portal/js/data.js` rather than
transcribed, and the two agree. Without that, every record the portal ships would become
untrackable the moment a backend was configured.
