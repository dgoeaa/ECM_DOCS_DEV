/* Operations console — sign-in gate, queue triage and the record drawer.
   Every action writes to the record timeline and the audit trail, so the
   citizen-facing tracking page and this console never disagree. */
PF.page = function () {
  var S = {
    tab: 'queue', q: '', status: 'all', service: 'all', unit: 'all', priority: 'all',
    overdue: false, sort: 'updated', page: 1, per: 10, sel: {},
    caseFilter: 'all', auditFilter: 'all'
  };
  var A = {
    state: S,
    refresh: function () { renderKpis(); renderTabs(); renderPanel(); },
    session: function () { return PF.store.admin.session() || { name: 'Registry', role: 'Registry', unit: '', scope: 'all' }; }
  };

  /* ============================================================
     Sign-in
     ============================================================ */
  function alias(name) { return name.toLowerCase().replace(/\.\s*/g, '.').replace(/\s+/g, ''); }

  PF.$('#demoAccounts').innerHTML = PF.STAFF.map(function (s) {
    return '<button type="button" class="dgo-chip" data-user="' + PF.esc(s.user) + '" style="cursor:pointer;border:0;background:var(--dgo-color-surface-muted)">' +
      PF.icon('user', 'icon-sm') + PF.esc(s.name) + ' · ' + PF.esc(s.role) + '</button>';
  }).join('');

  PF.$('#demoAccounts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-user]');
    if (!b) return;
    var s = PF.STAFF.filter(function (x) { return x.user === b.getAttribute('data-user'); })[0];
    PF.$('#user').value = s.user;
    PF.$('#pass').value = s.pass;
    signStatus('info', 'Credentials filled', 'Press sign in to open the console as ' + s.name + '.');
    PF.$('#signInBtn').focus();
  });

  function signStatus(kind, title, body) {
    var tone = { success: 'success', error: 'danger', info: 'info' }[kind] || 'info';
    var ic = { success: 'check-circle', error: 'alert', info: 'info' }[kind] || 'info';
    PF.$('#signInStatus').innerHTML = '<div class="dgo-alert dgo-alert--' + tone + '"><span class="dgo-alert__icon">' + PF.icon(ic, 'icon-sm') + '</span>' +
      '<div class="dgo-alert__body"><div class="dgo-alert__title">' + PF.esc(title) + '</div>' + (body ? '<p style="margin:0">' + PF.esc(body) + '</p>' : '') + '</div></div>';
  }

  var attempts = 0;
  PF.$('#signIn').addEventListener('submit', function (e) {
    e.preventDefault();
    var u = PF.$('#user').value.trim().toLowerCase(), p = PF.$('#pass').value;
    if (!u || !p) return signStatus('error', 'Both fields are required', 'Enter your username and password.');
    var btn = PF.$('#signInBtn');
    btn.setAttribute('data-loading', 'true'); btn.disabled = true;
    signStatus('info', 'Verifying credentials…', 'Checking the directorate account.');
    setTimeout(function () {
      btn.removeAttribute('data-loading'); btn.disabled = false;
      var hit = PF.STAFF.filter(function (s) { return (s.user === u || alias(s.name) === u) && s.pass === p; })[0];
      if (!hit) {
        attempts++;
        signStatus('error', 'Those credentials were not accepted', attempts >= 2 ? 'Select one of the demonstration accounts below to fill the form.' : 'Check the username and password and try again.');
        PF.toast('error', 'Sign-in failed', 'Attempt ' + attempts + ' recorded in the audit trail.');
        PF.store.log('auth', u, 'Failed console sign-in attempt');
        return;
      }
      PF.store.admin.signIn(hit);
      PF.toast('success', 'Signed in', hit.name + ' · ' + hit.role);
      openConsole();
    }, 800);
  });

  PF.$('#signOutBtn').addEventListener('click', function () {
    PF.store.admin.signOut();
    PF.$('#console').hidden = true;
    PF.$('#gate').hidden = false;
    PF.$('#signIn').reset();
    signStatus('info', 'Signed out', 'The console is locked. Sign in again to continue.');
    PF.toast('info', 'Signed out', 'Console locked.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ============================================================
     Console shell
     ============================================================ */
  function openConsole() {
    var s = A.session();
    if (s.scope === 'unit') S.unit = s.unit;
    PF.$('#gate').hidden = true;
    PF.$('#console').hidden = false;
    PF.$('#sessionChip').innerHTML = '<span class="dgo-pill__dot"></span>' + PF.esc(s.name) + ' · ' + PF.esc(s.role);
    PF.$('#consoleSub').textContent = s.scope === 'unit'
      ? 'Signed in for ' + s.unit + '. Widen the unit filter to see the whole registry.'
      : 'Full registry access across every directorate.';
    A.refresh();
  }

  PF.$('#exportBtn').addEventListener('click', function () {
    var rows = filtered();
    var csv = PF.panels.csv(rows);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nitda-registry-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    PF.store.log('system', 'EXPORT', rows.length + ' records exported to CSV by ' + A.session().name);
    PF.toast('success', 'Export ready', rows.length + ' records written to CSV.');
  });

  PF.$('#resetBtn').addEventListener('click', function () {
    PF.dialog({
      title: 'Reinstall demonstration data?',
      okLabel: 'Reinstall',
      tone: 'danger',
      body: '<p class="pf-note">Every record, support case, audit entry and draft held in this browser is replaced with the shipped demonstration set. Submissions made on this device are lost.</p>'
    }).then(function (ok) {
      if (!ok) return;
      PF.store.reset();
      S.sel = {}; S.page = 1;
      A.refresh();
      PF.toast('info', 'Registry reset', 'The demonstration data has been reinstalled.');
    });
  });

  /* ---------- KPIs ---------- */
  function renderKpis() {
    var m = PF.metrics();
    var tiles = [
      { l: 'Open in the queue', v: m.open, n: m.review + ' under review · ' + m.action + ' waiting on requesters' },
      { l: 'Action required', v: m.action, n: 'Clock paused until the requester replies', tone: m.action ? 'var(--dgo-color-status-action-fg)' : '' },
      { l: 'Overdue', v: m.overdue, n: m.expedited + ' expedited in the queue', tone: m.overdue ? 'var(--dgo-color-danger-subtle-fg)' : '' },
      { l: 'Received in 7 days', v: m.week, n: m.total + ' records in the registry' }
    ];
    PF.$('#kpis').innerHTML = tiles.map(function (t) {
      return '<div class="dgo-metric" style="gap:6px">' +
        '<span class="dgo-metric__label">' + t.l + '</span>' +
        '<span class="dgo-metric__value" style="font-size:34px' + (t.tone ? ';color:' + t.tone : '') + '">' + t.v + '</span>' +
        '<span class="pf-note">' + PF.esc(t.n) + '</span></div>';
    }).join('');
  }

  /* ---------- tabs ---------- */
  function renderTabs() {
    var m = PF.metrics();
    var openCases = PF.store.tickets().filter(function (t) { return t.status !== 'resolved'; }).length;
    var tabs = [
      { key: 'queue', label: 'Queue', badge: m.open },
      { key: 'cases', label: 'Support cases', badge: openCases },
      { key: 'performance', label: 'Performance', badge: null },
      { key: 'audit', label: 'Audit trail', badge: PF.store.audit().length }
    ];
    PF.$('#tabs').innerHTML = tabs.map(function (t) {
      return '<button class="dgo-tabs__tab" role="tab" data-tab="' + t.key + '" aria-selected="' + (S.tab === t.key) + '">' +
        t.label + (t.badge ? ' <span class="dgo-badge">' + t.badge + '</span>' : '') + '</button>';
    }).join('');
    PF.$('#consoleTitle').textContent = { queue: 'Queue', cases: 'Support cases', performance: 'Performance', audit: 'Audit trail' }[S.tab];
  }

  PF.$('#tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b) return;
    S.tab = b.getAttribute('data-tab');
    S.page = 1;
    A.refresh();
  });

  /* ============================================================
     Queue
     ============================================================ */
  function filtered() {
    var s = A.session();
    var rows = PF.store.all().filter(function (r) {
      if (S.status === 'open' && !PF.isOpen(r)) return false;
      if (S.status !== 'all' && S.status !== 'open' && r.status !== S.status) return false;
      if (S.service !== 'all' && r.service !== S.service) return false;
      if (S.unit !== 'all' && r.unit !== S.unit) return false;
      if (S.priority !== 'all' && r.priority !== S.priority) return false;
      if (S.overdue && !PF.isOverdue(r)) return false;
      if (S.q) {
        var hay = (r.id + ' ' + r.title + ' ' + r.name + ' ' + r.org + ' ' + r.email + ' ' + r.serviceName + ' ' + r.officer).toLowerCase();
        if (hay.indexOf(S.q.toLowerCase()) === -1) return false;
      }
      return true;
    });
    var by = {
      updated: function (a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); },
      received: function (a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); },
      due: function (a, b) { return new Date(a.dueAt) - new Date(b.dueAt); },
      priority: function (a, b) { return (b.priority === 'expedited') - (a.priority === 'expedited') || new Date(a.dueAt) - new Date(b.dueAt); },
      org: function (a, b) { return a.org.localeCompare(b.org); }
    };
    return rows.sort(by[S.sort] || by.updated);
  }

  function selCount() { return Object.keys(S.sel).filter(function (k) { return S.sel[k]; }).length; }

  function queuePanel() {
    var rows = filtered();
    var pages = Math.max(1, Math.ceil(rows.length / S.per));
    if (!S.page || S.page < 1 || S.page > pages) S.page = Math.min(Math.max(1, S.page || 1), pages);
    var page = rows.slice((S.page - 1) * S.per, S.page * S.per);
    var n = selCount();

    var opt = function (v, label, cur) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>'; };

    var html =
      '<div class="dgo-stack dgo-stack--4">' +
        '<div class="dgo-filter-bar">' +
          '<div class="dgo-search" style="flex:1;min-width:220px">' + PF.icon('search', 'icon-sm') +
            '<input id="qSearch" type="search" placeholder="Tracking ID, organisation, subject, officer…" value="' + PF.esc(S.q) + '" style="border:0;background:none;flex:1;font:inherit;color:inherit;outline:none" autocomplete="off"></div>' +
          '<div class="dgo-select"><select class="dgo-select__field dgo-btn--sm" id="fStatus" aria-label="Status">' +
            opt('all', 'All statuses', S.status) + opt('open', 'Open only', S.status) +
            Object.keys(PF.STATUS).map(function (k) { return opt(k, PF.STATUS[k].label, S.status); }).join('') +
          '</select></div>' +
          '<div class="dgo-select"><select class="dgo-select__field" id="fService" aria-label="Service">' +
            opt('all', 'All services', S.service) +
            PF.SERVICES.map(function (s) { return opt(s.key, s.code + ' — ' + s.name, S.service); }).join('') +
          '</select></div>' +
          '<div class="dgo-select"><select class="dgo-select__field" id="fUnit" aria-label="Unit">' +
            opt('all', 'All units', S.unit) +
            PF.UNITS.map(function (u) { return opt(u, u, S.unit); }).join('') +
          '</select></div>' +
          '<div class="dgo-select"><select class="dgo-select__field" id="fSort" aria-label="Sort">' +
            opt('updated', 'Recently updated', S.sort) + opt('received', 'Newest received', S.sort) +
            opt('due', 'Due soonest', S.sort) + opt('priority', 'Expedited first', S.sort) + opt('org', 'Organisation A–Z', S.sort) +
          '</select></div>' +
          '<label class="dgo-check"><input type="checkbox" id="fOverdue"' + (S.overdue ? ' checked' : '') + '><span>Overdue only</span></label>' +
          '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm" id="clearFilters">Clear</button>' +
        '</div>' +

        (n ? '<div class="dgo-bulk-bar"><b>' + n + ' selected</b>' +
          '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm" data-bulk="assign">' + PF.icon('users', 'icon-sm') + 'Assign officer</button>' +
          '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm" data-bulk="advance">' + PF.icon('arrow-right', 'icon-sm') + 'Advance stage</button>' +
          '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm" data-bulk="expedite">' + PF.icon('sparkle', 'icon-sm') + 'Mark expedited</button>' +
          '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm" data-bulk="clear" style="margin-left:auto">Clear selection</button></div>' : '') +

        '<div class="dgo-row dgo-row--between" style="flex-wrap:wrap;gap:8px">' +
          '<span class="pf-note">' + rows.length + (rows.length === 1 ? ' request' : ' requests') + ' match' + (rows.length === 1 ? 'es' : '') + ' this view</span>' +
          '<span class="pf-note">Select a row to open the full record</span>' +
        '</div>' +

        (rows.length ?
          '<div class="dgo-table-wrap" style="overflow-x:auto"><table class="dgo-table"><thead><tr>' +
            '<th style="width:38px"><input type="checkbox" id="selAll" aria-label="Select all on this page"' + (page.every(function (r) { return S.sel[r.id]; }) ? ' checked' : '') + '></th>' +
            '<th>Request</th><th>Service</th><th>Requester</th><th>Officer</th><th>Status</th><th>Due</th><th>Updated</th>' +
          '</tr></thead><tbody>' + page.map(function (r) {
            var over = PF.isOverdue(r);
            return '<tr data-row="' + PF.esc(r.id) + '" style="cursor:pointer">' +
              '<td><input type="checkbox" data-sel="' + PF.esc(r.id) + '"' + (S.sel[r.id] ? ' checked' : '') + ' aria-label="Select ' + PF.esc(r.id) + '"></td>' +
              '<td><span class="pf-rec__id">' + PF.esc(r.id) + '</span>' +
                '<div class="pf-note" style="max-width:32ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + PF.esc(r.title) + '</div></td>' +
              '<td><span class="pf-mono" style="font-size:11.5px;color:var(--dgo-color-fg-muted)">' + PF.esc(r.serviceCode) + '</span>' +
                '<div style="font-size:12.5px">' + PF.esc(r.unit) + '</div></td>' +
              '<td>' + PF.esc(r.name) + '<div class="pf-note" style="max-width:26ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + PF.esc(r.org) + '</div></td>' +
              '<td>' + PF.esc(r.officer) + '</td>' +
              '<td>' + PF.pill(r.status) + (r.priority === 'expedited' ? ' <span class="dgo-pill dgo-pill--escalated"><span class="dgo-pill__dot"></span>Exp</span>' : '') + '</td>' +
              '<td class="pf-mono" style="font-size:12px' + (over ? ';color:var(--dgo-color-danger-subtle-fg);font-weight:600' : '') + '">' + PF.date(r.dueAt) + (over ? '<div style="font-size:11px">overdue</div>' : '') + '</td>' +
              '<td class="pf-mono" style="font-size:12px">' + PF.rel(r.updatedAt) + '</td>' +
            '</tr>';
          }).join('') + '</tbody></table></div>' +
          (pages > 1 ? '<div class="dgo-row dgo-row--between" style="flex-wrap:wrap;gap:10px">' +
            '<span class="pf-note">Page ' + S.page + ' of ' + pages + '</span>' +
            '<div class="dgo-pagination">' +
              '<button class="dgo-pagination__btn" data-page="' + (S.page - 1) + '"' + (S.page === 1 ? ' disabled' : '') + '>' + PF.icon('chevron-left', 'icon-sm') + '</button>' +
              Array.apply(null, { length: pages }).map(function (x, i) {
                return '<button class="dgo-pagination__btn" data-page="' + (i + 1) + '"' + (S.page === i + 1 ? ' aria-current="page"' : '') + '>' + (i + 1) + '</button>';
              }).join('') +
              '<button class="dgo-pagination__btn" data-page="' + (S.page + 1) + '"' + (S.page === pages ? ' disabled' : '') + '>' + PF.icon('chevron-right', 'icon-sm') + '</button>' +
            '</div></div>' : '')
          : '<div class="pf-panel"><div class="dgo-empty"><span class="pf-drop__ic">' + PF.icon('search') + '</span>' +
            '<div class="dgo-empty__title">Nothing matches this view</div>' +
            '<p class="dgo-empty__body">Loosen a filter or clear the search. The registry holds ' + PF.store.all().length + ' records in total.</p>' +
            '<button class="dgo-btn dgo-btn--secondary dgo-btn--sm" id="clearFilters2">Clear all filters</button></div></div>') +
      '</div>';

    function bind(root) {
      var search = root.querySelector('#qSearch');
      if (search) {
        var t = null;
        search.addEventListener('input', function (e) {
          var v = e.target.value;
          clearTimeout(t);
          t = setTimeout(function () { S.q = v; S.page = 1; renderPanel(true); }, 200);
        });
      }
      var map = { fStatus: 'status', fService: 'service', fUnit: 'unit', fSort: 'sort' };
      Object.keys(map).forEach(function (id) {
        var el = root.querySelector('#' + id);
        if (el) el.addEventListener('change', function (e) { S[map[id]] = e.target.value; S.page = 1; renderPanel(); });
      });
      var ov = root.querySelector('#fOverdue');
      if (ov) ov.addEventListener('change', function (e) { S.overdue = e.target.checked; S.page = 1; renderPanel(); });

      ['#clearFilters', '#clearFilters2'].forEach(function (sel) {
        var b = root.querySelector(sel);
        if (b) b.addEventListener('click', function () {
          S.q = ''; S.status = 'all'; S.service = 'all'; S.priority = 'all'; S.overdue = false; S.sort = 'updated'; S.page = 1;
          S.unit = A.session().scope === 'unit' ? A.session().unit : 'all';
          renderPanel();
        });
      });

      var all = root.querySelector('#selAll');
      if (all) all.addEventListener('change', function (e) {
        page.forEach(function (r) { S.sel[r.id] = e.target.checked; });
        renderPanel();
      });

      root.addEventListener('click', function (e) {
        var cb = e.target.closest('[data-sel]');
        if (cb) { S.sel[cb.getAttribute('data-sel')] = cb.checked; e.stopPropagation(); return renderPanel(); }

        var pg = e.target.closest('[data-page]');
        if (pg && !pg.disabled) { S.page = Math.max(1, +pg.getAttribute('data-page') || 1); return renderPanel(); }

        var bulk = e.target.closest('[data-bulk]');
        if (bulk) return doBulk(bulk.getAttribute('data-bulk'));

        var row = e.target.closest('[data-row]');
        if (row && !e.target.closest('input')) return openRecord(row.getAttribute('data-row'));
      });
    }

    return { html: html, bind: bind };
  }

  /* ---------- bulk actions ---------- */
  function selected() {
    return PF.store.all().filter(function (r) { return S.sel[r.id]; });
  }

  function doBulk(kind) {
    var rows = selected();
    if (!rows.length) return;
    var who = A.session().name;

    if (kind === 'clear') { S.sel = {}; return renderPanel(); }

    if (kind === 'assign') {
      return PF.dialog({
        title: 'Assign ' + rows.length + (rows.length === 1 ? ' request' : ' requests'),
        okLabel: 'Assign',
        body: '<div class="dgo-field"><label class="dgo-field__label" for="dlgOfficer">Reviewing officer</label>' +
          '<div class="dgo-select"><select class="dgo-select__field" id="dlgOfficer" data-field="officer">' +
          PF.OFFICERS.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('') +
          '</select></div></div>'
      }).then(function (ok) {
        if (!ok) return;
        var officer = PF.dialog.values.officer;
        rows.forEach(function (r) {
          PF.store.update(r.id, { officer: officer }, { status: r.status, label: 'Reassigned to ' + officer + '.', note: '', actor: who });
        });
        PF.store.log('assignment', rows.length + ' records', 'Bulk assignment to ' + officer + ' by ' + who);
        S.sel = {};
        A.refresh();
        PF.toast('success', 'Assigned', rows.length + ' requests are now with ' + officer + '.');
      });
    }

    if (kind === 'advance') {
      var movable = rows.filter(function (r) { return nextStatus(r.status); });
      if (!movable.length) return PF.toast('warning', 'Nothing to advance', 'The selected requests have already reached a decision.');
      return PF.dialog({
        title: 'Advance ' + movable.length + (movable.length === 1 ? ' request' : ' requests'),
        okLabel: 'Advance',
        body: '<p class="pf-note">Each request moves to the next stage in its lifecycle. Requests already at a decision are skipped.</p>'
      }).then(function (ok) {
        if (!ok) return;
        movable.forEach(function (r) {
          var next = nextStatus(r.status);
          PF.store.update(r.id, { status: next }, { status: next, label: stageLabel(next), note: '', actor: who });
        });
        PF.store.log('decision', movable.length + ' records', 'Bulk stage advance by ' + who);
        S.sel = {};
        A.refresh();
        PF.toast('success', 'Queue advanced', movable.length + ' requests moved on.');
      });
    }

    if (kind === 'expedite') {
      rows.forEach(function (r) {
        if (r.priority === 'expedited') return;
        PF.store.update(r.id, { priority: 'expedited' }, { status: r.status, label: 'Marked expedited by the registry.', note: '', actor: who });
      });
      PF.store.log('assignment', rows.length + ' records', 'Bulk expedite by ' + who);
      S.sel = {};
      A.refresh();
      return PF.toast('info', 'Marked expedited', rows.length + ' requests are triaged first.');
    }
  }

  function nextStatus(s) {
    return { received: 'validation', validation: 'review', review: 'approved', 'action-required': 'review' }[s] || null;
  }
  function stageLabel(s) {
    return {
      validation: 'Documents validated by the registry.',
      review: 'Assigned for technical assessment.',
      approved: 'Decision issued — approved.',
      declined: 'Decision issued — not approved.'
    }[s] || PF.status(s).label;
  }

  /* ============================================================
     Record drawer
     ============================================================ */
  var drawer = PF.$('#drawer');

  function slaLine(rec) {
    var total = PF.service(rec.service).sla, used = 0;
    var d = new Date(rec.submittedAt), end = PF.isOpen(rec) ? new Date() : new Date(rec.updatedAt);
    while (d < end) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6) used++; }
    var pct = Math.min(100, Math.round((used / total) * 100)), over = used > total && PF.isOpen(rec);
    return '<div class="dgo-stack dgo-stack--2">' +
      '<div class="dgo-row dgo-row--between" style="font-size:12.5px;white-space:nowrap;gap:12px"><span style="color:var(--dgo-color-fg-muted)">Working days used</span>' +
      '<span style="font-weight:600' + (over ? ';color:var(--dgo-color-danger-subtle-fg)' : '') + '">' + used + ' of ' + total + '</span></div>' +
      '<div class="pf-meter" data-over="' + over + '"><i style="width:' + pct + '%"></i></div></div>';
  }

  function openRecord(id) {
    var rec = PF.store.get(id);
    if (!rec) return;
    var events = rec.events.slice().reverse();
    drawer.innerHTML =
      '<div class="pf-drawer__bd" data-close></div>' +
      '<div class="pf-drawer__pn">' +
        '<div class="pf-drawer__hd">' +
          '<div style="flex:1;min-width:0">' +
            '<div class="dgo-row" style="gap:8px;flex-wrap:wrap"><span class="pf-rec__id" style="font-size:14px;white-space:nowrap">' + rec.id + '</span>' + PF.pill(rec.status) +
            (PF.isOverdue(rec) ? '<span class="dgo-pill dgo-pill--danger"><span class="dgo-pill__dot"></span>Overdue</span>' : '') +
            (rec.priority === 'expedited' ? '<span class="dgo-pill dgo-pill--escalated"><span class="dgo-pill__dot"></span>Expedited</span>' : '') + '</div>' +
            '<h2 style="margin:8px 0 0;font-family:var(--dgo-family-display);font-size:19px;line-height:1.25">' + PF.esc(rec.title) + '</h2>' +
          '</div>' +
          '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm dgo-btn--icon" data-close aria-label="Close">' + PF.icon('close', 'icon-sm') + '</button>' +
        '</div>' +
        '<div class="pf-drawer__bdy dgo-stack dgo-stack--5">' +
          slaLine(rec) +
          '<dl class="pf-kv">' +
            '<dt>Service</dt><dd>' + PF.esc(rec.serviceName) + ' <span class="pf-mono" style="color:var(--dgo-color-fg-muted)">(' + rec.serviceCode + ')</span></dd>' +
            '<dt>Unit</dt><dd>' + PF.esc(rec.unit) + '</dd>' +
            '<dt>Officer</dt><dd>' + PF.esc(rec.officer) + '</dd>' +
            '<dt>Requester</dt><dd>' + PF.esc(rec.name) + '<br><span class="pf-note">' + PF.esc(rec.org) + ' · ' + PF.esc(rec.orgType) + '</span></dd>' +
            '<dt>Contact</dt><dd><a class="pf-inline-link" href="mailto:' + PF.esc(rec.email) + '">' + PF.esc(rec.email) + '</a>' + (rec.phone ? '<br><span class="pf-note">' + PF.esc(rec.phone) + '</span>' : '') + '</dd>' +
            '<dt>State</dt><dd>' + PF.esc(rec.state || '—') + '</dd>' +
            '<dt>Received</dt><dd>' + PF.dateTime(rec.submittedAt) + '</dd>' +
            '<dt>Due</dt><dd>' + PF.date(rec.dueAt) + '</dd>' +
            '<dt>Attachments</dt><dd>' + (rec.files.length ? rec.files.map(function (f) {
              return '<span class="dgo-row" style="gap:8px">' + PF.icon('file', 'icon-sm') + PF.esc(f.name) + ' <span class="pf-mono" style="color:var(--dgo-color-fg-muted)">' + PF.bytes(f.size) + '</span></span>';
            }).join('') : '—') + '</dd>' +
            '<dt>Description</dt><dd style="white-space:pre-line">' + PF.esc(rec.description || '—') + '</dd>' +
          '</dl>' +
          '<div class="dgo-stack dgo-stack--3">' +
            '<span class="dgo-field__label">Timeline · ' + events.length + ' entries</span>' +
            '<ol class="pf-tl">' + events.map(function (e) {
              return '<li><div class="pf-tl__a">' + PF.esc(e.label) + '</div>' +
                '<div class="pf-tl__m"><span>' + PF.dateTime(e.at) + '</span><span>·</span><span>' + PF.esc(e.actor || 'Registry') + '</span></div>' +
                (e.note ? '<p class="pf-tl__note">' + PF.esc(e.note) + '</p>' : '') + '</li>';
            }).join('') + '</ol>' +
          '</div>' +
        '</div>' +
        '<div class="pf-drawer__ft">' +
          (PF.isOpen(rec) ? '<button class="dgo-btn dgo-btn--primary dgo-btn--sm" data-act="advance">' + PF.icon('arrow-right', 'icon-sm') + (nextStatus(rec.status) === 'approved' ? 'Approve' : 'Advance stage') + '</button>' : '') +
          (PF.isOpen(rec) ? '<button class="dgo-btn dgo-btn--secondary dgo-btn--sm" data-act="info">' + PF.icon('help', 'icon-sm') + 'Request information</button>' : '') +
          (PF.isOpen(rec) ? '<button class="dgo-btn dgo-btn--secondary dgo-btn--sm" data-act="assign">' + PF.icon('users', 'icon-sm') + 'Reassign</button>' : '') +
          (PF.isOpen(rec) ? '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm" data-act="decline" style="color:var(--dgo-color-action-danger)">Decline</button>' : '') +
          '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm" data-act="note">' + PF.icon('chat', 'icon-sm') + 'Add note</button>' +
          '<a class="dgo-btn dgo-btn--ghost dgo-btn--sm" style="margin-left:auto" href="track.html?id=' + encodeURIComponent(rec.id) + '&email=' + encodeURIComponent(rec.email) + '">' + PF.icon('external', 'icon-sm') + 'Citizen view</a>' +
        '</div>' +
      '</div>';
    drawer.setAttribute('data-open', 'true');
    document.body.style.overflow = 'hidden';
    var closeBtn = drawer.querySelector('[data-close]');
    if (closeBtn) closeBtn.focus();
  }

  function closeDrawer() {
    drawer.setAttribute('data-open', 'false');
    drawer.innerHTML = '';
    document.body.style.overflow = '';
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.getAttribute('data-open') === 'true') closeDrawer();
  });

  drawer.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) return closeDrawer();
    var act = e.target.closest('[data-act]');
    if (!act) return;
    var id = drawer.querySelector('.pf-rec__id').textContent.trim();
    var rec = PF.store.get(id);
    var who = A.session().name;
    var kind = act.getAttribute('data-act');

    var noteField = function (label, ph) {
      return '<div class="dgo-field"><label class="dgo-field__label" for="dlgText">' + label + '</label>' +
        '<textarea class="dgo-textarea" id="dlgText" data-field="text" rows="4" placeholder="' + ph + '"></textarea></div>';
    };
    var after = function (msg, tone) {
      A.refresh();
      openRecord(id);
      PF.toast(tone || 'success', msg, rec.id + ' · ' + PF.status(PF.store.get(id).status).label);
    };

    if (kind === 'advance') {
      var next = nextStatus(rec.status);
      return PF.dialog({
        title: next === 'approved' ? 'Approve this request?' : 'Move to ' + PF.status(next).label,
        sub: rec.id,
        okLabel: next === 'approved' ? 'Approve' : 'Move on',
        body: (next === 'approved' ? '<p class="pf-note" style="margin-bottom:12px">The decision is published on the requester’s timeline and emailed to ' + PF.esc(rec.email) + '.</p>' : '') +
          noteField('Note for the timeline (optional)', next === 'approved' ? 'Certificate reference, conditions, next steps.' : 'What was checked at this stage.')
      }).then(function (ok) {
        if (!ok) return;
        PF.store.update(rec.id, { status: next }, { status: next, label: stageLabel(next), note: (PF.dialog.values.text || '').trim(), actor: who });
        PF.store.log('decision', rec.id, PF.status(next).label + ' set by ' + who);
        after(next === 'approved' ? 'Request approved' : 'Stage updated');
      });
    }

    if (kind === 'info') {
      return PF.dialog({
        title: 'Request information from the requester',
        sub: rec.id,
        okLabel: 'Send request',
        body: noteField('What do you need?', 'Be specific — name the document, the section or the reference you need.') +
          '<p class="pf-note" style="margin-top:10px">The request appears on the citizen timeline and the working-day clock pauses until they respond.</p>'
      }).then(function (ok) {
        if (!ok) return;
        var text = (PF.dialog.values.text || '').trim();
        if (text.length < 10) return PF.toast('error', 'Too short', 'Say exactly what is needed.');
        PF.store.update(rec.id, { status: 'action-required' }, { status: 'action-required', label: 'Additional information requested.', note: text, actor: who });
        PF.store.log('decision', rec.id, 'Information requested by ' + who);
        after('Information requested', 'info');
      });
    }

    if (kind === 'assign') {
      return PF.dialog({
        title: 'Reassign this request',
        sub: rec.id,
        okLabel: 'Reassign',
        body: '<div class="dgo-field"><label class="dgo-field__label" for="dlgOfficer">Reviewing officer</label>' +
          '<div class="dgo-select"><select class="dgo-select__field" id="dlgOfficer" data-field="officer">' +
          PF.OFFICERS.map(function (o) { return '<option value="' + o + '"' + (o === rec.officer ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
          '</select></div></div>' +
          '<div class="dgo-field" style="margin-top:14px"><label class="dgo-field__label" for="dlgUnit">Handling unit</label>' +
          '<div class="dgo-select"><select class="dgo-select__field" id="dlgUnit" data-field="unit">' +
          PF.UNITS.map(function (u) { return '<option value="' + u + '"' + (u === rec.unit ? ' selected' : '') + '>' + u + '</option>'; }).join('') +
          '</select></div></div>'
      }).then(function (ok) {
        if (!ok) return;
        var officer = PF.dialog.values.officer, unit = PF.dialog.values.unit;
        PF.store.update(rec.id, { officer: officer, unit: unit }, {
          status: rec.status,
          label: 'Reassigned to ' + officer + (unit !== rec.unit ? ' · ' + unit : '') + '.',
          note: '', actor: who
        });
        PF.store.log('assignment', rec.id, 'Reassigned to ' + officer + ' by ' + who);
        after('Reassigned', 'info');
      });
    }

    if (kind === 'decline') {
      return PF.dialog({
        title: 'Decline this request?',
        sub: rec.id,
        okLabel: 'Decline',
        tone: 'danger',
        body: '<p class="pf-note" style="margin-bottom:12px">The reason is published on the requester’s timeline. Declining closes the record.</p>' +
          noteField('Reason', 'Explain the ground for refusal and whether resubmission is welcome.')
      }).then(function (ok) {
        if (!ok) return;
        var text = (PF.dialog.values.text || '').trim();
        if (text.length < 10) return PF.toast('error', 'A reason is required', 'Declined decisions must be explained.');
        PF.store.update(rec.id, { status: 'declined' }, { status: 'declined', label: 'Decision issued — not approved.', note: text, actor: who });
        PF.store.log('decision', rec.id, 'Declined by ' + who);
        after('Request declined', 'warning');
      });
    }

    if (kind === 'note') {
      return PF.dialog({
        title: 'Add a note',
        sub: rec.id,
        okLabel: 'Add note',
        body: noteField('Note', 'Context for whoever picks this file up next.')
      }).then(function (ok) {
        if (!ok) return;
        var text = (PF.dialog.values.text || '').trim();
        if (text.length < 5) return PF.toast('error', 'Note too short', '');
        PF.store.update(rec.id, {}, { status: rec.status, label: 'Note added by ' + who + '.', note: text, actor: who });
        after('Note added', 'info');
      });
    }
  });

  /* ============================================================
     Panel switching
     ============================================================ */
  function renderPanel(keepFocus) {
    var host = PF.$('#panel');
    var focusId = keepFocus && document.activeElement ? document.activeElement.id : null;
    var caret = focusId && document.activeElement.selectionStart;
    var view = S.tab === 'cases' ? PF.panels.cases(A)
      : S.tab === 'performance' ? PF.panels.performance(A)
      : S.tab === 'audit' ? PF.panels.audit(A)
      : queuePanel();
    host.innerHTML = view.html;
    if (view.bind) view.bind(host);
    if (focusId) {
      var back = host.querySelector('#' + focusId);
      if (back) { back.focus(); if (caret != null && back.setSelectionRange) try { back.setSelectionRange(caret, caret); } catch (e) {} }
    }
  }

  /* ============================================================
     Boot
     ============================================================ */
  if (PF.store.admin.signedIn()) openConsole();
  else {
    signStatus('info', 'Sign in to continue', 'Use a directorate account, or pick one of the demonstration accounts below.');
    PF.$('#user').focus();
  }
};
