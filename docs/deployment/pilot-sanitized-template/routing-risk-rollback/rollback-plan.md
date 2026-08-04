# Rollback plan template

Use with `docs/deployment/CLOUDFLARE.md` Part I (go-live and rollback).

## Preconditions

- `npx wrangler deployments list` recorded outside Git
- Current deployment identifiers recorded outside Git
- Secret inventory reconciled in `worker-pages/secret-status.csv`

## Plan

1. Identify rollback target deployment outside Git.
2. Execute `npx wrangler rollback --message "reason for rollback"` from the external operator workstation.
3. Verify that secrets and Durable Object bindings remain correct.
4. If public intake must stop, delete `DGO_ENDPOINT_INTAKE_SUBMISSION` and record the action outside Git.
5. Re-run the Part G verification sequence (G1-G8) and capture sanitized results.
