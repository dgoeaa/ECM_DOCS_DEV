export const ModuleBoundaries = Object.freeze({
  home: { role:'operational-landing', owns:['quick-entry','workload-summary'], views:['intake','assignments','sla'], mustNotOwn:['certification','formal-reporting','archive-execution'] },
  'ecm-erp-charter': { role:'boundary-charter', owns:['scope-boundary-charter','ownership-matrix','shared-terminology','integration-rules','delivery-sequencing'], views:['erp-capabilities','ecm-capabilities','governance-model'], mustNotOwn:['transaction-processing','content-write-operations','records-disposition-execution'] },
  // 'activity-lifecycle-routing' is the Canvas FastTrack queue routing (UNC / SIWES / NYSC):
  // it writes a DGOFASTTRACK queue record and marks the source activity Treated. It is NOT
  // archive-execution — immutable closure bundles, retention and reopen stay owned by the
  // archive module (ArchiveService), which this lens must not and does not invoke.
  activities: { role:'activity-lens', owns:['activity-view','phase-filtering','flag-document','activity-lifecycle-routing','activity-attachment-preview'], views:['correspondence','tasks','registry'], mustNotOwn:['intake-master','registry-control','approval-decision','archive-execution'] },
  correspondence: { role:'intake-master', owns:['create-correspondence','triage','classify','hold','reject','duplicate','send-to-routing'], views:['source-documents','email-evidence'], mustNotOwn:['registry-custody','task-execution','archive-execution'] },
  'scan-intake': { role:'counter-deposit', owns:['scan-deposit','deposit-custody-attribution'], views:['correspondence'], mustNotOwn:['registry-custody','triage','approval-decision','archive-execution'] },
  registry: { role:'official-file-control', owns:['registry-file','file-jacket','custody','movement','minutes','registry-closure-candidate'], views:['correspondence','tasks','archive-readiness'], mustNotOwn:['triage-master','search-retrieval','report-export'] },
  'single-assignment': { role:'single-task-assignment', owns:['assign-one','validate-assignee','create-task','create-task-from-email','route-task'], views:['triaged-references'], mustNotOwn:['bulk-actions','task-execution'] },
  'bulk-assignment': { role:'bulk-task-assignment', owns:['bulk-assign','bulk-validation','otp-protected-batch','partial-results'], views:['triaged-references'], mustNotOwn:['task-execution','approval-decision'] },
  fasttrack: { role:'priority-intervention', owns:['fasttrack','urgent-assign','escalate-priority','notify-owner'], views:['sla-risk','unassigned','due-soon'], mustNotOwn:['normal-task-workbench','formal-approval'] },
  acknowledgment: { role:'assignment-receipt-gate', owns:['acknowledge','acknowledge-retry','remind-assignee','escalate-non-ack'], views:['assigned-tasks'], mustNotOwn:['task-progress','response-monitoring'] },
  orchestrator: { role:'task-execution-workbench', owns:['start-work','progress','block','resume','complete-action','submit-review','update-task'], views:['work-journal','comments'], mustNotOwn:['assignment-creation','review-decision'] },
  'response-tracking': { role:'response-monitoring-lens', owns:['monitor-response','ageing','export-monitoring','route-to-owner'], views:['tasks','approval-readiness'], mustNotOwn:['task-execution','approval-decision'] },
  comments: { role:'collaboration-thread', owns:['comment','review-note','return-reason','dispatch-note'], views:['reference-thread'], mustNotOwn:['status-transition','archive-mutation'] },
  approvals: { role:'standard-review-authority', owns:['approve','approve-with-edit','return','reject','review-minute'], views:['draft-response','source-record'], mustNotOwn:['executive-exception-only','dispatch-execution'] },
  executive: { role:'executive-exception-authority', owns:['executive-approve','executive-return','executive-escalate','request-clarification'], views:['sensitive','escalated','overdue'], mustNotOwn:['routine-approval-queue','task-execution'] },
  dispatch: { role:'dispatch-execution', owns:['prepare-dispatch','send-dispatch','retry-dispatch','no-dispatch','capture-receipt','closure-check'], views:['approved-response'], mustNotOwn:['approval-decision','archive-execution'] },
  archive: { role:'immutable-archive-execution', owns:['archive-reference','archive-file','archive-readiness','archive-hash','archive-access'], views:['bundle','audit-thread'], mustNotOwn:['registry-custody','lookup-search','report-generation'] },
  lookup: { role:'search-retrieval', owns:['search','filter','open-active','open-archive'], views:['records','archives'], mustNotOwn:['archive-execution','report-generation'] },
  reports: { role:'report-export-authority', owns:['generate-report','print','export','email-report','evidence-report'], views:['metrics','archive-evidence'], mustNotOwn:['live-monitoring','archive-execution'] },
  statistics: { role:'analytics-kpi', owns:['metrics','trends','phase-distribution','sla-analytics'], views:['workload','performance'], mustNotOwn:['formal-report-generation','runtime-certification'] },
  assistant: { role:'governed-ai-assist', owns:['ask','summarize','suggest-next-action'], views:['scoped-context'], mustNotOwn:['raw-state-access','unauthorized-action'] },
  'operator-hud': { role:'runtime-monitoring', owns:['sync-status','pending-queue','runtime-load','operator-alerts'], views:['diagnostics-summary'], mustNotOwn:['configuration-edit','release-certification'] },
  'correspondence-email': { role:'official-correspondence-email-dispatch', owns:['create-correspondence-email-draft','send-correspondence-email','duplicate-correspondence-email','archive-correspondence-email'], views:['correspondence','registryFiles','dispatches','correspondenceEmails'], mustNotOwn:['task-notification','acknowledgement-receipt','personal-mailbox'] },
  settings: { role:'configuration', owns:['profile','theme','density','endpoint-restore','state-import-export'], views:['endpoint-config'], mustNotOwn:['runtime-certification','live-monitoring'] },
  diagnostics: { role:'certification-health', owns:['run-checks','contract-health','route-health','governance-health','release-blockers'], views:['runtime','endpoint','ui-certification'], mustNotOwn:['configuration-edit','business-action'] },
  'user-admin': { role:'user-access-admin', owns:['create-user','edit-user','disable-user','assign-role'], views:['role-matrix'], mustNotOwn:['business-workflow-action'] }
});
export function boundaryFor(moduleName){ return ModuleBoundaries[moduleName] || null; }
export function ownsAction(moduleName, action){ const b=boundaryFor(moduleName); return !!b && (b.owns||[]).includes(action); }
export function moduleRole(moduleName){ return boundaryFor(moduleName)?.role || 'unclassified'; }
