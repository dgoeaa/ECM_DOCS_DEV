// Registry Scan Intake — channel C. TARGET_ARCHITECTURE.md §3.2, step 7.
//
// A document arrives physically at the registry counter. A clerk scans it, deposits the
// bytes through the proxy into the document library, and the platform gets a correspondence
// record with the link already attached. Before this, channel C was metadata only: a clerk
// could log that a document existed but had nowhere to put it, so the record and the paper
// stayed in different places.
//
// TWO RULES THIS MODULE IS BUILT AROUND
//
//   1. NO RECORD WITHOUT A DEPOSIT. If the bytes did not reach the library, no
//      correspondence record is created. A registry record pointing at a document that was
//      never filed is a broken custody record — the same silent-loss failure as F-028 on
//      the portal, wearing an internal badge. Failed deposits stay in the tray, visible and
//      retryable, and say why.
//
//   2. CUSTODY IS ATTRIBUTED BY THE SERVER. `depositedBy` comes back from the proxy, which
//      read it from the verified token. This module never asserts who deposited a document,
//      because a client-asserted depositor is not a custody record.
//
// It creates correspondence as an ALLOWED INVOKER of the correspondence module's
// `create-correspondence` action rather than owning a second creation path, so a scanned
// record and a logged one are the same kind of thing with the same audit event.

import { hydrateGovernance, executeOwnedAction } from '../core/governed-actions.js';
import { State } from '../core/state.js';
import { head, kpis, esc, badge, toast, confirmAction, fmtDateTime } from '../core/ui.js';
import { UIState } from '../core/ui-state.js';
import { audit } from '../core/enterprise-domain.js';
import { invoke } from '../core/api.js';
import { priorityOptions, normalizePriority } from '../config/priority.config.js';
import { DocumentKinds } from '../config/correspondence-categories.config.js';
import { depositScan, validateScan, digestOf, scanIntakeConfigured, SCAN_LIMITS } from '../core/scan-intake-service.js';

/* The tray holds File objects, which are not serialisable and therefore cannot live in
   State. Module scope, reset on mount, so it survives a re-render but not a navigation —
   a clerk who leaves the workspace mid-deposit should not find a stale tray on return. */
let tray = [];

/* One document-kind vocabulary, shared with modules/correspondence.js and the portal, so a
   scanned record and a logged one are classified identically. See F-032: the routing
   domains in assignment-cascade.config.js are a DIFFERENT axis, not a fourth copy of this
   one, and config/correspondence-categories.config.js is what maps between them. */

