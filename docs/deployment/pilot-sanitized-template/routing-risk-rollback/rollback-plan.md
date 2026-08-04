# Rollback plan template

Use with `docs/deployment/CLOUDFLARE.md` Part I (go-live and rollback).

## Preconditions

- Current Pages deployment identifier recorded outside Git
- Previous known-good Pages deployment identifier recorded outside Git
- Endpoint configuration reconciled in `pages-endpoints/endpoint-config-status.csv`

## Plan

1. Identify the previous known-good Pages deployment outside Git.
2. Roll the Pages deployment back in the Cloudflare dashboard (Workers & Pages -> project ->
   Deployments -> Rollback), or redeploy a known-good working tree with
   `npx wrangler pages deploy .`, from the external operator workstation.
3. If a flow URL is implicated, regenerate its SAS signature in Power Automate, paste the new
   URL into the matching key in config/config.local.js or document-portal/config.local.js, and
   redeploy. Rotating the signature is what revokes the exposed URL; a Pages rollback alone
   does not.
4. If public intake must stop, blank the SUBMISSION key in document-portal/config.local.js
   (the portal falls back to demo mode) and redeploy, or regenerate the SUBMISSION flow's
   signature to revoke the published URL. Record the action outside Git.
5. Do not reset the registry reference sequence; it lives in the SUBMISSION flow and
   SharePoint, and reissuing a used number is the failure the design prevents.
6. Re-run the Part G verification sequence (G1-G8) and capture sanitized results.
