# Flow decommission inventory

**Generated:** 2026-08-03 · **Source:** `scripts/flow-inventory.mjs`
**Scope:** every Power Automate workflow for which this repository contains a signed
(`sig=`) trigger URL.

## Why this file exists

Task #9 of the remediation plan is "decommission all 25 dev/pilot workflows and provision
replacements behind proxy egress". The egress half of that is no longer achievable — the
proxy has been removed and both clients call each flow directly — but the decommission half
is unchanged and is now the more important of the two. The obvious way to build that
checklist is to read the platform's endpoint configuration and list what it calls.

**That method covers 8 of the 25.**

`config/endpoints.config.js` no longer holds any URL — the SAS-signed URLs were removed from
it and the real values now live in `config/config.local.js`, which is git-ignored. The
working configuration therefore wires 8 workflows. The other 17 are not absent because
they were retired; they are absent because nothing in the current tree happens to reference
them. They remain deployed in the Power Platform environment and their trigger URLs remain
valid.

Their signed URLs *were* published in `ECM_DOCS_DEV.zip`. That file has since been removed
from the tree — which changed nothing about the flows. The URLs are still in git history and
every one of them still works. Only regenerating or deleting the trigger changes that.

A signed Power Automate trigger URL is a bearer credential: possession is authorisation.
Deleting the file that contains one does not revoke it and neither does rewriting history.
**Only regenerating the trigger URL in Power Automate revokes it.**

### 25 workflows, 31 signatures

`tests/check-secrets.mjs` reports 31 distinct signatures in the archive; this inventory
reports 25 workflows. Both are right, and the difference is the point: **six workflows carry
two signatures each.** That is a trigger that was regenerated at some stage, with the
superseded signature still published alongside its replacement.

It matters for step 2 below. Regenerating a trigger once and moving on leaves those six
flows reachable through the other signature. Confirm per flow that no other signature
remains valid, not merely that you regenerated it.

## The inventory

Workflow IDs are identifiers, not secrets — they are what an administrator searches on in the
Power Platform admin centre. The `sig` tokens are deliberately not reproduced here.

### Wired by the current working configuration (8)

| Workflow ID | Endpoint key(s) | Config | Archive copies |
|---|---|---|---|
| `02a3a70f3dec4dcd9a85a244a60c65b9` | `API_GET` | wired | 2 |
| `1154b50e1d17420dadb3b012e7e2a02c` | `BULK_ASSIGNMENT` | wired | 5 |
| `37642ba3597f4cf58288cc71b5e6b519` | — | wired | 4 |
| `3931e2ff995242b6b2c920c8b2209797` | — | wired | 3 |
| `6b3bad3005b44bf6bced0f8074d3f2ed` | `SINGLE_ASSIGNMENT` | wired | 6 |
| `7e71fffe770a45ccb93bf216bb53786e` | `BULK_ASSIGNMENT_DIRECT` | wired | 6 |
| `818ec4053f1e4f0b87845114241d8b74` | `GET_DOCS` | wired | 6 |
| `ff455c68e9ac493e858fb984bcfd01fb` | — | wired | 4 |

### Present only in `ECM_DOCS_DEV.zip` (17)

These are the ones a config-derived checklist misses.

| Workflow ID | Endpoint key(s) | Config | Archive copies |
|---|---|---|---|
| `1ff7714c11a74fa4a876f8f6a79b64d2` | — | not wired | 1 |
| `20e3b003a57f47febae8a24ad5b9acd4` | `AI_DOC_ANALYSIS` | not wired | 4 |
| `20e6340941ce4b1bbb87b43c9102a777` | `FETCH_EMAIL_ATTACHMENTS` | not wired | 4 |
| `314aaf27593147089b38322e5ca25936` | `OTP_GENERATE` | not wired | 5 |
| `3fc71cc29d15481291fd341def327572` | — | not wired | 1 |
| `43879c5165de439680055ab4258b3f27` | `OTP_VERIFY` | not wired | 5 |
| `4a250f97181b4a28abc1d0fb0f7d4c4d` | `FETCH_ALL` | not wired | 5 |
| `5b29edc84b5d4a8db3c885d8441aa977` | — | not wired | 1 |
| `7995c1eb50d94d5daa2780e71391d874` | — | not wired | 1 |
| `85c556f10b8244ba9d839a2ebe240b91` | `FETCH_ACTIVITIES`, `SUBSIDIARY_ACTIONS` | not wired | 5 |
| `a13c8b577bd44f8787c50d095ea3faf9` | `AI_CHAT` | not wired | 4 |
| `a942d230337c4ddfa9a386e92bbd048b` | `EMAIL_RELATED_TASK` | not wired | 4 |
| `bc83d98acf474a088832d78f50085388` | `DYNAMIC_ACTIONS`, `EMAIL` | not wired | 6 |
| `c43388639d14452faef4ca3042a95b23` | — | not wired | 1 |
| `ca0bafc172114e0bb4853c135246654c` | — | not wired | 1 |
| `d67f2acb3708449490eed561ee56efbe` | `REFERENCE_DATA` | not wired | 4 |
| `fe794e0139784ac694768e5a716e0be7` | `AI_EMAIL_ANALYSIS` | not wired | 4 |

## Endpoint keys with no signed URL anywhere

`config/endpoints.config.js` declares 17 endpoint keys. Several resolve to workflows above;
the rest have no signed URL in the repository at all, which means either the flow was never
built or its URL only ever existed in someone's local config. Both cases need an answer
before cutover, because an endpoint the platform calls and nobody can account for is either
dead code or an undocumented dependency.

## What to do with this list

1. **Reconcile.** For each of the 25, confirm in the Power Platform admin centre whether the
   flow still exists and is enabled. Expect some to be already-deleted.
2. **Rotate or delete, do not merely unwire.** Removing an endpoint from configuration leaves
   the flow running and its published URL valid.
3. **Re-provision flows that defend themselves.** Per `docs/architecture/AUTHENTICATION_CONTRACT.md` §2, every
   replacement is callable from a browser — there is no longer anything in front of it — so
   each must validate the token, derive the role, authorise the action, validate its input and
   rate-limit its callers itself. Rotate its signature on a schedule; regenerating is the only
   way to revoke.
4. **Re-run `scripts/flow-inventory.mjs`** afterwards. It should report zero.

## Verification

`tests/secret-exposure.test.mjs` fails if a full-length signed trigger URL appears in any
**tracked** file. It currently fails against `ECM_DOCS_DEV.zip` by design — that failure is
the finding, and it clears when the archive's disposition is settled (see
`docs/cutover/ARCHIVE_DISPOSITION.md`).
