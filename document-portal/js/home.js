/* Home — live registry panel, catalogue, stats and the first-visit welcome. */
PF.page = function () {
  var m = PF.metrics();

  /* ---- clock ---- */
  var clock = PF.$('#liveClock');
  function tick() {
    var d = new Date();
    clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0') + ' WAT';
  }
  tick(); setInterval(tick, 1000);

  /* ---- counts inside the registry panel ---- */
  function tile(v, l, tone) {
    return '<div><div class="pf-mono" style="font-size:26px;font-weight:600;line-height:1;color:' + tone + '">' + v + '</div>' +
      '<div style="margin-top:6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dgo-color-fg-muted)">' + l + '</div></div>';
  }
  PF.$('#liveCounts').innerHTML =
    tile(m.open, 'In progress', 'var(--dgo-color-fg-strong)') +
    tile(m.action, 'Action needed', 'var(--dgo-color-status-action-fg)') +
    tile(m.onTimeRate + '%', 'On time', 'var(--dgo-color-action-accent)');

  /* ---- where the register currently stands ----
     This panel used to list PF.store.all() — every record, newest first, each row carrying a
     tracking ID and deep-linking to track.html?id=. That is an unauthenticated page publishing
     the register: the ID identifies a submission, and the record behind it holds the submitter's
     name, email, organisation, assigned officer, file names and the reviewer's notes. The
     visitor's own submissions have always had their own panel below (#myRequests, from
     PF.store.mine()), so the public list was never how anyone found their own request.

     Nothing crossed between citizens while the store was localStorage. Wiring STATUS to the live
     registry is what would have made it real, so the shape had to change before that, not after.

     What replaces it is a status mix: counts only, no identifier, no timestamp, nothing that
     resolves to a person or a submission. It is what a registry can honestly say in public. */
  /* PF.STATUS is declared in lifecycle order, so its keys are the order to read the mix in. */
  var mix = Object.keys(PF.STATUS).map(function (key) {
    return { key: key, label: PF.status(key).label, n: m.byStatus[key] || 0 };
  }).filter(function (x) { return x.n > 0; });

  PF.$('#liveFeed').innerHTML = mix.length
    ? mix.map(function (x) {
        return '<li><span class="pf-rec" style="cursor:default;display:flex;align-items:center;gap:10px">' +
          PF.pill(x.key) +
          '<span class="pf-rec__id" style="margin-left:auto">' + x.n + '</span></span></li>';
      }).join('')
    : '<li><span class="pf-rec" style="cursor:default;color:var(--dgo-color-fg-muted);font-size:12px">' +
      'No submissions in the register yet.</span></li>';

  /* ---- your requests on this device ---- */
  var mine = PF.store.mine();
  if (mine.length) {
    PF.$('#myRequests').innerHTML =
      '<div class="pf-panel"><div class="pf-panel__head">' +
        '<svg class="icon-sm" aria-hidden="true" style="color:var(--dgo-color-action-primary)"><use href="#i-id"></use></svg>' +
        '<h2 class="pf-panel__title">Your recent submissions</h2></div>' +
      '<ul class="pf-recs">' + mine.slice(0, 3).map(function (x) {
        var rec = PF.store.get(x.id);
        return '<li><a class="pf-rec" href="track.html?id=' + encodeURIComponent(x.id) + '&email=' + encodeURIComponent(x.email) + '" style="text-decoration:none">' +
          '<span class="pf-rec__top"><span class="pf-rec__id">' + PF.esc(x.id) + '</span>' + (rec ? PF.pill(rec.status) : '') + '</span>' +
          '<span class="pf-rec__meta"><span>' + PF.esc(x.title || 'Submission') + '</span><span>·</span><span>' + PF.rel(x.at) + '</span></span></a></li>';
      }).join('') + '</ul></div>';
  }

  /* ---- headline statistics (counted up) ---- */
  var stats = [
    { v: m.total, l: 'Requests in the registry' },
    { v: m.onTimeRate, l: 'Closed within target', suffix: '%' },
    { v: PF.CORRESPONDENCE_TYPES.length, l: 'Correspondence types' },
    { v: m.week, l: 'Received in the last 7 days' }
  ];
  PF.$('#heroStats').innerHTML = stats.map(function (s, i) {
    return '<div><div class="pf-stat__v" data-count="' + s.v + '" data-suffix="' + (s.suffix || '') + '">0' + (s.suffix || '') + '</div><div class="pf-stat__l">' + s.l + '</div></div>';
  }).join('');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countUp(node) {
    var target = +node.getAttribute('data-count'), suffix = node.getAttribute('data-suffix') || '';
    if (reduce || target === 0) { node.textContent = target + suffix; return; }
    var start = performance.now(), dur = 900;
    (function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.4 });
    PF.$$('[data-count]').forEach(function (n) { io.observe(n); });
  } else PF.$$('[data-count]').forEach(countUp);

  /* ---- correspondence types ----
     Step 2 renamed the model's fields (name/code/sla -> label/category) and this card
     kept reading the old ones, so every title rendered empty and every card carried an
     "undefined" handling unit. A correspondence type has no unit — the registry assigns
     one on receipt — so that line is gone rather than sourced from somewhere else. */
  PF.$('#catalogue').innerHTML = PF.CORRESPONDENCE_TYPES.map(function (s) {
    var count = m.byType[s.key] || 0;
    return '<a class="pf-cat__i" href="submit.html?type=' + encodeURIComponent(s.key) + '" style="text-decoration:none;color:inherit">' +
      '<span class="pf-cat__sla">' + PF.esc(s.category) + ' · acknowledged in ' + PF.ACK_TARGET_DAYS + ' working days</span>' +
      '<span class="pf-cat__t">' + PF.esc(s.label) + '</span>' +
      '<p class="pf-cat__b">' + PF.esc(s.blurb) + '</p>' +
      (count ? '<span style="font-size:12px;color:var(--dgo-color-action-primary);font-weight:600">' + count + ' in the registry</span>' : '') +
      '</a>';
  }).join('');

  /* ---- FAQ preview ---- */
  PF.$('#faqPreview').innerHTML = PF.FAQ.slice(0, 4).map(function (f, i) {
    return '<details' + (i === 0 ? ' open' : '') + '><summary>' + PF.esc(f.q) + '<svg class="icon-sm" aria-hidden="true"><use href="#i-chevron-down"></use></svg></summary>' +
      '<div class="pf-faq__a"><p>' + PF.esc(f.a) + '</p></div></details>';
  }).join('');

  /* ---- first-visit welcome ---- */
  var seen = false;
  try { seen = localStorage.getItem('nitda.portal.welcome') === '1'; } catch (e) { seen = true; }
  if (!seen) {
    setTimeout(function () {
      PF.dialog({
        title: 'Welcome to the Intelligent Portal',
        sub: 'Three things worth knowing before you start.',
        okLabel: 'Start a submission',
        cancelLabel: 'Look around first',
        body:
          '<ul class="dgo-stack dgo-stack--4" style="list-style:none;margin:0;padding:0">' +
          '<li class="dgo-row" style="gap:14px;align-items:flex-start"><span class="pf-drop__ic" style="width:34px;height:34px"><svg class="icon-sm" aria-hidden="true"><use href="#i-upload"></use></svg></span><span><b>Submit once.</b><br><span style="color:var(--dgo-color-fg-muted);font-size:13.5px">A four-step form routes your document to the right unit and issues a tracking ID immediately.</span></span></li>' +
          '<li class="dgo-row" style="gap:14px;align-items:flex-start"><span class="pf-drop__ic" style="width:34px;height:34px"><svg class="icon-sm" aria-hidden="true"><use href="#i-search"></use></svg></span><span><b>Track anytime.</b><br><span style="color:var(--dgo-color-fg-muted);font-size:13.5px">Your ID plus the email you used opens the full timeline, notes and the working-day target.</span></span></li>' +
          '<li class="dgo-row" style="gap:14px;align-items:flex-start"><span class="pf-drop__ic" style="width:34px;height:34px"><svg class="icon-sm" aria-hidden="true"><use href="#i-settings"></use></svg></span><span><b>Make it yours.</b><br><span style="color:var(--dgo-color-fg-muted);font-size:13.5px">Press <kbd class="dgo-kbd">Ctrl</kbd> <kbd class="dgo-kbd">K</kbd> to search anything, and switch between light, dark and high-contrast themes in the header.</span></span></li>' +
          '</ul>'
      }).then(function (go) {
        try { localStorage.setItem('nitda.portal.welcome', '1'); } catch (e) {}
        if (go) location.href = 'submit.html';
      });
    }, 450);
  }
};
