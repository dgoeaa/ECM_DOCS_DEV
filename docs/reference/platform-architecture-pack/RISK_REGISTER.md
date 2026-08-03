# Risk Register

## Risk 1: Flow URLs Exposed in Browser

Impact: Unauthorized triggering if endpoint is not restricted.  
Mitigation: Use Power Automate trigger restrictions where available, validate module/action pairs, avoid sensitive operations without authentication, monitor flow run history.

## Risk 2: Inconsistent Migrated Module Quality

Impact: Platform becomes difficult to maintain.  
Mitigation: Enforce module contract and migration checklist.

## Risk 3: Duplicated Logic Across Modules

Impact: Bugs and inconsistent behavior.  
Mitigation: Promote repeated logic to shared validators, transformers, and components.

## Risk 4: Shell Becomes Business-Logic Heavy

Impact: Future changes become risky.  
Mitigation: Keep shell generic. Business logic remains inside modules and flows.

## Risk 5: Power Automate Response Inconsistency

Impact: Modules handle errors differently.  
Mitigation: Standard response envelope and response normalizer.

## Risk 6: Stale Cached Files

Impact: Users run old config or old modules.  
Mitigation: Use versioning and cautious service-worker strategy. Disable service worker until needed.

## Risk 7: No Build Tool Means Manual Discipline Required

Impact: Import/path mistakes.  
Mitigation: Strict folder structure, checklists, and pilot module standard.

## Risk 8: Large Migrated SPA Becomes Oversized Module

Impact: Hard to maintain.  
Mitigation: Use submodules when complexity threshold is reached.

## Risk 9: Poor Error Visibility

Impact: Hard troubleshooting.  
Mitigation: Standard error envelope, logger, requestId tracing.

## Risk 10: Unauthorized Module Access

Impact: Users access features they should not.  
Mitigation: Route guards, module permissions, flow-side validation.
