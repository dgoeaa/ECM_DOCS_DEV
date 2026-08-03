/* Support — answers, helpdesk channels and the case desk.
   Cases are filed locally and handed to the support workflow; the reference is
   issued immediately so a citizen always has something to quote. */
PF.page = function () {
  var EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  var IDPAT = /^NITDA-[A-Z0-9]{5,12}$/;

  function sref() {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
    var buf = new Uint32Array(6);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 6; i++) out += abc[buf[i] % abc.length];
    return 'NITDA-S-' + out;
  }
  function topicOf(key) {
    return (PF.SUPPORT_TOPICS.filter(function (t) { return t.key === key; })[0] || PF.SUPPORT_TOPICS[PF.SUPPORT_TOPICS.length - 1]);
  }
  function caseStatusPill(s) {
    var map = { open: ['pending', 'Open'], 'in-progress': ['routed', 'With the helpdesk'], resolved: ['success', 'Resolved'] };
    var m = map[s] || map.open;
    return '<span class="dgo-pill dgo-pill--' + m[0] + '"><span class="dgo-pill__dot"></span>' + m[1] + '</span>';
  }

  /* ---------- header figures ---------- */
  var m = PF.metrics();
  var tickets = PF.store.tickets();
  var openCases = tickets.filter(function (t) { return t.status !== 'resolved'; }).length;
  PF.$('#supportStats').innerHTML = [
    ['1', 'day', 'Reply target'],
    [String(openCases), openCases === 1 ? 'case' : 'cases', 'With the helpdesk'],
    [m.onTimeRate + '%', 'on time', 'Requests closed']
  ].map(function (s) {
    return '<div class="dgo-metric" style="padding:14px 16px;gap:6px">' +
      '<div class="dgo-metric__label">' + s[2] + '</div>' +
      '<div class="pf-mono" style="font-size:20px;font-weight:600;line-height:1.1;color:var(--dgo-color-fg-strong);white-space:nowrap">' + s[0] +
      ' <span style="font-size:11px;font-weight:400;color:var(--dgo-color-fg-muted)">' + s[1] + '</span></div></div>';
  }).join('');

  /* ---------- channels ---------- */
  PF.$('#channels').innerHTML = PF.CHANNELS.map(function (c) {
    var val = c.href ? '<a href="' + c.href + '">' + PF.esc(c.value) + '</a>' : PF.esc(c.value);
    return '<div class="pf-chan"><span class="pf-chan__ic">' + PF.icon(c.icon, 'icon-sm') + '</span>' +
      '<div style="min-width:0"><div class="pf-chan__t">' + PF.esc(c.label) + '</div>' +
      '<div class="pf-chan__v">' + val + '</div>' +
      '<p class="pf-note" style="margin:6px 0 0">' + PF.esc(c.note) + '</p></div></div>';
  }).join('');

  /* ---------- portal status ---------- */
  function renderStatus() {
    var pending = PF.outbox.all().length;
    var rows = [
      ['Submission service', 'ok', 'Accepting documents'],
      ['Tracking service', 'ok', m.total + ' records searchable'],
      ['Workflow delivery', pending ? 'warn' : 'ok', pending ? pending + ' payload' + (pending === 1 ? '' : 's') + ' waiting to go out' : 'All payloads delivered'],
      ['Helpdesk', 'ok', 'Open · 08:00 – 17:00 WAT']
    ];
    PF.$('#statusPanel').innerHTML = rows.map(function (r) {
      var tone = r[1] === 'ok' ? 'var(--dgo-color-action-accent)' : 'var(--dgo-color-status-pending-fg)';
      return '<div class="dgo-row" style="gap:10px;align-items:flex-start">' +
        '<i style="width:8px;height:8px;border-radius:50%;background:' + tone + ';margin-top:6px;flex:none"></i>' +
        '<div style="min-width:0"><div style="font-size:13.5px;font-weight:600;color:var(--dgo-color-fg-strong)">' + r[0] + '</div>' +
        '<div class="pf-note">' + PF.esc(r[2]) + '</div></div></div>';
    }).join('') +
      '<p class="pf-note" style="border-top:1px solid var(--dgo-color-border-default);padding-top:12px;margin:0">Planned maintenance is announced on this page and on nitda.gov.ng at least 48 hours ahead.</p>';
  }
  renderStatus();

  /* ---------- FAQ ---------- */
  var faqQuery = '';
  function hl(text, q) {
    if (!q) return PF.esc(text);
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return PF.esc(text);
    return PF.esc(text.slice(0, i)) + '<mark>' + PF.esc(text.slice(i, i + q.length)) + '</mark>' + PF.esc(text.slice(i + q.length));
  }
  function renderFaq() {
    var q = faqQuery.trim();
    var list = PF.FAQ.filter(function (f) {
      if (!q) return true;
      return (f.q + ' ' + f.a).toLowerCase().indexOf(q.toLowerCase()) > -1;
    });
    PF.$('#faqCount').textContent = list.length + '/' + PF.FAQ.length;
    PF.$('#faqList').innerHTML = list.map(function (f, i) {
      return '<details' + (q || i === 0 ? ' open' : '') + '><summary>' + hl(f.q, q) + PF.icon('chevron-down', 'icon-sm') + '</summary>' +
        '<div class="pf-faq__a"><p>' + hl(f.a, q) + '</p></div></details>';
    }).join('');
    var empty = PF.$('#faqEmpty');
    empty.hidden = !!list.length;
    if (!list.length) {
      empty.innerHTML = '<div class="dgo-empty"><span class="pf-drop__ic">' + PF.icon('help') + '</span>' +
        '<div class="dgo-empty__title">Nothing here matches “' + PF.esc(q) + '”</div>' +
        '<p class="dgo-empty__body">Open a case and describe it in your own words — the helpdesk answers within one working day and the question usually ends up on this page.</p>' +
        '<button class="dgo-btn dgo-btn--secondary dgo-btn--sm" data-jump>Open a case</button></div>';
    }
  }
  renderFaq();
  PF.$('#faqSearch').addEventListener('input', function (e) { faqQuery = e.target.value; renderFaq(); });
  PF.$('#faqEmpty').addEventListener('click', function (e) {
    if (!e.target.closest('[data-jump]')) return;
    PF.$('#topic').focus();
    window.scrollTo({ top: PF.$('#casePanel').getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
  });

  /* ---------- device case history ---------- */
  function renderCases() {
    var mineCases = PF.store.tickets().filter(function (t) { return !t.seeded; });
    PF.$('#casesPanel').hidden = !mineCases.length;
    if (!mineCases.length) return;
    PF.$('#casesCount').textContent = mineCases.length + (mineCases.length === 1 ? ' case' : ' cases');
    PF.$('#casesList').innerHTML = mineCases.map(function (t) {
      var reply = t.replies && t.replies.length ? t.replies[t.replies.length - 1] : null;
      return '<li><div class="pf-rec" style="cursor:default">' +
        '<span class="pf-rec__top"><span class="pf-rec__id">' + PF.esc(t.ref) + '</span>' + caseStatusPill(t.status) +
        '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm" data-copy="' + PF.esc(t.ref) + '" style="margin-left:auto">' + PF.icon('id', 'icon-sm') + 'Copy</button></span>' +
        '<span class="pf-rec__meta"><span>' + PF.esc(t.topicLabel) + '</span><span>·</span><span>' + PF.rel(t.at) + '</span>' +
        (t.requestId ? '<span>·</span><span class="pf-mono">' + PF.esc(t.requestId) + '</span>' : '') + '</span>' +
        (reply ? '<p class="pf-tl__note" style="margin-top:8px"><b>' + PF.esc(reply.by) + ':</b> ' + PF.esc(reply.text) + '</p>' : '') +
        '</div></li>';
    }).join('');
  }
  renderCases();
  PF.$('#casesList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (b) PF.copy(b.getAttribute('data-copy'), 'Case reference copied.');
  });

  /* ---------- form ---------- */
  var form = PF.$('#caseForm');
  PF.$('#topic').innerHTML = '<option value="">Choose a topic…</option>' +
    PF.SUPPORT_TOPICS.map(function (t) { return '<option value="' + t.key + '">' + PF.esc(t.label) + '</option>'; }).join('');

  var counter = PF.$('#cmsgCount');
  PF.$('#cmsg').addEventListener('input', function (e) { counter.textContent = e.target.value.trim().length; });
  PF.$('#cref').addEventListener('input', function (e) { e.target.value = e.target.value.toUpperCase(); });

  function err(id, msg) {
    var p = PF.$('#' + id + '-err'), f = PF.$('#' + id);
    if (msg) { p.textContent = msg; p.hidden = false; if (f) f.setAttribute('aria-invalid', 'true'); }
    else { p.hidden = true; if (f) f.removeAttribute('aria-invalid'); }
  }
  function clearErrors() { ['topic', 'cname', 'cemail', 'cref', 'cmsg', 'cconsent'].forEach(function (k) { err(k, ''); }); }

  function status(kind, title, body) {
    var tone = { success: 'success', error: 'danger', info: 'info', warning: 'warning' }[kind] || 'info';
    var ic = { success: 'check-circle', error: 'alert', info: 'info', warning: 'warning' }[kind] || 'info';
    PF.$('#caseStatus').innerHTML = '<div class="dgo-alert dgo-alert--' + tone + '"><span class="dgo-alert__icon">' + PF.icon(ic, 'icon-sm') + '</span>' +
      '<div class="dgo-alert__body"><div class="dgo-alert__title">' + PF.esc(title) + '</div>' + (body ? '<p style="margin:0">' + PF.esc(body) + '</p>' : '') + '</div></div>';
  }

  PF.$('#caseReset').addEventListener('click', function () {
    form.reset(); clearErrors(); counter.textContent = '0';
    PF.$('#caseStatus').innerHTML = '';
    PF.$('#topic').focus();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    var data = {
      topic: PF.$('#topic').value,
      name: PF.$('#cname').value.trim(),
      email: PF.$('#cemail').value.trim(),
      requestId: PF.$('#cref').value.trim().toUpperCase(),
      message: PF.$('#cmsg').value.trim(),
      consent: PF.$('#cconsent').checked
    };
    var bad = false;
    if (!data.topic) { err('topic', 'Choose the closest topic so the case reaches the right desk.'); bad = true; }
    if (data.name.length < 2) { err('cname', 'Enter the name we should address the reply to.'); bad = true; }
    if (!EMAIL.test(data.email)) { err('cemail', 'Enter a working email address — the reply goes there.'); bad = true; }
    if (data.requestId && !IDPAT.test(data.requestId)) { err('cref', 'A tracking ID looks like NITDA-A1B2C3D4E. Leave it blank if you do not have one.'); bad = true; }
    if (data.message.length < 20) { err('cmsg', 'Give us a little more detail — twenty characters minimum.'); bad = true; }
    if (!data.consent) { err('cconsent', 'We need your agreement before we can process the case.'); bad = true; }
    if (bad) {
      status('error', 'The form is not ready to send', 'Fix the highlighted fields and try again.');
      var first = PF.$('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    PF.$('#caseStatus').innerHTML = '';
    preview(data);
  });

  function preview(data) {
    var t = topicOf(data.topic);
    var known = data.requestId ? PF.store.get(data.requestId) : null;
    PF.dialog({
      title: 'Confirm this support case',
      sub: 'Nothing is sent until you confirm.',
      okLabel: 'Confirm and send',
      cancelLabel: 'Keep editing',
      body: '<dl class="pf-kv" style="margin-bottom:14px">' +
        '<dt>Topic</dt><dd>' + PF.esc(t.label) + '</dd>' +
        '<dt>Name</dt><dd>' + PF.esc(data.name) + '</dd>' +
        '<dt>Email</dt><dd>' + PF.esc(data.email) + '</dd>' +
        (data.requestId ? '<dt>Tracking ID</dt><dd class="pf-mono">' + PF.esc(data.requestId) + (known ? ' · ' + PF.esc(known.category) + ' · ' + PF.esc(PF.status(known.status).label) : ' · not on this device') + '</dd>' : '') +
        '<dt>Message</dt><dd style="white-space:pre-line">' + PF.esc(data.message) + '</dd>' +
        '</dl>' +
        '<p class="pf-note">A reference is issued immediately and the case is queued for the helpdesk. Attachments cannot be added here — email them to portal@nitda.gov.ng quoting the reference.</p>'
    }).then(function (ok) { if (ok) send(data); });
  }

  function send(data) {
    var btn = PF.$('#caseBtn');
    btn.setAttribute('data-loading', 'true'); btn.disabled = true;
    status('info', 'Sending your case…', 'Passing the details to the support workflow.');

    setTimeout(function () {
      var t = topicOf(data.topic);
      var now = new Date().toISOString();
      var ticket = {
        ref: sref(), topic: data.topic, topicLabel: t.label, name: data.name, email: data.email,
        requestId: data.requestId, message: data.message, status: 'open',
        at: now, updatedAt: now, replies: []
      };
      PF.store.addTicket(ticket);
      PF.intake.support({
        name: ticket.name,
        email: ticket.email,
        topic: ticket.topicLabel,
        aboutReference: ticket.requestId || '',
        message: ticket.message
      });

      btn.removeAttribute('data-loading'); btn.disabled = false;
      PF.$('#casePanel').hidden = true;
      PF.$('#caseStatus').innerHTML = '';
      receipt(ticket);
      renderCases();
      renderStatus();
      PF.toast('success', 'Case ' + ticket.ref + ' opened', 'The helpdesk replies to ' + ticket.email + ' within one working day.');
    }, 750);
  }

  function receipt(t) {
    var box = PF.$('#caseResult');
    box.hidden = false;
    box.innerHTML =
      '<div class="pf-print-head" style="margin-bottom:18px"><img src="ds/logo/nitda-lockup.png" alt="National Information Technology Development Agency" style="height:56px"><p style="margin:10px 0 0;font-size:12px">Support case ' + t.ref + ' · filed ' + PF.dateTime(t.at) + '</p></div>' +
      '<div class="pf-result">' +
        '<div class="pf-result__head"><span class="pf-result__ic">' + PF.icon('check') + '</span>' +
          '<div><h2 style="margin:0;font-family:var(--dgo-family-display);font-size:24px;line-height:1.15">Case opened</h2>' +
          '<p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,.78);max-width:52ch">' + PF.esc(t.topicLabel) + ' — the helpdesk has your details and replies to ' + PF.esc(t.email) + ' within one working day.</p></div></div>' +
        '<div style="padding:22px;display:grid;gap:20px;background:var(--dgo-color-surface-raised)">' +
          '<div class="pf-idplate"><div style="flex:1"><div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dgo-color-fg-muted);margin-bottom:6px">Your case reference</div><code>' + t.ref + '</code></div>' +
          '<button class="dgo-btn dgo-btn--secondary dgo-btn--sm pf-no-print" id="refCopy">' + PF.icon('id', 'icon-sm') + 'Copy</button></div>' +
          '<dl class="pf-kv">' +
            '<dt>Topic</dt><dd>' + PF.esc(t.topicLabel) + '</dd>' +
            '<dt>Filed</dt><dd>' + PF.dateTime(t.at) + '</dd>' +
            (t.requestId ? '<dt>Linked request</dt><dd class="pf-mono">' + PF.esc(t.requestId) + '</dd>' : '') +
            '<dt>Your message</dt><dd style="white-space:pre-line">' + PF.esc(t.message) + '</dd>' +
          '</dl>' +
          '<div class="dgo-cluster dgo-cluster--2 pf-no-print">' +
            (t.requestId ? '<a class="dgo-btn dgo-btn--primary" href="track.html?id=' + encodeURIComponent(t.requestId) + '&email=' + encodeURIComponent(t.email) + '">' + PF.icon('search', 'icon-sm') + 'Open the linked request</a>' : '<a class="dgo-btn dgo-btn--primary" href="track.html">' + PF.icon('search', 'icon-sm') + 'Track a request</a>') +
            '<button class="dgo-btn dgo-btn--secondary" id="refPrint">' + PF.icon('download', 'icon-sm') + 'Save as PDF</button>' +
            '<button class="dgo-btn dgo-btn--ghost" id="refAgain">Open another case</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    PF.$('#refCopy').addEventListener('click', function () { PF.copy(t.ref, 'Case reference copied.'); });
    PF.$('#refPrint').addEventListener('click', function () { window.print(); });
    PF.$('#refAgain').addEventListener('click', function () {
      box.hidden = true; box.innerHTML = '';
      form.reset(); clearErrors(); counter.textContent = '0';
      PF.$('#casePanel').hidden = false;
      PF.$('#topic').focus();
    });
    box.scrollTop = 0;
    window.scrollTo({ top: box.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
  }

  /* ---------- deep links ---------- */
  var q = new URLSearchParams(location.search);
  if (q.get('id')) PF.$('#cref').value = q.get('id').toUpperCase();
  if (q.get('topic') && topicOf(q.get('topic')).key === q.get('topic')) PF.$('#topic').value = q.get('topic');
  if (q.get('email')) PF.$('#cemail').value = q.get('email');
};
