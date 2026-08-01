import { status } from './domain.js';
export function operationalMetrics(state){
  const tasks=state.tracking||[], refs=state.activities||[], approvals=state.approvals||[], dispatches=state.dispatches||[];
  const openRefs=refs.filter(a=>!['Treated','Processed','Closed','Archived'].includes(status(a)));
  const openTasks=tasks.filter(t=>!['Completed','Closed','Cancelled'].includes(t.status));
  const overdue=tasks.filter(t=>t.due && new Date(t.due)<new Date() && !['Completed','Closed'].includes(t.status));
  const dueSoon=tasks.filter(t=>t.due && new Date(t.due)>=new Date() && (new Date(t.due)-Date.now())<=86400000 && !['Completed','Closed'].includes(t.status));
  return {references:refs.length, openReferences:openRefs.length, tasks:tasks.length, openTasks:openTasks.length, overdue:overdue.length, dueSoon:dueSoon.length, pendingApprovals:approvals.filter(a=>['pending','pending_review'].includes(a.status||a.__status)).length, pendingDispatch:dispatches.filter(d=>['dispatch_pending','dispatch_failed'].includes(d.status||d.__status)).length, pendingQueue:(state.pending||[]).length};
}
export function moduleMetrics(state,moduleName){ return {...operationalMetrics(state), moduleName}; }
