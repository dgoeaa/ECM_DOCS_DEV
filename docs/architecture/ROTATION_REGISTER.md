# Power Automate Workflow Register — decommission and replacement checklist

**Generated from the repository at `9deda9e`.** Signature *values* are deliberately excluded —
reproducing a credential to evidence it is what caused finding F-003. Each row names the
**workflow GUID**, which is the identifier you need in Power Automate to find the flow.

> **Owner decision (recorded).** These endpoints are development and pilot infrastructure.
> They are **not being rotated in place — they are to be replaced entirely** once the build is
> complete to the owner's satisfaction.
>
> That changes what this document is for. It is no longer a rotation queue; it is the
> **inventory of what must be decommissioned at cutover**, and it is the only place the full
> set is enumerated. Nine of the 31 signatures appear *nowhere but the archive*, so the
> workflows at rows carrying them would be missed by anyone working from the source tree.
>
> **Replacement only revokes anything if the old triggers stop existing.** A new production
> flow standing beside a still-enabled pilot flow leaves every leaked signature live. The
> deliverable at cutover is therefore *deleted or regenerated*, per row, for all 25 — not
> *superseded*.

---

## Scope

| | |
|---|---:|
| Distinct Power Automate workflows | **25** |
| Distinct signatures across all of them | **31** |
| Workflows already re-signed at least once | **6** |
| Still present in tracked files at HEAD | **2 files, 4 signatures** |

Six workflows carry more than one signature. That means the URL was regenerated at some point
and **the superseded signature is still in the archive** — evidence that regenerating a URL
does not clean the tree, and that the tree does not tell you what is current. It is also the
reason this register is keyed on the workflow GUID rather than on the URL: the GUID is stable
across regenerations, so it is the only identifier that lets you confirm coverage.

---

## Register

Every row must be accounted for at cutover. A signature is a bearer credential: possession
authorises invoking the flow, with no authentication step to fail.

| # | Workflow GUID | Sigs | Known as | Where it appears |
|---:|---|---:|---|---|
| 1 | `314aaf27593147089b38322e5ca25936` | 2 | — | 5 archive members |
| 2 | `37642ba3597f4cf58288cc71b5e6b519` | 2 | FETCH_ACTIVITIES | 4 archive members |
| 3 | `3931e2ff995242b6b2c920c8b2209797` | 2 | SUBSIDIARY_ACTIONS (emails) | 3 archive members |
| 4 | `43879c5165de439680055ab4258b3f27` | 2 | — | 5 archive members |
| 5 | `4a250f97181b4a28abc1d0fb0f7d4c4d` | 2 | FETCH_ALL | 5 archive members |
| 6 | `ff455c68e9ac493e858fb984bcfd01fb` | 2 | REFERENCE_DATA | 4 archive members |
| 7 | `02a3a70f3dec4dcd9a85a244a60c65b9` | 1 | newack API_GET | **tracked: `newack/config.js`** + 2 archive |
| 8 | `1154b50e1d17420dadb3b012e7e2a02c` | 1 | BULK_ASSIGNMENT | 5 archive members |
| 9 | `1ff7714c11a74fa4a876f8f6a79b64d2` | 1 | document-portal submission | **tracked: `document-portal/js/data.js`** + 1 archive |
| 10 | `20e3b003a57f47febae8a24ad5b9acd4` | 1 | — | 4 archive members |
| 11 | `20e6340941ce4b1bbb87b43c9102a777` | 1 | — | 4 archive members |
| 12 | `3fc71cc29d15481291fd341def327572` | 1 | document-portal support | **tracked: `document-portal/js/data.js`** + 1 archive |
| 13 | `5b29edc84b5d4a8db3c885d8441aa977` | 1 | — | archive: DGO_Targets_References/NITDA_DGCEO_DOCOPS_EXEC_UI_PROD_v13_fixed_dropdowns_actions_responsive.html |
| 14 | `6b3bad3005b44bf6bced0f8074d3f2ed` | 1 | SINGLE_ASSIGNMENT | 6 archive members |
| 15 | `7995c1eb50d94d5daa2780e71391d874` | 1 | — | archive: DGO_Targets_References/NITDA_DGCEO_DOCOPS_EXEC_UI_PROD_v13_fixed_dropdowns_actions_responsive.html |
| 16 | `7e71fffe770a45ccb93bf216bb53786e` | 1 | BULK_ASSIGNMENT_DIRECT | 6 archive members |
| 17 | `818ec4053f1e4f0b87845114241d8b74` | 1 | GET_DOCS | 6 archive members |
| 18 | `85c556f10b8244ba9d839a2ebe240b91` | 1 | SUBSIDIARY_ACTIONS | 5 archive members |
| 19 | `a13c8b577bd44f8787c50d095ea3faf9` | 1 | — | 4 archive members |
| 20 | `a942d230337c4ddfa9a386e92bbd048b` | 1 | — | 4 archive members |
| 21 | `bc83d98acf474a088832d78f50085388` | 1 | — | 6 archive members |
| 22 | `c43388639d14452faef4ca3042a95b23` | 1 | — | archive: DGO_Targets_References/Flows/Flow/Deployed Bulk Task Assignment_Create Task__08584160940563880480924374615CU64__flow_run_record.json |
| 23 | `ca0bafc172114e0bb4853c135246654c` | 1 | document-portal tracking | **tracked: `document-portal/js/data.js`** + 1 archive |
| 24 | `d67f2acb3708449490eed561ee56efbe` | 1 | REFERENCE_DATA | 4 archive members |
| 25 | `fe794e0139784ac694768e5a716e0be7` | 1 | — | 4 archive members |

---

## Cutover procedure

Nothing here is urgent while the platform is in development against these endpoints. All of it
is required **before the replacement set carries anything real**.

1. **Account for all 25.** For each row, either **delete** the flow or **regenerate** its HTTP
   trigger URL. Superseding a pilot flow with a new production one does not revoke the pilot's
   signature — the old trigger keeps answering until it is removed or re-signed. This is the
   step the register exists for, and the nine archive-only signatures are why working from the
   source tree is not sufficient.
2. **Provision the replacement flows behind the proxy's egress only.** Private endpoint or
   IP restriction, so a leaked URL is not sufficient to invoke them even if one escapes again.
   See `TARGET_ARCHITECTURE.md` §3.1 — this is what makes the replacement durable rather than
   a one-time cleanup.
3. **Supply the new URLs server-side only** — the proxy's `DGO_ENDPOINT_*` environment. They
   must not enter `config/config.local.js` for any component that ships to a browser.
4. **Confirm no client holds one.** The document portal already holds no credential (step 5);
   the root platform and the ECM Activity Hub route through the proxy once auth is enabled
   (step 8). `npm run test:secrets` and `tests/auth-posture.test.mjs` are the checks.
5. **Leave the archive out of the replacement set.** `ECM_DOCS_DEV.zip` is a reference archive,
   not source. Its nine unique signatures name flows to decommission; the archive itself should
   move out of the repository (decision **D5**).

**What is already true, and is why this can wait.** The architecture no longer depends on any
of these URLs staying secret. The portal holds none. The proxy holds them in server-side
configuration and hands out none. Every route added in steps 3–7 was built so that a credential
never reaches a client. That is what turns "replace the URLs" from a recurring chore into a
one-time decommission — this register should never need a second edition.

