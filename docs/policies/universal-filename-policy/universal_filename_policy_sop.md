# Universal Filename Policy — SOP

- **Version:** v1.0
- **Effective date:** 2026-06-16
- **Owner:** Document Control / Operations

## Purpose
This policy establishes one universal filename standard for documents, records, reports, templates, and shared artifacts so files remain readable, sortable, system-safe, automation-friendly, and consistent across teams, devices, repositories, and time.

## Mandatory filename pattern
```text
subject_document_type[_descriptor][_v#][_yyyy-mm-dd]
```

## Validation regex
```regex
^[a-z0-9]+(?:_[a-z0-9]+)*(?:_v[0-9]+(?:_[0-9]+)?)?(?:_[0-9]{4}-[0-9]{2}-[0-9]{2})?$
```

## Rules
1. Use lowercase only.
2. Use underscores between words.
3. Permit letters a-z and numbers 0-9; use hyphens only inside a terminal ISO date token (yyyy-mm-dd).
4. Order filenames as: subject, document type, optional descriptor, optional version, optional date.
5. Prefer concise, descriptive names; target 3 to 8 tokens where practical.
6. Avoid vague terms such as final, latest, new, misc, updated, use_this_one.
7. Use version tags as v1, v2, v3 or minor versions as v1_1, v1_2.
8. Use dates only when useful, and always as yyyy-mm-dd at the end of the filename.
9. Do not use spaces or prohibited punctuation such as / \ : * ? " < > | ( ) [ ] { } & % # @ ! , ; '.
10. Keep the most important identifier first for human scanning and alphabetical grouping.

## Procedure
1. Convert the full filename body to lowercase.
2. Replace spaces and separators with underscores.
3. Remove prohibited punctuation and duplicate separators.
4. Standardize wording to concise subject + document type + optional descriptor.
5. Append version if the file is controlled or revised.
6. Append terminal date only when operationally useful.
7. Validate against the policy regex before saving or publishing.

## Approved examples
- `unified_hub_requirements_hybrid`
- `unified_hub_requirements_hybrid_v1`
- `unified_hub_requirements_hybrid_v1_2026-06-16`
- `ai_session_operating_rules_v1`
- `system_directive_architecture_audit_v1_2026-06-16`
- `client_proposal_v3_2026-06-16`
- `security_audit_v2`
- `meeting_minutes_v1_2026-06-16`

## Prohibited examples
- `Unified Hub Business Requirements Document (BRD) / Functional Requirements Document (FRD) Hybrid`
- `AI session mandatory operating rules FINAL`
- `SYSTEM DIRECTIVE: SYSTEMATIC ARCHITECTURE AND STRUCTURAL AUDIT`
- `document_new_latest_final2`
- `project plan draft!!.docx`

## Session examples normalized
- `Unified_Hub_Business Requirements Document (BRD) / Functional Requirements Document (FRD) Hybrid` -> `unified_hub_requirements_hybrid`
- `AI session mandatory operating rules` -> `ai_session_mandatory_operating_rules`
- `SYSTEM DIRECTIVE: SYSTEMATIC ARCHITECTURE AND STRUCTURAL AUDIT` -> `system_directive_systematic_architecture_structural_audit`

## Compliance statement
All files created, revised, shared, archived, or automated under this standard must comply unless an exception is explicitly approved and documented.
