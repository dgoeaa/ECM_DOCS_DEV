/* Durable UI feedback channel.

   Until this existed, `dgo-shell.toast()` was the entire feedback surface of the runtime:
   it appended a div and removed it 4200ms later. There was no history, no dismissal, no
   severity beyond a colour, and nothing survived a route change — so an approval, a
   dispatch or a failed sync that the user did not happen to be looking at was
   unrecoverable from the UI. That is the defect this closes.

   Deliberately NOT `State.notifications`. That array is a domain entity — reminders raised
   against a task and addressed to an assignee, written by orchestrator.js, fasttrack.js and
   acknowledgment.js — and modules/correspondence-email.js states the distinction outright:
   "This desk is for actual outward correspondences via email. It is not a task-notification
   center." Mixing an interaction log into a governed record set would put UI chatter into
   the audit trail and domain records into a dismissable inbox. They stay separate.

   Storage is this module's own key, so the state schemaVersion, its hydrate() path and its
   audit machinery are all untouched. */

import { AppConfig } from '../config/app.config.js';

const KEY = `${AppConfig.storageKey}.feed`;
const CAPACITY = 200;
const TONES = new Set(['info', 'success', 'warn', 'error']);

const listeners = new Set();
let feed = load();

function safeLocalStorage(){ try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }

function load(){
  try {
    const raw = JSON.parse(safeLocalStorage()?.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(valid).slice(0, CAPACITY) : [];
  } catch { return []; }
}

function valid(r){ return r && typeof r === 'object' && typeof r.id === 'string' && typeof r.message === 'string'; }

function persist(){
  try { safeLocalStorage()?.setItem(KEY, JSON.stringify(feed)); return true; }
  catch (e) { console.error('[DGO FEED]', e); return false; }
}

function emit(){ const snap = all(); listeners.forEach(f => { try { f(snap); } catch (e) { console.error('[DGO FEED]', e); } }); }

/* `warn` and `error` are the two a user must be able to find again after the fact, so they
   arrive unread. `info` and `success` confirm something the user just did and was looking
   at — marking those unread would leave a permanent badge nobody can clear by working. */
function normalizeTone(tone){
  const t = String(tone || 'info').toLowerCase();
  if (TONES.has(t)) return t;
  if (t === 'err' || t === 'danger') return 'error';
  if (t === 'warning') return 'warn';
  return 'info';
}

export function push(message, tone = 'info', meta = {}){
  const text = String(message || '').trim();
  if (!text) return null;
  const rec = {
    id: (crypto?.randomUUID?.() || `n-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    at: new Date().toISOString(),
    message: text,
    tone: normalizeTone(tone),
    module: String(meta.module || ''),
    ref: String(meta.ref || ''),
    read: false
  };
  if (rec.tone === 'info' || rec.tone === 'success') rec.read = true;
  feed = [rec, ...feed].slice(0, CAPACITY);
  persist(); emit();
  return { ...rec };
}

export function all(){ return feed.map(r => ({ ...r })); }
export function unreadCount(){ return feed.reduce((n, r) => n + (r.read ? 0 : 1), 0); }
export function markAllRead(){ if (!feed.some(r => !r.read)) return; feed = feed.map(r => ({ ...r, read: true })); persist(); emit(); }
export function dismiss(id){ const next = feed.filter(r => r.id !== id); if (next.length === feed.length) return; feed = next; persist(); emit(); }
export function clear(){ if (!feed.length) return; feed = []; persist(); emit(); }
export function subscribe(fn){ listeners.add(fn); return () => listeners.delete(fn); }

export const NotificationCenter = Object.freeze({ push, all, unreadCount, markAllRead, dismiss, clear, subscribe, CAPACITY });
