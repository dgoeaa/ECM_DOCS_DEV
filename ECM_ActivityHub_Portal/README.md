# DG/CEO Executive Operations SPA (No Build Tools)

This is a full single-page application (SPA) implemented using:
- Plain HTML + Tailwind (CDN)
- Plain JavaScript ES modules (no React/Vite)
- Lucide icons (CDN)
- A single backend endpoint configured via `js/core/config.js` (API_URL)

## Run locally
ES modules require HTTP(S). Use any static server, e.g.:

- Python: `python -m http.server 8080`
- Open: `http://localhost:8080/DGCEO%20SPA.html`

## Configure backend
Edit `js/core/config.js`:
- Set `CONFIG.API_URL` to your secured API gateway / Power Automate HTTP-trigger endpoint.

The SPA sends envelopes:
```json
{
  "action": "INBOX_LIST",
  "user": "dgceo@nitda.gov.ng",
  "role": "DGCEO",
  "timestamp": "2025-12-24T00:00:00.000Z",
  "payload": { "filters": { ... } }
}
```

Backend should reply with either:
- `{ "data": <payload> }` or `<payload>` directly.

Expected bootstrap response:
```json
{
  "ref": { "departments": [], "people": [] },
  "entities": { "inbox": [], "inward": [], "outward": [], "minutes": [], "approvals": [], "briefs": [], "decisions": [], "meetings": [], "tasks": [], "projects": [], "kpi": { "snapshot": [] }, "notifications": [], "audit": [], "sla": { "metrics": [] }, "directory": [] }
}
```

## Demo fallback
If API_URL is not configured or the backend fails, the SPA loads demo data (configurable via `CONFIG.DEMO_FALLBACK`).
