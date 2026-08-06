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
| `Deployed - Create Task — Flow Run Record — 08584160987852269791356030937CU197 (2)/Deployed - Create Task__08584160987852269791356030937CU197__flow_run_record.json` | `deployed_create_task__08584160987852269791356030937CU197/record.json` |
| `Deployed - Create Task — Flow Run Record — 08584160987852269791356030937CU197 (2)/Deployed - Create Task__08584160987852269791356030937CU197__flow_run_record_schema.json` | `deployed_create_task__08584160987852269791356030937CU197/record_schema.json` |
| `Deployed - Create Task — Flow Run Record — 08584160987852269791356030937CU197 (2)/Deployed - Create Task__08584160987852269791356030937CU197__full_definition.json` | `deployed_create_task__08584160987852269791356030937CU197/definition.json` |
| `Deployed - Create Task — Flow Run Record — 08584160987852269791356030937CU197 (2)/Deployed - Create Task__08584160987852269791356030937CU197__trigger_input_schema.json` | `deployed_create_task__08584160987852269791356030937CU197/trigger_schema.json` |
| `Deployed - Create Task — Flow Run Record — 08584160987852269791356030937CU197 (2)/Deployed - Create Task__08584160987852269791356030937CU197__varResponse.json` | `deployed_create_task__08584160987852269791356030937CU197/response.json` |
| `Deployed - Create Task — Flow Run Record — 08584160987852269791356030937CU197 (2)/Download PowerAutomate_SP_Audit_AI_Machine_Build_Spec.md` | `deployed_create_task__08584160987852269791356030937CU197/build_spec.md` |
| `Deployed Bulk Task Assignment_Create Task — Flow Run Record — 08584160940563880480924374615CU64/Deployed Bulk Task Assignment_Create Task__08584160940563880480924374615CU64__flow_run_record.json` | `deployed_bulk_task_assignment_create_task__08584160940563880480924374615CU64/record.json` |
| `Deployed Bulk Task Assignment_Create Task — Flow Run Record — 08584160940563880480924374615CU64/Deployed Bulk Task Assignment_Create Task__08584160940563880480924374615CU64__flow_run_record_schema.json` | `deployed_bulk_task_assignment_create_task__08584160940563880480924374615CU64/record_schema.json` |
| `Deployed Bulk Task Assignment_Create Task — Flow Run Record — 08584160940563880480924374615CU64/Deployed Bulk Task Assignment_Create Task__08584160940563880480924374615CU64__full_definition.json` | `deployed_bulk_task_assignment_create_task__08584160940563880480924374615CU64/definition.json` |
| `Deployed Bulk Task Assignment_Create Task — Flow Run Record — 08584160940563880480924374615CU64/Deployed Bulk Task Assignment_Create Task__08584160940563880480924374615CU64__trigger_input_schema.json` | `deployed_bulk_task_assignment_create_task__08584160940563880480924374615CU64/trigger_schema.json` |
| `Deployed Bulk Task Assignment_Create Task — Flow Run Record — 08584160940563880480924374615CU64/Deployed Bulk Task Assignment_Create Task__08584160940563880480924374615CU64__varResponse.json` | `deployed_bulk_task_assignment_create_task__08584160940563880480924374615CU64/response.json` |
| `Fetch_Emails_POST — Flow Run Record — 08584160938057055146646161713CU198/Fetch_Emails_POST__08584160938057055146646161713CU198__flow_run_record.json` | `fetch_emails_post__08584160938057055146646161713CU198/record.json` |
| `Fetch_Emails_POST — Flow Run Record — 08584160938057055146646161713CU198/Fetch_Emails_POST__08584160938057055146646161713CU198__flow_run_record_schema.json` | `fetch_emails_post__08584160938057055146646161713CU198/record_schema.json` |
| `Fetch_Emails_POST — Flow Run Record — 08584160938057055146646161713CU198/Fetch_Emails_POST__08584160938057055146646161713CU198__full_definition.json` | `fetch_emails_post__08584160938057055146646161713CU198/definition.json` |
| `Fetch_Emails_POST — Flow Run Record — 08584160938057055146646161713CU198/Fetch_Emails_POST__08584160938057055146646161713CU198__trigger_input_schema.json` | `fetch_emails_post__08584160938057055146646161713CU198/trigger_schema.json` |
| `Fetch_Emails_POST — Flow Run Record — 08584160938057055146646161713CU198/Fetch_Emails_POST__08584160938057055146646161713CU198__varResponse.json` | `fetch_emails_post__08584160938057055146646161713CU198/response.json` |
| `Web - Email Task Created — Flow Run Record — 08584160936199347696097640638CU254/Web - Email Task Created__08584160936199347696097640638CU254__flow_run_record.json` | `web_email_task_created__08584160936199347696097640638CU254/record.json` |
| `Web - Email Task Created — Flow Run Record — 08584160936199347696097640638CU254/Web - Email Task Created__08584160936199347696097640638CU254__flow_run_record_schema.json` | `web_email_task_created__08584160936199347696097640638CU254/record_schema.json` |
| `Web - Email Task Created — Flow Run Record — 08584160936199347696097640638CU254/Web - Email Task Created__08584160936199347696097640638CU254__full_definition.json` | `web_email_task_created__08584160936199347696097640638CU254/definition.json` |
| `Web - Email Task Created — Flow Run Record — 08584160936199347696097640638CU254/Web - Email Task Created__08584160936199347696097640638CU254__trigger_input_schema.json` | `web_email_task_created__08584160936199347696097640638CU254/trigger_schema.json` |
| `Web - Email Task Created — Flow Run Record — 08584160936199347696097640638CU254/Web - Email Task Created__08584160936199347696097640638CU254__varResponse.json` | `web_email_task_created__08584160936199347696097640638CU254/response.json` |
| `Flow Definition  DGSO INCOMING AI PROCESSING Flow-DGO SharePoint Provisioning Report _ 2026-08-04 15_55 UTC _ Lists Validated_ (1)/FLM_Get_Current_Flow_DefinitionRawJson_20260804_155500_UTC.json` | `dgso_incoming_ai_processing_provisioning_report_2026-08-04_1/definition_raw.json` |
| `Flow Definition  DGSO INCOMING AI PROCESSING Flow-DGO SharePoint Provisioning Report _ 2026-08-04 15_55 UTC _ Lists Validated_ (1)/FLM_Get_Current_Flow_MetaJson_20260804_155500_UTC.json` | `dgso_incoming_ai_processing_provisioning_report_2026-08-04_1/meta.json` |
| `Flow Definition  DGSO INCOMING AI PROCESSING Flow-DGO SharePoint Provisioning Report _ 2026-08-04 15_55 UTC _ Lists Validated_ (1)/FLM_Get_Current_Flow_StandardHtml_20260804_155500_UTC.html` | `dgso_incoming_ai_processing_provisioning_report_2026-08-04_1/standard.html` |
| `Flow Definition  DGSO INCOMING AI PROCESSING Flow-DGO SharePoint Provisioning Report _ 2026-08-04 15_55 UTC _ Lists Validated_ (1)/PowerAutomate_SP_Audit_Flow_Guide.html` | `dgso_incoming_ai_processing_provisioning_report_2026-08-04_1/flow_guide.html` |
| `Flow Definition  DGSO INCOMING AI PROCESSING Flow-DGO SharePoint Provisioning Report _ 2026-08-04 15_55 UTC _ Lists Validated_ (2)/FLM_Get_Current_Flow_DefinitionRawJson_20260804_155500_UTC.json` | `dgso_incoming_ai_processing_provisioning_report_2026-08-04_2/definition_raw.json` |
| `Flow Definition  DGSO INCOMING AI PROCESSING Flow-DGO SharePoint Provisioning Report _ 2026-08-04 15_55 UTC _ Lists Validated_ (2)/FLM_Get_Current_Flow_MetaJson_20260804_155500_UTC.json` | `dgso_incoming_ai_processing_provisioning_report_2026-08-04_2/meta.json` |
| `Flow Definition  DGSO INCOMING AI PROCESSING Flow-DGO SharePoint Provisioning Report _ 2026-08-04 15_55 UTC _ Lists Validated_ (2)/FLM_Get_Current_Flow_StandardHtml_20260804_155500_UTC.html` | `dgso_incoming_ai_processing_provisioning_report_2026-08-04_2/standard.html` |

## Duplicate

`dgso_incoming_ai_processing_provisioning_report_2026-08-04_2` is a byte-identical
subset of `..._1` — the same three files, same checksums, one browser download
repeated. `..._1` additionally holds `flow_guide.html`. Kept as received; `_2` can
be deleted without losing anything.
