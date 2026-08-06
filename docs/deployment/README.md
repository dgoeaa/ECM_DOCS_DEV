# Deployment documentation

**Start here: [`MINIMAL-PILOT.md`](./MINIMAL-PILOT.md)** — about 75 minutes, gets
correspondence flowing end to end. Every governed write in the platform goes through one
endpoint, so a pilot needs 6 flows rather than 24; the rest are features you add later, one
config line and a redeploy each.

Then:

- **[`FLOW-BUILD-PLAN.md`](./FLOW-BUILD-PLAN.md)** — what to BUILD in Power Automate. All 19
  contract keys across 15 physical flows, each with its request, response and obligations,
  sequenced into six waves by what unblocks what. Start at Wave 0: it closes the fail-open
  that makes every browser a System Administrator, and needs no authentication.
- **[`CLOUDFLARE.md`](./CLOUDFLARE.md)** — the full deployment, and the reference for the
  parts the minimal path points at. What to DO. A click-by-click walkthrough in nine
  parts (A to I), 229 numbered steps, from checking Node.js to reading the logs after
  go-live. Follow it top to bottom.
- **[`LOCAL-DEV.md`](./LOCAL-DEV.md)** — how to run both applications end to end with nothing
  provisioned. `npm run dev` starts one Node process that serves the platform, the portal and
  a stand-in for every endpoint they call. It authenticates nobody, binds loopback only and
  refuses to start under `NODE_ENV=production`; use it to read the code, review a screen or
  reproduce a bug, never to carry real correspondence.
- **[`pilot-sanitized-template/`](./pilot-sanitized-template/README.md)** — what to RECORD.
  Registers for each flow regenerated, deleted or rebuilt, the value register, endpoint
  configuration status and verification results. Fill these in as you work through
  CLOUDFLARE.md so the cutover leaves evidence rather than only an outcome.

The one script that replaces a tedious part:

| Script | Replaces | Time saved |
|---|---|---|
| `scripts/setup-sharepoint.ps1` | Part B — 33 columns clicked one at a time | ~1 hour |

There is no Worker any more, so there are no secrets to set: the flow trigger URLs are pasted
straight into the two git-ignored config files in Part E (`config/config.local.js` and
`document-portal/config.local.js`). Because those files are delivered to every visitor's
browser, treat every URL in them as a public bearer credential and rotate it on a schedule.

The value register uses the same V1–V7 numbering as Part A of the walkthrough, and the flow
registers use the same workflow IDs as Part C.

The committed template tree contains placeholders only. Copy it outside the repository before entering any operational, internal, or personal data.
