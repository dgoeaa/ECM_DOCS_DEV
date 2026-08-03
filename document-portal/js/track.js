/* Track — verified lookup, lifecycle timeline and citizen-side actions. */
PF.page = function () {
  var out = PF.$('#trackOut');
  var form = PF.$('#lookup');

  /* ---------- quick picks ---------- */
  function chip(label, id, email, tone) {
    return '<button type="button" class="dgo-chip" data-fill="' + PF.esc(id) + '" data-email="' + PF.esc(email) + '" style="cursor:pointer;border:0' + (tone ? ';background:var(--dgo-color-surface-sunken);color:var(--dgo-color-fg-default)' : '') + '">' +
      '<svg class="icon-sm" aria-hidden="true"><use href="#i-id"></use></svg>' + PF.esc(label) + '</button>';
  }
  function renderQuick() {
    var mine = PF.store.mine();
    var demos = PF.store.all().filter(function (r) { return r.seeded; }).slice(0, 3);
    var html = '';
    if (mine.length) {
      html += '<div class="dgo-stack dgo-stack--2"><span class="dgo-field__label">Your requests from this device</span><div class="dgo-cluster dgo-cluster--2">' +
        mine.slice(0, 4).map(function (m) { return chip(m.id, m.id, m.email); }).join('') + '</div></div>';
    }
    html += '<div class="dgo-stack dgo-stack--2" style="margin-top:' + (mine.length ? '14px' : '0') + '"><span class="dgo-field__label">Or open a sample record</span><div class="dgo-cluster dgo-cluster--2">' +
      demos.map(function (r) { return chip(PF.status(r.status).label + ' · ' + r.category, r.id, r.email, true); }).join('') + '</div>' +
      '<p class="pf-note">Sample records ship with the portal so the tracking experience can be reviewed end to end.</p></div>';
    PF.$('#quickPicks').innerHTML = html;
  }
  renderQuick();

  PF.$('#quickPicks').addEventListener('click', function (e) {
    var b = e.target.closest('[data-fill]');
    if (!b) return;
    PF.$('#trackId').value = b.getAttribute('data-fill');
    PF.$('#trackEmail').value = b.getAttribute('data-email');
    lookup();
  });

  /* ---------- device history ---------- */
  function renderMine() {
    var mine = PF.store.mine();
    PF.$('#minePanel').hidden = !mine.length;
    if (!mine.length) return;
    PF.$('#mineList').innerHTML = mine.map(function (m) {
      var rec = PF.store.get(m.id);
      return '<li><button class="pf-rec" data-open="' + PF.esc(m.id) + '" data-email="' + PF.esc(m.email) + '">' +
        '<span class="pf-rec__top"><span class="pf-rec__id">' + PF.esc(m.id) + '</span>' + (rec ? PF.pill(rec.status) : '<span class="dgo-pill">Not on this device</span>') + '</span>' +
        '<span class="pf-rec__meta"><span>' + PF.esc(m.title || 'Submission') + '</span><span>·</span><span>' + PF.rel(m.at) + '</span></span></button></li>';
    }).join('');
  }
  renderMine();
  PF.$('#mineList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-open]');
    if (!b) return;
    PF.$('#trackId').value = b.getAttribute('data-open');
    PF.$('#trackEmail').value = b.getAttribute('data-email');
    lookup();
  });
  PF.$('#forgetBtn').addEventListener('click', function () {
    PF.dialog({ title: 'Forget this device history?', okLabel: 'Forget', tone: 'danger', body: '<p class="pf-note">The list of tracking IDs kept in this browser is cleared. The requests themselves are unaffected and can still be found with the ID and email.</p>' })
      .then(function (ok) { if (!ok) return; PF.store.forgetMine(); renderMine(); renderQuick(); PF.toast('info', 'Device history cleared', ''); });
  });

  /* ---------- validation + lookup ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  function err(id, msg) {
    var p = PF.$('#' + id + '-err'), f = PF.$('#' + id);
    if (msg) { p.textContent = msg; p.hidden = false; f.setAttribute('aria-invalid', 'true'); }
    else { p.hidden = true; f.removeAttribute('aria-invalid'); }
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); lookup(); });
  PF.$('#resetBtn').addEventListener('click', function () {
    form.reset(); err('trackId', ''); err('trackEmail', ''); out.innerHTML = '';
    history.replaceState(null, '', location.pathname);
    PF.$('#trackId').focus();
  });

  function lookup() {
    var id = PF.$('#trackId').value.trim().toUpperCase();
    var email = PF.$('#trackEmail').value.trim();
    err('trackId', ''); err('trackEmail', '');
    var bad = false;
    if (!id || id.length < 6) { err('trackId', 'Enter the full tracking ID from your receipt.'); bad = true; }
    if (!EMAIL.test(email)) { err('trackEmail', 'Enter the email address used at submission.'); bad = true; }
    if (bad) { PF.toast('error', 'Cannot look that up yet', 'Both the tracking ID and the email are required.'); return; }

    PF.$('#trackId').value = id;
    var btn = PF.$('#lookupBtn');
    btn.setAttribute('data-loading', 'true'); btn.disabled = true;
    out.innerHTML = '<div class="pf-panel"><div class="pf-panel__body dgo-stack dgo-stack--3">' +
      '<span class="dgo-skeleton" style="height:20px;width:40%"></span>' +
      '<span class="dgo-skeleton" style="height:14px;width:80%"></span>' +
      '<span class="dgo-skeleton" style="height:14px;width:65%"></span></div></div>';

    /* Ask the registry first. Until step 6 this function read localStorage and nothing
       else, so it could not report a decision the registry had actually taken and a
       submission made on a phone did not exist on a laptop. The device store is now a
       fallback, and when it is used the page says so — presenting device data as though it
       came from the registry is the failure this replaces. */
    PF.intake.status(id, email).then(function (res) {
      btn.removeAttribute('data-loading'); btn.disabled = false;
      PF.store.log('lookup', id, 'Status lookup for ' + id);

      if (res.resolution === 'found') {
        keepUrl(id, email);
        return render(fromRegistry(res.record, id), 'registry');
      }
      if (res.resolution === 'denied') return denied(id);

      // Unavailable: no read-back configured, offline, or the registry could not be
      // reached. That is not a statement that the request does not exist, so it must not
      // be reported as one.
      var rec = PF.store.get(id);
      if (!rec || String(rec.email || '').toLowerCase() !== email.toLowerCase()) {
        return unavailable(id, res.reason);
      }
      keepUrl(id, email);
      render(rec, 'device');
    });
  }

  function keepUrl(id, email) {
    history.replaceState(null, '', location.pathname + '?id=' + encodeURIComponent(id) + '&email=' + encodeURIComponent(email));
  }

  /* One denial for both cases. The registry deliberately does not distinguish "no such
     reference" from "wrong email" — telling an anonymous caller which it was answers
     "does NITDA-2026-000318 exist?" for anybody who asks. Saying it differently here
     would put that oracle straight back. */
  function denied(id) {
    out.innerHTML = '<div class="dgo-alert dgo-alert--danger"><span class="dgo-alert__icon"><svg class="icon" aria-hidden="true"><use href="#i-alert"></use></svg></span>' +
      '<div class="dgo-alert__body"><div class="dgo-alert__title">No request matches that tracking ID and email</div>' +
      '<p style="margin:0 0 10px">Both must match the request exactly. Check for transposed characters in the ID, and use the email address the confirmation was sent to — not a colleague’s.</p>' +
      '<a class="dgo-btn dgo-btn--secondary dgo-btn--sm" href="support.html">Ask the helpdesk to find it</a></div></div>';
    PF.toast('error', 'No match', 'Nothing matches that tracking ID and email together.');
  }

  function unavailable(id, reason) {
    var why = reason === 'offline'
      ? 'This device is offline, so the registry could not be reached.'
      : reason === 'rate-limited'
        ? 'Too many lookups from this connection in a short time. Wait a minute and try again.'
        : 'The registry could not be reached just now.';
    out.innerHTML = '<div class="dgo-alert dgo-alert--warning"><span class="dgo-alert__icon"><svg class="icon" aria-hidden="true"><use href="#i-warning"></use></svg></span>' +
      '<div class="dgo-alert__body"><div class="dgo-alert__title">Status is unavailable right now</div>' +
      '<p style="margin:0 0 10px">' + why + ' This does <strong>not</strong> mean ' + PF.esc(id) + ' was not received — it means the status could not be read. Try again shortly.</p>' +
      '<a class="dgo-btn dgo-btn--secondary dgo-btn--sm" href="support.html">Contact the helpdesk</a></div></div>';
    PF.toast('warning', 'Status unavailable', 'The registry could not be reached.');
  }

  /* ---------- record view ---------- */
  function stageOf(rec) { return PF.status(rec.status).stage; }

  /* Map the registry's projected view onto the shape this page renders.
     The projection is deliberately narrow — no officer, no handling unit, no attachment
     list, no description — so the fields it does not carry are left undefined and the
     renderer omits their rows rather than printing empty ones. */
  function fromRegistry(p, id) {
    p = p || {};
    var tl = (p.timeline || []).map(function (e) {
      return { at: e.at, status: e.status, label: e.label || '', note: e.note || '', actor: 'Registry' };
    });
    return {
      id: p.referenceId || id,
      status: p.status || 'received',
      statusLabel: p.statusLabel || '',
      category: p.category || '',
      title: p.subject || '',
      submittedAt: p.receivedAt || '',
      acknowledgedAt: p.acknowledgedAt || '',
      updatedAt: p.updatedAt || p.receivedAt || '',
      closedAt: p.closedAt || '',
      actionRequired: p.actionRequired === true,
      events: tl
    };
  }

  /* Acknowledgement of receipt, NOT a decision deadline.
     This block used to be titled "Service-level target" and measured elapsed days against
     a per-service SLA — the service-desk model step 2 retired. On a closed record it read
     "Closed after 14 of 3 working days", which is meaningless: the 3 days are the window
     to acknowledge receipt, and the outcome follows its own workflow. It now reports the
     one commitment the registry actually makes. */
  function ackBlock(rec) {
    var total = PF.ACK_TARGET_DAYS;
    if (!rec.submittedAt) return '';
    var ackAt = rec.acknowledgedAt || (rec.events.length ? rec.events[0].at : '');
    var used = 0, d = new Date(rec.submittedAt), end = new Date(ackAt || Date.now());
    while (d < end) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6) used++; }

    var pct = Math.min(100, Math.round((used / total) * 100));
    var over = used > total, label;
    if (ackAt) label = 'Acknowledged ' + (used <= total ? 'within' : 'after') + ' ' + used + (used === 1 ? ' working day' : ' working days');
    else if (over) label = 'Acknowledgement overdue by ' + (used - total) + (used - total === 1 ? ' working day' : ' working days');
    else label = (total - used) + (total - used === 1 ? ' working day left' : ' working days left') + ' of ' + total;

    var late = over && !ackAt;
    return '<div class="dgo-stack dgo-stack--2">' +
      '<div class="dgo-row dgo-row--between" style="font-size:12.5px"><span style="color:var(--dgo-color-fg-muted)">Acknowledgement of receipt</span>' +
      '<span style="font-weight:600;color:' + (late ? 'var(--dgo-color-danger-subtle-fg)' : 'var(--dgo-color-fg-strong)') + '">' + label + '</span></div>' +
      '<div class="pf-meter" data-over="' + late + '"><i style="width:' + pct + '%"></i></div>' +
      '<div class="dgo-row dgo-row--between" style="font-size:11.5px;color:var(--dgo-color-fg-subtle)"><span>Received ' + PF.date(rec.submittedAt) + '</span>' +
      '<span>' + (ackAt ? 'Acknowledged ' + PF.date(ackAt) : 'Target ' + PF.date(rec.ackDueAt || PF.addWorkingDays(rec.submittedAt, total))) + '</span></div>' +
      '<p class="pf-note" style="margin:0">The registry commits to acknowledging receipt. The outcome follows its own workflow and is reported on this timeline.</p>' +
      '</div>';
  }

  function stageBar(rec) {
    var cur = stageOf(rec), decided = ['approved', 'declined', 'withdrawn'].indexOf(rec.status) > -1;
    return '<div class="pf-steps"><ol class="dgo-stepper">' + PF.STAGES.map(function (s, i) {
      var n = i + 1;
      var state = n < cur ? 'done' : (n === cur ? (decided ? 'done' : 'current') : 'todo');
      var label = (n === 4 && decided) ? PF.status(rec.status).label : s;
      return '<li class="dgo-stepper__step" data-state="' + state + '"><span class="dgo-stepper__bullet">' + (state === 'done' ? '✓' : n) + '</span><span>' + label + '</span></li>' +
        (n < 4 ? '<li class="dgo-stepper__line"></li>' : '');
    }).join('') + '</ol></div>';
  }

  /* A row is emitted only when there is something to put in it. The registry projection
     carries fewer fields than a device record, and a blank <dd> — or worse, the literal
     string "undefined" — is not an acceptable way to render an absent one. */
  function row(label, value) {
    return value ? '<dt>' + label + '</dt><dd>' + value + '</dd>' : '';
  }

  function sourceNote(source) {
    if (source === 'registry') {
      return '<p class="pf-note" style="margin:0">Read from the NITDA registry just now.</p>';
    }
    // Device data is shown only when the registry could not be reached, and it must be
    // labelled. The whole point of step 6 is that this page stops passing off one browser's
    // localStorage as the registry's answer.
    return '<div class="dgo-alert dgo-alert--warning" style="margin:0"><span class="dgo-alert__icon"><svg class="icon-sm" aria-hidden="true"><use href="#i-warning"></use></svg></span>' +
      '<div class="dgo-alert__body"><div class="dgo-alert__title">Shown from this device</div>' +
      '<p style="margin:0">The registry could not be reached, so this is the copy saved in this browser when the request was submitted. It will not show anything the registry has done since.</p></div></div>';
  }

  function render(rec, source) {
    source = source || 'device';
    var st = PF.status(rec.status);
    var typeLabel = rec.typeLabel || (rec.type ? PF.correspondenceType(rec.type).label : '');
    var events = rec.events.slice().reverse();
    out.innerHTML =
      '<div class="pf-print-head" style="margin-bottom:18px"><img src="ds/logo/nitda-lockup.png" alt="National Information Technology Development Agency" style="height:56px"><p style="margin:10px 0 0;font-size:12px">Request record ' + rec.id + ' · printed ' + PF.dateTime(new Date().toISOString()) + '</p></div>' +
      '<div class="dgo-stack dgo-stack--5">' +
        '<div class="pf-panel">' +
          '<div class="pf-panel__head" style="flex-wrap:wrap">' +
            '<span class="pf-rec__id" style="font-size:15px">' + rec.id + '</span>' + PF.pill(rec.status) +
            (PF.isOverdue(rec) ? '<span class="dgo-pill dgo-pill--danger">Overdue</span>' : '') +
            (rec.priority === 'expedited' ? '<span class="dgo-pill dgo-pill--escalated">Expedited</span>' : '') +
            '<span class="dgo-cluster dgo-cluster--2 pf-no-print" style="margin-left:auto">' +
              '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm" id="copyBtn"><svg class="icon-sm" aria-hidden="true"><use href="#i-id"></use></svg>Copy ID</button>' +
              '<button class="dgo-btn dgo-btn--secondary dgo-btn--sm" id="printBtn"><svg class="icon-sm" aria-hidden="true"><use href="#i-download"></use></svg>Save as PDF</button>' +
            '</span>' +
          '</div>' +
          '<div class="pf-panel__body dgo-stack dgo-stack--5">' +
            '<div class="dgo-stack dgo-stack--2"><h2 style="margin:0;font-family:var(--dgo-family-display);font-size:22px;line-height:1.2;letter-spacing:-.012em">' + PF.esc(rec.title) + '</h2>' +
            '<p class="pf-note">' + PF.esc(rec.statusLabel || st.blurb) + '</p></div>' +
            stageBar(rec) +
            ackBlock(rec) +
            sourceNote(source) +
            '<dl class="pf-kv">' +
              row('Correspondence type', PF.esc(typeLabel)) +
              row('Registry category', PF.esc(rec.category)) +
              row('Handling unit', PF.esc(rec.unit)) +
              row('Submitted by', rec.name ? PF.esc(rec.name) + (rec.org ? ' · ' + PF.esc(rec.org) : '') : '') +
              row('Received', rec.submittedAt ? PF.dateTime(rec.submittedAt) + ' · ' + PF.rel(rec.submittedAt) : '') +
              row('Last update', rec.updatedAt ? PF.dateTime(rec.updatedAt) + ' · ' + PF.rel(rec.updatedAt) : '') +
              row('Attachments', (rec.files || []).map(function (f) { return PF.esc(f.name) + ' <span class="pf-mono" style="color:var(--dgo-color-fg-muted)">' + PF.bytes(f.size) + '</span>'; }).join('<br>')) +
            '</dl>' +
            actions(rec, source) +
          '</div>' +
        '</div>' +
        '<div class="pf-panel">' +
          '<div class="pf-panel__head"><svg class="icon-sm" aria-hidden="true" style="color:var(--dgo-color-action-primary)"><use href="#i-clock"></use></svg><h2 class="pf-panel__title">Timeline</h2><span class="pf-note" style="margin-left:auto">' + events.length + ' entries</span></div>' +
          '<div class="pf-panel__body"><ol class="pf-tl">' + events.map(function (e) {
            return '<li><div class="pf-tl__a">' + PF.esc(e.label) + '</div>' +
              '<div class="pf-tl__m"><span>' + PF.dateTime(e.at) + '</span><span>·</span><span>' + PF.esc(e.actor || 'Registry') + '</span><span>·</span>' + PF.pill(e.status || rec.status) + '</div>' +
              (e.note ? '<p class="pf-tl__note">' + PF.esc(e.note) + '</p>' : '') + '</li>';
          }).join('') + '</ol></div>' +
        '</div>' +
      '</div>';

    PF.$('#copyBtn').addEventListener('click', function () { PF.copy(rec.id, 'Tracking ID copied.'); });
    PF.$('#printBtn').addEventListener('click', function () { window.print(); });
    var respond = PF.$('#respondBtn'); if (respond) respond.addEventListener('click', function () { doRespond(rec); });
    var withdraw = PF.$('#withdrawBtn'); if (withdraw) withdraw.addEventListener('click', function () { doWithdraw(rec); });
    var note = PF.$('#noteBtn'); if (note) note.addEventListener('click', function () { doNote(rec); });
    PF.toast('success', 'Request located', rec.id + ' · ' + st.label);
  }

  /* Respond / note / withdraw write to this browser's store and nothing else — there is no
     write-back route to the registry yet. On a registry-sourced record they would render a
     "Response sent" toast for something that was never sent, so they are not offered there.
     The helpdesk route IS delivered (POST /intake/support), so it is what a submitter
     looking at a real record is given. Citizen write-back to the registry is a later step;
     offering a button that quietly does nothing is worse than not offering one. */
  function actions(rec, source) {
    var btns = [];
    if (source === 'device') {
      if (rec.status === 'action-required') btns.push('<button class="dgo-btn dgo-btn--primary" id="respondBtn"><svg class="icon-sm" aria-hidden="true"><use href="#i-send"></use></svg>Respond to the request</button>');
      if (PF.isOpen(rec)) btns.push('<button class="dgo-btn dgo-btn--secondary" id="noteBtn"><svg class="icon-sm" aria-hidden="true"><use href="#i-chat"></use></svg>Add a note</button>');
      if (PF.isOpen(rec)) btns.push('<button class="dgo-btn dgo-btn--ghost" id="withdrawBtn" style="color:var(--dgo-color-action-danger)">Withdraw request</button>');
    } else if (rec.actionRequired) {
      btns.push('<a class="dgo-btn dgo-btn--primary" href="support.html?ref=' + encodeURIComponent(rec.id) + '&topic=submission"><svg class="icon-sm" aria-hidden="true"><use href="#i-send"></use></svg>Respond to the registry</a>');
    }
    btns.push('<a class="dgo-btn dgo-btn--ghost" href="support.html?ref=' + encodeURIComponent(rec.id) + '">Contact the helpdesk</a>');
    return '<div class="dgo-cluster dgo-cluster--2 pf-no-print" style="padding-top:4px">' + btns.join('') + '</div>';
  }

  function textareaField(label, placeholder) {
    return '<div class="dgo-field"><label class="dgo-field__label" for="dlgText">' + label + '</label>' +
      '<textarea class="dgo-textarea" id="dlgText" data-field="text" rows="5" placeholder="' + placeholder + '"></textarea></div>';
  }

  function doRespond(rec) {
    var ask = rec.events.slice().reverse().filter(function (e) { return e.status === 'action-required'; })[0];
    PF.dialog({
      title: 'Respond to the reviewer',
      sub: rec.id,
      okLabel: 'Send response',
      body: (ask && ask.note ? '<div class="dgo-alert dgo-alert--warning" style="margin-bottom:14px"><span class="dgo-alert__icon"><svg class="icon-sm" aria-hidden="true"><use href="#i-warning"></use></svg></span><div class="dgo-alert__body"><div class="dgo-alert__title">What was asked for</div>' + PF.esc(ask.note) + '</div></div>' : '') +
        textareaField('Your response', 'Explain what you are providing, and quote any document names you have emailed to the registry.') +
        '<p class="pf-note" style="margin-top:10px">Attachments cannot be added here — email them to portal@nitda.gov.ng quoting ' + rec.id + '. Your response returns the request to the review queue.</p>'
    }).then(function (ok) {
      if (!ok) return;
      var text = (PF.dialog.values.text || '').trim();
      if (text.length < 10) { PF.toast('error', 'Response too short', 'Give the reviewer enough detail to act on.'); return doRespond(rec); }
      PF.store.update(rec.id, { status: 'review' }, { status: 'review', label: 'Requester responded to the request for information.', note: text, actor: rec.name });
      PF.store.log('response', rec.id, 'Requester response recorded');
      render(PF.store.get(rec.id));
      PF.toast('success', 'Response sent', 'The request is back with ' + rec.officer + '.');
    });
  }

  function doNote(rec) {
    PF.dialog({
      title: 'Add a note to this request',
      sub: rec.id,
      okLabel: 'Add note',
      body: textareaField('Note', 'Anything the reviewing officer should know — a correction, a deadline, a change of contact.')
    }).then(function (ok) {
      if (!ok) return;
      var text = (PF.dialog.values.text || '').trim();
      if (text.length < 5) { PF.toast('error', 'Note too short', ''); return; }
      PF.store.update(rec.id, {}, { status: rec.status, label: 'Note added by the requester.', note: text, actor: rec.name });
      render(PF.store.get(rec.id));
      PF.toast('success', 'Note added', 'It is now on the reviewer’s timeline.');
    });
  }

  function doWithdraw(rec) {
    PF.dialog({
      title: 'Withdraw this request?',
      sub: rec.id,
      okLabel: 'Withdraw it',
      tone: 'danger',
      body: '<p class="pf-note" style="margin-bottom:12px">The request is closed and removed from the review queue. You can submit a fresh request at any time, but this tracking ID cannot be reopened.</p>' +
        textareaField('Reason (optional)', 'Superseded by a corrected submission.')
    }).then(function (ok) {
      if (!ok) return;
      PF.store.update(rec.id, { status: 'withdrawn' }, { status: 'withdrawn', label: 'Withdrawn at the request of the submitter.', note: (PF.dialog.values.text || '').trim(), actor: rec.name });
      PF.store.log('withdraw', rec.id, 'Request withdrawn by submitter');
      render(PF.store.get(rec.id));
      PF.toast('info', 'Request withdrawn', rec.id + ' is now closed.');
    });
  }

  /* ---------- deep link ---------- */
  var q = new URLSearchParams(location.search);
  var qid = q.get('id'), qemail = q.get('email');
  if (qid) {
    PF.$('#trackId').value = qid.toUpperCase();
    if (qemail) PF.$('#trackEmail').value = qemail;
    if (qid && qemail) lookup();
    else PF.$('#trackEmail').focus();
  }
};
