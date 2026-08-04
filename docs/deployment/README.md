# Deployment documentation

Two things, used together:

- **[`CLOUDFLARE.md`](./CLOUDFLARE.md)** — what to DO. A click-by-click walkthrough in nine
  parts (A to I), 273 numbered steps, from checking Node.js to reading the logs after
  go-live. Follow it top to bottom.
- **[`pilot-sanitized-template/`](./pilot-sanitized-template/README.md)** — what to RECORD.
  Registers for each flow regenerated, deleted or rebuilt, the value register, secret status
  and verification results. Fill these in as you work through CLOUDFLARE.md so the cutover
  leaves evidence rather than only an outcome.

The two are cross-referenced: the value register uses the same V1–V9 numbering as Part A of
the walkthrough, and the flow registers use the same workflow IDs as Part C.

The committed template tree contains placeholders only. Copy it outside the repository before entering any operational, internal, or personal data.
