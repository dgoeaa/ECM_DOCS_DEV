# Deployment documentation

**Running it against your own flows, without the proxy?
[`DIRECT-ENDPOINTS.md`](./DIRECT-ENDPOINTS.md)** — the browser calls your signed Power
Automate URLs directly. Minutes rather than ninety, and the trade is stated there: the
signatures reach the browser, so it suits development and a machine you control rather
than real correspondence on a shared host.

**No endpoints to hand? [`LOCAL-DEV.md`](./LOCAL-DEV.md)** — one command, no accounts, no
cloud. A local server that answers every endpoint from a seeded registry, so the platform
runs end to end with nothing provisioned. Not a deployment and not a substitute for the
proxy; it is how you read the code, review a screen or reproduce a bug without spending
ninety minutes first.

**Deploying for real? Start here: [`MINIMAL-PILOT.md`](./MINIMAL-PILOT.md)** — about 90 minutes, gets
correspondence flowing end to end. Every governed write in the platform goes through one
endpoint, so a pilot needs 6 flows rather than 23; the rest are features you add later, one
command each, with no redeploy.

Then:

- **[`CLOUDFLARE.md`](./CLOUDFLARE.md)** — the full deployment, and the reference for the
  parts the minimal path points at. What to DO. A click-by-click walkthrough in nine
  parts (A to I), 273 numbered steps, from checking Node.js to reading the logs after
  go-live. Follow it top to bottom.
- **[`pilot-sanitized-template/`](./pilot-sanitized-template/README.md)** — what to RECORD.
  Registers for each flow regenerated, deleted or rebuilt, the value register, secret status
  and verification results. Fill these in as you work through CLOUDFLARE.md so the cutover
  leaves evidence rather than only an outcome.

Scripts that replace the most tedious parts:

| Script | Replaces | Time saved |
|---|---|---|
| `scripts/setup-sharepoint.ps1` | Part B — 33 columns clicked one at a time | ~1 hour |
| `scripts/set-worker-secrets.sh` | Part E — 31 interactive paste prompts | ~20 minutes |

Fill in `scripts/worker-secrets.example.env` (copied outside the repository) and the secrets
script sets everything in one run, refusing values of the wrong shape before they become a
deployment that fails with no useful error.

The value register uses the same V1–V9 numbering as Part A of the walkthrough, and the flow
registers use the same workflow IDs as Part C.

The committed template tree contains placeholders only. Copy it outside the repository before entering any operational, internal, or personal data.
