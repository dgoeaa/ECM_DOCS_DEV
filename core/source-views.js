import { SourceViews, SourceViewAll, sourceView } from '../config/source-views.config.js';
import { entryPoint } from '../config/entry-points.config.js';
import { declaredEntryPoint } from './entry-point-feeds.js';
const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const hay = item => {
  try { return JSON.stringify(item ?? {}).toLowerCase(); } catch { return String(item ?? '').toLowerCase(); }
};
/**
 * Which source view an item belongs to.
 *
 * ORDER MATTERS, AND IT USED NOT TO. This function previously concatenated the explicit
 * channel fields onto `JSON.stringify(item)` and regex-swept the lot, so a record that
 * DECLARED its channel could still be misfiled by its own prose — `channel:'Document'` with
 * the title "Ministerial directive" was filed as DGCEO outgoing, because 'directive' matched
 * an earlier pattern than 'document'. Three of six records carrying an explicit channel were
 * misfiled that way.
 *
 * Now there are three tiers, and a lower one is only consulted when the one above is silent:
 *
 *   1. The D4 stamp written at ingestion by core/entry-point-feeds.js. Provenance, not a
 *      guess — the feed that admitted the record knew where it came from.
 *   2. Any other DECLARED channel field, matched exactly against the entry point's
 *      channelValues. Still a statement by the producer, not an inference.
 *   3. Only then, the text sweep — kept because records loaded from older captures carry no
 *      stamp and no channel, and a best guess beats nothing for those. It no longer gets to
 *      overrule a record that said what it was.
 */
export function inferSourceId(item={}){
  const declared = declaredEntryPoint(item);
  if (declared) {
    const ep = entryPoint(declared.id);
    if (ep) return ep.sourceView;
  }
  const explicit = String(item.source?.sourceView || item.source?.sourceId || item.source?.channel || '').toLowerCase();
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
  return `<section class="source-view-switcher" aria-label="Filter by ingestion source"><div class="eyebrow panel-eyebrow">Source view</div><div class="chips source-view-chips">${SourceViews.map(s=>`<button type="button" class="chip dgo-chip source-chip ${s.id===active?'active':''}" ${attr}="${escapeHtml(s.id)}" title="${escapeHtml(s.purpose)}"><span class="source-icon">${srcIcon(s.icon)}</span><span>${escapeHtml(s.short)}</span>${counts?`<b>${counts[s.id]||0}</b>`:''}</button>`).join('')}</div></section>`;
}
const srcIcon = n => /^i-[a-z-]+$/.test(String(n||'')) ? `<svg class="dgo-icon" aria-hidden="true" focusable="false"><use href="#${n}"></use></svg>` : '';
export function sourceBadge(item){ const s=sourceView(inferSourceId(item)); return `<span class="pill dgo-pill source-badge" title="${escapeHtml(s.purpose)}">${srcIcon(s.icon)} ${escapeHtml(s.short)}</span>`; }
export function sourceViewSummary(sourceId=SourceViewAll){ const s=sourceView(sourceId); return `${s.label}: ${s.purpose}`; }
