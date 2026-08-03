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

    setTimeout(function () {
      btn.removeAttribute('data-loading'); btn.disabled = false;
      var rec = PF.store.get(id);
      PF.store.log('lookup', id, 'Status lookup for ' + id);
      /* The tracking flow used to be called here. It did nothing: PF.flow only ever read
         r.ok, never a response body, so a lookup was fire-and-forget and every result
         shown came from this browser's own store. Removing the call loses no behaviour and
         removes one signed credential. Genuine read-back from the registry is step 6 of
         docs/architecture/TARGET_ARCHITECTURE.md. */
      if (!rec) return notFound(id);
      if (rec.email.toLowerCase() !== email.toLowerCase()) return mismatch(id);
      history.replaceState(null, '', location.pathname + '?id=' + encodeURIComponent(id) + '&email=' + encodeURIComponent(email));
      render(rec);
    }, 700);
  }

  function notFound(id) {
    out.innerHTML = '<div class="dgo-alert dgo-alert--danger"><span class="dgo-alert__icon"><svg class="icon" aria-hidden="true"><use href="#i-alert"></use></svg></span>' +
      '<div class="dgo-alert__body"><div class="dgo-alert__title">No request found for ' + PF.esc(id) + '</div>' +
      '<p style="margin:0 0 10px">Check for transposed characters — tracking IDs are nine characters after the NITDA prefix and never contain the letters I or O.</p>' +
      '<a class="dgo-btn dgo-btn--secondary dgo-btn--sm" href="support.html">Ask the helpdesk to find it</a></div></div>';
    PF.toast('error', 'Request not found', 'Nothing in the registry matches ' + id + '.');
  }

  function mismatch(id) {
    out.innerHTML = '<div class="dgo-alert dgo-alert--warning"><span class="dgo-alert__icon"><svg class="icon" aria-hidden="true"><use href="#i-lock"></use></svg></span>' +
      '<div class="dgo-alert__body"><div class="dgo-alert__title">That email does not match this request</div>' +
      '<p style="margin:0 0 10px">' + PF.esc(id) + ' exists, but it is registered to a different address. Use the address the confirmation was sent to, or ask the helpdesk to re-issue access.</p>' +
      '<a class="dgo-btn dgo-btn--secondary dgo-btn--sm" href="support.html">Contact the helpdesk</a></div></div>';
    PF.toast('warning', 'Verification failed', 'The email does not match the record.');
  }

  /* ---------- record view ---------- */
  function stageOf(rec) { return PF.status(rec.status).stage; }

  function slaBlock(rec) {
    var total = PF.ACK_TARGET_DAYS;
    var used = 0, d = new Date(rec.submittedAt), end = PF.isOpen(rec) ? new Date() : new Date(rec.updatedAt);
    while (d < end) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6) used++; }
    var pct = Math.min(100, Math.round((used / total) * 100));
    var over = used > total;
    var label;
    if (!PF.isOpen(rec)) label = 'Closed after ' + used + ' of ' + total + ' working days';
    else if (over) label = 'Overdue by ' + (used - total) + (used - total === 1 ? ' working day' : ' working days');
    else label = (total - used) + (total - used === 1 ? ' working day left' : ' working days left') + ' of ' + total;
    return '<div class="dgo-stack dgo-stack--2">' +
      '<div class="dgo-row dgo-row--between" style="font-size:12.5px"><span style="color:var(--dgo-color-fg-muted)">Service-level target</span>' +
      '<span style="font-weight:600;color:' + (over && PF.isOpen(rec) ? 'var(--dgo-color-danger-subtle-fg)' : 'var(--dgo-color-fg-strong)') + '">' + label + '</span></div>' +
      '<div class="pf-meter" data-over="' + (over && PF.isOpen(rec)) + '"><i style="width:' + pct + '%"></i></div>' +
      '<div class="dgo-row dgo-row--between" style="font-size:11.5px;color:var(--dgo-color-fg-subtle)"><span>Received ' + PF.date(rec.submittedAt) + '</span><span>Acknowledgement by ' + PF.date(rec.ackDueAt) + '</span></div>' +
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

  function render(rec) {
    var s = PF.correspondenceType(rec.type), st = PF.status(rec.status);
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
            '<p class="pf-note">' + PF.esc(st.blurb) + '</p></div>' +
            stageBar(rec) +
            slaBlock(rec) +
            '<dl class="pf-kv">' +
              '<dt>Service</dt><dd>' + PF.esc(s.name) + ' <span class="pf-mono" style="color:var(--dgo-color-fg-muted)">(' + s.code + ')</span></dd>' +
              '<dt>Handling unit</dt><dd>' + PF.esc(rec.unit) + '</dd>' +
              '<dt>Reviewing officer</dt><dd>' + PF.esc(rec.officer) + '</dd>' +
              '<dt>Submitted by</dt><dd>' + PF.esc(rec.name) + ' · ' + PF.esc(rec.org) + '</dd>' +
              '<dt>Received</dt><dd>' + PF.dateTime(rec.submittedAt) + ' · ' + PF.rel(rec.submittedAt) + '</dd>' +
              '<dt>Last update</dt><dd>' + PF.dateTime(rec.updatedAt) + ' · ' + PF.rel(rec.updatedAt) + '</dd>' +
              '<dt>Attachments</dt><dd>' + rec.files.map(function (f) { return PF.esc(f.name) + ' <span class="pf-mono" style="color:var(--dgo-color-fg-muted)">' + PF.bytes(f.size) + '</span>'; }).join('<br>') + '</dd>' +
            '</dl>' +
            actions(rec) +
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

  function actions(rec) {
    var btns = [];
    if (rec.status === 'action-required') btns.push('<button class="dgo-btn dgo-btn--primary" id="respondBtn"><svg class="icon-sm" aria-hidden="true"><use href="#i-send"></use></svg>Respond to the request</button>');
    if (PF.isOpen(rec)) btns.push('<button class="dgo-btn dgo-btn--secondary" id="noteBtn"><svg class="icon-sm" aria-hidden="true"><use href="#i-chat"></use></svg>Add a note</button>');
    if (PF.isOpen(rec)) btns.push('<button class="dgo-btn dgo-btn--ghost" id="withdrawBtn" style="color:var(--dgo-color-action-danger)">Withdraw request</button>');
    btns.push('<a class="dgo-btn dgo-btn--ghost" href="support.html">Contact the helpdesk</a>');
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
