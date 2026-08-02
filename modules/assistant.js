import { hydrateGovernance, executeOwnedAction } from '../core/governed-actions.js';
import { QueryStore } from '../core/query-store.js';
import { head, esc, confirmAction, toast } from '../core/ui.js';
import { invokeData } from '../core/api.js';
import { SupportService } from '../core/support-service.js';
import { SupportRoutingConfig } from '../config/support-routing.config.js';
let messages = [], sending = false;
export async function mount(el){hydrateGovernance();render(el); }
function supportPanel(){ const ctx=SupportService.buildContext(); return `<section class="panel"><h2>Contextual Support</h2><p class="meta">Captures current route, selected reference, last error, pending writes and recent receipts for support triage.</p><div class="form-row"><select id="support-category" aria-label="Support request category">${SupportRoutingConfig.categories.map(c=>`<option value="${c.id}">${c.label}</option>`).join('')}</select><input id="support-ref" aria-label="Reference or task ID" placeholder="Reference / Task ID" value="${esc(ctx.selectedId||'')}"></div><textarea id="support-message" rows="3" aria-label="Describe the support request" placeholder="Describe the issue, required reassignment, timeline concern, or clarification…"></textarea><div class="toolbar"><button class="btn" id="support-submit">Submit Support Request</button></div><details><summary>Support context preview</summary><pre class="pre">${esc(JSON.stringify(ctx,null,2))}</pre></details></section>`; }
function render(el) {
  el.innerHTML = `<div class="workspace">${head('Assistant', 'Ask scoped questions about correspondence, tasks and workflow status. Unauthorized/raw data is not sent.')}
    <div class="panel"><div class="thread" id="asst-log">${messages.length ? messages.map(m => `<div class="msg ${m.role === 'user' ? 'mine' : ''}"><span class="who">${m.role === 'user' ? 'You' : 'Assistant'}</span>${esc(m.content)}</div>`).join('') : '<p class="meta">Ask a question to get started.</p>'}</div>
      <div class="form-row"><textarea id="asst-input" class="flex-1" rows="2" aria-label="Ask the assistant" placeholder="Ask the assistant… (Ctrl+Enter to send)"></textarea>
      <button class="btn" id="asst-send" ${sending ? 'disabled' : ''}>${sending ? 'Sending…' : 'Send'}</button></div></div>${supportPanel()}</div>`;
  const input = el.querySelector('#asst-input'), send = el.querySelector('#asst-send');
  send.onclick = () => submit(el);
  el.querySelector('#support-submit')?.addEventListener('click', async()=>{ const category=el.querySelector('#support-category')?.value||'clarification'; const ref=el.querySelector('#support-ref')?.value||''; const message=el.querySelector('#support-message')?.value||''; if(!message.trim()) return toast('Enter support message','error'); if(!await confirmAction({title:'Submit support request', body:message})) return; try{ await SupportService.submit({category,message,ref,taskId:ref}); toast('Support request submitted','success'); }catch(e){ toast('Support request failed: '+e.message,'error'); } });
  input.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(el); } };
  el.querySelector('#asst-log').scrollTop = el.querySelector('#asst-log').scrollHeight;
}
async function submit(el) {
  if (sending) return; const input = el.querySelector('#asst-input'); const text = (input.value || '').trim(); if (!text) return;
  if (!await confirmAction({ title: 'Send to Assistant', body: `<p>${esc(text)}</p><p class="meta">This is sent to the AI_CHAT flow endpoint.</p>` })) return;
  messages.push({ role: 'user', content: text }); sending = true; render(el);
  try {
    const context = await QueryStore.dashboard().catch(()=>null);
    const res = await executeOwnedAction('assistant','ask',()=>invokeData('AI_CHAT', { messages, scoped:true, context }),{meta:{promptLength:text.length}});
    messages.push({ role: 'assistant', content: res?.reply || res?.message || (typeof res==='string'?res:'No reply was returned by the AI flow.') });
    toast('Assistant response received','success');
  } catch (error) { messages.push({ role: 'assistant', content: 'The AI flow could not complete the request. Review Diagnostics or retry. ' + (error?.message||'') }); toast('Assistant request failed','error'); }
  sending = false; render(el);
}