const bytes = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB`
              : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;

export async function mount(el) {
  hydrateGovernance();
  tray = [];
  render(el);
}

function render(el) {
  const s = State.get();
  const u = UIState.get('scan-intake', { depositing: false });
  const configured = scanIntakeConfigured();
  const deposited = tray.filter(t => t.state === 'deposited');
  const failed = tray.filter(t => t.state === 'failed');

  el.innerHTML = `<div class="workspace">
    ${head('Registry Scan Intake',
           'Counter deposit for physically-received documents. The scan is filed in the document library and a correspondence record is created with the link already attached.')}
    ${kpis([
      ['In tray', tray.length],
      ['Deposited', deposited.length],
      ['Failed', failed.length],
      ['Byte path', configured ? 'Configured' : 'Not configured'],
    ])}
    ${configured ? '' : `<section class="panel">
      <div class="eyebrow panel-eyebrow">Deposit unavailable</div>
      <p>No proxy is configured, so there is nowhere to file a scan. Set <code>proxyBaseUrl</code>
         in <code>config/config.local.js</code> to enable counter deposits.</p>
      <p class="meta">Correspondence can still be logged from <b>Intake &amp; Assignment</b>, but a
         record logged there carries no document. This workspace will not create one either —
         a registry record pointing at a document that was never filed is not a custody record.</p>
    </section>`}
    <section class="panel">
      <div class="eyebrow panel-eyebrow">1 · The document</div>
      <div class="form-row">
        <label class="wide">Scanned file(s)
          <input type="file" data-files multiple accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.doc,.docx"
                 ${configured ? '' : 'disabled'}>
        </label>
      </div>
      <p class="meta">${SCAN_LIMITS.acceptLabel}, up to ${SCAN_LIMITS.maxFileBytes / 1048576} MB each.
         A SHA-256 digest is computed here and verified against the bytes by the proxy, so a
         file that changes in transit is refused rather than filed.</p>
      ${tray.length ? `<ul class="timeline" data-tray>${tray.map((t, i) => trayRow(t, i)).join('')}</ul>` : ''}
    </section>
    <section class="panel">
      <div class="eyebrow panel-eyebrow">2 · The correspondence</div>
      <form class="grid" data-form>
        <label>Sender *<input name="sender" required placeholder="Organisation or person the document is from"></label>
        <label>Sender email<input name="senderEmail" type="email" placeholder="Where a reply would go"></label>
        <label class="wide">Subject *<input name="subject" required placeholder="What the document is about"></label>
        <label>Category *<select name="category" required>${DocumentKinds.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
        <label>Priority<select name="priority">${priorityOptions('normal')}</select></label>
        <label>Received at the counter *<input name="receivedAt" type="date" required value="${new Date().toISOString().slice(0, 10)}"></label>
        <label>Confidentiality<select name="confidentiality"><option>Official</option><option>Confidential</option><option>Restricted</option></select></label>
        <label class="wide">Remarks<textarea name="description" rows="3" placeholder="Anything the registry should know — condition of the document, enclosures, how it was delivered."></textarea></label>
        <div class="wide form-row">
          <button class="btn" ${configured && tray.some(t => t.state === 'ready') && !u.depositing ? '' : 'disabled'}>
            ${u.depositing ? 'Depositing…' : 'Deposit and create correspondence'}
          </button>
          <button type="button" class="btn ghost" data-clear ${tray.length ? '' : 'disabled'}>Clear tray</button>
        </div>
      </form>
    </section>
    ${deposited.length ? `<section class="panel">
      <div class="eyebrow panel-eyebrow">Deposited this session</div>
      <ul class="timeline">${deposited.map(t => `<li>
        <div class="when">${esc(fmtDateTime(t.result.depositedAt))}</div>
        <b>${esc(t.result.referenceId)} · ${esc(t.file.name)}</b>
        <p>${t.result.attachmentLink
              ? `<a href="${esc(t.result.attachmentLink)}" target="_blank" rel="noopener noreferrer">Open in the document library</a>`
              : 'Accepted and verified, but the library did not confirm a link.'}</p>
        <div class="meta">Deposited by ${esc(t.result.depositedBy || 'the signed-in officer')} · ${esc(bytes(t.result.bytes))} · sha256 ${esc(String(t.result.sha256).slice(0, 16))}…</div>
      </li>`).join('')}</ul>
    </section>` : ''}
  </div>`;

  bind(el, s, u);
}

function trayRow(t, i) {
  const tone = { ready: 'Ready', hashing: 'Reading', depositing: 'Depositing',
                 deposited: 'Deposited', failed: 'Failed', invalid: 'Rejected' }[t.state] || t.state;
  return `<li>
    <b>${esc(t.file.name)}</b> <span class="meta">${esc(bytes(t.file.size))}</span>
    <div class="meta">${badge(tone)}${t.digest ? ` · sha256 ${esc(t.digest.slice(0, 16))}…` : ''}</div>
    ${t.error ? `<p class="meta">${esc(t.error)}</p>` : ''}
    ${t.state !== 'deposited' ? `<button type="button" class="btn ghost" data-drop="${i}">Remove</button>` : ''}
  </li>`;
}

function bind(el, s, u) {
  el.querySelector('[data-files]')?.addEventListener('change', async e => {
    const picked = [...(e.target.files || [])];
    e.target.value = '';
    for (const file of picked) {
      const invalid = validateScan(file);
      const entry = { file, state: invalid ? 'invalid' : 'hashing', error: invalid, digest: '' };
      tray.push(entry);
      render(el);
      if (invalid) continue;
      // Hash on arrival rather than at deposit time, so the clerk sees the digest before
      // committing and a file that cannot be read fails here rather than mid-deposit.
      try { entry.digest = await digestOf(file); entry.state = 'ready'; }
      catch { entry.state = 'invalid'; entry.error = 'That file could not be read.'; }
      render(el);
    }
  });

  el.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => {
    tray.splice(Number(b.dataset.drop), 1);
    render(el);
  });

  el.querySelector('[data-clear]')?.addEventListener('click', () => {
    tray = [];
    render(el);
  });

  el.querySelector('[data-form]')?.addEventListener('submit', e => deposit(e, el, s));
}

async function deposit(e, el, s) {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  const ready = tray.filter(t => t.state === 'ready');
  if (!ready.length) return toast('Nothing in the tray is ready to deposit', 'error');

  if (!await confirmAction({
    title: 'Deposit into the registry',
    body: `<p>${esc(d.subject)}</p><p class="meta">${esc(d.sender)} · ${esc(d.category)}</p>
           <p>${ready.length} document(s) will be filed in the document library and
           ${ready.length === 1 ? 'a correspondence record' : `${ready.length} correspondence records`}
           created with the link attached.</p>`,
  })) return;

  UIState.set('scan-intake', { depositing: true });
  render(el);

  const created = [];
  for (const entry of ready) {
    entry.state = 'depositing';
    entry.error = '';
    render(el);

    let res;
    await executeOwnedAction('scan-intake', 'scan-deposit', async () => {
      res = await depositScan(entry.file);
    }, { ref: entry.digest.slice(0, 12) }).catch(() => { res = { ok: false, reason: 'action-failed' }; });

    // Rule 1: no record without a deposit. `ok` means the proxy verified the bytes;
    // `stored` means the library confirmed the write. Only both together justify a record.
    if (!res?.ok || !res.stored) {
      entry.state = 'failed';
      entry.error = failureText(res);
      render(el);
      continue;
    }

    entry.state = 'deposited';
    entry.result = res;
    created.push(recordFor(res, entry, d));
    render(el);
  }

  if (created.length) {
    await executeOwnedAction('correspondence', 'create-correspondence', () => {
      State.patch({
        correspondence: [...created, ...(s.correspondence || [])],
        audit: [...created.map(c =>
          audit('Correspondence Registered from Counter Scan', 'correspondence', c.id,
                { channel: 'Registry', attachmentLink: c.attachmentLink }, s.profile.email)),
          ...s.audit],
      }, { module: 'scan-intake', action: 'scan:create-correspondence', ref: created[0].referenceId });

      // Best-effort mirror to the backend, exactly as modules/correspondence.js does. The
      // record is already in local state and in the audit trail; a failure here is a
      // synchronisation problem, not a lost deposit — the document is already filed.
      for (const c of created) {
        invoke('DYNAMIC_ACTIONS', { action: 'upsert_record', module: 'DGCEO_Tracker', data: c })
          .catch(() => toast('Deposited and recorded locally; synchronization queued', 'error'));
      }
    }, { ref: created[0].referenceId });
  }

  UIState.set('scan-intake', { depositing: false });
  const failed = tray.filter(t => t.state === 'failed').length;
  if (created.length && !failed) toast(`${created.length} document(s) deposited and registered`, 'success');
  else if (created.length) toast(`${created.length} deposited, ${failed} failed — the tray shows why`, 'error');
  else toast('Nothing was deposited — the tray shows why', 'error');
  render(el);
}

/** Build the correspondence record. Shape matches modules/correspondence.js exactly. */
function recordFor(res, entry, d) {
  const now = new Date().toISOString();
  return {
    // The reference is the one the proxy minted. modules/correspondence.js derives its own
    // from Date.now(), which collides under concurrency and is chosen by the client; a
    // registry reference must be neither.
    id: res.referenceId,
    referenceId: res.referenceId,
    subject: d.subject,
    sender: d.sender,
    senderEmail: d.senderEmail || '',
    receivedAt: new Date(d.receivedAt).toISOString(),
    correspondenceType: 'Incoming',
    // Channel C. This is what distinguishes a counter deposit from a portal submission and
    // from an email — the model gains no new field, only this value.
    channel: 'Registry',
    category: d.category,
    status: 'Received',
    priority: normalizePriority(d.priority),
    confidentiality: d.confidentiality || 'Official',
    description: d.description || '',
    attachmentLink: res.attachmentLink,
    // Custody facts, all server-side: who deposited it, when, and the digest of what was
    // filed. The digest is what makes the record checkable against the library later.
    depositedBy: res.depositedBy,
    depositedAt: res.depositedAt,
    documentSha256: res.sha256,
    documentName: entry.file.name,
    documentBytes: res.bytes,
    createdAt: now,
    updatedAt: now,
  };
}

function failureText(res) {
  if (!res) return 'The deposit did not run.';
  switch (res.reason) {
    case 'not-configured':   return 'No proxy is configured, so there is nowhere to file this.';
    case 'unauthenticated':  return 'Your session was not accepted. Sign in again and retry.';
    case 'forbidden':        return 'Your role may not deposit documents into the registry.';
    case 'unreachable':      return 'The proxy could not be reached. The document was not filed.';
    case 'digest_mismatch':  return 'The bytes that arrived did not match the digest. Rescan and retry.';
    case 'size_mismatch':    return 'The file changed size in transit. Rescan and retry.';
    case 'file_too_large':   return `Larger than the ${SCAN_LIMITS.maxFileBytes / 1048576} MB limit.`;
    case 'invalid':          return res.detail || 'That file was refused.';
    default:
      // ok:true with stored:false — verified but not filed. A real and distinct outcome:
      // the deposit is audited, the document is not in the library, and no record is made.
      if (res.ok) return 'Accepted and verified, but the document library did not confirm the write. Nothing was registered; retry.';
      return `The deposit was refused (${esc(res.reason || 'unknown')}).`;
  }
}
