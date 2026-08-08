# Deployment documentation

**Start here: [`MINIMAL-PILOT.md`](./MINIMAL-PILOT.md)** — the short path, gets
correspondence flowing end to end. Every governed write in the platform goes through one
endpoint, so a pilot needs 6 flows rather than 24; the rest are features you add later, one
config line and a redeploy each. Hosting the front end and gating who may load it are handled
outside this repository — not covered here.

Then:

- **[`PACKAGING.md`](./PACKAGING.md)** — what to HAND OVER. `npm run package` builds each
  platform into a self-contained directory with its endpoint URLs configured into it, a
  manifest hashing every byte, and a provisioning record. It refuses to emit a pilot package
  with a missing required endpoint, a malformed URL, two keys on one flow, or a signature
  this repository already publishes. `npm run package:verify` checks a delivered package
  against its manifest before you deploy it.
- **[`FLOW-BUILD-PLAN.md`](./FLOW-BUILD-PLAN.md)** — what to BUILD in Power Automate. All 19
  contract keys across 15 physical flows, each with its request, response and obligations,
  sequenced into six waves by what unblocks what. Start at Wave 0: it closes the fail-open
  that makes every browser a System Administrator, and needs no authentication.
- **[`FLOW-BUILD-WALKTHROUGH.md`](./FLOW-BUILD-WALKTHROUGH.md)** — the full SharePoint and
  Power Automate build, and the reference for the parts the minimal path points at. What to
  DO. A click-by-click walkthrough in two parts (B and C), from provisioning SharePoint to
  building the last intake flow. Follow it top to bottom.
- **[`LOCAL-DEV.md`](./LOCAL-DEV.md)** — how to run both applications end to end with nothing
  provisioned. `npm run dev` starts one Node process that serves the platform, the portal and
  a stand-in for every endpoint they call. It authenticates nobody, binds loopback only and
  refuses to start under `NODE_ENV=production`; use it to read the code, review a screen or
  reproduce a bug, never to carry real correspondence.

The one script that replaces a tedious part:

| Script | Replaces | Time saved |
|---|---|---|
| `scripts/setup-sharepoint.ps1` | Part B — 33 columns clicked one at a time | ~1 hour |

There is no Worker any more, so there are no secrets to set: the flow trigger URLs go
straight into the endpoint configuration each platform loads — written into a working tree
by `npm run setup`, and into a deliverable package by `npm run package`. Because that file
is delivered to every visitor's browser, treat every URL in it as a public bearer credential
and rotate it on a schedule. Rotation is the only revocation there is.
