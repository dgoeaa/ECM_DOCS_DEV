# Evidence integrity and safe handling

Use this guidance only for the external private evidence directory copied from the sanitized templates.

## SHA-256 checksums

- Generate SHA-256 for each populated evidence file after capture and before handoff.
- Record the checksum beside the file path in `control/evidence-index.csv` or in an external checksum manifest required by your procedure.
- Recompute after any redaction or format conversion and record the new checksum with the reason.

Example command outside Git:

```bash
sha256sum path/to/evidence-file
```

## Safe handling rules

- Never commit generated checksums for placeholder files from this repository template.
- Never store raw Power Automate trigger URLs, `sig=` values, `DGO_UPLOAD_SECRET`, or `DGO_VERIFY_SECRET` in any template file.
- Use vault references such as `vault://pilot/...` wherever a secret or live endpoint must be tracked.
- Keep screenshots and exported logs in UTF-8-friendly filenames like `YYYY-MM-DDTHHMMSSZ-step-slug.png` and `YYYY-MM-DDTHHMMSSZ-step-slug.txt`.
- Redact officer identities, submitter content, cookies, JWTs, and authorization headers before sharing any excerpt.
