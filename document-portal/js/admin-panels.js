/* Operations console — support inbox, performance and audit panels.
   Each panel returns { html, bind } so admin.js can swap sections without
   re-mounting the console shell. */
window.PF = window.PF || {};
PF.panels = {};

(function () {
  'use strict';

  function caseStatusPill(s) {
    var map = { open: ['pending', 'Open'], 'in-progress': ['routed', 'In progress'], resolved: ['success', 'Resolved'] };
    var m = map[s] || map.open;
    return '<span class="dgo-pill dgo-pill--' + m[0] + '"><span class="dgo-pill__dot"></span>' + m[1] + '</span>';
  }

  function seg(items, active, attr) {
    return '<div class="dgo-btn-group" role="group">' + items.map(function (i) {
      var on = i[0] === active;
      return '<button type="button" class="dgo-btn dgo-btn--' + (on ? 'primary' : 'secondary') + ' dgo-btn--sm" ' + attr + '="' + i[0] + '"' + (on ? ' aria-pressed="true"' : '') + '>' + i[1] + '</button>';
    }).join('') + '</div>';
  }

  function meterRow(label, value, max, note) {
    var pct = max ? Math.round((value / max) * 100) : 0;
    return '<li><span style="font-size:13px;color:var(--dgo-color-fg-default)">' + PF.esc(label) + '</span>' +
      '<span class="pf-mono" style="font-size:12.5px;color:var(--dgo-color-fg-muted)">' + (note || value) + '</span>' +
      '<div class="pf-meter"><i style="width:' + Math.max(pct, value ? 4 : 0) + '%"></i></div></li>';
  }

  function statRow(label, value, tone) {
    return '<div class="dgo-row" style="gap:12px;align-items:baseline">' +
      '<span style="flex:1;font-size:12.5px;color:var(--dgo-color-fg-muted)">' + label + '</span>' +
      '<span class="pf-mono" style="font-weight:600;white-space:nowrap' + (tone ? ';color:' + tone : '') + '">' + value + '</span></div>';
  }

  /* ============================================================
     Support inbox
     ============================================================ */
  PF.panels.cases = function (A) {
    var all = PF.store.tickets();
    var f = A.state.caseFilter || 'all';
    var list = all.filter(function (t) { return f === 'all' ? true : t.status === f; });
    var counts = {
      all: all.length,
      open: all.filter(function (t) { return t.status === 'open'; }).length,
      'in-progress': all.filter(function (t) { return t.status === 'in-progress'; }).length,
      resolved: all.filter(function (t) { return t.status === 'resolved'; }).length
    };

    var rows = list.map(function (t) {
      var last = t.replies && t.replies.length ? t.replies[t.replies.length - 1] : null;
      return '<tr>' +
        '<td><span class="pf-rec__id">' + PF.esc(t.ref) + '</span></td>' +
        '<td>' + PF.esc(t.topicLabel) + (last ? '<div class="pf-note" style="max-width:38ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Last reply: ' + PF.esc(last.text) + '</div>' : '') + '</td>' +
        '<td>' + PF.esc(t.name) + '<div class="pf-note">' + PF.esc(t.email) + '</div></td>' +
        '<td>' + (t.requestId ? '<a class="pf-inline-link pf-mono" href="track.html?id=' + encodeURIComponent(t.requestId) + '&email=' + encodeURIComponent(t.email) + '">' + PF.esc(t.requestId) + '</a>' : '<span style="color:var(--dgo-color-fg-subtle)">—</span>') + '</td>' +
        '<td class="pf-mono" style="font-size:12px">' + PF.rel(t.at) + '</td>' +
        '<td>' + caseStatusPill(t.status) + '</td>' +
        '<td><div class="dgo-row" style="gap:6px;justify-content:flex-end">' +
          (t.status !== 'resolved' ? '<button class="dgo-btn dgo-btn--secondary dgo-btn--sm" data-reply="' + PF.esc(t.ref) + '">Reply</button>' : '') +
          (t.status === 'open' ? '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm" data-claim="' + PF.esc(t.ref) + '">Claim</button>' : '') +
          (t.status === 'resolved' ? '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm" data-reopen="' + PF.esc(t.ref) + '">Reopen</button>' : '') +
        '</div></td></tr>';
    }).join('');

    var html =
      '<div class="dgo-stack dgo-stack--4">' +
        '<div class="dgo-filter-bar">' +
          seg([['all', 'All ' + counts.all], ['open', 'Open ' + counts.open], ['in-progress', 'In progress ' + counts['in-progress']], ['resolved', 'Resolved ' + counts.resolved]], f, 'data-case-filter') +
        '</div>' +
        '<p class="pf-note" style="margin:0">Cases opened on the support page arrive here immediately. Replying resolves the case unless you keep it open.</p>' +
        (list.length ?
          '<div class="dgo-table-wrap" style="overflow-x:auto"><table class="dgo-table"><thead><tr>' +
            '<th>Reference</th><th>Topic</th><th>Requester</th><th>Linked request</th><th>Opened</th><th>Status</th><th style="text-align:end">Action</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<div class="pf-panel"><div class="dgo-empty"><span class="pf-drop__ic">' + PF.icon('chat') + '</span>' +
            '<div class="dgo-empty__title">No cases in this view</div><p class="dgo-empty__body">Nothing is waiting on the helpdesk with that status.</p></div></div>') +
      '</div>';

    function bind(root) {
      root.addEventListener('click', function (e) {
        var seg = e.target.closest('[data-case-filter]');
        if (seg) { A.state.caseFilter = seg.getAttribute('data-case-filter'); return A.refresh(); }

        var reply = e.target.closest('[data-reply]');
        if (reply) {
          var ref = reply.getAttribute('data-reply');
          var t = PF.store.tickets().filter(function (x) { return x.ref === ref; })[0];
          return PF.dialog({
            title: 'Reply to ' + ref,
            sub: t.topicLabel + ' · ' + t.email,
            okLabel: 'Send and resolve',
            cancelLabel: 'Cancel',
            body: '<div class="dgo-alert dgo-alert--info" style="margin-bottom:14px"><span class="dgo-alert__icon">' + PF.icon('chat', 'icon-sm') + '</span>' +
              '<div class="dgo-alert__body"><div class="dgo-alert__title">What was asked</div><p style="margin:0;white-space:pre-line">' + PF.esc(t.message) + '</p></div></div>' +
              '<div class="dgo-field"><label class="dgo-field__label" for="dlgText">Your reply</label>' +
              '<textarea class="dgo-textarea" id="dlgText" data-field="text" rows="5" placeholder="Answer the question and say what happens next."></textarea></div>' +
              '<label class="dgo-check" style="margin-top:12px"><input type="checkbox" data-field="keepOpen"><span style="font-size:13px;color:var(--dgo-color-fg-muted)">Keep the case open after replying</span></label>'
          }).then(function (ok) {
            if (!ok) return;
            var text = (PF.dialog.values.text || '').trim();
            if (text.length < 10) return PF.toast('error', 'Reply too short', 'Give the requester something they can act on.');
            var keep = !!PF.dialog.values.keepOpen;
            PF.store.updateTicket(ref, { status: keep ? 'in-progress' : 'resolved' }, { by: A.session().name, text: text });
            PF.store.log('support', ref, 'Helpdesk replied' + (keep ? ' — case kept open' : ' and resolved the case'));
            PF.toast('success', keep ? 'Reply sent' : 'Case resolved', ref + ' → ' + t.email);
            A.refresh();
          });
        }

        var claim = e.target.closest('[data-claim]');
        if (claim) {
          var cref = claim.getAttribute('data-claim');
          PF.store.updateTicket(cref, { status: 'in-progress', owner: A.session().name });
          PF.store.log('support', cref, 'Case claimed by ' + A.session().name);
          PF.toast('info', 'Case claimed', cref + ' is now with you.');
          return A.refresh();
        }

        var reopen = e.target.closest('[data-reopen]');
        if (reopen) {
          var rref = reopen.getAttribute('data-reopen');
          PF.store.updateTicket(rref, { status: 'open' });
          PF.store.log('support', rref, 'Case reopened by ' + A.session().name);
          PF.toast('info', 'Case reopened', rref);
          return A.refresh();
        }
      });
    }

    return { html: html, bind: bind };
  };

  /* ============================================================
     Performance
     ============================================================ */
  PF.panels.performance = function () {
    var all = PF.store.all(), m = PF.metrics(), now = new Date();

    /* eight-week intake */
    var weeks = [];
    for (var w = 7; w >= 0; w--) {
      var end = new Date(now); end.setDate(end.getDate() - w * 7);
      var start = new Date(end); start.setDate(start.getDate() - 6);
      weeks.push({
        label: (w === 0 ? 'now' : '-' + w + 'w'),
        n: all.filter(function (r) { var d = new Date(r.submittedAt); return d >= start && d <= end; }).length
      });
    }
    var peak = Math.max.apply(null, weeks.map(function (x) { return x.n; }).concat([1]));

    /* open ages */
    var openRecs = all.filter(PF.isOpen);
    var ages = openRecs.map(function (r) { return PF.daysBetween(r.submittedAt, now.toISOString()); }).sort(function (a, b) { return a - b; });
    var median = ages.length ? ages[Math.floor(ages.length / 2)] : 0;
    var oldest = ages.length ? ages[ages.length - 1] : 0;

    /* service load */
    var svc = PF.CORRESPONDENCE_TYPES.map(function (s) {
      var rows = all.filter(function (r) { return r.service === s.key; });
      var openN = rows.filter(PF.isOpen).length;
      return { name: s.label, code: s.category, total: rows.length, open: openN, sla: PF.ACK_TARGET_DAYS };
    }).filter(function (s) { return s.total; }).sort(function (a, b) { return b.total - a.total; });
    var svcMax = Math.max.apply(null, svc.map(function (s) { return s.total; }).concat([1]));

    /* officer workload */
    var officers = PF.OFFICERS.map(function (o) {
      var rows = openRecs.filter(function (r) { return r.officer === o; });
      return { name: o, open: rows.length, overdue: rows.filter(PF.isOverdue).length };
    }).sort(function (a, b) { return b.open - a.open; });
    var offMax = Math.max.apply(null, officers.map(function (o) { return o.open; }).concat([1]));

    /* status split */
    var statusKeys = Object.keys(PF.STATUS);
    var stMax = Math.max.apply(null, statusKeys.map(function (k) { return m.byStatus[k] || 0; }).concat([1]));

    var html =
      '<div class="dgo-stack dgo-stack--5">' +
        '<div class="dgo-grid dgo-grid--3" style="gap:14px">' +
          '<div class="pf-panel"><div class="pf-panel__body dgo-row" style="gap:16px;align-items:center">' +
            '<span class="dgo-progress-ring" style="--_p:' + m.onTimeRate + '"><span>' + m.onTimeRate + '%</span></span>' +
            '<div><div style="font-size:13.5px;font-weight:600;color:var(--dgo-color-fg-strong)">Closed within target</div>' +
            '<p class="pf-note" style="margin:4px 0 0">' + m.onTime + ' of ' + m.closed + ' closed requests met the published working-day target.</p></div>' +
          '</div></div>' +
          '<div class="pf-panel"><div class="pf-panel__body dgo-row" style="gap:16px;align-items:center">' +
            '<span class="dgo-progress-ring" style="--_p:' + m.clearanceRate + '"><span>' + m.clearanceRate + '%</span></span>' +
            '<div><div style="font-size:13.5px;font-weight:600;color:var(--dgo-color-fg-strong)">Approval rate</div>' +
            '<p class="pf-note" style="margin:4px 0 0">' + m.approved + ' approved against ' + m.declined + ' declined on decided requests.</p></div>' +
          '</div></div>' +
          '<div class="pf-panel"><div class="pf-panel__body dgo-stack dgo-stack--2">' +
            statRow('Median age, open', median + ' d') +
            statRow('Oldest open request', oldest + ' d') +
            statRow('Expedited in queue', m.expedited) +
            statRow('Overdue', m.overdue, m.overdue ? 'var(--dgo-color-danger-subtle-fg)' : '') +
          '</div></div>' +
        '</div>' +

        '<div class="dgo-grid dgo-grid--2" style="gap:14px;align-items:start">' +
          '<div class="pf-panel"><div class="pf-panel__head">' + PF.icon('chart', 'icon-sm') + '<h2 class="pf-panel__title">Intake, last eight weeks</h2></div>' +
            '<div class="pf-panel__body"><div class="pf-bars">' + weeks.map(function (x) {
              return '<div class="pf-bars__c" title="' + x.n + ' received"><span class="pf-mono" style="font-size:11px;color:var(--dgo-color-fg-muted)">' + x.n + '</span>' +
                '<span class="pf-bars__b" style="height:' + Math.max(3, Math.round((x.n / peak) * 100)) + '%"></span>' +
                '<span class="pf-bars__l">' + x.label + '</span></div>';
            }).join('') + '</div></div></div>' +

          '<div class="pf-panel"><div class="pf-panel__head">' + PF.icon('filter', 'icon-sm') + '<h2 class="pf-panel__title">Where the queue sits</h2></div>' +
            '<div class="pf-panel__body"><ul class="pf-split-list">' + statusKeys.map(function (k) {
              return meterRow(PF.STATUS[k].label, m.byStatus[k] || 0, stMax);
            }).join('') + '</ul></div></div>' +
        '</div>' +

        '<div class="dgo-grid dgo-grid--2" style="gap:14px;align-items:start">' +
          '<div class="pf-panel"><div class="pf-panel__head">' + PF.icon('folder', 'icon-sm') + '<h2 class="pf-panel__title">Load by service</h2></div>' +
            '<div class="pf-panel__body"><ul class="pf-split-list">' + svc.map(function (s) {
              return meterRow(s.name, s.total, svcMax, s.open + ' open · ' + s.total + ' total');
            }).join('') + '</ul></div></div>' +

          '<div class="pf-panel"><div class="pf-panel__head">' + PF.icon('users', 'icon-sm') + '<h2 class="pf-panel__title">Officer workload</h2></div>' +
            '<div class="pf-panel__body"><ul class="pf-split-list">' + officers.map(function (o) {
              return meterRow(o.name, o.open, offMax, o.open + ' open' + (o.overdue ? ' · ' + o.overdue + ' overdue' : ''));
            }).join('') + '</ul>' +
            '<p class="pf-note" style="margin-top:14px">Workload counts every request that has not reached a decision, including those waiting on the requester.</p></div></div>' +
        '</div>' +
      '</div>';

    return { html: html };
  };

  /* ============================================================
     Audit trail
     ============================================================ */
  PF.panels.audit = function (A) {
    var log = PF.store.audit();
    var kinds = ['all'].concat(log.map(function (e) { return e.kind; }).filter(function (k, i, a) { return a.indexOf(k) === i; }));
    var f = A.state.auditFilter || 'all';
    var list = log.filter(function (e) { return f === 'all' || e.kind === f; });
    var tone = { submission: 'success', support: 'info', decision: 'success', lookup: 'routed', integration: 'draft', auth: 'escalated', system: 'archived', assignment: 'routed', response: 'action', withdraw: 'danger' };

    var html =
      '<div class="dgo-stack dgo-stack--4">' +
        '<div class="dgo-filter-bar">' +
          '<label class="dgo-field__label" for="auditKind" style="margin:0">Activity</label>' +
          '<div class="dgo-select" style="min-width:200px"><select class="dgo-select__field" id="auditKind">' +
            kinds.map(function (k) { return '<option value="' + k + '"' + (k === f ? ' selected' : '') + '>' + (k === 'all' ? 'Everything' : k.charAt(0).toUpperCase() + k.slice(1)) + '</option>'; }).join('') +
          '</select></div>' +
          '<span class="pf-note" style="margin-left:auto">' + list.length + ' of ' + log.length + ' entries · newest first</span>' +
        '</div>' +
        (list.length ?
          '<div class="pf-panel"><ul class="pf-recs">' + list.slice(0, 80).map(function (e) {
            return '<li><div class="pf-rec" style="cursor:default">' +
              '<span class="pf-rec__top"><span class="dgo-pill dgo-pill--' + (tone[e.kind] || 'draft') + '"><span class="dgo-pill__dot"></span>' + PF.esc(e.kind) + '</span>' +
              '<span class="pf-rec__id">' + PF.esc(e.ref || '—') + '</span>' +
              '<span class="pf-note pf-mono" style="margin-left:auto">' + PF.dateTime(e.at) + '</span></span>' +
              '<span class="pf-rec__meta" style="white-space:normal">' + PF.esc(e.message) + '</span></div></li>';
          }).join('') + '</ul>' +
          (list.length > 80 ? '<div class="pf-panel__foot"><span class="pf-note">Showing the 80 most recent entries. Export the CSV for the full trail.</span></div>' : '') +
          '</div>'
          : '<div class="pf-panel"><div class="dgo-empty"><span class="pf-drop__ic">' + PF.icon('shield') + '</span>' +
            '<div class="dgo-empty__title">Nothing recorded yet</div><p class="dgo-empty__body">Submissions, lookups, decisions and workflow deliveries all write a line here.</p></div></div>') +
      '</div>';

    function bind(root) {
      var sel = root.querySelector('#auditKind');
      if (sel) sel.addEventListener('change', function (e) { A.state.auditFilter = e.target.value; A.refresh(); });
    }

    return { html: html, bind: bind };
  };

  /* ============================================================
     CSV
     ============================================================ */
  PF.panels.csv = function (rows) {
    var head = ['Tracking ID', 'Service', 'Code', 'Unit', 'Subject', 'Requester', 'Organisation', 'Email', 'Priority', 'Status', 'Officer', 'Received', 'Due', 'Last update', 'Overdue', 'Attachments'];
    var cell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [head.map(cell).join(',')];
    rows.forEach(function (r) {
      lines.push([
        r.id, r.typeLabel, r.category, r.unit, r.title, r.name, r.org, r.email,
        r.priority, PF.status(r.status).label, r.officer,
        r.submittedAt.slice(0, 10), r.ackDueAt.slice(0, 10), r.updatedAt.slice(0, 10),
        PF.isOverdue(r) ? 'yes' : 'no',
        r.files.map(function (f) { return f.name; }).join(' | ')
      ].map(cell).join(','));
    });
    return lines.join('\r\n');
  };
})();
