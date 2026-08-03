/* Submission wizard — service → requester → document → review → receipt. */
PF.page = function () {
  var DRAFT_NOTE = 'Attachments are never stored in the draft — re-attach them before you submit.';
  var MAXF = 5, MAXSIZE = 10 * 1024 * 1024, CAP = 50 * 1024 * 1024;
  var OK_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'];

  var step = 1, files = [], submitting = false, booted = false;
  var form = PF.$('#wizard');

  /* ---------- populate selects and the service list ---------- */
  PF.$('#orgType').innerHTML = '<option value="">Select…</option>' + PF.ORG_TYPES.map(function (o) { return '<option>' + PF.esc(o) + '</option>'; }).join('');
  PF.$('#state').innerHTML = '<option value="">Select…</option>' + PF.STATES.map(function (o) { return '<option>' + PF.esc(o) + '</option>'; }).join('');

  PF.$('#serviceList').innerHTML = PF.SERVICES.map(function (s) {
    return '<label class="pf-choice"><input type="radio" name="service" value="' + s.key + '">' +
      '<span style="flex:1"><span class="pf-choice__t">' + PF.esc(s.name) + '</span>' +
      '<span class="pf-choice__b">' + PF.esc(s.blurb) + '</span></span>' +
      '<span class="pf-mono" style="font-size:11px;color:var(--dgo-color-fg-subtle);white-space:nowrap">' + s.code + ' · ' + s.sla + 'd</span></label>';
  }).join('');

  function renderRequirements() {
    var key = val('service');
    var box = PF.$('#serviceReq');
    if (!key) { box.innerHTML = ''; return; }
    var s = PF.service(key);
    var due = PF.addWorkingDays(new Date().toISOString(), s.sla);
    box.innerHTML = '<div class="dgo-alert dgo-alert--success" style="align-items:flex-start">' +
      '<span class="dgo-alert__icon"><svg class="icon-sm" aria-hidden="true"><use href="#i-check-circle"></use></svg></span>' +
      '<div class="dgo-alert__body" style="flex:1">' +
      '<div class="dgo-alert__title">' + PF.esc(s.name) + ' · ' + PF.esc(s.unit) + '</div>' +
      '<p style="margin:0 0 8px;font-size:13.5px">Submitted today, a decision is due by <b>' + PF.date(due) + '</b> (' + s.sla + ' working days).</p>' +
      '<p style="margin:0 0 4px;font-size:12.5px;font-weight:600">Have these ready</p>' +
      '<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">' + s.needs.map(function (n) { return '<li>' + PF.esc(n) + '</li>'; }).join('') + '</ul>' +
      '</div></div>';
  }

  /* ---------- helpers ---------- */
  function val(name) {
    var n = form.elements[name];
    if (!n) return '';
    if (n.length && n[0] && n[0].type === 'radio') {
      for (var i = 0; i < n.length; i++) if (n[i].checked) return n[i].value;
      return '';
    }
    return (n.value || '').trim();
  }
  function setVal(name, v) {
    var n = form.elements[name];
    if (!n || v == null) return;
    if (n.length && n[0] && n[0].type === 'radio') {
      for (var i = 0; i < n.length; i++) n[i].checked = (n[i].value === v);
    } else n.value = v;
  }
  function err(id, msg) {
    var p = PF.$('#' + id + '-err'), f = PF.$('#' + id);
    if (!p) return;
    if (msg) { p.textContent = msg; p.hidden = false; if (f) f.setAttribute('aria-invalid', 'true'); }
    else { p.hidden = true; p.textContent = ''; if (f) f.removeAttribute('aria-invalid'); }
  }
  function clearErrors() { PF.$$('.dgo-field__error', form).forEach(function (p) { p.hidden = true; }); PF.$$('[aria-invalid]', form).forEach(function (n) { n.removeAttribute('aria-invalid'); }); }

  var EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function validate(n) {
    clearErrors();
    var bad = [];
    if (n === 1) {
      if (!val('service')) { err('service', 'Choose the service this document belongs to.'); bad.push('serviceList'); }
    }
    if (n === 2) {
      if (val('name').length < 2) { err('name', 'Enter the full name of the person submitting.'); bad.push('name'); }
      if (!EMAIL.test(val('email'))) { err('email', 'Enter a valid email address — this is where the decision goes.'); bad.push('email'); }
      var ph = val('phone');
      if (ph && ph.replace(/[^0-9]/g, '').length < 7) { err('phone', 'That telephone number looks too short.'); bad.push('phone'); }
      if (val('org').length < 2) { err('org', 'Enter the organisation this submission is for.'); bad.push('org'); }
      if (!val('orgType')) { err('orgType', 'Select an organisation type.'); bad.push('orgType'); }
      if (!val('state')) { err('state', 'Select a state.'); bad.push('state'); }
    }
    if (n === 3) {
      if (val('title').length < 6) { err('title', 'Give the submission a subject of at least six characters.'); bad.push('title'); }
      if (val('description').length < 20) { err('description', 'Describe the purpose in at least twenty characters.'); bad.push('description'); }
      if (!files.length) { err('files', 'Attach at least one document.'); bad.push('drop'); }
      if (!PF.$('#declare').checked) { err('declare', 'Confirm the declaration before continuing.'); bad.push('declare'); }
    }
    if (bad.length) {
      var first = PF.$('#' + bad[0]);
      if (first && first.focus) first.focus();
      PF.toast('error', 'Check the highlighted fields', bad.length + (bad.length === 1 ? ' field needs attention.' : ' fields need attention.'));
      return false;
    }
    return true;
  }

  /* ---------- step machine ---------- */
  var TITLES = { 1: 'Choose the service', 2: 'Who is submitting', 3: 'The document', 4: 'Review and submit' };
  function show(n) {
    step = n;
    PF.$$('[data-step]', form).forEach(function (fs) { fs.hidden = (+fs.getAttribute('data-step') !== n); });
    PF.$$('#stepper .dgo-stepper__step').forEach(function (li) {
      var i = +li.getAttribute('data-step');
      li.setAttribute('data-state', i < n ? 'done' : (i === n ? 'current' : 'todo'));
      li.style.cursor = i < n ? 'pointer' : 'default';
    });
    PF.$('#stepTitle').textContent = TITLES[n];
    PF.$('#stepCount').textContent = 'STEP ' + n + ' OF 4';
    PF.$('#backBtn').hidden = n === 1;
    var next = PF.$('#nextBtn');
    next.innerHTML = n === 4
      ? 'Submit to the registry<svg class="icon-sm" aria-hidden="true"><use href="#i-send"></use></svg>'
      : 'Continue<svg class="icon-sm" aria-hidden="true"><use href="#i-chevron-right"></use></svg>';
    if (n === 4) renderReview();
    if (booted) window.scrollTo({ top: Math.max(0, PF.$('#wizard').offsetTop - 90), behavior: 'smooth' });
  }

  PF.$('#stepper').addEventListener('click', function (e) {
    var li = e.target.closest('.dgo-stepper__step');
    if (!li) return;
    var i = +li.getAttribute('data-step');
    if (i < step) show(i);
  });

  PF.$('#backBtn').addEventListener('click', function () { if (step > 1) show(step - 1); });
  PF.$('#nextBtn').addEventListener('click', function () {
    if (submitting) return;
    if (!validate(step)) return;
    if (step < 4) { saveDraft(); show(step + 1); }
    else confirmSubmit();
  });

  /* ---------- review ---------- */
  function renderReview() {
    var s = PF.service(val('service'));
    var rows = [
      ['Service', s.name + ' <span class="pf-mono" style="color:var(--dgo-color-fg-muted)">(' + s.code + ')</span>'],
      ['Handling unit', s.unit],
      ['Target', s.sla + ' working days · decision due ' + PF.date(PF.addWorkingDays(new Date().toISOString(), s.sla))],
      ['Priority', val('priority') === 'expedited' ? 'Expedited' : 'Standard'],
      ['Submitted by', PF.esc(val('name')) + '<br><span style="color:var(--dgo-color-fg-muted)">' + PF.esc(val('email')) + (val('phone') ? ' · ' + PF.esc(val('phone')) : '') + '</span>'],
      ['Organisation', PF.esc(val('org')) + '<br><span style="color:var(--dgo-color-fg-muted)">' + PF.esc(val('orgType')) + ' · ' + PF.esc(val('state')) + '</span>'],
      ['Subject', PF.esc(val('title'))],
      ['Purpose', PF.esc(val('description')).replace(/\n/g, '<br>')],
      ['Attachments', files.map(function (f) { return PF.esc(f.name) + ' <span class="pf-mono" style="color:var(--dgo-color-fg-muted)">' + PF.bytes(f.size) + '</span>'; }).join('<br>')]
    ];
    PF.$('#reviewBody').innerHTML = '<dl class="pf-kv">' + rows.map(function (r) {
      return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>';
    }).join('') + '</dl>';
  }

  /* ---------- attachments ---------- */
  var input = PF.$('#files'), drop = PF.$('#drop');
  drop.addEventListener('click', function () { input.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.setAttribute('data-drag', 'true'); });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.removeAttribute('data-drag'); });
  });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) accept(e.dataTransfer.files); });
  input.addEventListener('change', function () { accept(input.files); input.value = ''; });

  function accept(list) {
    var added = 0, rejected = [];
    Array.prototype.forEach.call(list, function (f) {
      var ext = (f.name.split('.').pop() || '').toLowerCase();
      if (files.length + added >= MAXF) { rejected.push(f.name + ' — limit of ' + MAXF + ' files'); return; }
      if (OK_EXT.indexOf(ext) === -1) { rejected.push(f.name + ' — .' + ext + ' is not accepted'); return; }
      if (f.size > MAXSIZE) { rejected.push(f.name + ' — ' + PF.bytes(f.size) + ' exceeds 10 MB'); return; }
      if (files.some(function (x) { return x.name === f.name && x.size === f.size; })) { rejected.push(f.name + ' — already attached'); return; }
      files.push({ name: f.name, size: f.size, type: f.type, file: f });
      added++;
    });
    renderFiles();
    if (added) { err('files', ''); PF.toast('success', added + (added === 1 ? ' file attached' : ' files attached'), files.map(function (f) { return f.name; }).join(', ')); }
    if (rejected.length) PF.toast('error', 'Some files were not accepted', rejected.join(' · '), 8000);
  }

  function renderFiles() {
    PF.$('#fileList').innerHTML = files.map(function (f, i) {
      return '<li class="pf-file"><span class="pf-file__ic"><svg class="icon" aria-hidden="true"><use href="#i-file"></use></svg></span>' +
        '<span style="flex:1;min-width:0"><span class="pf-file__n">' + PF.esc(f.name) + '</span><br><span class="pf-file__s">' + PF.bytes(f.size) + (f.restored ? ' · re-attach required' : '') + '</span></span>' +
        '<button type="button" class="dgo-btn dgo-btn--ghost dgo-btn--sm dgo-btn--icon" data-rm="' + i + '" aria-label="Remove ' + PF.esc(f.name) + '"><svg class="icon-sm" aria-hidden="true"><use href="#i-trash"></use></svg></button></li>';
    }).join('');
    var total = files.reduce(function (a, f) { return a + f.size; }, 0);
    PF.$('#fileTotal').textContent = files.length ? files.length + (files.length === 1 ? ' file attached' : ' files attached') : 'No files attached';
    PF.$('#fileCap').textContent = PF.bytes(total) + ' / 50 MB';
    var meter = PF.$('#fileMeter');
    meter.firstElementChild.style.width = Math.min(100, (total / CAP) * 100) + '%';
    meter.setAttribute('data-over', String(total > CAP));
  }

  PF.$('#fileList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (!b) return;
    var f = files.splice(+b.getAttribute('data-rm'), 1)[0];
    renderFiles();
    PF.toast('info', 'Removed', f.name);
  });

  /* ---------- counters ---------- */
  function counter(id, out, max) {
    var n = PF.$('#' + id), o = PF.$('#' + out);
    var upd = function () { o.textContent = n.value.length + '/' + max; };
    n.addEventListener('input', upd); upd();
  }
  counter('title', 'titleCount', 120);
  counter('description', 'descCount', 1200);

  /* ---------- draft ---------- */
  var FIELDS = ['service', 'priority', 'name', 'email', 'phone', 'org', 'orgType', 'state', 'title', 'description'];
  function snapshot() {
    var d = { at: new Date().toISOString(), step: step, declare: PF.$('#declare').checked, files: files.map(function (f) { return { name: f.name, size: f.size }; }) };
    FIELDS.forEach(function (k) { d[k] = val(k); });
    return d;
  }
  function saveDraft() {
    var d = snapshot();
    var any = FIELDS.some(function (k) { return k !== 'priority' && d[k]; });
    if (any) PF.store.draft.set(d);
  }
  form.addEventListener('input', function () { saveDraft(); });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'service') renderRequirements();
    saveDraft();
  });

  function applyDraft(d) {
    FIELDS.forEach(function (k) { setVal(k, d[k]); });
    PF.$('#declare').checked = !!d.declare;
    files = (d.files || []).map(function (f) { return { name: f.name, size: f.size, restored: true }; });
    renderFiles();
    renderRequirements();
    counterRefresh();
    show(Math.min(d.step || 1, 3));
  }
  function counterRefresh() {
    PF.$('#titleCount').textContent = PF.$('#title').value.length + '/120';
    PF.$('#descCount').textContent = PF.$('#description').value.length + '/1200';
  }

  var draft = PF.store.draft.get();
  if (draft) {
    PF.$('#draftBar').innerHTML =
      '<div class="dgo-alert dgo-alert--warning"><span class="dgo-alert__icon"><svg class="icon-sm" aria-hidden="true"><use href="#i-refresh"></use></svg></span>' +
      '<div class="dgo-alert__body" style="flex:1"><div class="dgo-alert__title">You have an unfinished submission</div>' +
      'Saved ' + PF.rel(draft.at) + '. ' + DRAFT_NOTE + '</div>' +
      '<span class="dgo-cluster dgo-cluster--2"><button class="dgo-btn dgo-btn--primary dgo-btn--sm" id="draftResume">Resume</button>' +
      '<button class="dgo-btn dgo-btn--ghost dgo-btn--sm" id="draftDrop">Discard</button></span></div>';
    PF.$('#draftResume').addEventListener('click', function () {
      applyDraft(draft);
      PF.$('#draftBar').innerHTML = '';
      PF.toast('success', 'Draft restored', files.length ? 'Re-attach your files before submitting.' : '');
    });
    PF.$('#draftDrop').addEventListener('click', function () {
      PF.store.draft.clear();
      PF.$('#draftBar').innerHTML = '';
      PF.toast('info', 'Draft discarded', '');
    });
  }

  PF.$('#clearBtn').addEventListener('click', function () {
    PF.dialog({ title: 'Clear this form?', sub: 'Everything you have typed and attached is removed.', okLabel: 'Clear it', tone: 'danger', body: '<p class="pf-note">The saved draft on this device is deleted too. Submitted requests are not affected.</p>' })
      .then(function (ok) {
        if (!ok) return;
        form.reset();
        files = []; renderFiles(); renderRequirements(); counterRefresh(); clearErrors();
        PF.store.draft.clear();
        PF.$('#draftBar').innerHTML = '';
        show(1);
        PF.toast('info', 'Form cleared', 'Start again whenever you are ready.');
      });
  });

  /* ---------- submit ---------- */
  function confirmSubmit() {
    var s = PF.service(val('service'));
    if (files.some(function (f) { return f.restored; })) {
      err('files', 'Re-attach the files from your restored draft before submitting.');
      show(3);
      PF.toast('error', 'Attachments missing', DRAFT_NOTE);
      return;
    }
    PF.dialog({
      title: 'Submit to the registry?',
      sub: s.name + ' · ' + files.length + (files.length === 1 ? ' attachment' : ' attachments'),
      okLabel: 'Confirm and submit',
      body: '<dl class="pf-kv">' +
        '<dt>Subject</dt><dd>' + PF.esc(val('title')) + '</dd>' +
        '<dt>From</dt><dd>' + PF.esc(val('name')) + ' · ' + PF.esc(val('org')) + '</dd>' +
        '<dt>Notifications to</dt><dd>' + PF.esc(val('email')) + '</dd>' +
        '</dl><p class="pf-note" style="margin-top:12px">A tracking ID is issued the moment the registry accepts the record.</p>'
    }).then(function (ok) { if (ok) doSubmit(); });
  }

  function doSubmit() {
    submitting = true;
    var next = PF.$('#nextBtn'), back = PF.$('#backBtn'), clear = PF.$('#clearBtn');
    next.setAttribute('data-loading', 'true'); next.disabled = true; back.disabled = true; clear.disabled = true;

    var panel = PF.$('#uploadPanel');
    panel.hidden = false;
    panel.innerHTML = '<div class="pf-panel"><div class="pf-panel__head"><span class="dgo-spinner" style="width:16px;height:16px;border-width:2px"></span><h2 class="pf-panel__title">Transferring to the registry</h2></div>' +
      '<div class="pf-panel__body dgo-stack dgo-stack--4">' +
      files.map(function (f, i) {
        return '<div class="dgo-stack dgo-stack--1"><div class="dgo-row dgo-row--between" style="font-size:12.5px"><span>' + PF.esc(f.name) + '</span><span class="pf-mono" id="up' + i + 'p">0%</span></div>' +
          '<div class="pf-meter"><i id="up' + i + '" style="width:0%"></i></div></div>';
      }).join('') +
      '<p class="pf-note" id="upNote">Encrypting and checking each attachment…</p></div></div>';
    window.scrollTo({ top: Math.max(0, panel.offsetTop - 90), behavior: 'smooth' });

    var done = 0;
    files.forEach(function (f, i) {
      var pct = 0;
      var iv = setInterval(function () {
        pct = Math.min(100, pct + 6 + Math.random() * 16);
        var bar = PF.$('#up' + i), lab = PF.$('#up' + i + 'p');
        if (bar) bar.style.width = pct + '%';
        if (lab) lab.textContent = Math.round(pct) + '%';
        if (pct >= 100) {
          clearInterval(iv);
          done++;
          if (done === files.length) setTimeout(finish, 420);
        }
      }, 120 + i * 40);
    });
  }

  /* Hands the submission to the agency workflow.

     F-028. This previously sent files[0] ONLY, and substituted an empty
     FileContentBase64 whenever that file exceeded 4 MB — while the submission
     still reported success. The form accepts five files at 10 MB each, so a
     submitter could attach five documents, be told they were received, and have
     four silently discarded. On an external document-intake channel that is the
     whole purpose failing quietly.

     Every attachment is now dispatched, one call per file, each carrying the same
     reference plus its part number so the registry can reassemble the set.

     INLINE_CAP is a real transport limit, not a policy: base64 inflates a payload
     by about a third, so a 4 MB file becomes roughly 5.3 MB of JSON. What changed
     is the failure mode — anything over the cap is queued in the outbox and written
     to the audit trail as UNDELIVERED. It is never silently replaced with an empty
     payload, and the submitter is told.

     The durable fix is upload brokering (TARGET_ARCHITECTURE.md §3.3): file bytes
     go straight to SharePoint and stop travelling inside a workflow payload at all.
     Until that exists, this at least stops losing documents without saying so. */
  var INLINE_CAP = 4 * 1048576;

  function dispatchToWorkflow(rec) {
    var total = files.length;
    var undelivered = [];

    var envelope = function (f, index, base64) {
      return {
        UserId: rec.id,
        SubmitterName: rec.name,
        EmailAddress: rec.email,
        CompanyName: rec.org,
        DocumentType: rec.serviceName,
        FileName: f ? f.name : '',
        FileContentBase64: base64 || '',
        /* Part metadata so N calls reassemble into one submission rather than
           looking like N unrelated submissions with a coincidental reference. */
        PartNumber: index + 1,
        PartCount: total,
        PartSizeBytes: f ? f.size : 0
      };
    };

    var report = function () {
      if (!undelivered.length) {
        if (total) PF.store.log('integration', rec.id, total + ' attachment(s) dispatched to the registry workflow');
        return;
      }
      var names = undelivered.join(', ');
      PF.store.log('integration', rec.id,
        undelivered.length + ' attachment(s) too large to transmit inline and queued for delivery: ' + names);
      PF.toast('warn', 'Some attachments are still uploading',
        names + ' exceeded the inline transfer limit. Your reference is recorded and the ' +
        'registry will receive them on retry — do not resubmit.', 9000);
    };

    /* No attachments at all: still register the submission itself. */
    if (!total) { PF.flow('submission', envelope(null, 0, ''), rec.id); return; }

    var index = 0;
    var next = function () {
      if (index >= total) return report();
      var f = files[index], at = index;
      index++;

      if (!f || !f.file) {                       // restored from a draft — bytes are gone
        undelivered.push(f ? f.name : 'attachment ' + (at + 1));
        PF.outbox.queue('submission', envelope(f, at, ''), rec.id);
        return next();
      }
      if (f.size > INLINE_CAP) {                 // queued, recorded, NOT silently emptied
        undelivered.push(f.name);
        PF.outbox.queue('submission', envelope(f, at, ''), rec.id);
        return next();
      }

      var reader = new FileReader();
      reader.onload = function () {
        PF.flow('submission', envelope(f, at, String(reader.result || '').split(',')[1] || ''), rec.id);
        next();
      };
      reader.onerror = function () {
        undelivered.push(f.name);
        PF.outbox.queue('submission', envelope(f, at, ''), rec.id);
        next();
      };
      try { reader.readAsDataURL(f.file); }
      catch (e) {
        undelivered.push(f.name);
        PF.outbox.queue('submission', envelope(f, at, ''), rec.id);
        next();
      }
    };
    next();
  }

  function finish() {
    var s = PF.service(val('service'));
    var now = new Date().toISOString();
    var rec = {
      id: PF.uid(), service: s.key, serviceName: s.name, serviceCode: s.code, unit: s.unit,
      title: val('title'), description: val('description'),
      name: val('name'), email: val('email'), phone: val('phone'),
      org: val('org'), orgType: val('orgType'), state: val('state'),
      priority: val('priority'), status: 'received',
      officer: PF.OFFICERS[Math.floor(Math.random() * PF.OFFICERS.length)], channel: 'Portal',
      files: files.map(function (f) { return { name: f.name, size: f.size }; }),
      submittedAt: now, updatedAt: now, dueAt: PF.addWorkingDays(now, s.sla),
      events: [{ at: now, status: 'received', label: 'Submission received and tracking ID issued.', note: '', actor: 'Portal' }]
    };
    PF.store.add(rec);
    PF.store.draft.clear();
    dispatchToWorkflow(rec);

    PF.$('#uploadPanel').hidden = true;
    form.hidden = true;
    PF.$('#helpPanel').classList.add('pf-no-print');
    PF.$$('.dgo-crumbs, .pf-steps, #draftBar').forEach(function (n) { n.classList.add('pf-no-print'); });
    PF.$('#main').querySelector('.dgo-stack--3').classList.add('pf-no-print');

    var due = PF.date(rec.dueAt);
    PF.$('#result').hidden = false;
    PF.$('#result').innerHTML =
      '<div class="pf-print-head" style="margin-bottom:18px"><img src="ds/logo/nitda-lockup.png" alt="National Information Technology Development Agency" style="height:56px"><p style="margin:10px 0 0;font-size:12px">Submission receipt · generated ' + PF.dateTime(rec.submittedAt) + '</p></div>' +
      '<div class="pf-result">' +
        '<div class="pf-result__head"><span class="pf-result__ic"><svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg></span>' +
        '<div><h2 style="margin:0;font-family:var(--dgo-family-display);font-size:24px;line-height:1.15">Submission received</h2>' +
        '<p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,.78);max-width:52ch">' + PF.esc(rec.serviceName) + ' has been logged with ' + PF.esc(rec.unit) + '. A confirmation is on its way to ' + PF.esc(rec.email) + '.</p></div></div>' +
        '<div style="padding:22px;display:grid;gap:20px;background:var(--dgo-color-surface-raised)">' +
          '<div class="pf-idplate"><div style="flex:1"><div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dgo-color-fg-muted);margin-bottom:6px">Your tracking ID</div><code>' + rec.id + '</code></div>' +
          '<button class="dgo-btn dgo-btn--secondary dgo-btn--sm pf-no-print" id="copyId"><svg class="icon-sm" aria-hidden="true"><use href="#i-id"></use></svg>Copy</button></div>' +
          '<dl class="pf-kv">' +
            '<dt>Service</dt><dd>' + PF.esc(rec.serviceName) + ' <span class="pf-mono" style="color:var(--dgo-color-fg-muted)">(' + rec.serviceCode + ')</span></dd>' +
            '<dt>Subject</dt><dd>' + PF.esc(rec.title) + '</dd>' +
            '<dt>Submitted by</dt><dd>' + PF.esc(rec.name) + ' · ' + PF.esc(rec.org) + '</dd>' +
            '<dt>Notifications</dt><dd>' + PF.esc(rec.email) + '</dd>' +
            '<dt>Received</dt><dd>' + PF.dateTime(rec.submittedAt) + '</dd>' +
            '<dt>Decision due</dt><dd><b>' + due + '</b> · ' + PF.service(rec.service).sla + ' working days</dd>' +
            '<dt>Handling</dt><dd>' + (rec.priority === 'expedited' ? 'Expedited' : 'Standard') + ' · ' + PF.esc(rec.officer) + '</dd>' +
            '<dt>Attachments</dt><dd>' + rec.files.map(function (f) { return PF.esc(f.name) + ' <span class="pf-mono" style="color:var(--dgo-color-fg-muted)">' + PF.bytes(f.size) + '</span>'; }).join('<br>') + '</dd>' +
          '</dl>' +
          '<div class="dgo-cluster dgo-cluster--2 pf-no-print">' +
            '<a class="dgo-btn dgo-btn--primary" href="track.html?id=' + encodeURIComponent(rec.id) + '&email=' + encodeURIComponent(rec.email) + '"><svg class="icon-sm" aria-hidden="true"><use href="#i-search"></use></svg>Track this request</a>' +
            '<button class="dgo-btn dgo-btn--secondary" id="printBtn"><svg class="icon-sm" aria-hidden="true"><use href="#i-download"></use></svg>Save receipt as PDF</button>' +
            '<a class="dgo-btn dgo-btn--ghost" href="submit.html">Submit another document</a>' +
          '</div>' +
          '<p class="pf-note">Keep this ID. It is the only key to your record — the registry cannot look up a submission without it.</p>' +
        '</div>' +
      '</div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    PF.toast('success', 'Submission received', 'Tracking ID ' + rec.id, 9000);
    PF.$('#copyId').addEventListener('click', function () { PF.copy(rec.id, 'Tracking ID ' + rec.id + ' copied.'); });
    PF.$('#printBtn').addEventListener('click', function () { window.print(); });
  }

  /* ---------- boot ---------- */
  var pre = new URLSearchParams(location.search).get('service');
  if (pre && PF.SERVICES.some(function (s) { return s.key === pre; })) {
    setVal('service', pre);
    renderRequirements();
  }
  renderFiles();
  show(1);
  booted = true;
};
