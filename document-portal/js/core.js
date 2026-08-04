/* NITDA Intelligent Portal — core runtime.
   Shared by every page: icon sprite, theme, persistent store, shell chrome,
   toasts, dialogs and the command palette. Plain classic script, no build step. */
(function () {
  'use strict';
  var PF = window.PF;

  /* ============================================================
     1 · Utilities
     ============================================================ */
  PF.$ = function (sel, root) { return (root || document).querySelector(sel); };
  PF.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  PF.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  PF.icon = function (name, cls) {
    return '<svg class="' + (cls || 'icon') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  };

  PF.uid = function () {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
    var buf = new Uint32Array(9);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 9; i++) out += abc[buf[i] % abc.length];
    return 'NITDA-' + out;
  };

  PF.bytes = function (n) {
    if (!n && n !== 0) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  };

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  PF.date = function (iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  };
  PF.dateTime = function (iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    var hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    return PF.date(iso) + ' · ' + hh + ':' + mm;
  };
  PF.rel = function (iso) {
    var diff = Date.now() - new Date(iso).getTime();
    var m = Math.round(diff / 60000), h = Math.round(diff / 3600000), d = Math.round(diff / 86400000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    if (d < 31) return d + (d === 1 ? ' day ago' : ' days ago');
    return PF.date(iso);
  };
  PF.daysBetween = function (a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); };

  /* Working-day arithmetic (Mon–Fri) used for every service-level target. */
  PF.addWorkingDays = function (from, n) {
    var d = new Date(from), added = 0;
    while (added < n) {
      d.setDate(d.getDate() + 1);
      var w = d.getDay();
      if (w !== 0 && w !== 6) added++;
    }
    return d.toISOString();
  };

  /* Correspondence type lookup. Replaced PF.service(): the portal classifies
     incoming correspondence, it does not sell services. Unknown keys fall back to
     the catch-all type rather than to whatever happens to be last in the list. */
  PF.correspondenceType = function (key) {
    var list = PF.CORRESPONDENCE_TYPES;
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
    for (var j = 0; j < list.length; j++) if (list[j].key === 'other') return list[j];
    return list[list.length - 1];
  };
  PF.status = function (key) { return PF.STATUS[key] || PF.STATUS.received; };
  PF.pill = function (key) {
    var s = PF.status(key);
    return '<span class="dgo-pill dgo-pill--' + s.pill + '"><span class="dgo-pill__dot"></span>' + s.label + '</span>';
  };
  PF.isOpen = function (rec) { return ['approved', 'declined', 'withdrawn'].indexOf(rec.status) === -1; };
  /* 'Overdue' now means the acknowledgement window has lapsed, not that a decision is
     late — the registry commits to acknowledging receipt, not to a decision date. */
  PF.isOverdue = function (rec) { return PF.isOpen(rec) && new Date(rec.ackDueAt) < new Date(); };

  /* ============================================================
     2 · Persistent store
     ============================================================ */
  var K = {
    recs: 'nitda.portal.records.v2',
    mine: 'nitda.portal.mine.v2',
    tick: 'nitda.portal.tickets.v2',
    audit: 'nitda.portal.audit.v2',
    draft: 'nitda.portal.draft.v2',
    out: 'nitda.portal.outbox.v2',
    theme: 'nitda.portal.theme',
    welcome: 'nitda.portal.welcome'
  };

  /* The retired operations console left a staff session — name, role, directorate — in
     sessionStorage. The console is gone, so nothing reads it, but a browser that used it
     is still holding the data. Clear it once on load rather than leaving it to expire
     whenever that tab happens to close. */
  try { sessionStorage.removeItem('nitda.portal.admin'); } catch (e) {}

  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }
  function agoISO(days, hourSeed) {
    var d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(8 + (hourSeed % 9), (hourSeed * 7) % 60, 0, 0);
    return d.toISOString();
  }

  function install() {
    var out = PF.SEEDS.map(function (s, i) {
      var ct = PF.correspondenceType(s.type);
      var submitted = agoISO(s.days, i + 3);
      var events = s.events.map(function (e, j) {
        return { at: agoISO(e.d, i + j + 4), status: e.s, label: e.a, note: e.n || '', actor: j === 0 ? 'Portal' : 'Registry' };
      });
      return {
        id: s.id, type: s.type, typeLabel: ct.label, category: ct.category, correspondenceType: 'Incoming', unit: s.unit || 'Registry & Correspondence',
        title: s.title, description: s.title + ' submitted through the NITDA Intelligent Portal.',
        name: s.name, email: s.email, phone: '', org: s.org, orgType: s.orgType, state: s.state,
        priority: s.priority, status: s.status, officer: s.officer, channel: 'Portal',
        files: s.files.map(function (f) { return { name: f.name, size: f.size }; }),
        submittedAt: submitted, updatedAt: events[events.length - 1].at,
        ackDueAt: PF.addWorkingDays(submitted, PF.ACK_TARGET_DAYS), events: events, seeded: true
      };
    });
    write(K.recs, out);
    return out;
  }

  PF.store = {
    all: function () {
      var r = read(K.recs, null);
      if (!r) r = install();
      return r;
    },
    get: function (id) {
      id = String(id || '').trim().toUpperCase();
      var all = this.all();
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return null;
    },
    save: function (list) { write(K.recs, list); },
    add: function (rec) {
      var all = this.all();
      all.unshift(rec);
      write(K.recs, all);
      var mine = read(K.mine, []);
      mine.unshift({ id: rec.id, email: rec.email, at: rec.submittedAt, title: rec.title });
      write(K.mine, mine.slice(0, 20));
      PF.store.log('submission', rec.id, 'Submission created via portal');
      return rec;
    },
    update: function (id, patch, event) {
      var all = this.all(), hit = null;
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === id) {
          hit = all[i];
          for (var k in patch) hit[k] = patch[k];
          hit.updatedAt = new Date().toISOString();
          if (event) hit.events.push(Object.assign({ at: hit.updatedAt, actor: 'Reviewer' }, event));
          break;
        }
      }
      if (hit) write(K.recs, all);
      return hit;
    },
    mine: function () { return read(K.mine, []); },
    forgetMine: function () { write(K.mine, []); },
    tickets: function () {
      var t = read(K.tick, null);
      if (!t) {
        t = (PF.SUPPORT_SEEDS || []).map(function (s, i) {
          var topic = (PF.SUPPORT_TOPICS.filter(function (x) { return x.key === s.topic; })[0] || PF.SUPPORT_TOPICS[0]);
          return {
            ref: s.ref, topic: s.topic, topicLabel: topic.label, name: s.name, email: s.email,
            requestId: s.requestId, message: s.message, status: s.status,
            at: agoISO(s.days, i + 5), updatedAt: agoISO(s.replies.length ? s.replies[s.replies.length - 1].d : s.days, i + 6),
            replies: s.replies.map(function (r, j) { return { at: agoISO(r.d, i + j + 7), by: r.by, text: r.text }; }),
            seeded: true
          };
        });
        write(K.tick, t);
      }
      return t;
    },
    addTicket: function (t) {
      var all = PF.store.tickets();
      all.unshift(t);
      write(K.tick, all);
      PF.store.log('support', t.ref, 'Support case opened — ' + t.topicLabel);
      return t;
    },
    updateTicket: function (ref, patch, reply) {
      var all = PF.store.tickets();
      for (var i = 0; i < all.length; i++) {
        if (all[i].ref === ref) {
          for (var k in patch) all[i][k] = patch[k];
          all[i].updatedAt = new Date().toISOString();
          if (reply) all[i].replies.push(Object.assign({ at: all[i].updatedAt, by: 'Helpdesk' }, reply));
        }
      }
      write(K.tick, all);
      return all;
    },
    audit: function () { return read(K.audit, []); },
    log: function (kind, ref, message) {
      var all = read(K.audit, []);
      all.unshift({ at: new Date().toISOString(), kind: kind, ref: ref, message: message });
      write(K.audit, all.slice(0, 200));
    },
    draft: {
      get: function () { return read(K.draft, null); },
      set: function (d) { write(K.draft, d); },
      clear: function () { try { localStorage.removeItem(K.draft); } catch (e) {} }
    },
    reset: function () {
      [K.recs, K.mine, K.tick, K.audit, K.draft, K.out].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      install();
      PF.store.tickets();
      PF.store.log('system', 'REGISTRY', 'Demonstration data reinstalled');
    },
    /* PF.store.admin is gone with the operations console it served. It kept a "signed in"
       staff session in sessionStorage after checking a password held in js/data.js — a
       gate whose entire strength was that the browser agreed to honour it. Triage,
       decisions and audit belong in the internal platform, where identity is enforced
       server-side. See TARGET_ARCHITECTURE.md §3.4. */
  };

  /* ============================================================
     2b · Outbox — workflow delivery that survives being offline
     ============================================================ */
  PF.outbox = {
    all: function () { return read(K.out, []); },
    queue: function (kind, payload, ref) {
      var all = read(K.out, []);
      all.push({ kind: kind, payload: payload, ref: ref || '', at: new Date().toISOString(), tries: 0 });
      write(K.out, all.slice(-50));
    },
    drop: function (item) {
      write(K.out, read(K.out, []).filter(function (x) { return !(x.kind === item.kind && x.at === item.at); }));
    },
    flush: function () {
      var all = read(K.out, []);
      if (!all.length || !navigator.onLine) return;
      all.forEach(function (item) {
        item.tries++;
        var send = item.kind === 'support'
          ? PF.intake.support(item.payload)
          : PF.intake.submit(item.payload, { queue: false });
        send.then(function (res) {
          if (res.delivered || item.tries >= 5) PF.outbox.drop(item);
        });
      });
      write(K.out, all);
    }
  };

  /* ============================================================
     Backend — the configured Power Automate flow endpoints, called directly.

     This replaced PF.flow(), which posted to a SAS-signed Power Automate URL
     hardcoded in this bundle. Two things changed.

     First, no URL is committed any more: each one is supplied at deploy time
     through PF.CONFIG.endpoints (see js/data.js), so nothing in the repository
     is a credential. Second, PF.flow never read a response body — only r.ok —
     so nothing here was ever genuinely two-way. These calls are, so a
     submission now comes back with a registry reference the submitter can
     actually use.

     There is no intermediary. Each call below goes straight to the flow that
     serves it, which means the flow is the only place validation, rate
     limiting, verification and authorisation can happen — see the contract in
     document-portal/README.md.

     Failure is never silent. A call that cannot be delivered is queued in the
     outbox and written to the audit trail, exactly as before.
     ============================================================ */
  function endpointUrl(name) {
    var endpoints = (PF.CONFIG && PF.CONFIG.endpoints) || {};
    return String(endpoints[name] || '').trim();
  }
  PF.backendConfigured = function () { return !!endpointUrl('SUBMISSION'); };

  function readJson(r) {
    return r.text().then(function (t) {
      var data = {};
      try { data = t ? JSON.parse(t) : {}; } catch (e) {}
      return data;
    });
  }

  PF.intake = {
    /* Phase 1 — register the correspondence and receive a reference plus one
       upload ticket per declared attachment. */
    submit: function (record, opts) {
      opts = opts || {};
      var url = endpointUrl('SUBMISSION');
      if (!url) return Promise.resolve({ delivered: false, reason: 'not-configured' });
      if (!navigator.onLine) {
        if (opts.queue !== false) PF.outbox.queue('submission', record, record.localId || '');
        return Promise.resolve({ delivered: false, reason: 'offline' });
      }
      return fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // The proof, when the wizard has one. Absent when verification is not required.
        body: JSON.stringify(opts.verification ? Object.assign({}, record, { verification: opts.verification }) : record)
      }).then(function (r) {
        return readJson(r).then(function (data) {
          if (r.status === 403 && data.error === 'verification_required') {
            /* Not a failure to queue. The submission is well-formed; the address has not
               been verified. Queuing it would retry forever against a control that is
               working as intended, so it is handed back for the wizard to resolve. */
            return { delivered: false, status: 403, reason: 'verification-required' };
          }
          if (!r.ok) {
            if (opts.queue !== false) PF.outbox.queue('submission', record, record.localId || '');
            PF.store.log('integration', record.localId || '', 'Registry refused the submission (HTTP ' + r.status + ')');
            return { delivered: false, status: r.status, reason: data.reason || 'rejected' };
          }
          PF.store.log('integration', data.referenceId || record.localId || '',
            'Registry accepted the submission and issued ' + (data.referenceId || 'a reference'));
          return { delivered: true, referenceId: data.referenceId, uploads: data.uploads || [] };
        });
      }).catch(function () {
        if (opts.queue !== false) PF.outbox.queue('submission', record, record.localId || '');
        PF.store.log('integration', record.localId || '', 'Registry unreachable — submission queued for delivery');
        return { delivered: false, reason: 'unreachable' };
      });
    },

    /* Phase 2 — redeem one ticket with the raw file. Bytes never travel
       base64-encoded inside a JSON payload, which is what forced the 4 MB
       ceiling and the silent truncation this replaced. */
    upload: function (ticket, file) {
      var url = endpointUrl('UPLOAD');
      if (!url) return Promise.resolve({ ok: false, stored: false, reason: 'not-configured' });
      return fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream', 'X-Upload-Ticket': ticket },
        body: file
      }).then(function (r) {
        return readJson(r).then(function (data) {
          return { ok: r.ok, stored: !!data.stored, status: r.status,
                   reason: data.reason || data.error || '', link: data.attachmentLink || '' };
        });
      }).catch(function () { return { ok: false, stored: false, reason: 'unreachable' }; });
    },

    /* A helpdesk case. A create, like a submission, but not correspondence —
       it gets a CASE- reference and never enters the registry. */
    support: function (payload) {
      var url = endpointUrl('SUPPORT');
      if (!url) return Promise.resolve({ delivered: false, reason: 'not-configured' });
      if (!navigator.onLine) {
        PF.outbox.queue('support', payload, '');
        return Promise.resolve({ delivered: false, reason: 'offline' });
      }
      return fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return readJson(r).then(function (data) {
          if (!r.ok) { PF.outbox.queue('support', payload, ''); return { delivered: false, status: r.status }; }
          return { delivered: true, caseRef: data.caseRef };
        });
      }).catch(function () {
        PF.outbox.queue('support', payload, '');
        return { delivered: false, reason: 'unreachable' };
      });
    },

    /* D4 · email verification.

       Two calls: `verifyRequest` asks the verification flow to mail a code to an address, and
       `verifyConfirm` exchanges the code for a single-use proof that `submit` passes along.

       The intake flow decides whether verification is REQUIRED — the portal cannot know, and
       should not guess. When it is not required these are simply never called; when it is,
       a submission without a proof comes back 403 and the wizard asks for the code. That
       keeps one source of truth for the posture, which is the flow. */
    verifyRequest: function (email) {
      var url = endpointUrl('VERIFY');
      if (!url) return Promise.resolve({ ok: false, reason: 'not-configured' });
      return fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      }).then(function (r) {
        return readJson(r).then(function (data) {
          if (r.status === 429) return { ok: false, reason: 'too-many-requests' };
          if (!r.ok) return { ok: false, reason: data.error || 'refused' };
          // `sent:false` means the flow issued a challenge it could not deliver. Telling the
          // submitter to check their inbox would be a lie.
          return { ok: true, sent: data.sent === true, expiresAt: data.expiresAt };
        });
      }).catch(function () { return { ok: false, reason: 'unreachable' }; });
    },

    verifyConfirm: function (email, code) {
      var url = endpointUrl('VERIFY_CONFIRM');
      if (!url) return Promise.resolve({ ok: false, reason: 'not-configured' });
      return fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, code: code })
      }).then(function (r) {
        return readJson(r).then(function (data) {
          if (!r.ok) return { ok: false, reason: 'verification-failed' };
          return { ok: true, verification: data.verification, expiresAt: data.expiresAt };
        });
      }).catch(function () { return { ok: false, reason: 'unreachable' }; });
    },

    /* Read a request's status back from the registry.

       Until this existed the tracking page reported whatever THIS browser's localStorage
       said, so it could not show a decision the registry had actually taken, and a
       submission made on a phone did not exist on a laptop. The local store is now a
       cache of last resort, and callers are told which of the two they are looking at —
       showing device data as though it came from the registry is the failure this
       replaces, so it must never be silent.

       Resolution is one of:
         found      the registry answered and the pair matched
         denied     the registry answered and it did not — authoritative, do not fall back
         unavailable  no read-back configured, offline, or the registry could not be
                    reached. NOT a denial: the caller may show device data, labelled. */
    status: function (referenceId, email) {
      var url = endpointUrl('STATUS');
      if (!url) return Promise.resolve({ resolution: 'unavailable', reason: 'not-configured' });
      if (!navigator.onLine) return Promise.resolve({ resolution: 'unavailable', reason: 'offline' });
      return fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceId: referenceId, email: email })
      }).then(function (r) {
        return readJson(r).then(function (data) {
          if (r.ok) return { resolution: 'found', record: data.record || null };
          // 404 is the registry's single, uniform denial — it deliberately does not say
          // whether the reference was unknown or the email was wrong, and neither does
          // this. 400 is a malformed query, which is also a definite "not this pair".
          if (r.status === 404 || r.status === 400) return { resolution: 'denied' };
          if (r.status === 429) return { resolution: 'unavailable', reason: 'rate-limited' };
          return { resolution: 'unavailable', reason: 'registry-error', status: r.status };
        });
      }).catch(function () {
        return { resolution: 'unavailable', reason: 'unreachable' };
      });
    }
  };

  /* Aggregate figures used by the home page and the operations console. */
  PF.metrics = function () {
    var all = PF.store.all(), now = new Date();
    // byType keys on r.type, the correspondence-type key. It was byService keyed on
    // r.service, a field step 2 removed from the record — so every bucket counted
    // `undefined` and every per-type figure on the home page was silently zero.
    var m = { total: all.length, open: 0, review: 0, action: 0, approved: 0, declined: 0, overdue: 0, expedited: 0, week: 0, onTime: 0, closed: 0, byStatus: {}, byType: {}, byCategory: {} };
    all.forEach(function (r) {
      m.byStatus[r.status] = (m.byStatus[r.status] || 0) + 1;
      if (r.type) m.byType[r.type] = (m.byType[r.type] || 0) + 1;
      if (r.category) m.byCategory[r.category] = (m.byCategory[r.category] || 0) + 1;
      if (PF.isOpen(r)) m.open++;
      if (r.status === 'review' || r.status === 'validation') m.review++;
      if (r.status === 'action-required') m.action++;
      if (r.status === 'approved') m.approved++;
      if (r.status === 'declined') m.declined++;
      if (r.priority === 'expedited') m.expedited++;
      if (PF.isOverdue(r)) m.overdue++;
      if ((now - new Date(r.submittedAt)) / 86400000 <= 7) m.week++;
      if (!PF.isOpen(r)) { m.closed++; if (new Date(r.updatedAt) <= new Date(r.ackDueAt)) m.onTime++; }
    });
    m.onTimeRate = m.closed ? Math.round((m.onTime / m.closed) * 100) : 100;
    m.clearanceRate = (m.approved + m.declined) ? Math.round((m.approved / (m.approved + m.declined)) * 100) : 0;
    return m;
  };

  /* ============================================================
     3 · Theme
     ============================================================ */
  var THEMES = [
    { key: 'light', label: 'Light', icon: 'sparkle' },
    { key: 'dark', label: 'Dark', icon: 'eye' },
    { key: 'hc', label: 'High contrast', icon: 'shield' }
  ];
  PF.theme = {
    get: function () { return localStorage.getItem(K.theme) || 'light'; },
    set: function (t) {
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem(K.theme, t); } catch (e) {}
      var btn = PF.$('#themeBtn');
      if (btn) {
        var meta = THEMES.filter(function (x) { return x.key === t; })[0] || THEMES[0];
        btn.innerHTML = PF.icon(meta.icon, 'icon-sm');
        btn.setAttribute('aria-label', 'Appearance: ' + meta.label + '. Change theme');
        btn.setAttribute('title', 'Appearance: ' + meta.label);
      }
    },
    cycle: function () {
      var i = THEMES.map(function (x) { return x.key; }).indexOf(PF.theme.get());
      var next = THEMES[(i + 1) % THEMES.length];
      PF.theme.set(next.key);
      PF.toast('info', 'Appearance', next.label + ' theme applied.');
    }
  };
  /* Applied before first paint by an inline snippet in each page; re-applied here. */
  document.documentElement.setAttribute('data-theme', PF.theme.get());

  /* ============================================================
     4 · Toasts
     ============================================================ */
  PF.toast = function (kind, title, body, ms) {
    var region = PF.$('#toasts');
    if (!region) {
      region = document.createElement('div');
      region.id = 'toasts';
      region.className = 'pf-toasts';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    var map = { success: 'check-circle', error: 'alert', warning: 'warning', info: 'info' };
    var tone = { success: 'success', error: 'danger', warning: 'warning', info: 'info' }[kind] || 'info';
    var t = document.createElement('div');
    t.className = 'dgo-toast';
    t.innerHTML =
      '<span class="dgo-alert__icon" style="color:var(--dgo-color-' + tone + '-subtle-fg)">' + PF.icon(map[kind] || 'info') + '</span>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="dgo-alert__title">' + PF.esc(title) + '</div>' +
        (body ? '<div style="font-size:13px;color:var(--dgo-color-fg-muted);line-height:1.5">' + PF.esc(body) + '</div>' : '') +
      '</div>' +
      '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm dgo-btn--icon" aria-label="Dismiss">' + PF.icon('close', 'icon-sm') + '</button>';
    region.appendChild(t);
    var kill = function () {
      t.style.transition = 'opacity .18s ease, transform .18s ease';
      t.style.opacity = '0'; t.style.transform = 'translateY(6px)';
      setTimeout(function () { t.remove(); }, 200);
    };
    t.querySelector('button').addEventListener('click', kill);
    setTimeout(kill, ms || 5200);
    return t;
  };

  /* ============================================================
     5 · Dialog — promise-based confirm built on the DS modal
     ============================================================ */
  PF.dialog = function (opts) {
    return new Promise(function (resolve) {
      var last = document.activeElement;
      var back = document.createElement('div');
      back.className = 'dgo-modal-backdrop';
      back.innerHTML =
        '<div class="dgo-modal" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">' +
          '<div class="dgo-modal__header">' +
            '<div><h2 class="dgo-modal__title" id="dlgTitle" style="font-family:var(--dgo-family-display)">' + PF.esc(opts.title) + '</h2>' +
            (opts.sub ? '<p class="dgo-card__sub">' + PF.esc(opts.sub) + '</p>' : '') + '</div>' +
            '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm dgo-btn--icon" data-act="cancel" aria-label="Close">' + PF.icon('close', 'icon-sm') + '</button>' +
          '</div>' +
          '<div class="dgo-modal__body">' + (opts.body || '') + '</div>' +
          '<div class="dgo-modal__footer">' +
            '<button class="dgo-btn dgo-btn--secondary" data-act="cancel">' + PF.esc(opts.cancelLabel || 'Cancel') + '</button>' +
            '<button class="dgo-btn dgo-btn--' + (opts.tone || 'primary') + '" data-act="ok">' + PF.esc(opts.okLabel || 'Confirm') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(back);
      document.body.style.overflow = 'hidden';
      var done = function (v) {
        PF.dialog.values = {};
        PF.$$('[data-field]', back).forEach(function (n) {
          PF.dialog.values[n.getAttribute('data-field')] = n.type === 'checkbox' ? n.checked : n.value;
        });
        document.removeEventListener('keydown', onKey, true);
        back.remove();
        document.body.style.overflow = '';
        if (last && last.focus) last.focus();
        resolve(v);
      };
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
        if (e.key === 'Tab') {
          var f = PF.$$('button, [href], input, select, textarea', back).filter(function (n) { return !n.disabled; });
          if (!f.length) return;
          var first = f[0], lastF = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastF.focus(); }
          else if (!e.shiftKey && document.activeElement === lastF) { e.preventDefault(); first.focus(); }
        }
      }
      document.addEventListener('keydown', onKey, true);
      back.addEventListener('click', function (e) {
        if (e.target === back) return done(false);
        var b = e.target.closest('[data-act]');
        if (!b) return;
        done(b.getAttribute('data-act') === 'ok');
      });
      setTimeout(function () { var ok = back.querySelector('[data-act="ok"]'); if (ok) ok.focus(); }, 30);
    });
  };

  /* ============================================================
     6 · Command palette (⌘K / Ctrl-K)
     ============================================================ */
  var cmdk = { open: false, items: [], view: [], idx: 0, root: null };

  function baseCommands() {
    var list = [
      { g: 'Navigate', label: 'Home', meta: 'Overview', icon: 'home', run: function () { location.href = 'index.html'; } },
      { g: 'Navigate', label: 'Submit a document', meta: 'New request', icon: 'upload', run: function () { location.href = 'submit.html'; } },
      { g: 'Navigate', label: 'Track a request', meta: 'Status', icon: 'search', run: function () { location.href = 'track.html'; } },
      { g: 'Navigate', label: 'Support and helpdesk', meta: 'Help', icon: 'help', run: function () { location.href = 'support.html'; } }
    ];
    PF.CORRESPONDENCE_TYPES.forEach(function (s) {
      list.push({
        g: 'Submit correspondence', label: s.label, meta: s.category, icon: 'file',
        run: function () { location.href = 'submit.html?type=' + s.key; }
      });
    });
    PF.store.mine().slice(0, 6).forEach(function (m) {
      list.push({
        g: 'Your requests', label: m.id, meta: m.title || 'Submitted ' + PF.rel(m.at), icon: 'id',
        run: function () { location.href = 'track.html?id=' + encodeURIComponent(m.id) + '&email=' + encodeURIComponent(m.email); }
      });
    });
    list.push({ g: 'Actions', label: 'Change appearance', meta: 'Light · Dark · High contrast', icon: 'settings', run: function () { PF.theme.cycle(); } });
    list.push({ g: 'Actions', label: 'Print this page', meta: 'PDF', icon: 'download', run: function () { window.print(); } });
    list.push({ g: 'Actions', label: 'Copy link to this page', meta: 'Share', icon: 'external', run: function () { PF.copy(location.href, 'Page link copied.'); } });
    return list;
  }

  function mark(text, q) {
    if (!q) return PF.esc(text);
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return PF.esc(text);
    return PF.esc(text.slice(0, i)) + '<mark>' + PF.esc(text.slice(i, i + q.length)) + '</mark>' + PF.esc(text.slice(i + q.length));
  }

  function renderCmdk(q) {
    var list = cmdk.items.filter(function (it) {
      if (!q) return true;
      return (it.label + ' ' + it.meta + ' ' + it.g).toLowerCase().indexOf(q.toLowerCase()) > -1;
    });
    cmdk.view = list;
    if (cmdk.idx >= list.length) cmdk.idx = 0;
    var box = PF.$('#cmdkList');
    if (!list.length) {
      box.innerHTML = '<li class="dgo-cmdk__empty"><strong>No matches</strong>Try a tracking ID, a service name, or “submit”.</li>';
      return;
    }
    var html = '', group = null, n = 0;
    list.forEach(function (it) {
      if (it.g !== group) {
        if (group !== null) html += '</ul></li>';
        group = it.g;
        html += '<li class="dgo-cmdk__group"><p class="dgo-cmdk__group-label">' + PF.esc(group) + '</p><ul>';
      }
      var sel = n === cmdk.idx;
      html += '<li class="dgo-cmdk__item" role="option" id="cmdk-o' + n + '" data-i="' + n + '" aria-selected="' + sel + '">' +
        PF.icon(it.icon, 'dgo-cmdk__item-icon') +
        '<span class="dgo-cmdk__item-label">' + mark(it.label, q) + '</span>' +
        '<span class="dgo-cmdk__item-meta">' + PF.esc(it.meta) + '</span></li>';
      n++;
    });
    html += '</ul></li>';
    box.innerHTML = html;
    var input = PF.$('#cmdkInput');
    if (input) input.setAttribute('aria-activedescendant', 'cmdk-o' + cmdk.idx);
    var active = PF.$('#cmdk-o' + cmdk.idx);
    if (active && active.scrollIntoViewIfNeeded) active.scrollIntoViewIfNeeded();
  }

  PF.cmdk = {
    open: function () {
      cmdk.items = baseCommands();
      cmdk.idx = 0;
      cmdk.root.setAttribute('data-state', 'open');
      cmdk.open = true;
      document.body.style.overflow = 'hidden';
      var input = PF.$('#cmdkInput');
      input.value = '';
      renderCmdk('');
      setTimeout(function () { input.focus(); }, 20);
    },
    close: function () {
      cmdk.root.setAttribute('data-state', 'closed');
      cmdk.open = false;
      document.body.style.overflow = '';
    }
  };

  function mountCmdk() {
    var wrap = document.createElement('div');
    wrap.className = 'dgo-cmdk-backdrop';
    wrap.id = 'cmdkBackdrop';
    wrap.setAttribute('data-state', 'closed');
    wrap.innerHTML =
      '<div class="dgo-cmdk" role="dialog" aria-modal="true" aria-label="Portal command palette">' +
        '<div class="dgo-cmdk__search">' +
          PF.icon('search', 'dgo-cmdk__search-icon') +
          '<input id="cmdkInput" class="dgo-cmdk__input" type="text" role="combobox" aria-expanded="true" aria-controls="cmdkList" aria-autocomplete="list" autocomplete="off" placeholder="Search services, requests and actions…" />' +
          '<span class="dgo-cmdk__hint">ESC</span>' +
        '</div>' +
        '<ul class="dgo-cmdk__listbox" id="cmdkList" role="listbox" aria-label="Results"></ul>' +
        '<div class="dgo-cmdk__footer">' +
          '<span class="dgo-cmdk__footer-hint"><kbd class="dgo-kbd">↑</kbd><kbd class="dgo-kbd">↓</kbd> move <kbd class="dgo-kbd">↵</kbd> open</span>' +
          '<span class="dgo-cmdk__footer-brand">NITDA Portal</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    cmdk.root = wrap;

    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) return PF.cmdk.close();
      var it = e.target.closest('.dgo-cmdk__item');
      if (!it) return;
      var item = cmdk.view[+it.getAttribute('data-i')];
      PF.cmdk.close();
      if (item) item.run();
    });
    PF.$('#cmdkInput').addEventListener('input', function (e) { cmdk.idx = 0; renderCmdk(e.target.value.trim()); });

    document.addEventListener('keydown', function (e) {
      var mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); return cmdk.open ? PF.cmdk.close() : PF.cmdk.open(); }
      if (!cmdk.open) {
        if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); PF.cmdk.open(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); return PF.cmdk.close(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); cmdk.idx = Math.min(cmdk.idx + 1, cmdk.view.length - 1); renderCmdk(PF.$('#cmdkInput').value.trim()); }
      if (e.key === 'ArrowUp') { e.preventDefault(); cmdk.idx = Math.max(cmdk.idx - 1, 0); renderCmdk(PF.$('#cmdkInput').value.trim()); }
      if (e.key === 'Enter') {
        e.preventDefault();
        var item = cmdk.view[cmdk.idx];
        PF.cmdk.close();
        if (item) item.run();
      }
    });
  }

  /* ============================================================
     7 · Clipboard
     ============================================================ */
  PF.copy = function (text, msg) {
    var done = function () { PF.toast('success', 'Copied', msg || 'Copied to the clipboard.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { PF.toast('error', 'Could not copy', 'Select the text and copy it manually.'); }
      ta.remove();
    }
  };

  /* ============================================================
     8 · Shell
     ============================================================ */
  PF.shell = function () {
    /* sprite */
    var holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    holder.innerHTML = PF.SPRITE;
    document.body.insertBefore(holder, document.body.firstChild);
    /* re-parse any <use> authored in the markup so it binds to the symbol we just added */
    PF.$$('svg > use[href^="#i-"]').forEach(function (u) { var s = u.parentNode; s.innerHTML = s.innerHTML; });

    PF.theme.set(PF.theme.get());

    var nojs = PF.$('#nojs');
    if (nojs) nojs.remove();

    /* current page nav state */
    var page = document.body.getAttribute('data-page');
    PF.$$('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === page) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    /* mobile nav */
    var burger = PF.$('#burger'), mobile = PF.$('#mobileNav');
    if (burger && mobile) {
      burger.innerHTML = PF.icon('menu');
      burger.addEventListener('click', function () {
        var open = mobile.getAttribute('data-open') === 'true';
        mobile.setAttribute('data-open', String(!open));
        burger.setAttribute('aria-expanded', String(!open));
        burger.innerHTML = PF.icon(open ? 'menu' : 'close');
      });
    }

    var tb = PF.$('#themeBtn');
    if (tb) tb.addEventListener('click', PF.theme.cycle);
    var kb = PF.$('#cmdkBtn');
    if (kb) kb.addEventListener('click', function () { PF.cmdk.open(); });

    mountCmdk();

    PF.$$('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
    var mk = PF.$$('[data-mac-key]');
    if (mk.length && /Mac|iPhone|iPad/.test(navigator.platform)) mk.forEach(function (n) { n.textContent = '⌘K'; });

    /* live counter in the ribbon, where present */
    var live = PF.$('[data-live-open]');
    if (live) live.textContent = PF.metrics().open;

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }

    /* retry anything the workflow endpoints did not accept earlier */
    PF.outbox.flush();
    window.addEventListener('online', function () { PF.outbox.flush(); });
  };

  document.addEventListener('DOMContentLoaded', function () {
    PF.shell();
    if (typeof PF.page === 'function') PF.page();
  });
})();
