# Identity and role assignment — the flow contracts

What Power Automate must do so that authentication and authorisation are real. No external
identity provider, no proxy: the flows are the only place a caller can be checked, so they are
the only place this can live.

Three flows and one list. Two of the flows already exist and are already wired.

| | Flow | Status |
|---|---|---|
| identity | `OTP_GENERATE` | exists, wired — needs the response contract below |
| identity | `OTP_VERIFY` | exists, wired — needs to mint a proof |
| directory | `FETCH_ALL` | exists, wired — needs to return `users` |
| register | `DGO_UserDirectory` | provisioned by `scripts/setup-sharepoint.ps1` |

---

## 1 · `OTP_GENERATE` — mail a code

**Request**

```json
{ "operation": "requestOtp", "email": "officer@nitda.gov.ng" }
```

**Response**

```json
{ "sent": true, "expiresAt": "2026-08-05T09:12:00Z" }
```

**Obligations**

- Look the address up in `DGO_UserDirectory`. **An address that is not in the directory, or
  whose `Status` is not `active`, must be treated exactly like one that is** — same
  response, same timing. Answering differently turns this flow into an oracle that
  enumerates who works at the agency.
- Store the code hashed, with an expiry (10 minutes is ample) and an attempt counter.
- Rate-limit per address and per source.
- Report `"sent": false` honestly when the mail could not be delivered. Do not tell someone
  to check an inbox nothing was sent to.

---

## 2 · `OTP_VERIFY` — exchange the code for a proof

**Request**

```json
{ "operation": "verifyOtp", "email": "officer@nitda.gov.ng", "code": "418209" }
```

**Response**

```json
{
  "ok": true,
  "token": "<signed proof>",
  "expiresAt": 1786000000000,
  "claims": {
    "preferred_username": "officer@nitda.gov.ng",
    "name": "A. Officer",
    "roles": ["director"]
  }
}
```

**Obligations**

- Compare in constant time. Expire and single-use the code. Cap attempts, then invalidate.
- **Resolve the role from `DGO_UserDirectory`, not from anything the client sent.** This is
  the whole point: the role in `claims.roles` is the server's statement about the caller.
- Refuse a caller whose `Status` is not `active`, and say only that the code was not
  accepted.
- Mint `token` as something you can verify later without state — an HMAC over
  `email | role | expiry` with a secret held in the flow is sufficient and needs no library.
  It must carry its own expiry and must not be forgeable by the browser.
- On rejection answer `{ "ok": false, "reason": "..." }` with no detail about which half was
  wrong.

`claims.roles` maps onto platform roles through `AuthConfig.roleClaimMap`, exactly as an
identity provider's group claim would. Set it at deploy time:

```
DGO_AUTH_ENABLED=true
DGO_AUTH_ROLE_SOURCE=claims
```

with `roleClaimMap` mapping each directory `Role` value to itself (`{"director":"director", …}`)
or to whatever vocabulary you prefer in the list.

---

## 3 · Every governed flow — verify the proof

The client sends `Authorization: Bearer <proof>` on every governed call once
`auth.enabled` is true. Each flow must, **before doing anything else**:

1. Verify the proof's signature and expiry.
2. Re-read the caller's `Role` and `Status` from `DGO_UserDirectory`. Do not trust a role
   carried in the proof body beyond the signature that covers it, and never trust
   `userEmail` in the request — that field stops being sent under enforcement.
3. Check the action against the role. `docs/reference/role-catalogue-seed.json` holds the
   permission and route sets, generated from `config/rbac.config.js`; seed it into
   `DGO_RoleCatalogue` and read it, so client and flow decide from one table.
4. Refuse with `401` when the proof is missing, expired or invalid, and `403` when the role
   does not permit the action. The client treats these differently.

Until this is done, `auth.enabled: true` changes only what the browser sends. It is the
client half. **Nothing is enforced by a client.**

---

## 4 · `FETCH_ALL` — return the directory

The platform already ingests a `users` collection from `FETCH_ALL`; it just has to be
populated from `DGO_UserDirectory`.

```json
{
  "docs":  [ … ],
  "tasks": [ … ],
  "users": [
    {
      "UserId": "u-1042",
      "FullName": "A. Officer",
      "Email": "officer@nitda.gov.ng",
      "Directorate": "Registry",
      "Role": "director",
      "Persona": "registry",
      "Status": "active",
      "AccessScope": "[\"Registry\"]"
    }
  ]
}
```

Return the SharePoint internal names as-is — `core/domain.js` `normalizeUser` reads them
directly, alongside the lower-case and Microsoft Graph forms.

**Two behaviours worth stating, because both were bugs:**

- **Return the collection even when it is empty.** `users: []` tells the platform the
  directory answered and nobody matched, which resolves the caller to `viewer` /
  `unregistered`. Omitting the key means "unchanged", and if no directory has *ever*
  answered the platform falls back to a bootstrap administrator so a fresh install can
  boot. Empty and absent are different facts.
- **Scope the collection to what the caller may see.** It is delivered to their browser.

---

## 5 · `DYNAMIC_ACTIONS` — role assignment writes

The User Administration workspace already posts these; nothing handles them yet.

```json
{ "operation": "user-admin:assign-role", "module": "user-admin",
  "user": { "email": "…", "role": "operator", "persona": "registry", "status": "active" } }
```

Operations: `create-user`, `update-user`, `assign-role`, `disable-user`.

**Obligations**

- Require `role:assign` on the CALLER, resolved server-side. A viewer must not be able to
  promote themselves by posting this payload — it is a plain HTTP call and anyone can send
  it.
- Write to `DGO_UserDirectory`, and append the before/after to `DGO_UserRoleHistory`. That
  list exists precisely so a role change is not a silent update.
- Refuse a role that is not in `DGO_RoleCatalogue`.
- Failures queue client-side in `PendingQueue` and retry, so a non-2xx is safe — but an
  ambiguous 200 that did not write is not. Answer honestly.

---

## Order of work

1. `npm run seed:roles` — regenerate the catalogue from the live RBAC config.
2. `./scripts/setup-sharepoint.ps1 -SiteUrl … -WhatIf`, then without `-WhatIf`. This now
   creates the lists, the 97 fields **and** the seed rows, including the six roles.
3. Populate `DGO_UserDirectory` with real officers.
4. Extend `FETCH_ALL` to return `users`. At this point role assignment is real for reading:
   the bootstrap administrator stops applying and roles come from the register.
5. Build the `OTP_GENERATE` / `OTP_VERIFY` contracts above.
6. Add proof verification to every governed flow, then set `DGO_AUTH_ENABLED=true`.

Steps 1–4 are worth doing on their own: they close the fail-open that granted every browser
`systemAdmin`, without touching authentication. Steps 5–6 are what make it enforcement.
