import { SourceViews, SourceViewAll, sourceView } from '../config/source-views.config.js';
const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const hay = item => {
  try { return JSON.stringify(item ?? {}).toLowerCase(); } catch { return String(item ?? '').toLowerCase(); }
};
export function inferSourceId(item={}){
  const explicit = String(item.sourceView || item.sourceId || item.sourceType || item.ingestionSource || item.channel || item.correspondenceType || item.source?.sourceView || item.source?.sourceId || item.source?.channel || '').toLowerCase();
  const text = `${explicit} ${hay(item)}`;
  if (/customer.?service|email|mailbox|message|internetmessageid|conversationid|fromaddress|email-to-task/.test(text)) return 'customer-service-emails';
  if (/portal|public.?submission|webform|submitter|public-correspondence/.test(text)) return 'public-portal-correspondence';
  if (/dgceo|dg.?outgoing|outgoing|dispatch|directive|minute|no-dispatch|receipt/.test(text)) return 'dgceo-outgoing-correspondence';
  if (/physical|scan|scanned|document|attachment|registry|file|hard.?copy|pdf/.test(text)) return 'physical-scanned-documents';
  return 'physical-scanned-documents';
}
export function itemMatchesSource(item, sourceId=SourceViewAll){ return !sourceId || sourceId===SourceViewAll || inferSourceId(item)===sourceId; }
export function filterItemsBySource(items=[], sourceId=SourceViewAll){ return (items || []).filter(item=>itemMatchesSource(item, sourceId)); }
export function sourceCounts(items=[]){
  const counts = Object.fromEntries(SourceViews.map(s=>[s.id,0]));
  counts.all = (items||[]).length;
  for (const item of (items||[])) counts[inferSourceId(item)] = (counts[inferSourceId(item)] || 0) + 1;
  return counts;
}
export function sourceFilterChips(active=SourceViewAll, attr='data-source-view', items=null){
  const counts = Array.isArray(items) ? sourceCounts(items) : null;
  return `<section class="source-view-switcher" aria-label="Filter by ingestion source"><div class="eyebrow panel-eyebrow">Source view</div><div class="chips source-view-chips">${SourceViews.map(s=>`<button type="button" class="chip dgo-chip source-chip ${s.id===active?'active':''}" ${attr}="${escapeHtml(s.id)}" title="${escapeHtml(s.purpose)}"><span class="source-icon">${escapeHtml(s.icon)}</span><span>${escapeHtml(s.short)}</span>${counts?`<b>${counts[s.id]||0}</b>`:''}</button>`).join('')}</div></section>`;
}
export function sourceBadge(item){ const s=sourceView(inferSourceId(item)); return `<span class="pill dgo-pill source-badge" title="${escapeHtml(s.purpose)}">${escapeHtml(s.icon)} ${escapeHtml(s.short)}</span>`; }
export function sourceViewSummary(sourceId=SourceViewAll){ const s=sourceView(sourceId); return `${s.label}: ${s.purpose}`; }
