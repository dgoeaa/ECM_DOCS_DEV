# Risk acceptance template

## Scope

- Pilot month: `YYYY-MM`
- Deployment manifest reference: `control/deployment-manifest.yaml`

## Risks to review

1. Power Automate trigger inventory may drift if rebuilt flows are not re-registered.
2. Secrets must remain in Cloudflare Worker secrets or an approved vault only.
3. Access-group claim errors can silently downgrade users to `viewer`.
4. Verification evidence may contain internal or personal data and must remain outside Git.

## Approval

- Decision: `null`
- Approved by: `OUTSIDE_GIT`
- Approved at UTC: `null`
- Notes: `REDACTED`
