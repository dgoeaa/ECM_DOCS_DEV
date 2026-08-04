# Sanitized deployment-record templates for the Cloudflare / Power Automate pilot

These committed files are **sanitized blank templates only**. They exist so operators can copy a complete record set for the pilot described in [`CLOUDFLARE.md`](./CLOUDFLARE.md) **without ever committing operational values**.

## Copy outside the repository first

Create the real evidence directory **outside the Git working tree** before entering any live or internal data.

Recommended external path:

```text
ECM_DOCS_DEV-deployment-private/pilot-YYYY-MM/
```

Recommended copy command from the repository root:

```bash
cp -R docs/deployment/pilot-sanitized-template ECM_DOCS_DEV-deployment-private/pilot-YYYY-MM
```

Do **not** populate these templates in place under `docs/`. The repository copy must remain sanitized.

## What must stay out of Git

Store the following only in an approved secrets vault, or in the Cloudflare / Power Automate consoles as required by the runbook:

- Any complete Power Automate trigger URL — including the ones configured client-side in `config/config.local.js` (`DGO_CONFIG.endpoints`) and `document-portal/config.local.js` (`PF_CONFIG.endpoints`), which are bearer credentials delivered to every visitor's browser
- Any `sig=` value
- OAuth tokens, JWTs, cookies, authorization headers, account exports, or vault exports
- Real operator emails, phone numbers, usernames, or personal data

The Git-ignored runtime files `config/config.local.js` and `document-portal/config.local.js` are deployment-time local files. This PR documents them only; it does **not** create or modify them.

## Records likely to contain internal or personal data

Keep these records outside Git once populated:

- `control/operators.csv`
- `control/evidence-index.csv`
- `power-automate/verification-results.csv`
- `verification/public-submission-results.redacted.json`
- Any screenshots, logs, browser exports, or access-verification captures
- Any file whose evidence notes include officer identities, submitter content, or internal hostnames

## File format and naming guidance

- Text files: UTF-8, LF line endings
- YAML: `.yaml`
- JSON: `.json`
- CSV: `.csv` with a header row
- Notes / decisions: `.md`
- Plain command output: `.txt`
- Screenshots: `YYYY-MM-DDTHHMMSSZ-step-slug.png`
- Logs: `YYYY-MM-DDTHHMMSSZ-step-slug.txt`

## Evidence integrity and checksums

When the external record set is populated, generate SHA-256 checksums for the **real evidence files** in the external directory and record them in `control/evidence-index.csv` or a companion checksum manifest used by your operating procedure.

Do **not** commit generated checksums for these placeholder files. The repository copy is a template, not evidence.

## Diagram sources

Sanitized editable Mermaid sources live in:

- `../forensic/dd2e909/diagrams/05-cloudflare-pilot-architecture.mmd`
- `../forensic/dd2e909/diagrams/06-power-automate-cutover-sequence.mmd`
- `../forensic/dd2e909/diagrams/07-auth-request-flow.mmd`
- `../forensic/dd2e909/diagrams/08-evidence-storage-zones.mmd`

Use placeholders such as `<TEAM-DOMAIN>`, `<AUD-TAG>`, `<PAGES-HOSTNAME>`, `<SHAREPOINT-SITE-URL>`, and `<POWER-AUTOMATE-ENDPOINT>` until working outside Git.

## Authoritative sequence

The authoritative Part A–Part I implementation order remains [`docs/deployment/CLOUDFLARE.md`](./CLOUDFLARE.md).
