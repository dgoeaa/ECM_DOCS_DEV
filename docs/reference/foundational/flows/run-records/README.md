# Flow run records

Power Automate run exports, one directory per run. The directory carries the
flow name and run id; the files inside are named for what they are.

These paths were shortened so the repository ZIP extracts on Windows and on
mobile devices — the originals reached 271 characters, past the 260-character
`MAX_PATH` limit that Windows Explorer and most mobile unzip tools enforce.
The flow name and run id were repeated in both the directory and every file
inside it; the leaf now states only which artefact it is. Em dashes and spaces
went with them, per the Universal Filename Policy
(`universal_filename_policy_deliverables/universal_filename_policy_sop.md`).

`tests/package-portability.test.mjs` holds the line.

## Original names

| Original path | Now |
|---|---|
| `Deployed - Create Task — Flow Run Record — 08584160987852269791356030937CU197 (2)/Deployed - Create Task__08584160987852269791356030937CU197__full_definition.json` | `deployed_create_task__08584160987852269791356030937CU197/definition.json` |
| `Deployed - Create Task — Flow Run Record — 08584160987852269791356030937CU197 (2)/Deployed - Create Task__08584160987852269791356030937CU197__trigger_input_schema.json` | `deployed_create_task__08584160987852269791356030937CU197/trigger_schema.json` |
| `Deployed - Create Task — Flow Run Record — 08584160987852269791356030937CU197 (2)/Deployed - Create Task__08584160987852269791356030937CU197__varResponse.json` | `deployed_create_task__08584160987852269791356030937CU197/response.json` |
| `Deployed Bulk Task Assignment_Create Task — Flow Run Record — 08584160940563880480924374615CU64/Deployed Bulk Task Assignment_Create Task__08584160940563880480924374615CU64__full_definition.json` | `deployed_bulk_task_assignment_create_task__08584160940563880480924374615CU64/definition.json` |
| `Deployed Bulk Task Assignment_Create Task — Flow Run Record — 08584160940563880480924374615CU64/Deployed Bulk Task Assignment_Create Task__08584160940563880480924374615CU64__trigger_input_schema.json` | `deployed_bulk_task_assignment_create_task__08584160940563880480924374615CU64/trigger_schema.json` |
| `Deployed Bulk Task Assignment_Create Task — Flow Run Record — 08584160940563880480924374615CU64/Deployed Bulk Task Assignment_Create Task__08584160940563880480924374615CU64__varResponse.json` | `deployed_bulk_task_assignment_create_task__08584160940563880480924374615CU64/response.json` |
| `Fetch_Emails_POST — Flow Run Record — 08584160938057055146646161713CU198/Fetch_Emails_POST__08584160938057055146646161713CU198__trigger_input_schema.json` | `fetch_emails_post__08584160938057055146646161713CU198/trigger_schema.json` |
| `Web - Email Task Created — Flow Run Record — 08584160936199347696097640638CU254/Web - Email Task Created__08584160936199347696097640638CU254__full_definition.json` | `web_email_task_created__08584160936199347696097640638CU254/definition.json` |
| `Web - Email Task Created — Flow Run Record — 08584160936199347696097640638CU254/Web - Email Task Created__08584160936199347696097640638CU254__trigger_input_schema.json` | `web_email_task_created__08584160936199347696097640638CU254/trigger_schema.json` |
| `Web - Email Task Created — Flow Run Record — 08584160936199347696097640638CU254/Web - Email Task Created__08584160936199347696097640638CU254__varResponse.json` | `web_email_task_created__08584160936199347696097640638CU254/response.json` |
| `Flow Definition  DGSO INCOMING AI PROCESSING Flow-DGO SharePoint Provisioning Report _ 2026-08-04 15_55 UTC _ Lists Validated_ (1)/FLM_Get_Current_Flow_DefinitionRawJson_20260804_155500_UTC.json` | `dgso_incoming_ai_processing_provisioning_report_2026-08-04_1/definition_raw.json` |
| `Flow Definition  DGSO INCOMING AI PROCESSING Flow-DGO SharePoint Provisioning Report _ 2026-08-04 15_55 UTC _ Lists Validated_ (1)/FLM_Get_Current_Flow_StandardHtml_20260804_155500_UTC.html` | `dgso_incoming_ai_processing_provisioning_report_2026-08-04_1/standard.html` |

## What is no longer here

The recorded executions themselves — `record.json` in each directory, and the
`__flow_run_record.json` files that sat beside the definitions — have been
deleted, along with the ten byte-identical copies of `record_schema.json`.

This applies the principle `docs/cutover/ARCHIVE_DISPOSITION.md` already
settled for `ECM_DOCS_DEV.zip`: **the flow contracts are kept, the recorded
executions are not.** A run record is one execution's inputs, outputs and
action-by-action trace on one day; it is evidence of a run, not a statement of
what the flow promises. The definition, the trigger schema and one response
sample per flow say everything a rebuild needs, and they are all still here.

What each directory keeps:

| File | Why |
|---|---|
| `definition.json` / `definition_raw.json` | the flow itself — the contract |
| `trigger_schema.json` | what the flow accepts |
| `response.json` | one response, kept as the shape exemplar for this flow |
| `standard.html` | the rendered provisioning report |

The single canonical run-record schema now lives at
`docs/reference/flow-contracts/flow_run_record_schema.json`, once, rather than
ten identical times.

Nothing is unrecoverable: every deleted file remains in git history, and no
workflow id lost its signed trigger URL — `scripts/lib/endpoint-recovery.mjs`
resolves the same 39 workflow ids from the retained corpus that it did before.
