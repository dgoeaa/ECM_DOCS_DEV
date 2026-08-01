import { State } from './state.js';
import { auditAction } from './action-authority.js';
import { status, isComplete, isPendingStatus } from './domain.js';
import { normalizePriority, priorityLabel } from '../config/priority.config.js';

// R11.6.3: the single reporting/export engine. Reports and Statistics both consume the
// same normalized row shape, summary math and download helpers, and every workspace
// exporter (CSV/JSON/HTML) routes through here instead of hand-building payloads.
export const ReportExportService=Object.freeze({createJson,createHtml,downloadText,exportCsv,exportJson,exportHtmlDoc,csvString,normalizeReportRows,reportSummary,groupCount});

function snapshot(){ const s=State.get(); return {generatedAt:new Date().toISOString(), profile:s.profile, counts:{activities:s.activities?.length||0, tracking:s.tracking?.length||0, correspondence:s.correspondence?.length||0, approvals:s.approvals?.length||0, dispatches:s.dispatches?.length||0, registryFiles:s.registryFiles?.length||0}}; }
function createJson(name='platform-report', payload=snapshot()){ auditAction('reports','generate-report',{meta:{name,format:'json'}}); return JSON.stringify({name,...payload},null,2); }
function createHtml(name='platform-report', payload=snapshot()){ auditAction('reports','generate-report',{meta:{name,format:'html'}}); return `<!doctype html><meta charset="utf-8"><title>${name}</title><h1>${name}</h1><pre>${JSON.stringify(payload,null,2)}</pre>`; }
export function downloadText(filename, text, type='text/plain'){ const blob=new Blob([text],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }

const cell = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
export function csvString(rows, cols){
  const header=cols.map(c=>c.label??c).join(',');
  const key=c=>c.key??c;
  return [header].concat(rows.map(r=>cols.map(c=>cell(typeof c.render==='function'?c.render(r):r[key(c)])).join(','))).join('\n');
}
export function exportCsv(rows, cols, filename){ downloadText(filename, csvString(rows,cols), 'text/csv'); }
export function exportJson(filename, payload){ downloadText(filename, JSON.stringify(payload,null,2), 'application/json'); }
export function exportHtmlDoc(filename, title, body){ downloadText(filename, `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>${body}</body></html>`, 'text/html'); }

const rowDate = r => String(r.created || r.due || '').slice(0,10);
export function normalizeReportRows(s){
  const acts=(s.activities||[]).map(a=>({ kind:'Activity', type:'Activity', id:a.id, title:a.title, created:a.created,
    category:a.category||'Unclassified', assignedTo:a.assignedTo||'', priority:normalizePriority(a.priority), priorityLabel:priorityLabel(a.priority),
    status:status(a), activityStatus:status(a), taskStatus:'', ack:a.assignmentStatus||'', due:a.dueDate||'',
    link:a.attachmentLink||a.link||'', attachmentLink:a.attachmentLink||'', comments:a.description||'', referenceId:a.referenceId||'' }));
  const tasks=(s.tracking||[]).map(t=>({ kind:'Task', type:'Task', id:t.id, title:t.title, created:t.created||t.start||'',
    category:t.category||'Task', assignedTo:t.assignedTo||'', priority:normalizePriority(t.priority), priorityLabel:priorityLabel(t.priority),
    status:t.status||'Pending', activityStatus:'', taskStatus:t.status||'Pending', ack:t.ack||t.acknowledged&&'Acknowledged'||'', due:t.due||'',
    link:t.link||t.attachmentLink||'', attachmentLink:t.attachmentLink||'', comments:t.description||'', referenceId:t.referenceId||'' }));
  return [...acts,...tasks];
}
export function filterByDateRange(rows,start,end){ return rows.filter(r=>{ const d=rowDate(r); return !d || (!start || d>=start) && (!end || d<=end); }); }
export function reportSummary(rows){
  const statusOf=r=>r.taskStatus||r.activityStatus||r.status||'';
  return { total:rows.length,
    completed:rows.filter(r=>isComplete(statusOf(r))).length,
    pending:rows.filter(r=>isPendingStatus(statusOf(r))).length,
    overdue:rows.filter(r=>r.due&&new Date(r.due)<new Date()&&!isComplete(statusOf(r))).length };
}
export function groupCount(rows,key){ const m={}; rows.forEach(r=>{ const v=(typeof key==='function'?key(r):r[key])||'Blank'; m[v]=(m[v]||0)+1; }); return Object.entries(m).sort((a,b)=>b[1]-a[1]); }
