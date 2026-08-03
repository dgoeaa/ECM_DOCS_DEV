# Power Automate Rotation Register

**Generated from the repository at `9deda9e`.** Signature *values* are deliberately excluded —
reproducing a credential to evidence it is what caused finding F-003. Each row names the
**workflow GUID**, which is the identifier you need in Power Automate to regenerate the URL.

---

## Scope

| | |
|---|---:|
| Distinct Power Automate workflows | **25** |
| Distinct signatures across all of them | **31** |
| Workflows already re-signed at least once | **6** |
| Still present in tracked files at HEAD | **2 files, 4 signatures** |

Six workflows carry more than one signature. That means the URL was regenerated at some
point and **the superseded signature is still in the archive** — evidence that rotation alone
does not clean the tree, and that the tree does not tell you what is current.

---

## Register

Rotate every row. A signature is a bearer credential: possession authorises invoking the flow.

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

## Procedure

1. **Regenerate** the HTTP trigger URL for each workflow above in Power Automate.
2. **Update** `config/config.local.js` and `ECM_ActivityHub_Portal/config.local.js` — both git-ignored.
3. **Bump `CACHE`** in `document-portal/sw.js`. It is cache-first over the endpoint file, so returning
   visitors stay pinned to the old URL until the constant changes. Miss this and the portal breaks
   for exactly the people who used it before.
4. **Only then** remove the values from tracked files. Deleting first revokes nothing.
5. **Shrink** `tests/secrets-baseline.txt` as each file is cleaned — the ratchet fails if a baselined
   file no longer carries a signature, so the list cannot drift.

> The durable fix is architectural: once the proxy holds the credentials
> (`TARGET_ARCHITECTURE.md` §3.1), no signed URL reaches a browser and this register cannot recur.

