/* ═══════════════════════════════════════════════════════════════════════════════════════
   DGO Digital Operations — Platform Atlas
   Renderer.

   THE DIVISION OF LABOUR IN THIS PAGE, BECAUSE IT IS THE WHOLE DESIGN
   Every NUMBER, NAME, COUNT, ROUTE, ROLE, FIELD, FILE and EDGE comes from
   window.DGO_PLATFORM, which scripts/visual-docs-data.mjs derives from the source tree.
   Every SENTENCE OF EXPLANATION is written here. Facts are measured; opinions are written;
   the two never swap places. tests/visual-docs.test.mjs asserts the rendered result against
   the live configuration, so a route added without regenerating fails the build rather than
   quietly making the atlas wrong.

   Diagrams are computed, not drawn. The lifecycle map lays itself out from the transition
   table, the workspace map from the workflow-clarity configuration, the layer graph from
   measured import counts. Nobody has to remember to move a box.

   Classic script, no module, no bundler, no network: this page has to open from a memory
   stick on a projector laptop in a room with no wifi.
   ═══════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var P = window.DGO_PLATFORM;
  if (!P) {
    document.getElementById('doc').innerHTML =
      '<section class="sheet"><div class="body"><div class="callout crit"><div class="lbl">Dataset missing</div>' +
      '<p><code>platform-data.js</code> did not load. It is generated, so the usual cause is that it ' +
      'has never been built in this checkout: run <code>npm run visual</code>. If the file is present ' +
      'and this message persists, the copy of this folder is incomplete — all four files ' +
      '(<code>index.html</code>, <code>visual.css</code>, <code>app.js</code>, <code>platform-data.js</code>) ' +
      'must sit in the same directory.</p></div></div></section>';
    return;
  }

  /* ── helpers ─────────────────────────────────────────────────────────────────────── */
  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function n(x) { return Number(x || 0).toLocaleString('en-US'); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function sum(arr, f) { return arr.reduce(function (a, b) { return a + (f ? f(b) : b); }, 0); }
  function kpi(v, k, d, hot) {
    /* A value longer than a short number is set as a phrase, not at the numeric size —
       "client-asserted (localStorage profile)" at 34px wraps to four lines and stops
       reading as a value. */
    var phrase = String(v).length > 12 ? ' phrase' : '';
    return '<div class="kpi' + (hot ? ' hot' : '') + phrase + '"><div class="v">' + h(v) + '</div><div class="k">' + h(k) + '</div>' +
      (d ? '<div class="d">' + d + '</div>' : '') + '</div>';
  }
  function tbl(headers, rows, cls) {
    return '<div class="scroll"><table' + (cls ? ' class="' + cls + '"' : '') + '><thead><tr>' +
      headers.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div>';
  }
  function acc(title, inner, open) {
    return '<details class="acc"' + (open ? ' open' : '') + '><summary>' + title + '</summary><div class="inner">' + inner + '</div></details>';
  }
  function tagList(items, cls) {
    if (!items || !items.length) return '<span class="tag" style="opacity:.5">none</span>';
    return items.map(function (t) { return '<span class="tag' + (cls ? ' ' + cls : '') + '">' + h(t) + '</span>'; }).join('');
  }
  /* An SVG opening tag that always carries the things a diagram must have: a viewBox so it
     scales, a role and a label so it is announced, and no fixed width so the container
     governs the size. Building it in one place is why every figure has them. */
  function svgOpen(vb, label) {
    return '<svg viewBox="' + vb + '" role="img" aria-label="' + h(label) + '" preserveAspectRatio="xMidYMid meet">';
  }
  function arrowDefs() {
    return '<defs>' +
      '<marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink-3)"/></marker>' +
      '<marker id="arg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--smart)"/></marker>' +
      '<marker id="arw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--warn)"/></marker>' +
      '<marker id="arc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--crit)"/></marker>' +
      '<pattern id="wall" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
      '<line x1="0" y1="0" x2="0" y2="8" stroke="var(--z-enforce)" stroke-width="3" opacity=".3"/></pattern>' +
      '</defs>';
  }
  function fig(svg, caption, legend) {
    return '<figure class="canvas">' + svg +
      (legend ? '<div class="legend">' + legend + '</div>' : '') +
      (caption ? '<figcaption>' + caption + '</figcaption>' : '') + '</figure>';
  }
  /* SVG has no text wrapping. Every diagram on this page needed it, and every diagram that
     tried to live without it produced a sentence running off the canvas — so it is one
     helper, used everywhere, measuring in characters because the font is fixed here. */
  function wrap(text, x, y, perLine, lineH, cls, extra) {
    var words = String(text).split(' '), out = [], cur = '';
    words.forEach(function (w) {
      if ((cur + ' ' + w).trim().length > perLine) { out.push(cur); cur = w; }
      else { cur = cur ? cur + ' ' + w : w; }
    });
    if (cur) out.push(cur);
    return out.map(function (line, i) {
      return '<text class="' + (cls || 't-sub') + '" x="' + x + '" y="' + (y + i * lineH) + '"' + (extra || '') + '>' + h(line) + '</text>';
    }).join('');
  }
  function wrapLines(text, perLine) {
    var words = String(text).split(' '), out = [], cur = '';
    words.forEach(function (w) {
      if ((cur + ' ' + w).trim().length > perLine) { out.push(cur); cur = w; }
      else { cur = cur ? cur + ' ' + w : w; }
    });
    if (cur) out.push(cur);
    return out;
  }
  function sw(color, label) { return '<span><i class="sw" style="background:' + color + '"></i>' + label + '</span>'; }
  function ln(color, label, dash) {
    return '<span><i class="ln" style="border-color:' + color + (dash ? ';border-top-style:dashed' : '') + '"></i>' + label + '</span>';
  }

  var HEAD = P.headline;
  var ROUTES = P.routes;
  var VISIBLE = ROUTES.filter(function (r) { return r.visible; });
  var TECHNICAL = ROUTES.filter(function (r) { return !r.visible; });

  /* Which visible workspace does a technical route surface through? workflow-clarity records
     that as prose ("Tracking / Dispatch & Archive / command search"), because it is written
     for a human. Resolving it to workspaces here is what lets the map be drawn instead of
     read. Anything that resolves to nothing — "command search" is a control, not a
     workspace — is dropped rather than guessed at. */
  function doorsFor(route) {
    if (!route.reachedThrough) return [];
    var parts = route.reachedThrough.split('/').map(function (s) { return s.trim(); }).filter(Boolean);
    var out = [];
    parts.forEach(function (p) {
      VISIBLE.forEach(function (w) {
        if (out.indexOf(w.path) > -1) return;
        var a = w.label.toLowerCase(), b = p.toLowerCase();
        if (a === b || a.indexOf(b) === 0 || b.indexOf(a) === 0) out.push(w.path);
      });
    });
    return out;
  }

  /* ═══════════════════════════════════════════════════════════════════════════════════
     DIAGRAMS
     ═══════════════════════════════════════════════════════════════════════════════════ */

  var ZONE_VAR = { public: 'var(--z-public)', enforcement: 'var(--z-enforce)', internal: 'var(--z-internal)', record: 'var(--z-record)' };

  function figZones() {
    /* Zone boxes across the top; every request path in a clear band beneath them, so a
       label never has to fight a box for space. An earlier version routed the arrows
       between the columns and the labels landed on top of the components. */
    var z = P.zones, s = '';
    var colX = [20, 320, 620, 920], colW = 240, boxTop = 40, boxH = 268;
    s += svgOpen('0 0 1180 470', 'Four trust zones, their components, and the credential boundary that separates every client from the systems of record');
    s += arrowDefs();

    /* the credential wall, drawn in the gap between public and enforcement */
    s += '<rect x="' + (colX[1] - 40) + '" y="' + boxTop + '" width="16" height="' + boxH + '" fill="url(#wall)"/>';
    s += '<text class="t-mono" transform="rotate(-90 ' + (colX[1] - 32) + ' ' + (boxTop + boxH / 2) + ')" x="' + (colX[1] - 32) + '" y="' + (boxTop + boxH / 2) + '" text-anchor="middle" fill="var(--z-enforce)" style="font-weight:700;letter-spacing:.12em">CREDENTIAL BOUNDARY</text>';

    z.forEach(function (zone, i) {
      var x = colX[i], c = ZONE_VAR[zone.id] || 'var(--ink-3)';
      var strong = zone.id === 'enforcement';
      s += '<g data-zone="' + h(zone.id) + '">';
      s += '<rect x="' + x + '" y="' + boxTop + '" width="' + colW + '" height="' + boxH + '" rx="13" fill="none" stroke="' + c + '" stroke-width="' + (strong ? 2.6 : 1.5) + '" opacity="' + (strong ? 1 : .6) + '"/>';
      s += '<rect x="' + x + '" y="' + boxTop + '" width="' + colW + '" height="30" rx="13" fill="' + c + '" opacity="' + (strong ? .2 : .11) + '"/>';
      s += '<text class="t-zone" x="' + (x + 15) + '" y="' + (boxTop + 20) + '" fill="' + c + '">' + h(zone.label) + '</text>';
      var cy = boxTop + 44;
      zone.components.forEach(function (comp) {
        s += '<rect class="box" x="' + (x + 14) + '" y="' + cy + '" width="' + (colW - 28) + '" height="52" rx="8" stroke="' + c + '"/>';
        s += '<text class="t-node" x="' + (x + 26) + '" y="' + (cy + 22) + '" style="font-size:12.5px">' + h(comp.name) + '</text>';
        s += '<text class="t-mono" x="' + (x + 26) + '" y="' + (cy + 39) + '">' + h(comp.detail) + '</text>';
        cy += 60;
      });
      s += wrap(zone.rule, x + 15, cy + 16, 30, 16, 't-sub');
      s += '</g>';
    });

    /* Request paths, in their own band. from-index, to-index, label, lane. */
    var band = boxTop + boxH;
    [[0, 1, 'anonymous submission — no account, no credential', 0],
     [2, 1, 'authenticated staff request — bearer token', 1],
     [1, 3, 'the only call that carries a credential', 2]].forEach(function (f) {
      var y = band + 30 + f[3] * 38;
      var ax = colX[f[0]] + colW / 2, bx = colX[f[1]] + colW / 2;
      s += '<path d="M' + ax + ',' + band + ' L' + ax + ',' + y + ' L' + bx + ',' + y + ' L' + bx + ',' + (band + 4) + '" fill="none" stroke="var(--smart)" stroke-width="2" marker-end="url(#arg)"/>';
      s += '<text class="t-edge" x="' + ((ax + bx) / 2) + '" y="' + (y - 8) + '" text-anchor="middle" fill="var(--smart)">' + h(f[2]) + '</text>';
    });
    s += '<text class="t-sub" x="20" y="' + (band + 148) + '" fill="var(--ink-3)">Three paths, one destination. The internal platform is not privileged here — it takes the same corridor as an anonymous submitter, through a different door.</text>';
    s += '</svg>';

    return fig(s,
      'The wall is drawn thick because it is the only structural claim on this sheet. Everything else is a consequence of it.',
      sw('var(--z-public)', 'Public') + sw('var(--z-enforce)', 'Enforcement') + sw('var(--z-internal)', 'Internal') + sw('var(--z-record)', 'Systems of record') + ln('var(--smart)', 'request path'));
  }

  function figJourney() {
    var W = 1180, s = svgOpen('0 0 ' + W + ' 430', 'Four intake channels converging on one correspondence record and one lifecycle');
    s += arrowDefs();
    var laneY = [40, 128, 216, 304];
    P.channels.forEach(function (c, i) {
      var y = laneY[i];
      s += '<g class="hit" data-channel="' + h(c.id) + '">';
      s += '<rect class="box" x="16" y="' + y + '" width="330" height="66" rx="9"/>';
      s += '<text class="t-mono" x="30" y="' + (y + 22) + '" fill="var(--smart)" style="font-weight:700">' + h(c.id) + '</text>';
      s += '<text class="t-node" x="52" y="' + (y + 23) + '">' + h(c.label) + '</text>';
      s += '<text class="t-sub" x="30" y="' + (y + 42) + '">' + h(c.origin) + '</text>';
      s += '<text class="t-mono" x="30" y="' + (y + 58) + '">' + h(c.entry) + '</text>';
      /* The channel value lives inside its own card. Floating it over the connector was
         how "channel: Document" ended up written across the record box. */
      s += '<text class="t-mono" x="334" y="' + (y + 58) + '" text-anchor="end" fill="var(--smart)">channel: ' + h(c.channelValue) + '</text>';
      s += '</g>';
      s += '<path d="M346,' + (y + 33) + ' C376,' + (y + 33) + ' 380,215 400,215" fill="none" stroke="var(--ink-3)" stroke-width="1.6" marker-end="url(#ar)"/>';
    });

    s += '<rect x="404" y="152" width="230" height="126" rx="11" fill="var(--accent-soft)" stroke="var(--deep)" stroke-width="2"/>';
    s += '<text class="t-node" x="519" y="182" text-anchor="middle">One correspondence record</text>';
    s += '<text class="t-sub" x="519" y="203" text-anchor="middle">reference · subject · sender</text>';
    s += '<text class="t-sub" x="519" y="221" text-anchor="middle">category · channel · status</text>';
    s += '<text class="t-mono" x="519" y="243" text-anchor="middle" fill="var(--deep)">attachmentLink → SharePoint</text>';
    s += '<text class="t-mono" x="519" y="261" text-anchor="middle" fill="var(--ink-3)">bytes are never in the record</text>';

    var stages = ['Registry', 'Assign', 'Treat', 'Approve', 'Dispatch', 'Close', 'Archive'];
    stages.forEach(function (st, i) {
      var x = 668 + i * 71;
      s += '<rect class="box" x="' + x + '" y="185" width="62" height="60" rx="8"/>';
      s += '<text class="t-mono" x="' + (x + 31) + '" y="212" text-anchor="middle" fill="var(--ink)" style="font-size:9.8px">' + h(st) + '</text>';
      s += '<text class="t-mono" x="' + (x + 31) + '" y="230" text-anchor="middle" style="font-size:9.5px">' + (i + 1) + '</text>';
      if (i < stages.length - 1) s += '<path d="M' + (x + 62) + ',215 L' + (x + 69) + ',215" stroke="var(--ink-3)" stroke-width="1.6" marker-end="url(#ar)"/>';
    });
    s += '<path d="M634,215 L666,215" stroke="var(--deep)" stroke-width="2.2" marker-end="url(#arg)"/>';
    s += '<text class="t-cap" x="854" y="164" text-anchor="middle" fill="var(--ink-2)">one lifecycle, whatever the channel — ' + HEAD.lifecycleStates + ' governed states</text>';
    s += '<text class="t-mono" x="854" y="272" text-anchor="middle">core/lifecycle.js decides every transition</text>';
    s += '</svg>';

    return fig(s,
      'That the model needed exactly one new value — <code>channel: Portal</code> — to absorb a whole new public channel is the test of whether it was right.',
      ln('var(--ink-3)', 'channel path') + ln('var(--deep)', 'shared lifecycle'));
  }

  function figLayers() {
    var L = P.layers, order = ['config', 'core', 'shared', 'modules'];
    var meta = {
      config: ['Declarations only. Routes, roles, boundaries, taxonomy, budgets. No behaviour.', 'var(--z-record)'],
      core: ['State, routing, domain, services, governance. Where the platform actually works.', 'var(--z-internal)'],
      shared: ['Shell, component library, design-system adapter, accessibility.', 'var(--z-public)'],
      modules: ['One workspace per route. Renders and delegates; owns nothing else.', 'var(--z-enforce)']
    };
    /* Each dependency gets its own lane in a left gutter. An earlier version stacked six
       edges into three lanes and the counts landed on top of one another — a diagram whose
       whole purpose is the counts. */
    var bandX = 190, bandW = 590, yOf = { config: 34, core: 134, shared: 234, modules: 334 };
    var s = svgOpen('0 0 1180 466', 'Front-end layer dependencies, with measured import counts and the composition root named');
    s += arrowDefs();
    var edgeKeys = Object.keys(L.edges);
    edgeKeys.forEach(function (key, i) {
      var p = key.split('->'), a = yOf[p[0]] + 41, b = yOf[p[1]] + 41;
      var x = 168 - i * 26;
      s += '<path d="M' + bandX + ',' + a + ' L' + x + ',' + a + ' L' + x + ',' + b + ' L' + (bandX - 4) + ',' + b + '" fill="none" stroke="var(--ink-3)" stroke-width="1.4" opacity=".75" marker-end="url(#ar)"/>';
      /* The lane is labelled with its edge, not only its count. Six arrowheads landing on
         four bands is otherwise a puzzle the reader has to solve. */
      var my = (a + b) / 2;
      s += '<text class="t-edge" transform="rotate(-90 ' + (x - 5) + ' ' + my + ')" x="' + (x - 5) + '" y="' + my + '" text-anchor="middle" fill="var(--ink-2)">' +
        h(key.replace('->', ' → ')) + '  ' + L.edges[key] + '</text>';
    });
    order.forEach(function (layer, i) {
      var y = yOf[layer], c = meta[layer][1];
      s += '<rect x="' + bandX + '" y="' + y + '" width="' + bandW + '" height="82" rx="11" fill="' + c + '" opacity=".08"/>';
      s += '<rect x="' + bandX + '" y="' + y + '" width="' + bandW + '" height="82" rx="11" fill="none" stroke="' + c + '" stroke-width="1.6"/>';
      s += '<text class="t-zone" x="' + (bandX + 18) + '" y="' + (y + 30) + '" fill="' + c + '">' + h(layer) + '/</text>';
      s += '<text class="t-mono" x="' + (bandX + 18) + '" y="' + (y + 52) + '" fill="var(--ink)" style="font-weight:700">' + L.files[layer] + ' files · ' + n(L.sloc[layer]) + ' lines</text>';
      s += wrap(meta[layer][0], bandX + 176, y + 32, 52, 17, 't-sub');
    });
    s += '<text class="t-edge" x="20" y="' + (yOf.modules + 106) + '">each lane is one measured dependency; the number is how many import specifiers cross it</text>';

    s += '<rect x="806" y="' + yOf.config + '" width="352" height="176" rx="11" fill="var(--warn-wash)" stroke="var(--warn)" stroke-width="1.8" stroke-dasharray="6 4"/>';
    s += '<text class="t-cap" x="826" y="' + (yOf.config + 28) + '" fill="var(--warn)">Composition root</text>';
    s += '<text class="t-mono" x="826" y="' + (yOf.config + 50) + '" fill="var(--ink)" style="font-weight:700">' + h(L.compositionRoot.file) + '</text>';
    s += wrap('Lazily imports all ' + L.compositionRoot.dynamicModuleImports + ' modules to register them with the router — one per route.', 826, yOf.config + 74, 42, 17);
    s += wrap('The one upward reference in the system, and it is named here rather than hidden by a tidier drawing.', 826, yOf.config + 122, 42, 17);

    s += '<rect x="806" y="' + (yOf.shared - 14) + '" width="352" height="130" rx="11" fill="var(--ok-wash)" stroke="var(--ok)" stroke-width="1.6"/>';
    s += '<text class="t-cap" x="826" y="' + (yOf.shared + 14) + '" fill="var(--ok)">Static graph: ' + (L.acyclic ? 'acyclic' : 'CYCLIC') + '</text>';
    s += wrap('Every layer builds, tests and deletes independently. Including the dynamic edges it is ' + (L.acyclicIncludingDynamic ? 'still acyclic' : 'not acyclic') + ' — which is the composition root, and only that.', 826, yOf.shared + 38, 42, 17);
    s += '</svg>';
    return fig(s,
      'Counts are measured from real import specifiers — <code>from</code>, bare, and dynamic — not from a diagram somebody kept up to date.',
      ln('var(--ink-3)', 'static import (count = specifiers)') + sw('var(--warn)', 'dynamic / composition root'));
  }

  function figDoors() {
    var groups = P.navGroups.filter(function (g) { return VISIBLE.some(function (w) { return w.group === g; }); });
    var rowH = 30, pad = 26, y = 54, positions = {}, s = '', leftItems = [];
    groups.forEach(function (g) {
      leftItems.push({ group: g });
      VISIBLE.filter(function (w) { return w.group === g; }).forEach(function (w) { leftItems.push({ ws: w }); });
    });
    var H = Math.max(leftItems.length, TECHNICAL.length) * rowH + 74;
    s = svgOpen('0 0 1180 ' + H, 'Nine visible workspaces on the left, the twenty technical routes each is reached through on the right');
    s += arrowDefs();
    s += '<text class="t-zone" x="20" y="30" fill="var(--ink-3)">' + VISIBLE.length + ' visible workspaces</text>';
    s += '<text class="t-zone" x="760" y="30" fill="var(--ink-3)">' + TECHNICAL.length + ' technical routes</text>';

    var cy = y;
    leftItems.forEach(function (it) {
      if (it.group) {
        s += '<text class="t-mono" x="20" y="' + (cy + 14) + '" fill="var(--smart)" style="font-weight:700;letter-spacing:.1em">' + h(it.group) + '</text>';
        cy += rowH;
      } else {
        positions[it.ws.path] = cy + 15;
        s += '<g class="hit" data-node="' + h(it.ws.path) + '">';
        s += '<rect class="box" x="34" y="' + cy + '" width="330" height="' + (rowH - 6) + '" rx="6"/>';
        s += '<text class="t-node" x="46" y="' + (cy + 17) + '" style="font-size:12.5px">' + h(it.ws.label) + '</text>';
        s += '<text class="t-mono" x="352" y="' + (cy + 17) + '" text-anchor="end">' + h(it.ws.path) + '</text>';
        s += '</g>';
        cy += rowH;
      }
    });

    var ry = y;
    TECHNICAL.forEach(function (t) {
      var doors = doorsFor(t);
      s += '<g class="hit" data-node="' + h(t.path) + '" data-doors="' + h(doors.join(' ')) + '">';
      s += '<rect class="box" x="770" y="' + ry + '" width="392" height="' + (rowH - 6) + '" rx="6" stroke-dasharray="4 3"/>';
      s += '<text class="t-mono" x="782" y="' + (ry + 17) + '" fill="var(--ink)" style="font-weight:700">' + h(t.path) + '</text>';
      s += '<text class="t-sub" x="1150" y="' + (ry + 17) + '" text-anchor="end">' + h((t.boundaryRole || '').replace(/-/g, ' ')) + '</text>';
      s += '</g>';
      doors.forEach(function (d) {
        var sy = positions[d];
        if (sy == null) return;
        s += '<path class="edge" data-from="' + h(d) + '" data-to="' + h(t.path) + '" d="M366,' + sy + ' C560,' + sy + ' 576,' + (ry + 12) + ' 768,' + (ry + 12) + '" fill="none" stroke="var(--ink-3)" stroke-width="1.2" opacity=".5"/>';
      });
      ry += rowH;
    });
    s += '</svg>';
    return fig(s,
      'Hover a row to isolate its connections. A technical route is routable, contract-tested and reachable by deep link — it simply is not a door somebody is asked to choose from.',
      ln('var(--ink-3)', 'reached through') + sw('var(--sheet)', 'visible workspace') + '<span><i class="sw" style="background:transparent;border-style:dashed"></i>technical route</span>');
  }

  function figHandoffs() {
    var R = 150, cx = 300, cy = 220, s = '';
    var pts = {};
    VISIBLE.forEach(function (w, i) {
      var a = (i / VISIBLE.length) * Math.PI * 2 - Math.PI / 2;
      pts[w.path] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a: a, w: w };
    });
    s = svgOpen('0 0 960 440', 'Handoff graph between the nine visible workspaces');
    s += arrowDefs();
    VISIBLE.forEach(function (w) {
      (w.handoffs || []).forEach(function (t) {
        var a = pts[w.path], b = pts[t];
        if (!a || !b) return;
        s += '<path class="edge" data-from="' + h(w.path) + '" data-to="' + h(t) + '" d="M' + a.x.toFixed(1) + ',' + a.y.toFixed(1) +
          ' Q' + cx + ',' + cy + ' ' + b.x.toFixed(1) + ',' + b.y.toFixed(1) + '" fill="none" stroke="var(--smart)" stroke-width="1.3" opacity=".42"/>';
      });
    });
    VISIBLE.forEach(function (w) {
      var p = pts[w.path];
      var out = (w.handoffs || []).length;
      var inn = VISIBLE.filter(function (v) { return (v.handoffs || []).indexOf(w.path) > -1; }).length;
      s += '<g class="hit" data-node="' + h(w.path) + '">';
      s += '<circle class="box" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (16 + out * 1.6).toFixed(1) + '"/>';
      s += '<text class="t-mono" x="' + p.x.toFixed(1) + '" y="' + (p.y + 4).toFixed(1) + '" text-anchor="middle" fill="var(--ink)" style="font-weight:700">' + (out + inn) + '</text>';
      var anchor = Math.cos(p.a) > .3 ? 'start' : Math.cos(p.a) < -.3 ? 'end' : 'middle';
      var lx = p.x + Math.cos(p.a) * 40, ly = p.y + Math.sin(p.a) * 40;
      s += '<text class="t-cap" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor + '" style="font-size:11.5px">' +
        h(w.label.length > 19 ? w.label.slice(0, 18) + '…' : w.label) + '</text>';
      s += '</g>';
    });
    /* The reading key sits clear of the widest label, so the circle needs no caption to
       be understood by somebody seeing it for the first time on a screen. */
    s += '<text class="t-zone" x="700" y="70" fill="var(--ink-3)">READ IT LIKE THIS</text>';
    s += wrap('A ring is a workspace, sized by how many handoffs it declares.', 700, 98, 30, 18);
    s += wrap('A chord is a declared handoff — one workspace passing work to another.', 700, 170, 30, 18);
    s += wrap('The number is total handoffs, in and out.', 700, 260, 30, 18);
    s += wrap('Hover a ring to isolate its chords.', 700, 320, 30, 18);
    s += '</svg>';
    return fig(s, 'Handoffs are declared in <code>config/workflow-clarity.config.js</code>, so this graph is the configuration rather than an impression of it.', '');
  }

  function figLifecycle() {
    var T = P.lifecycle.transitions, states = P.lifecycle.states;
    /* Rank by shortest path from `arrival`. A longest-path layering would be tidier on a
       pure DAG, but this graph has genuine cycles (returned → in_progress, blocked →
       in_progress, archived → reopen_requested), and a layout that pretends otherwise
       misrepresents the thing it is drawing. */
    var rank = {}, q = ['arrival'];
    rank.arrival = 0;
    while (q.length) {
      var cur = q.shift();
      (T[cur] || []).forEach(function (nx) {
        if (rank[nx] == null) { rank[nx] = rank[cur] + 1; q.push(nx); }
      });
    }
    states.forEach(function (st) { if (rank[st] == null) rank[st] = 0; });
    /* Laid out top to bottom, one rank per row. Thirteen ranks side by side made a 2000px
       canvas that the page scaled down until the labels were unreadable; a lifecycle reads
       downwards anyway. */
    var rows = {};
    states.forEach(function (st) { (rows[rank[st]] = rows[rank[st]] || []).push(st); });
    var rowKeys = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
    var nodeW = 158, nodeH = 30, gapX = 14, rowH = 62, padX = 24, padY = 54;
    var maxCols = Math.max.apply(null, rowKeys.map(function (k) { return rows[k].length; }));
    var W = padX * 2 + maxCols * (nodeW + gapX) + 130;
    var H = padY + rowKeys.length * rowH + 40;
    var pos = {};
    rowKeys.forEach(function (k, ri) {
      rows[k].sort();
      var span = rows[k].length * (nodeW + gapX) - gapX;
      var startX = padX + 110 + (maxCols * (nodeW + gapX) - gapX - span) / 2;
      rows[k].forEach(function (st, ci) {
        pos[st] = { x: startX + ci * (nodeW + gapX), y: padY + ri * rowH, w: nodeW, hh: nodeH };
      });
    });
    /* Terminal is measured, not remembered: a state with nothing after it. */
    var TERMINALISH = {};
    P.lifecycle.terminalStates.forEach(function (t) { TERMINALISH[t] = 1; });
    var s = svgOpen('0 0 ' + W + ' ' + H, 'The governed lifecycle: ' + states.length + ' states and every transition the platform permits');
    s += arrowDefs();
    /* rank guides, so "how far from arrival" is readable without counting */
    rowKeys.forEach(function (k, ri) {
      var y = padY + ri * rowH;
      s += '<line x1="' + padX + '" y1="' + (y + nodeH / 2) + '" x2="' + (W - 20) + '" y2="' + (y + nodeH / 2) + '" stroke="var(--rule-2)" stroke-width="1"/>';
      s += '<text class="t-edge" x="' + padX + '" y="' + (y + nodeH / 2 - 6) + '">step ' + k + '</text>';
    });
    /* edges first so nodes sit above them */
    states.forEach(function (from) {
      (T[from] || []).forEach(function (to) {
        var a = pos[from], b = pos[to];
        if (!a || !b) return;
        var back = rank[to] <= rank[from];
        var d;
        if (back) {
          /* around the right-hand side, so a return path never hides under a forward one */
          var side = Math.max(a.x + a.w, b.x + b.w) + 34;
          d = 'M' + (a.x + a.w) + ',' + (a.y + a.hh / 2) + ' C' + side + ',' + (a.y + a.hh / 2) +
            ' ' + side + ',' + (b.y + b.hh / 2) + ' ' + (b.x + b.w) + ',' + (b.y + b.hh / 2);
        } else {
          d = 'M' + (a.x + a.w / 2) + ',' + (a.y + a.hh) + ' C' + (a.x + a.w / 2) + ',' + (a.y + a.hh + 18) +
            ' ' + (b.x + b.w / 2) + ',' + (b.y - 18) + ' ' + (b.x + b.w / 2) + ',' + b.y;
        }
        s += '<path class="edge" data-from="' + h(from) + '" data-to="' + h(to) + '" d="' + d + '" fill="none" stroke="' +
          (back ? 'var(--warn)' : 'var(--ink-3)') + '" stroke-width="1.2" opacity="' + (back ? '.55' : '.45') + '"' +
          (back ? ' stroke-dasharray="4 3"' : '') + ' marker-end="url(#' + (back ? 'arw' : 'ar') + ')"/>';
      });
    });
    states.forEach(function (st) {
      var p = pos[st], term = TERMINALISH[st];
      s += '<g class="hit" data-node="' + h(st) + '">';
      s += '<rect class="box" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.hh + '" rx="7"' +
        (term ? ' stroke="var(--deep)" stroke-width="1.9"' : '') + '/>';
      s += '<text class="t-mono" x="' + (p.x + p.w / 2) + '" y="' + (p.y + 19) + '" text-anchor="middle" fill="var(--ink)" style="font-size:10.6px">' +
        h(st.replace(/_/g, ' ')) + '</text>';
      s += '</g>';
    });
    s += '<text class="t-cap" x="' + padX + '" y="28" fill="var(--ink-2)">' + states.length + ' states · rows are distance from arrival · dashed edges go backwards</text>';
    s += '</svg>';
    return fig(s,
      'Drawn from <code>core/lifecycle.js</code>. <code>assertTransitionAllowed()</code> refuses anything not on an edge here, and <code>validateGate()</code> additionally demands evidence: a completion needs a response, a return needs a reason, an approve-with-edit needs a diff.',
      ln('var(--ink-3)', 'forward transition') + ln('var(--warn)', 'backward transition', true) + sw('var(--deep)', 'terminal or disposition'));
  }

  function figCascade() {
    var d = P.design, s = svgOpen('0 0 1180 300', 'The CSS cascade: six ordered layers and the sheets imported into each');
    s += arrowDefs();
    var w = Math.floor(1120 / d.layerOrder.length);
    d.layerOrder.forEach(function (layer, i) {
      var x = 20 + i * w;
      var sheets = d.sheets.filter(function (sh) { return sh.layer === layer; });
      s += '<rect class="box" x="' + x + '" y="46" width="' + (w - 12) + '" height="196" rx="10" stroke="var(--deep)" stroke-width="' + (1 + i * .28).toFixed(2) + '"/>';
      s += '<rect x="' + x + '" y="46" width="' + (w - 12) + '" height="30" rx="10" fill="var(--deep)" opacity="' + (0.07 + i * 0.035).toFixed(3) + '"/>';
      s += '<text class="t-zone" x="' + (x + 12) + '" y="66" fill="var(--deep)">' + h(layer) + '</text>';
      sheets.forEach(function (sh, j) {
        var name = sh.sheet.split('/').pop();
        s += '<text class="t-mono" x="' + (x + 12) + '" y="' + (96 + j * 16) + '" style="font-size:9.4px">' + h(name.length > 21 ? name.slice(0, 20) + '…' : name) + '</text>';
      });
      if (!sheets.length) s += '<text class="t-mono" x="' + (x + 12) + '" y="96" fill="var(--ink-3)" style="font-size:9.4px">(no import)</text>';
      if (i < d.layerOrder.length - 1) s += '<path d="M' + (x + w - 12) + ',144 L' + (x + w - 2) + ',144" stroke="var(--ink-3)" stroke-width="1.6" marker-end="url(#ar)"/>';
    });
    s += wrap('Later layer wins, before specificity is even considered. One @layer statement in styles/index.css replaced 19 unordered link tags, which is why a token change now lands predictably instead of depending on document order.', 20, 268, 118, 19);
    s += '</svg>';
    return fig(s, 'The <code>overrides</code> layer still holds two authorities. Splitting them was attempted and <em>measured</em> — no sub-layer order is behaviour-preserving — so the debt is recorded rather than papered over. <code>styles/index.css</code> carries the measurement.', '');
  }

  /* ═══════════════════════════════════════════════════════════════════════════════════
     SECTIONS
     ═══════════════════════════════════════════════════════════════════════════════════ */

  var SECTIONS = [];
  function S(o) { SECTIONS.push(o); return o; }

  /* ── I · ORIENTATION ─────────────────────────────────────────────────────────────── */

  S({
    id: 'overview', part: 'Orientation', title: 'What this platform is', aud: 'exec arch dev ops',
    eyebrow: 'Start here',
    note: 'One paragraph for the room, then the numbers behind it. Everything on this page is derived from the source tree at commit <code>' + h(P.provenance.commit) + '</code> — no figure here was typed by hand.',
    render: function () {
      var pr = P.product;
      var out = '';
      out += '<div class="callout" data-aud="exec arch dev ops"><div class="lbl">In one paragraph</div><p>' + h(pr.summary) + '</p>' +
        '<p><strong>The organising rule, and the reason this is an architecture rather than a collection of apps: no client — internal or external — holds a credential for a system of record.</strong> ' +
        'The component that holds it is the flow itself, and the browser reaches it with a URL provisioned into the package it was delivered in. That single sentence explains the trust zones, the upload design and half the roadmap — and the cost, stated rather than absorbed: the URL is a credential the browser holds, so it can be rotated but never retired, and every flow must authenticate its own caller.' + '</p></div>';

      out += '<div class="grid g4" data-aud="exec arch dev ops">' +
        kpi(HEAD.routes, 'routes', 'every workspace the runtime can open', true) +
        kpi(HEAD.visibleWorkspaces, 'visible workspaces', 'the doors a person is asked to choose from') +
        kpi(HEAD.technicalRoutes, 'technical routes', 'routable and contract-tested, reached through a door') +
        kpi(HEAD.roles + ' / ' + HEAD.permissions, 'roles / permissions', 'one matrix, and the flows must apply the same one') +
        kpi(HEAD.stateCollections, 'state collections', 'the working set a session holds') +
        kpi(HEAD.contractKeys, 'endpoint contracts', 'named keys — never URLs in the client') +
        kpi(P.dataModel.listCount + ' / ' + P.dataModel.fieldCount, 'lists / fields', 'the system-of-record schema') +
        kpi(HEAD.lifecycleStates, 'lifecycle states', 'every transition the platform permits') +
        '</div>';

      out += '<h3 class="sub" data-aud="exec arch dev ops">Where the code is</h3>';
      var L = P.layers;
      out += '<div class="grid g4" data-aud="exec arch dev ops">' +
        kpi(n(L.files.config + L.files.core + L.files.shared + L.files.modules), 'front-end files', n(sum(Object.keys(L.sloc).map(function (k) { return L.sloc[k]; }))) + ' lines across four layers') +
        kpi('direct', 'flow access', 'no proxy tier — each flow enforces its own contract') +
        kpi(P.portal.files, 'portal files', P.portal.pages.length + ' pages, holding no credential') +
        kpi(P.quality.suites.length, 'test suites', P.quality.ciJobs.length + ' CI jobs gate every push') +
        '</div>';

      out += '<h3 class="sub" data-aud="exec arch dev ops">How to use this atlas</h3>';
      out += '<p data-aud="exec arch dev ops">The <strong>audience lens</strong> in the toolbar reshapes the page rather than merely styling it: choosing <em>Executive</em> removes file inventories and implementation detail and leaves the decisions and their consequences; choosing <em>Developer</em> restores them. <strong>Search</strong> (<kbd>/</kbd> or <kbd>⌘K</kbd>) reaches every route, module, service, role, endpoint key, data field and term on the page. <strong>Print</strong> produces a real handout — diagrams intact, navigation and controls removed.</p>';

      out += '<div class="grid g2" data-aud="exec arch dev ops">' +
        [['Executive briefing', 'Sections 1–3, 13 and 17. The rule, the zones, the document\'s journey, the security posture and what remains to decide. Roughly twelve minutes at a walk.'],
         ['Architecture review', 'Sections 2–5, 9–10 and 14. Zones, layering, workspace topology, the flow tier and the lifecycle that governs every record.'],
         ['Developer onboarding', 'Sections 4–8 and 15. Layer rules, the module contract, the service catalogue, the design system, then the test suites that will tell you when you are wrong.'],
         ['Operations & deployment', 'Sections 9, 11, 15–16. The proxy, the portal, what CI proves, and the deployment surface with the state caveats stated rather than buried.']]
          .map(function (c) { return '<div class="card sunk"><h4>' + h(c[0]) + '</h4><p>' + h(c[1]) + '</p></div>'; }).join('') + '</div>';

      out += '<h3 class="sub" data-aud="arch dev ops">Where a document can come from</h3>';
      out += '<div class="grid g2" data-aud="arch dev ops">' + pr.ingestionSources.map(function (src) {
        return '<div class="card"><h4>' + h(src.label) + '</h4><p>' + h(src.description) + '</p></div>';
      }).join('') + '</div>';

      out += '<div class="callout warn" data-aud="exec arch dev ops"><div class="lbl">Status, stated plainly</div>' +
        '<p>Authentication is <strong>provisioned and inert</strong>. Every structure required for enforced, server-authoritative operation exists on both sides, and the switch is off so the pilot loop stays frictionless. While inert, identity is client-asserted and RBAC is advisory — editing one browser storage key escalates a viewer. Activation is a configuration event, not a development one. Section&nbsp;13 has the detail and the exact obligations.</p></div>';
      return out;
    }
  });

  S({
    id: 'zones', part: 'Orientation', title: 'Trust zones and the credential boundary', aud: 'exec arch dev ops',
    eyebrow: 'Sheet 1 · topology',
    note: 'Four zones. One rule. Everything structural about this platform follows from where the wall is drawn.',
    render: function () {
      var out = figZones();
      out += '<div class="grid g2">' + P.zones.map(function (z) {
        return '<div class="card"><h4><span class="pill z-' + h(z.id === 'enforcement' ? 'enforce' : z.id) + '">' + h(z.label) + '</span></h4>' +
          '<p>' + h(z.rule) + '</p><div class="tags">' +
          tagList(z.components.map(function (c) { return c.name + ' — ' + c.detail; })) + '</div></div>';
      }).join('') + '</div>';

      out += '<h3 class="sub" data-aud="arch dev">What the boundary buys, concretely</h3>';
      out += tbl(['Property', 'Before the boundary', 'After it'], [
        ['<b>Credential exposure</b>', 'Signed workflow URLs shipped inside client JavaScript. A URL is a bearer credential: possession alone authorises the call.', 'No signature exists in any shipped asset. There is nothing to leak, which is stronger than rotating what leaked.'],
        ['<b>Identity</b>', 'Client asserts <code>userEmail</code>; the server believes it.', 'Identity is read from validated token claims. A client-asserted identity is stripped before authorization runs.'],
        ['<b>Authorization</b>', 'Enforced in the browser, which can decline to send a request but can never prevent one.', 'Enforced server-side against the same matrix the client renders from, so the two cannot disagree.'],
        ['<b>Audit</b>', 'Recorded where the actor can edit it.', 'Recorded server-side, before the upstream call.']
      ]);
      out += '<div class="callout" data-aud="exec arch"><div class="lbl">Why it is drawn as a wall</div>' +
        '<p>A line invites exceptions; a wall does not. Internal staff clients take exactly the same path as an anonymous submitter — a different door into the same corridor, not a private one. The moment one internal client is allowed past it, every argument in this atlas about where credentials live stops being true.</p></div>';
      return out;
    }
  });

  S({
    id: 'journey', part: 'Orientation', title: 'How a document travels', aud: 'exec arch dev ops',
    eyebrow: 'Sheet 2 · the end-to-end story',
    note: 'Four channels, one record, one lifecycle. This is the section to walk an executive audience through — it is the whole platform in a single picture.',
    render: function () {
      var out = figJourney();
      out += tbl(['Channel', 'Origin', 'Entry point', 'Path', 'Authentication', 'Status'],
        P.channels.map(function (c) {
          var tone = /implemented/.test(c.status) ? 'ok' : 'warn';
          return ['<b>' + h(c.id) + ' · ' + h(c.label) + '</b>', h(c.origin), '<code>' + h(c.entry) + '</code>',
            '<code>' + h(c.path) + '</code>', h(c.auth), '<span class="pill ' + tone + '">' + h(c.status) + '</span>'];
        }));

      out += '<h3 class="sub">The record every channel produces</h3>';
      out += '<p>Identical in every case. <code>channel</code> is the only field that distinguishes origin, and it takes one of ' +
        P.channels.length + ' values: ' + P.channels.map(function (c) { return '<code>' + h(c.channelValue) + '</code>'; }).join(', ') + '.</p>';
      out += '<p class="mono" style="background:var(--sunken);border:1px solid var(--rule-2);border-radius:10px;padding:14px 16px;max-width:none">' +
        'id · referenceId · subject · sender · senderEmail · receivedAt · correspondenceType · channel · category · subcategory · assignedTo · assignedDsu · status · priority · confidentiality · attachmentLink · description · duplicateOf · holdReason · closedAt · createdAt · updatedAt</p>';
      out += '<div class="callout ok"><div class="lbl">Documents are never carried as bytes</div>' +
        '<p>The record holds <code>attachmentLink</code>. The bytes live in the SharePoint document library, deposited by the only component that can reach it. This was already the implicit model before the public channel existed, and it is the reason absorbing that channel needed one new field value rather than a migration.</p></div>';

      out += '<h3 class="sub" data-aud="arch dev ops">The reference a submitter is given</h3>';
      out += '<div class="grid g3">' +
        kpi(P.taxonomy.referenceFormat, 'reference format', 'minted server-side, never client-chosen') +
        kpi(P.taxonomy.referenceExample, 'as the register issues it', 'unpadded (D1) — the platform conforms to the register') +
        kpi(P.taxonomy.publicKinds.length, 'public document kinds', 'the vocabulary a citizen chooses from') +
        '</div>';
      out += '<p data-aud="arch dev"><strong>Why the sequence is not a variable in memory.</strong> It was, and two processes both minted <code>' +
        h(P.taxonomy.referencePrefix) + '-2026-1</code>: on a server that needed a restart, on an edge isolate it needs only a cold start, which happens routinely and invisibly. Two citizens then hold a receipt for the same reference and the register contains it twice. For a records system that is not a rough edge — it is the register being wrong. ' + 'The sequence is held by the SUBMISSION flow, which is the single writer. Anything this browser mints is marked <code>referenceProvisional</code> on the record, because a client sees only the records it has loaded and cannot issue an authoritative registry reference.' + '</p>';

      out += '<h3 class="sub" data-aud="arch dev ops">What a citizen may send</h3>';
      out += '<div class="tags">' + tagList(P.taxonomy.publicKinds) + '</div>';
      out += '<p data-aud="arch dev ops">A submitter chooses from this public subset; every value maps into the internal taxonomy, defaulting to <code>' +
        h(P.taxonomy.defaultRoutingCategory) + '</code>. A citizen should not be asked to pick from an internal list, and no value may exist that the registry cannot route.</p>';
      return out;
    }
  });

  /* ── II · FRONT END ──────────────────────────────────────────────────────────────── */

  S({
    id: 'frontend', part: 'Front end', title: 'Layered architecture and the composition root', aud: 'arch dev',
    eyebrow: 'Sheet 3 · structure',
    note: 'Four layers, a measured dependency graph, and the one upward reference — named rather than hidden, because a diagram claiming a clean hierarchy while that exists is worse than no diagram.',
    render: function () {
      var L = P.layers, out = figLayers();
      out += '<div class="grid g4">' +
        kpi(L.files.config, 'config/ files', 'declarations — no behaviour') +
        kpi(L.files.core, 'core/ files', 'state, domain, services, governance') +
        kpi(L.files.shared, 'shared/ files', 'shell, components, adapter') +
        kpi(L.files.modules, 'modules/ files', 'one workspace per route') +
        '</div>';

      out += '<h3 class="sub">The rules the graph enforces</h3>';
      out += tbl(['Rule', 'Why', 'How it is checked'], [
        ['<b>config/ imports nothing from core, shared or modules</b>', 'A declaration that imports behaviour is not a declaration. Configuration must be readable by a test, a script and the proxy without booting an app.', '<code>npm run test:imports</code> plus the measured graph — <code>config→*</code> has no edge.'],
        ['<b>modules/ never import each other</b>', 'A module that reaches into a sibling has taken ownership of something it does not own, and the boundary contract stops meaning anything.', 'Measured: <code>modules→shared</code> is ' + (L.edges['modules->shared'] || 0) + ' and there is no <code>modules→modules</code> cross-import edge in the graph.'],
        ['<b>Static graph stays acyclic</b>', 'A cycle means no layer can be built, tested or deleted alone.', '<code>tests/architecture.test.mjs</code> fails on a static cycle — the import gets fixed, not the diagram.'],
        ['<b>The composition root is disclosed</b>', '<code>core/boot.js</code> dynamically imports every module to register it. That is a genuine upward reference and pretending otherwise is the failure these checks exist to catch.', 'The test asserts exactly ' + L.compositionRoot.dynamicModuleImports + ' dynamic module imports — one per route — and that the dynamic graph is <em>not</em> acyclic.']
      ]);

      out += '<h3 class="sub" data-aud="dev">Boot sequence</h3>';
      out += '<div class="grid g2" data-aud="dev">' + [
        ['1 · Stylesheet', 'A single <code>@layer</code> entry point, <code>styles/index.css</code>. Six ordered layers replace 19 unordered links.'],
        ['2 · Runtime config', '<code>config/config.local.js</code> is optional and loaded with <code>onerror</code>. A 404 here is expected — endpoints may come from the proxy instead.'],
        ['3 · Design-system runtime', '<code>shared/figma-uiux-runtime.js</code> applies theme, density and root attributes before first paint.'],
        ['4 · Composition', '<code>core/boot.js</code> hydrates state, then dynamically imports all ' + L.compositionRoot.dynamicModuleImports + ' modules to register them with the router.'],
        ['5 · Route', 'The router resolves the hash, checks <code>canAccess()</code>, and hands the workspace its slice.'],
        ['6 · Watchdog', 'If nothing has booted in 15 seconds, <code>index.html</code> names the resources that failed to load — because a static module-graph failure throws nothing and logs nothing, and once shipped as a permanent spinner.']
      ].map(function (c) { return '<div class="card sunk"><h4>' + c[0] + '</h4><p>' + c[1] + '</p></div>'; }).join('') + '</div>';

      out += '<div class="callout" data-aud="dev"><div class="lbl">Zero build, on purpose</div>' +
        '<p>No bundler, no transpiler, no server-side rendering, no runtime dependency. What is in the repository is what runs in the browser, which means a stack trace points at a real line and an auditor reads shipped source rather than a build output. The cost is that the module graph must be correct on disk — hence the cheapest and most load-bearing test in the suite: <code>npm run test:imports</code>.</p></div>';
      return out;
    }
  });

  S({
    id: 'workspaces', part: 'Front end', title: 'The workspace map', aud: 'exec arch dev ops',
    eyebrow: 'Sheet 4 · navigation topology',
    note: HEAD.routes + ' routes exist. A person is asked to choose between ' + HEAD.visibleWorkspaces + ' of them. The other ' + HEAD.technicalRoutes + ' are reached through one of those, by a guided handoff or a deep link — routable and contract-tested, never a menu item.',
    render: function () {
      var out = figDoors();
      out += '<h3 class="sub">Handoffs between workspaces</h3>';
      out += figHandoffs();
      out += '<h3 class="sub">Navigation groups</h3>';
      var groups = P.navGroups.filter(function (g) { return VISIBLE.some(function (w) { return w.group === g; }); });
      out += '<div class="grid g3">' + groups.map(function (g) {
        var ws = VISIBLE.filter(function (w) { return w.group === g; });
        return '<div class="card"><h4><span class="meta">' + h(g) + '</span></h4>' +
          ws.map(function (w) {
            return '<p style="margin-top:10px"><b style="color:var(--ink)">' + h(w.label) + '</b><br><span class="mono" style="color:var(--ink-3)">' + h(w.path) + '</span><br>' + h(w.purpose || '') + '</p>';
          }).join('') + '</div>';
      }).join('') + '</div>';

      out += '<h3 class="sub" data-aud="arch dev ops">Every technical route and the door it opens behind</h3>';
      out += tbl(['Route', 'Label', 'Reached through', 'Boundary role', 'Roles with access'],
        TECHNICAL.map(function (t) {
          return ['<code>' + h(t.path) + '</code>', h(t.label), h(t.reachedThrough || '—'),
            '<span class="mono">' + h(t.boundaryRole || '—') + '</span>',
            '<span class="mono" style="font-size:11px">' + h(t.roles.join(' ')) + '</span>'];
        }));
      out += '<div class="callout" data-aud="exec arch"><div class="lbl">Why hide twenty routes</div>' +
        '<p>A navigation menu with twenty-nine entries is a menu nobody reads; the user picks the wrong workspace and the record starts in the wrong place. Visible workspaces answer <em>what am I trying to do</em>; technical routes answer <em>where does the system put this step</em>. Both are real, both are governed, and only one of them is a question a person should be asked.</p></div>';
      return out;
    }
  });

  S({
    id: 'modules', part: 'Front end', title: 'Module catalogue', aud: 'arch dev ops',
    eyebrow: 'Sheet 5 · ' + HEAD.routes + ' workspaces',
    note: 'Every route, with the contract that governs it. <strong>owns</strong> is what the module may do, <strong>views</strong> is what it may read, and <strong>must not own</strong> is the list that keeps a workspace from quietly absorbing a neighbour\'s authority — the failure that turns a governed platform into a set of screens.',
    render: function () {
      var groups = P.navGroups;
      var out = '<div class="filters" data-filter="modules">' +
        '<input type="search" placeholder="Filter ' + HEAD.routes + ' modules by name, purpose, capability…" aria-label="Filter modules">' +
        '<button class="chip" data-f="all" aria-pressed="true">All</button>' +
        '<button class="chip" data-f="visible" aria-pressed="false">Visible</button>' +
        '<button class="chip" data-f="technical" aria-pressed="false">Technical</button>' +
        groups.map(function (g) { return '<button class="chip" data-f="g:' + h(g) + '" aria-pressed="false">' + h(g) + '</button>'; }).join('') +
        '<span class="count"></span></div>';

      out += '<div class="grid g2" data-list="modules">' + ROUTES.map(function (r) {
        var hay = [r.path, r.label, r.group, r.kind, r.purpose, r.boundaryRole].concat(r.owns, r.views, r.roles).join(' ').toLowerCase();
        return '<article class="mcard" id="route-' + h(r.path) + '" data-hay="' + h(hay) + '" data-vis="' + (r.visible ? 'visible' : 'technical') + '" data-group="' + h(r.group) + '">' +
          '<div class="top"><div><div class="rt">' + h(r.path) + '</div><div class="lb">' + h(r.label) + '</div></div>' +
          '<div style="text-align:right;display:flex;flex-direction:column;gap:4px;align-items:flex-end">' +
          '<span class="pill ' + (r.visible ? 'brand' : 'mut') + '">' + (r.visible ? 'visible' : 'technical') + '</span>' +
          '<span class="pill mut">' + h(r.kind) + '</span></div></div>' +
          (r.purpose ? '<p class="pp">' + h(r.purpose) + '</p>' :
            (r.reachedThrough ? '<p class="pp">Reached through <b>' + h(r.reachedThrough) + '</b>.</p>' : '')) +
          (r.boundaryRole ? '<p class="pp"><span class="meta">Role</span> <span class="mono">' + h(r.boundaryRole) + '</span></p>' : '') +
          (r.owns.length ? '<div class="tags"><span class="meta" style="width:100%">owns</span>' + tagList(r.owns) + '</div>' : '') +
          (r.views.length ? '<div class="tags"><span class="meta" style="width:100%">views</span>' + tagList(r.views, 'eye') + '</div>' : '') +
          (r.mustNotOwn.length ? '<div class="tags"><span class="meta" style="width:100%">must not own</span>' + tagList(r.mustNotOwn, 'no') + '</div>' : '') +
          (r.handoffs.length ? '<div class="tags"><span class="meta" style="width:100%">hands off to</span>' + tagList(r.handoffs) + '</div>' : '') +
          '<div class="tags" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--rule-2)">' +
          '<span class="tag">' + h(r.file || 'no module file') + '</span>' +
          '<span class="tag">' + r.lines + ' lines</span>' +
          '<span class="tag">' + r.roles.length + '/' + HEAD.roles + ' roles</span></div>' +
          '</article>';
      }).join('') + '</div>';

      out += '<div class="callout" data-aud="dev"><div class="lbl">The module contract, in one rule</div>' +
        '<p>A module renders and delegates. It never writes to another module\'s collection, never performs a transition itself, and never invokes an endpoint directly — <code>core/governed-actions.js</code> and <code>core/action-authority.js</code> stand in front of both. <code>assertModuleAction()</code> refuses an action the boundary does not grant, so an overreach fails at the call rather than in review.</p></div>';
      return out;
    }
  });

  S({
    id: 'services', part: 'Front end', title: 'Core services', aud: 'dev arch',
    eyebrow: 'Sheet 6 · ' + P.layers.files.core + ' core files, ' + P.layers.files.shared + ' shared, ' + P.layers.files.config + ' config',
    note: 'The layer modules delegate to. Grouped by what they are responsible for, with the exported surface of each — this is the map to read before writing a line of code in this repository.',
    render: function () {
      /* Subsystem membership is editorial: the code is grouped by responsibility, and the
         grouping is a judgement about the codebase, not a fact in it. Anything not named
         below lands in "Everything else", so a new file appears rather than vanishing. */
      var SUB = [
        ['State & data', 'The single store, how it is filled, and how it is read.',
          ['state', 'data-loader', 'data-client', 'data-reconciler', 'data-selectors', 'entity-store', 'query-store', 'cache-manager', 'fetch-manager', 'write-manager', 'idempotency', 'pending-queue', 'offline-action-queue']],
        ['Domain & lifecycle', 'What a correspondence, a task and a registry file are, and which transitions are legal.',
          ['domain', 'enterprise-domain', 'lifecycle', 'executive-register', 'archive', 'retention', 'reference-minter', 'assignment-cascade', 'assignment-payload', 'directorate-scope', 'source-views']],
        ['Governance & authority', 'The spine. Every state change passes through here.',
          ['governed-actions', 'action-authority', 'action-runtime', 'audit-log', 'contracts', 'receipt-ledger', 'security-actions', 'current-user', 'auth']],
        ['Integration', 'How the platform talks to anything outside itself.',
          ['api', 'endpoint-registry', 'flow-confirmation', 'otp-service', 'scan-intake-service', 'support-service', 'acknowledgement-service', 'correspondence-email-service', 'dispatch-service', 'platform-provisioner']],
        ['Presentation', 'Rendering primitives shared by every module.',
          ['ui', 'ui-state', 'ui-interactions', 'render-budget', 'loading-state', 'focus-trap', 'nitda-module-adapter', 'welcome-experience']],
        ['Observability', 'What the platform knows about itself.',
          ['metrics-service', 'performance-monitor', 'activity-parity', 'export-bundle', 'report-export-service', 'errors', 'deeplink-resolver', 'router', 'boot']]
      ];
      var claimed = {};
      SUB.forEach(function (g) { g[2].forEach(function (nm) { claimed[nm] = 1; }); });
      var rest = P.inventory.core.filter(function (f) { return !claimed[f.name]; }).map(function (f) { return f.name; });
      if (rest.length) SUB.push(['Everything else', 'Not yet grouped. Listed so nothing is invisible.', rest]);

      var byName = {};
      P.inventory.core.forEach(function (f) { byName[f.name] = f; });

      var out = '<div class="grid g3">' +
        kpi(P.layers.files.core, 'core services', n(P.layers.sloc.core) + ' lines') +
        kpi(sum(P.inventory.core, function (f) { return f.exports.length; }), 'exported symbols', 'the surface modules may call') +
        kpi(P.layers.edges['modules->core'] || 0, 'module→core imports', 'measured, not estimated') +
        '</div>';

      out += SUB.map(function (g) {
        var files = g[2].map(function (nm) { return byName[nm]; }).filter(Boolean);
        var body = tbl(['File', 'Lines', 'Exports', 'Reaches'], files.map(function (f) {
          return ['<code>' + h(f.name) + '</code>', '<span class="num">' + f.lines + '</span>',
            f.exports.length
              ? '<span class="mono" style="font-size:11px">' + h(f.exports.slice(0, 9).join(' · ')) + (f.exports.length > 9 ? ' <b>+' + (f.exports.length - 9) + '</b>' : '') + '</span>'
              : '<span style="opacity:.5">—</span>',
            f.reaches.length ? '<span class="mono" style="font-size:11px">' + h(f.reaches.join(' ')) + '</span>' : '<span style="opacity:.5">self-contained</span>'];
        }));
        return acc('<b>' + h(g[0]) + '</b> <span class="pill mut">' + files.length + ' files</span> <span style="color:var(--ink-3);font-weight:400">' + h(g[1]) + '</span>', body);
      }).join('');

      out += '<h3 class="sub">shared/ — the application shell</h3>';
      out += tbl(['File', 'Lines', 'Responsibility'], P.inventory.shared.map(function (f) {
        var role = {
          'shell': 'The chrome: sidebar, header, command palette, persona switcher, route frame.',
          'components': 'The component library — ' + P.design.components.length + ' functions returning escaped markup. No framework, no virtual DOM.',
          'design-system-adapter': 'The single place theme, density and root attributes are decided, plus the escaping helpers every component uses.',
          'accessibility': 'Keyboard shortcuts, focus restoration after a route change, and icon labelling.',
          'figma-uiux-runtime': 'Applies the design-system attributes before first paint, so there is no flash of an unthemed shell.',
          'relationship-runtime': 'Turns a declared handoff into an actual navigation with context, and installs the interceptors that carry it.',
          'welcome-runtime': 'First-run experience, driven by config/welcome-experience.config.js.',
          'workspace-guide': 'The per-workspace guidance surface and the command list behind it.'
        }[f.name] || '—';
        return ['<code>' + h(f.name) + '</code>', '<span class="num">' + f.lines + '</span>', role];
      }));

      out += '<h3 class="sub">config/ — declarations only</h3>';
      out += '<p>' + P.layers.files.config + ' files, ' + n(P.layers.sloc.config) + ' lines, and no behaviour. Configuration is importable by a test, a build script and the proxy without booting an application — which is exactly why the proxy can import the RBAC matrix instead of restating it.</p>';
      out += tbl(['File', 'Lines', 'Exports'], P.inventory.config.map(function (f) {
        return ['<code>' + h(f.name) + '</code>', '<span class="num">' + f.lines + '</span>',
          '<span class="mono" style="font-size:11px">' + h(f.exports.slice(0, 6).join(' · ') || '—') + (f.exports.length > 6 ? ' <b>+' + (f.exports.length - 6) + '</b>' : '') + '</span>'];
      }));
      return out;
    }
  });

  S({
    id: 'design', part: 'Front end', title: 'The design system', aud: 'dev arch ops',
    eyebrow: 'Sheet 7 · Obsidian Harmonized',
    note: 'Self-hosted tokens, a deterministic cascade, ' + P.design.components.length + ' components and ' + P.design.themes.length + ' themes. Nothing loads from a CDN, so the platform looks the same on a government network with the outside world blocked.',
    render: function () {
      var d = P.design, out = '';
      out += '<div class="grid g4">' +
        kpi(d.primitiveTokens, 'primitive tokens', 'raw values — the only place a hex code appears') +
        kpi(d.semanticTokens, 'semantic tokens', 'meanings, which is what components consume') +
        kpi(d.components, 'component functions', 'escaped markup, no framework') +
        kpi(d.themes.length + ' × ' + d.densities.length, 'themes × densities', d.themes.join(' · ') + ' — ' + d.densities.join(' · ')) +
        '</div>';

      out += '<h3 class="sub">Brand</h3>';
      out += '<div class="grid g3">' + d.brand.filter(function (b) { return b.note; }).map(function (b) {
        return '<div class="card"><h4><span style="display:inline-block;width:22px;height:22px;border-radius:5px;background:' + h(b.value) + ';border:1px solid var(--rule)"></span> ' + h(b.value) + '</h4>' +
          '<p><span class="mono">' + h(b.token) + '</span><br>' + h(b.note) + '</p></div>';
      }).join('') + '</div>';
      out += '<p>The full primitive ramp carries ' + d.brand.length + ' brand steps. A component never names one: it names a semantic token, which a theme re-binds. That indirection is why a dark theme is a token file rather than a second stylesheet.</p>';

      out += '<h3 class="sub">The cascade</h3>';
      out += figCascade();

      out += '<h3 class="sub" data-aud="dev">Token files</h3>';
      out += '<div class="tags">' + tagList(d.tokenFiles) + '</div>';
      out += '<h3 class="sub" data-aud="dev">Component library</h3>';
      out += '<div class="tags">' + tagList(d.components) + '</div>';

      out += '<div class="callout" data-aud="dev arch"><div class="lbl">Every component escapes</div>' +
        '<p>Components return strings, which is fast and framework-free and would be a cross-site-scripting machine without discipline. So escaping is not left to the caller: <code>esc()</code> is applied at each interpolation inside the component, and <code>tests/output-encoding.test.mjs</code> is written as negative controls — removing an escaper fails its matching case rather than passing silently.</p></div>';

      out += '<h3 class="sub" data-aud="dev ops">Accessibility</h3>';
      out += '<div class="grid g2" data-aud="dev ops">' + [
        ['Focus is managed, not assumed', 'Route changes restore focus to the main region; dialogs trap it and give it back. <code>core/focus-trap.js</code> is one implementation, used everywhere.'],
        ['Three themes, not two', 'Light, dark and a high-contrast theme — <code>tokens.theme-hc.css</code> — bound at the token layer so it needs no component changes.'],
        ['Density is a token', 'Comfortable and compact re-bind spacing tokens. No component knows which one is active.'],
        ['Icons carry labels', '<code>shared/accessibility.js</code> supplies the labelling helper; an icon-only control without a label is a bug with a name.']
      ].map(function (c) { return '<div class="card sunk"><h4>' + h(c[0]) + '</h4><p>' + c[1] + '</p></div>'; }).join('') + '</div>';
      return out;
    }
  });

  /* ── III · BACK END ──────────────────────────────────────────────────────────────── */

  S({
    id: 'backend', part: 'Back end',
    title: 'The flow tier',
    aud: 'arch dev ops exec',
    eyebrow: 'Sheet 8 · where enforcement actually happens',
    note: 'This platform ships no proxy, by decision. Enforcement lives at the flow endpoint '
      + 'instead — which does not weaken the organising rule, it relocates it. A browser can '
      + 'still decline to send a request and can still never prevent one; the component that '
      + 'says no is simply on the other side of the boundary.',
    render: function () {
      /* Sheet 8 used to render either topology, and the proxy branch is now unreachable:
         the variant was withdrawn rather than deployed and the generator no longer reports
         one. Dead branches in a briefing pack are worse than dead code in a module — this
         is the artefact people read to learn what the system is, and a diagram of a tier
         that does not exist is a confident wrong picture, which is the exact failure the
         generated-documentation approach exists to prevent. */
      var b = P.backend;
      var out = '<div class="grid g4">' +
        kpi(P.endpoints.count, 'endpoint contracts', 'each one a flow that authenticates its own caller') +
        kpi('0', 'shipped tiers', 'nothing to deploy between client and flow') +
        kpi(P.security.postureName, 'auth posture', 'reported by the auth layer about itself') +
        kpi(P.quality.suites.length, 'test suites', 'contract shape is asserted client-side') +
        '</div>';
      out += '<p class="note">' + h(b.note) + '</p>';
      out += '<h3 class="sub">The ' + P.endpoints.count + ' contracts</h3>';
      out += '<p>Declared in <code>config/endpoints.config.js</code>, which holds no URL. ' +
        'Trigger URLs are provisioned into the delivered package by <code>npm run package</code>, ' +
        'so the repository names the contracts without carrying the credentials that reach them, ' +
        'and the artefact that is handed over carries both.</p>';
      out += '<div class="chips">' + P.endpoints.keys.map(function (k) {
        return '<span class="chip">' + h(k) + '</span>';
      }).join('') + '</div>';
      out += '<h3 class="sub">What moved, and what did not</h3>';
      out += tbl(['Concern', 'With a proxy', 'Here'], [
        ['Who holds the flow credential', 'The proxy, in Worker secrets', 'The delivered package; readable by anyone the site serves'],
        ['Who authenticates the caller', 'The proxy, once, centrally', 'Each flow, for itself'],
        ['Who mints the registry reference', 'A Durable Object counter', 'The SUBMISSION flow; client minting stays provisional'],
        ['Where rate limiting lives', 'One choke point', 'Per flow — more places to tune, no single point to forget'],
        ['How a credential is revoked', 'Rotate one secret in one place', 'Rotate the trigger and rebuild the package. Rotation is the only revocation'],
        ['The organising rule', 'No client holds a credential for a system of record', '<strong>Changed, and the cost is stated.</strong> The browser does hold one. The rule that replaces it: every flow authenticates its own caller, because nothing else can'],
      ]);
      return out;
    }
  });

  S({
    id: 'intake', part: 'Back end', title: 'Anonymous intake, uploads and verification', aud: 'arch dev ops',
    eyebrow: 'Sheet 9 · the one unauthenticated path',
    note: 'The public submission path requires no token, because a citizen writing to NITDA has no account and should not need one. With no tier in front of it, every property below is an obligation on the SUBMISSION flow itself — specified in <code>document-portal/README.md</code> and the deployment guides, and enforced there rather than by a component this repository ships.',
    render: function () {
      var out = '';
      out += '<div class="grid g2">' + [
        ['No mutation of existing records', 'It can create a submission and read back the status of one record the caller already identifies. It cannot list, search, or change anything that exists.'],
        ['Rate limited, twice', 'Per source address, fixed window, with a separate and stricter budget for status reads. Sharing one limiter would let a guessing run spend the submission allowance, and let a burst of lookups block a submission.'],
        ['Size capped', 'Bounded body, bounded attachment count, bounded declared size — checked before anything is stored.'],
        ['Server-minted references', 'A client-chosen identifier is not a reference: two submitters collide and a malicious one claims someone else\'s. The registry sequence is issued here.']
      ].map(function (c) { return '<div class="card"><h4>' + h(c[0]) + '</h4><p>' + h(c[1]) + '</p></div>'; }).join('') + '</div>';

      out += '<div class="callout warn"><div class="lbl">A weakening, recorded rather than buried</div>' +
        '<p>Status read-back was added in step 6 and it weakened the create-only property this route started with. It is bounded — one record, identified by the pair the submitter already holds, on its own tighter budget — but it is a read, and the module says so in its own header instead of leaving a future reader to discover it.</p></div>';

      out += '<h3 class="sub">Upload brokering</h3>';
      /* The ticket lifecycle is a proxy mechanism. Drawing it on a tree that ships no proxy
         would illustrate a component the reader cannot find — so the obligation is stated
         instead, which is what actually transfers to the flow. */
      out += '<p>There is no ticket broker to draw, because there is no tier to draw it in. The '
        + 'obligation transfers whole to the <code>UPLOAD</code> flow: redeem a single-use ticket once, '
        + 'verify the received bytes against the declared size and SHA-256, and refuse anything that '
        + 'does not match. The portal computes and declares the digest before sending, so a file that '
        + 'changes in transit is refused rather than filed.</p>';
      out += '<div class="callout" data-aud="arch dev"><div class="lbl">The bug this design retires</div>' +
        '<p>The portal used to base64-encode a file into a workflow payload. Base64 inflates by a third, so the transport limit became a silent data-loss bug: the interface accepted five files up to 50&nbsp;MB, transmitted only the first, and if that one exceeded 4&nbsp;MB sent an <strong>empty</strong> payload while reporting success. For a service desk that is a bug. For a document intake channel it is the entire purpose failing silently — and telling the submitter their documents were received. Moving bytes out of the payload removes the ceiling and the failure mode together.</p></div>';

      out += '<h3 class="sub">Email verification before a reference is minted</h3>';
      out += '<div class="grid g2">' + [
        ['What it is for', 'A submitter gets a receipt that actually reaches them. Today a typo in the address produces a reference nobody can ever use — the tracking page needs the pair, and the wrong half is unrecoverable. This is by far the more common failure.'],
        ['What it also does', 'Raises the cost of bulk abuse. It does not stop a determined attacker, who can verify one address and reuse it. It stops the trivial case, which is the one that actually happens.'],
        ['What it is emphatically not', 'Identity. A verified address proves someone reads that mailbox. Nothing downstream may treat it as proof of who they are.'],
        ['Why it defaults to off', 'With no mail endpoint configured the proxy cannot send a code, so requiring one would take the public channel offline. <code>requireVerification</code> defaults to false and must be enabled deliberately — and the posture is reported in every response, so a deployment cannot be wrong about which mode it is in.']
      ].map(function (c) { return '<div class="card"><h4>' + h(c[0]) + '</h4><p>' + c[1] + '</p></div>'; }).join('') + '</div>';

      out += '<h3 class="sub">The universal filename policy, made executable</h3>';
      var fp = P.taxonomy.filenamePolicy;
      out += '<p>The agency policy is real, written down and dated ' + h(fp.effective) + ', owned by ' + h(fp.owner) + '. Nothing enforced it: both paths by which a file enters the registry took the basename and capped the length. A policy that exists only as a PDF is a policy the registry does not have.</p>';
      out += '<div class="grid g3">' +
        kpi(fp.version, 'policy version', 'effective ' + h(fp.effective)) +
        kpi(fp.limits.maxBodyChars, 'max body characters', 'the whole name stays under the transport limit of 200') +
        kpi(fp.vagueTerms.length, 'flagged vague terms', 'flagged, never rejected') +
        '</div>';
      out += '<p><span class="meta">Authoring pattern</span> <code>' + h(fp.pattern) + '</code></p>';
      out += tbl(['Arrives as', 'Stored as', 'Why'], P.taxonomy.filenameExamples.map(function (e) {
        return ['<code>' + h(e.from) + '</code>', '<code>' + h(e.to) + '</code>',
          '<span class="mono" style="font-size:11px">' + h(e.reasons.join(' · ')) + '</span>'];
      }));
      out += '<div class="callout ok"><div class="lbl">It normalises; it never rejects</div>' +
        '<p>A citizen\'s correspondence must not be refused because their phone named the scan <code>IMG_20260101_093211(1).jpg</code>. The file is accepted, stored under a compliant name, and the name they sent is recorded beside it. Refusing here would convert a naming standard into a barrier to petitioning the government. Normalising also happens to neutralise reserved device names, control characters and right-to-left override tricks — and because "happens to" is not a control, those are handled explicitly as well.</p></div>';
      return out;
    }
  });

  S({
    id: 'portal', part: 'Back end', title: 'The public document portal', aud: 'exec dev ops',
    eyebrow: 'Sheet 10 · the external channel',
    note: 'The external intake channel for documents and correspondence addressed to NITDA: submission, tracking, and a helpdesk. It is not a service-request desk and carries no staff-facing function — internal operations live in the platform, which is the system of record.',
    render: function () {
      var pt = P.portal, out = '';
      out += '<div class="grid g4">' +
        kpi(pt.pages.length, 'pages', pt.pages.join(' · ')) +
        kpi(pt.files, 'files', 'static only — no build step, no framework') +
        kpi(pt.icons, 'sprite symbols', 'injected at runtime, no icon CDN') +
        kpi(pt.shellEntries.length, 'precached shell entries', 'cache <code>' + h(pt.cacheName) + '</code>') +
        '</div>';
      out += tbl(['Page', 'What it does'], [
        ['<code>index.html</code>', 'Front door: live registry activity, correspondence types, a lifecycle explainer, FAQ and a first-visit welcome.'],
        ['<code>submit.html</code>', 'Four-step guided submission — type, sender, document, review — with drag-and-drop attachments, an autosaved draft and a printable receipt.'],
        ['<code>track.html</code>', 'Verified lookup by reference and email, read back from the registry: lifecycle stepper, acknowledgement meter, full timeline.'],
        ['<code>support.html</code>', 'Helpdesk: searchable answers, contact channels, portal status, and a case desk with preview-and-confirm and an instant case reference.'],
        ['<code>404.html</code>', 'Not-found, inside the portal shell rather than the host\'s default page.']
      ]);
      out += '<h3 class="sub" data-aud="dev ops">Offline behaviour, and one hard-won rule</h3>';
      out += '<div class="callout" data-aud="dev ops"><div class="lbl">Why <code>js/data.js</code> is deliberately not precached</div>' +
        '<p>The shell is cache-first and navigations are network-first, so a redeploy is picked up on the next online visit. <code>js/data.js</code> is excluded from the install shell on purpose: it once carried the signed workflow endpoints, and precaching wrote them durably into Cache Storage where they outlived the tab. The endpoints are gone now, and it stays excluded anyway — it is the file most likely to change with registry reference data, and a cache-first copy of a stale correspondence taxonomy is the wrong thing to serve offline.</p>' +
        '<p>The cache constant must be bumped on every release, and <em>always</em> when endpoints rotate: cache-first means a stale entry survives a redeploy, so rotating without bumping pins returning visitors to an endpoint that no longer exists.</p></div>';
      out += '<h3 class="sub" data-aud="dev">Runtime</h3>';
      out += '<div class="tags" data-aud="dev">' + tagList(pt.scripts) + '</div>';
      out += '<p data-aud="dev">Classic scripts, one namespace, no build step. The portal can be copied to any web root — Apache, Nginx, IIS, S3 and CloudFront, Cloudflare Pages, Azure Static Web Apps — and it runs.</p>';
      return out;
    }
  });

  /* ── IV · DATA & GOVERNANCE ──────────────────────────────────────────────────────── */

  S({
    id: 'data', part: 'Data & governance', title: 'The data model', aud: 'arch dev ops exec',
    eyebrow: 'Sheet 11 · ' + P.dataModel.listCount + ' lists, ' + P.dataModel.fieldCount + ' fields',
    note: 'Two shapes, and they are not the same thing. The <strong>system-of-record schema</strong> is what SharePoint holds and what survives the session. The <strong>runtime state</strong> is what a browser holds while a session is open. Confusing them is how a platform ends up trusting the browser.',
    render: function () {
      var dm = P.dataModel, out = '';
      out += '<div class="grid g4">' +
        kpi(dm.listCount, 'SharePoint lists', 'the system-of-record schema') +
        kpi(dm.fieldCount, 'fields', 'provisioned from a machine-readable specification') +
        kpi(dm.stateCollections.length, 'runtime collections', 'schema version ' + dm.stateSchemaVersion) +
        kpi(dm.provisioningSteps, 'provisioning steps', dm.validationChecks + ' validation checks') +
        '</div>';

      out += '<h3 class="sub">System of record</h3>';
      out += tbl(['#', 'List', 'Purpose', 'Fields', 'Required', 'Indexed'], dm.lists.map(function (l) {
        return ['<span class="num">' + l.order + '</span>', '<code>' + h(l.title) + '</code>', h(l.purpose || l.description || ''),
          '<span class="num">' + l.fieldCount + '</span>', '<span class="num">' + l.requiredFields + '</span>', '<span class="num">' + l.indexedFields + '</span>'];
      }));

      out += '<h3 class="sub" data-aud="arch dev">Every field, by list</h3>';
      out += '<div data-aud="arch dev">' + dm.lists.map(function (l) {
        var body = tbl(['Field', 'Type', 'Required', 'Indexed', 'Choices'], l.fields.map(function (f) {
          return ['<code>' + h(f.name) + '</code>', '<span class="mono">' + h(f.type) + '</span>',
            f.required ? '<span class="pill ok">yes</span>' : '<span style="opacity:.4">—</span>',
            f.indexed ? '<span class="pill info">yes</span>' : '<span style="opacity:.4">—</span>',
            f.choices ? '<span class="mono" style="font-size:11px">' + h(f.choices.join(' · ')) + '</span>' : '<span style="opacity:.4">—</span>'];
        }));
        return acc('<code>' + h(l.title) + '</code> <span class="pill mut">' + l.fieldCount + ' fields</span> <span style="color:var(--ink-3);font-weight:400">' + h(l.description || '') + '</span>', body);
      }).join('') + '</div>';

      out += '<h3 class="sub">Runtime state</h3>';
      out += '<p>' + dm.stateCollections.length + ' collections and ' + dm.stateObjects.length + ' objects, normalised on every load by <code>normalizePlatformState()</code> so a module never has to defend against a missing collection. An absent collection becomes an empty array, not <code>undefined</code> — which is why no module contains a <code>|| []</code> guard.</p>';
      out += '<div class="tags">' + tagList(dm.stateCollections) + '</div>';
      out += '<div class="tags">' + tagList(dm.stateObjects, 'eye') + '</div>';

      out += '<h3 class="sub" data-aud="arch dev">Domain vocabularies</h3>';
      out += '<div class="grid g3" data-aud="arch dev">' + [
        ['Correspondence', P.lifecycle.correspondenceStates],
        ['Operations / tasks', P.lifecycle.operationStates],
        ['Registry', P.lifecycle.registryStates]
      ].map(function (g) {
        return '<div class="card"><h4>' + h(g[0]) + ' <span class="pill mut">' + g[1].length + '</span></h4><div class="tags">' + tagList(g[1]) + '</div></div>';
      }).join('') + '</div>';
      return out;
    }
  });

  S({
    id: 'security', part: 'Data & governance', title: 'Security, identity and governance', aud: 'exec arch dev ops',
    eyebrow: 'Sheet 12 · posture and controls',
    note: 'What is enforced today, what is provisioned and waiting, and exactly what changes when the switch is thrown. Stated as it is — a half-enabled auth layer is worse than none, because it invites the assumption that something is being enforced.',
    render: function () {
      var s = P.security, out = '';
      var po = s.posture || {};
      out += '<div class="callout ' + (s.enabled ? 'ok' : 'warn') + '"><div class="lbl">Current posture: ' + h(s.postureName) + '</div>' +
        '<p>' + (s.enabled
          ? 'Authentication is enforced. Every request carries a bearer token, identity comes from validated claims, and the client-asserted identity field is not sent.'
          : 'Authentication is <strong>provisioned and inert</strong>. Identity travels as a client-asserted field from local storage and RBAC is advisory — editing one storage key escalates a viewer to system administrator. This is deliberate for the development and pilot loop, and it is why the enforcement tier exists.') + '</p>' +
        (po.warning ? '<p><strong>The layer\'s own words:</strong> ' + h(po.warning) + '</p>' : '') +
        '</div>';
      out += '<div class="grid g4">' +
        kpi(po.enforced ? 'enforced' : 'advisory', 'governance', 'what the controls actually are today') +
        kpi(po.identity || '—', 'identity source', 'where the caller\'s name comes from') +
        kpi(po.roleSource || '—', 'role source', 'where the caller\'s role comes from') +
        kpi(po.readyToActivate ? 'yes' : 'no', 'ready to activate', po.readyToActivate
          ? 'every activation value is present'
          : 'missing: <span class="mono">' + h((po.missingConfig || []).join(', ') || 'unknown') + '</span>') +
        '</div>';

      out += '<h3 class="sub">What flipping one switch changes</h3>';
      out += tbl(['Concern', 'Inert (today)', 'Enforced (at release)'], [
        ['<b>Request</b>', 'No <code>Authorization</code> header. <code>userEmail</code> travels in the body.', 'Every request carries <code>Authorization: Bearer</code>. The client-asserted field is no longer sent — and is stripped server-side even if it were.'],
        ['<b>Identity</b>', 'Read from the local profile.', 'Read from validated token claims. Never from the request body, under any circumstance.'],
        ['<b>Role</b>', 'Read from local state; editable by the actor.', 'Derived from claims and mapped server-side. A principal carrying several mapped roles gets the most capable one, decided by permission count — not by array order, which the identity provider controls.'],
        ['<b>Unauthenticated caller</b>', 'Reaches every governed action.', 'Cannot reach a governed action at all.']
      ]);
      out += '<p data-aud="arch dev ops">Provider <code>' + h(s.provider) + '</code>, scopes <code>' + h(s.scopes.join(' ')) + '</code>. Tenant, client and proxy base URL are injected at deploy time and never committed. The full obligations are in <code>docs/architecture/AUTHENTICATION_CONTRACT.md</code>; Diagnostics reports the live posture inside the running platform.</p>';

      out += '<h3 class="sub">Role and route matrix</h3>';
      out += '<p>One matrix, one consumer today: the client renders navigation from it. With nothing in front of the flows to authorize against it, RBAC here is <strong>advisory</strong> — which is exactly what the auth posture above reports, and why it says so rather than implying enforcement. Each flow must apply the same matrix for it to become enforcement.</p>';
      var roleIds = Object.keys(s.roleRouteAccess);
      var matrix = '<div class="scroll"><table class="matrix"><thead><tr><th class="rh">Route</th>' +
        roleIds.map(function (r) { return '<th class="rot">' + h(r) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        ROUTES.map(function (rt) {
          return '<tr><th class="rh"><code>' + h(rt.path) + '</code>' + (rt.visible ? ' <span class="pill brand">door</span>' : '') + '</th>' +
            roleIds.map(function (role) {
              var allowed = s.roleRouteAccess[role];
              if (allowed.indexOf('*') > -1) return '<td class="all" title="all routes">●</td>';
              return allowed.indexOf(rt.path) > -1 ? '<td class="y">●</td>' : '<td class="n">·</td>';
            }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
      out += matrix;

      out += '<h3 class="sub">Roles and what they may do</h3>';
      out += tbl(['Role', 'Label', 'Persona', 'Routes', 'Permissions'], s.roles.map(function (r) {
        var allowed = s.roleRouteAccess[r.id] || [];
        var count = allowed.indexOf('*') > -1 ? HEAD.routes + ' (all)' : allowed.length;
        return ['<code>' + h(r.id) + '</code>', '<b>' + h(r.label) + '</b>', '<span class="mono">' + h(s.rolePersonaMap[r.id] || '—') + '</span>',
          '<span class="num">' + count + '</span>',
          r.permissions.length ? '<span class="mono" style="font-size:11px">' + h(r.permissions.join(' · ')) + '</span>' : '<span style="opacity:.5">read-only — none</span>'];
      }));

      out += '<h3 class="sub" data-aud="arch dev">Controls beyond authentication</h3>';
      out += tbl(['Control', 'What it stops', 'Where it lives'], [
        ['<b>Module boundaries</b>', 'A workspace quietly absorbing a neighbour\'s authority — approving inside a tracking lens, archiving inside a registry view.', '<code>config/module-boundaries.config.js</code> · <code>core/action-authority.js</code>'],
        ['<b>Lifecycle gates</b>', 'A transition without its evidence: a completion with no response, a return with no reason, an approve-with-edit with no diff.', '<code>core/lifecycle.js</code>'],
        ['<b>Idempotency</b>', 'A retried or replayed action creating a second record. The first response is returned instead.', '<code>core/idempotency.js</code>, and the flow must honour the key it is sent'],
        ['<b>Output encoding</b>', 'Injected markup from a sender name, a subject line or a filename.', '<code>shared/design-system-adapter.js</code> · <code>core/ui.js</code>, tested as negative controls'],
        ['<b>Endpoint redaction</b>', 'A signed URL reaching a log, an export or a diagnostics panel. <code>sig</code>, <code>sv</code>, <code>sp</code> and <code>code</code> are stripped first.', '<code>core/endpoint-registry.js</code>'],
        ['<b>Filename normalisation</b>', 'Reserved device names, control characters and right-to-left override tricks arriving from an anonymous submitter into a Windows document library.', '<code>config/filename-policy.config.js</code>'],
        ['<b>Secret ratchet</b>', 'A <em>new</em> signed URL entering a tracked file. Known ones are baselined so CI reports rather than blocks — the fix for those is rotation, not deletion.', '<code>tests/check-secrets.mjs</code> · <code>tests/secrets-baseline.txt</code>']
      ]);
      var s_secretsLen = (P.security.secretsBaseline || []).length;
      /* The signed-URL exposure narrative belongs to the proxy variant, where rotation is a
         prerequisite for placing a URL in a Worker secret. On a tree with no proxy tier the
         endpoint URLs are deploy-time configuration that is never committed, so leading this
         sheet with a rotation warning would foreground an operational concern at the expense
         of the architecture the sheet exists to explain. The defences above are still drawn;
         only the framing changes. */
      out += '<div class="callout" data-aud="exec arch ops"><div class="lbl">Where the credential lives</div>' +
        '<p>No endpoint URL is committed. <code>config/endpoints.config.js</code> declares the ' +
        P.endpoints.count + ' contracts by name and holds no URL; the URLs are provisioned into the ' +
        'delivered package by <code>npm run package</code>, which refuses to build one wired to a ' +
        'signature this repository already publishes. The secret ratchet above exists so that a ' +
        '<em>new</em> one entering a tracked file is reported by CI rather than discovered later, and ' +
        'it reports the exposure it deliberately excludes on every run rather than describing a ' +
        'narrowed scan as a clean result.</p></div>';
      return out;
    }
  });

  S({
    id: 'lifecycle', part: 'Data & governance', title: 'The governed lifecycle', aud: 'arch dev ops exec',
    eyebrow: 'Sheet 13 · ' + HEAD.lifecycleStates + ' states',
    note: 'Every transition the platform permits, and no others. This is what makes the platform a records system rather than a set of forms — a status is not a field somebody types, it is a move the system either allows or refuses.',
    render: function () {
      var out = figLifecycle();
      out += '<h3 class="sub">Gates — transitions that additionally demand evidence</h3>';
      out += tbl(['Transition', 'Requires', 'Why'], [
        ['→ <code>action_complete</code>', 'A response, a summary, or a task reference', 'Work reported complete with nothing attached is not evidence of completion, and the record is the only thing that outlives the conversation.'],
        ['→ <code>returned</code>', 'A reason', 'A return with no reason is a loop. The officer needs to know what to change.'],
        ['→ <code>approved_with_edit</code>', 'An edit diff', 'An approval that silently altered the text is unauditable — what was approved must be recoverable.'],
        ['→ <code>no_dispatch</code>', 'A reason', 'Deciding not to reply is a decision, and it belongs in the record like any other.'],
        ['→ <code>closed</code>', 'The closure gate passes', 'Closure is checked, not asserted: outstanding tasks, unacknowledged assignments and missing receipts all block it.']
      ]);
      out += '<div class="grid g4">' +
        kpi(HEAD.lifecycleStates, 'states', 'declared in <code>core/lifecycle.js</code>') +
        kpi(P.lifecycle.transitionCount, 'permitted transitions', 'everything else is refused', true) +
        kpi(P.lifecycle.terminalStates.length, 'terminal states', 'nothing follows them: ' + h(P.lifecycle.terminalStates.join(', '))) +
        kpi('reopen', 'never a mutation', 'a reopened record becomes a new reference — the archive stays immutable') +
        '</div>';
      out += '<div class="callout" data-aud="arch exec"><div class="lbl">Why archive → reopen is the interesting edge</div>' +
        '<p>An archived record is immutable, so reopening cannot mean editing it. The transition is <code>archived → reopen_requested → reopened_as_new_ref</code>: the original stays exactly as archived and a new reference carries the new work, linked to it. That is the difference between a records system and a database with a status column.</p></div>';
      return out;
    }
  });

  /* ── V · DELIVERY ────────────────────────────────────────────────────────────────── */

  S({
    id: 'quality', part: 'Delivery', title: 'What the build proves', aud: 'dev ops arch',
    eyebrow: 'Sheet 14 · ' + P.quality.suites.length + ' suites, ' + P.quality.ciJobs.length + ' CI jobs',
    note: 'Tests here are written as negative controls wherever they can be: reverting a fix must fail its matching case rather than passing silently. A test that cannot fail is documentation with a green tick.',
    render: function () {
      var q = P.quality, out = '';
      out += '<div class="grid g4">' +
        kpi(q.suites.length, 'npm test suites', 'all gated on every push') +
        kpi(q.ciJobs.length, 'CI jobs', q.ciJobs.map(function (j) { return j.name; }).join(' · ')) +
        kpi(q.proxyTests.length, 'proxy suites', 'real RSA tokens, signed at run time') +
        kpi(q.playwrightSpecs.length, 'browser specs', 'the app actually booting') +
        '</div>';
      out += '<h3 class="sub">The suites</h3>';
      out += tbl(['Command', 'Runs'], q.suites.map(function (s) {
        return ['<code>' + h(s.script) + '</code>', '<span class="mono" style="font-size:11.5px">' + h(s.runs) + '</span>'];
      }));
      out += '<h3 class="sub">Continuous integration</h3>';
      out += tbl(['Job', 'What it establishes'], q.ciJobs.map(function (j) {
        var why = {
          'Module graph': 'Fails fast and gates everything else. This is the check that would have caught 12 config modules imported but never committed — a failure that threw nothing, logged nothing, and shipped as a permanent boot spinner. It also carries the governance, encoding, hardening, auth-posture and proxy suites.',
          'Smoke tests': 'The application actually boots in a real browser and the themes apply. Uploads the Playwright report on failure.',
          'Link check': 'Crawls both entry points. Informational only — it depends on external hosts being reachable, so a flaky CDN cannot block a merge.',
          'Secret scan': 'A ratchet, not a gate: fails on a <em>new</em> signature and reports the already-known ones. Failing on the baselined set would make CI permanently red without improving anything — those need rotation, which no test can perform.'
        }[j.name] || '';
        return ['<b>' + h(j.name) + '</b>', why];
      }));
      out += '<h3 class="sub" data-aud="dev">Every CI step, in order</h3>';
      out += '<div class="tags" data-aud="dev">' + tagList(q.ciSteps) + '</div>';
      out += '<div class="callout" data-aud="dev arch"><div class="lbl">The drift test, which is why this atlas can be trusted</div>' +
        '<p><code>tests/visual-docs.test.mjs</code> asserts this page against the live configuration: the counts, every route name, the roles, the endpoint keys, the data-model totals. A route added without regenerating the dataset fails the build. That is the only reason a document like this one is worth reading a month after it was written.</p></div>';
      return out;
    }
  });

  S({
    id: 'deploy', part: 'Delivery', title: 'Deployment and operations', aud: 'ops arch dev',
    eyebrow: 'Sheet 15 · the runtime surface',
    note: 'Static hosting plus a provisioned package. There is no tier between the clients and the Power Automate flows: endpoint URLs are configured into the delivered artefact and are never committed, and each flow enforces its own contract.',
    render: function () {
      /* No proxy in this variant, so there is no worker to describe. The honest thing is
         to describe the topology that IS in force rather than render an empty deployment
         sheet — the reader's question ("what do I stand up, and what enforces what?") has
         a real answer here, it is just a different one. */
      {
        var o = '<div class="grid g4">' +
          kpi('none', 'proxy tier', 'the platform calls the flows directly') +
          kpi(P.endpoints.keys.length, 'endpoint contracts', 'each one a flow that enforces its own caller') +
          kpi(P.portal.files, 'portal files', 'static hosting only — holds no credential') +
          kpi(P.quality.suites.length, 'test suites', P.quality.ciJobs.length + ' CI jobs gate every push') +
          '</div>';
        o += '<p class="note">' + h(P.backend.note) + '</p>';
        o += '<h3 class="sub">What this means for deployment</h3>';
        o += tbl(['Concern', 'Where it is enforced', 'Consequence'], [
          ['Authentication of the caller', 'Inside each Power Automate flow', 'There is no tier to deploy, and no tier to forget to deploy.'],
          ['The registry sequence', 'The SUBMISSION flow holds it', 'Client minting stays <em>provisional</em> and is flagged as such on the record.'],
          ['Rate limiting and size caps', 'Flow-side, per endpoint', 'Each flow carries its own limits; there is no single choke point to tune.'],
          ['Trigger URLs', 'Configuration supplied at deploy time', 'Static hosting plus configuration is the whole runtime surface.'],
        ]);
        return o;
      }
      var w = P.backend.worker, out = '';
      out += '<div class="grid g4">' +
        kpi(w.name || '—', 'worker', 'entry <code>' + h(w.entry) + '</code>') +
        kpi(w.durableObjects.length, 'durable objects', w.durableObjects.join(' · ') || '—') +
        kpi(w.vars.length, 'non-secret vars', 'committed, because none of them is sensitive') +
        kpi(w.secrets.length, 'secret names', 'set with <code>wrangler secret put</code>, never written down') +
        '</div>';
      out += '<h3 class="sub">Configuration surface</h3>';
      out += tbl(['Variable', 'Value', 'What it governs'], w.vars.map(function (v) {
        var why = {
          'DGO_INTAKE_REF_PREFIX': 'The registry reference prefix.',
          'DGO_UPSTREAM_TIMEOUT_MS': 'How long the proxy waits on a workflow before giving up.',
          'DGO_TRUST_FORWARDED_FOR': 'False on purpose. The edge sets <code>cf-connecting-ip</code>; <code>X-Forwarded-For</code> can be spoofed by the caller, and a rate limiter keyed on a spoofable value is not one.',
          'DGO_REQUIRE_VERIFICATION': 'Email round-trip before a reference is minted. Requires the verify secret; the Worker refuses to serve if this is true without it, rather than taking the public channel offline.',
          'DGO_REQUIRE_DURABLE_REFERENCES': 'Set true once the Durable Object is bound. The Worker then refuses to serve rather than issue a reference it cannot promise is unique — the register being wrong is worse than the channel being down.'
        }[v.key] || '';
        return ['<code>' + h(v.key) + '</code>', '<code>' + h(v.value) + '</code>', why];
      }));
      out += '<h3 class="sub">Secrets</h3>';
      out += tbl(['Name', 'Purpose'], w.secrets.map(function (sc) {
        return ['<code>' + h(sc.key) + '</code>', h(sc.note)];
      }));
      out += '<div class="callout warn"><div class="lbl">State that is genuinely weaker at the edge — stated, not buried</div>' +
        '<p>Five stores began in memory: the rate limiter, the reference minter, the idempotency cache, the upload-ticket burn list, and the verification challenge store. The minter is now a Durable Object, because a sequence must be atomic and eventually-consistent storage cannot make it so. Of the remaining four, two are a <em>degradation</em> — limits are per-isolate and therefore more permissive than they read. Two are a <strong>correctness failure</strong>, because they are single-use guarantees: a ticket burned in one isolate can be redeemed in another, and a verification proof consumed in one can be replayed in another. Single use that holds most of the time is not single use.</p>' +
        '<p>So the Worker reports <code>singleUseScope</code> on <code>/healthz</code> and logs the posture on every cold start. A deployment cannot be wrong about which guarantee it has, and the walkthrough requires a shared store before production traffic.</p></div>';
      out += '<h3 class="sub" data-aud="ops">Running it locally</h3>';
      out += tbl(['Command', 'What it does'], [
        ['<code>npm install && npm start</code>', 'Serves the platform at <code>localhost:8080</code>. Authentication stays inert, identity comes from the local profile — exactly as the pilot behaves.'],
        ['<code>npm run start:proxy</code>', 'Runs the proxy under the <code>node:http</code> host, the same handler the Worker runs.'],
        ['<code>npm run visual</code>', 'Regenerates this atlas\'s dataset from the source tree.'],
        ['<code>npm test</code>', 'The whole suite: import graph, secrets, governance, encoding, hardening, proxy, intake, upload, architecture and the browser smoke tests.']
      ]);
      out += '<p data-aud="ops">The full click-by-click deployment walkthrough — Cloudflare Access groups, flow regeneration, SharePoint provisioning, secrets, verification evidence and rollback — is <code>docs/deployment/CLOUDFLARE.md</code>, with the shortest viable path in <code>docs/deployment/MINIMAL-PILOT.md</code>.</p>';
      return out;
    }
  });

  S({
    id: 'roadmap', part: 'Delivery', title: 'What is done, what is next', aud: 'exec arch ops',
    eyebrow: 'Sheet 16 · state of play',
    note: 'An honest register. Nothing here is aspirational — each row is either in the tree, or named as not yet being there.',
    render: function () {
      var out = '';
      out += '<h3 class="sub">Built</h3>';
      out += tbl(['Capability', 'Where it lives', 'Status'], [
        ['Internal operations platform — ' + HEAD.routes + ' routes, ' + HEAD.visibleWorkspaces + ' workspaces', '<code>index.html</code> · <code>modules/</code> · <code>core/</code>', '<span class="pill ok">running</span>'],
        ['Public document portal — ' + P.portal.pages.length + ' pages, offline shell', '<code>document-portal/</code>', '<span class="pill ok">running</span>'],
      ].concat([
        ['Anonymous intake and upload — enforced by the flow, not by a shipped tier', '<code>document-portal/</code> → <code>SUBMISSION</code>', '<span class="pill warn">flow-side contract</span>'],
        ['Registry sequence — held by the SUBMISSION flow', '<code>core/reference-minter.js</code> mints provisional only', '<span class="pill ok">server-issued</span>'],
        ['Registry scan intake — channel C', '<code>modules/scan-intake.js</code> · <code>core/scan-intake-service.js</code>', '<span class="pill ok">running against SCAN_INTAKE</span>'],
        ['Provisioned deployment packages, manifest-verified', '<code>scripts/package.mjs</code>', '<span class="pill ok">gated in CI</span>'],
      ]).concat([
        ['Universal filename policy, enforced at both entry points', '<code>config/filename-policy.config.js</code>', '<span class="pill ok">enforced</span>'],
        ['Briefs, meetings and projects (ex-Activity Hub, decision D6(b))', '<code>core/executive-register.js</code>', '<span class="pill ok">running as platform modules</span>']
      ]));
      out += '<h3 class="sub">Open</h3>';
      /* The roadmap follows the topology too. On a tree with no proxy, "rotate every
         published signature" and "restrict the flows to proxy egress" are not open items —
         they are items belonging to a different variant, and listing them here would send a
         reader to look for work that does not exist on this branch. What IS open is the
         architecture that has been decided and not yet built. */
      out += tbl(['Item', 'Why it matters', 'What closes it'],
        ([
        ['<b>Rotate every published signature</b>', 'A signed trigger URL is a bearer credential, and this repository publishes 55 of them. Deleting a file revokes nothing; neither does rewriting history.', 'Regenerate every trigger in Power Automate, then rebuild the packages. <code>npm run package</code> refuses a pilot build wired to a published one.'],
        ['<b>Activate authentication</b>', 'Until it is on, every client-side control is an affordance and RBAC is advisory. The auth layer says so about itself rather than implying otherwise.', 'Set <code>auth.enabled</code>, supply tenant configuration, and satisfy the server-side obligations at the flow.'],
        ['<b>Dual-spine intake (D2)</b>', 'AI classification and human triage are to run at par, with the AI path degrading to human-only rather than blocking. Approved and not yet built.', 'Build the AI spine alongside the human one, sharing the category taxonomy both already write into.'],
        ['<b>Per-entry-point first-line feeds (D4)</b>', 'Each of the four channels is to keep its own dedicated first-line feed before convergence. Approved and not yet built.', 'Give each channel its own feed, then converge through the normalising layer that already exists in <code>core/source-normalizer.js</code>.'],
        ['<b>Routing-graph authoring — scope undecided</b>', 'The source Orchestrator SPA edited the routing graph. Building it here before deciding creates two authorities over one graph.', 'Decide whether authoring belongs in the platform or stays in Power Automate.'],
      ]).concat([
        ['<b>Rendered-appearance regression coverage</b>', 'Nothing beyond the smoke suite\'s theme check protects the cascade.', 'Add visual regression coverage over the rendered surfaces.'],
      ]));
      out += '<div class="callout" data-aud="exec"><div class="lbl">The one-line summary for a decision meeting</div>' +
        '<p>The platform is built and running against its own flows, and both deliverables package with their endpoints provisioned in and every byte hashed. Governance is enforced at the flow endpoint, authentication is provisioned and inert, and the remaining work is in Power Automate rather than here — rotate the published signatures, and make each flow authenticate its own caller.</p></div>';
      return out;
    }
  });

  S({
    id: 'glossary', part: 'Delivery', title: 'Glossary and provenance', aud: 'exec arch dev ops',
    eyebrow: 'Sheet 17 · terms and sources',
    note: 'The vocabulary this platform uses precisely, and where every figure on this page came from.',
    render: function () {
      var terms = [
        ['Correspondence', 'A document received or originated by the agency, in any channel. The central record — everything else hangs off it.'],
        ['Reference', 'The registry identifier issued to a correspondence: <code>' + h(P.taxonomy.referenceFormat) + '</code>, for example <code>' + h(P.taxonomy.referenceExample) + '</code>. Unpadded, minted server-side, never chosen by a client.'],
        ['Registry file', 'The official file jacket a correspondence is placed in. Carries custody, movement and minutes.'],
        ['Minute', 'A recorded instruction or annotation on a registry file — the paper practice this platform is a faithful digital version of.'],
        ['Movement', 'A registry file passing from one holder to another, with the action requested and the priority.'],
        ['Task / operation', 'A unit of work assigned to an officer, acknowledged, progressed and completed.'],
        ['Acknowledgement', 'The assignee\'s receipt of an assignment. A gate, not a courtesy: unacknowledged work escalates.'],
        ['Dispatch', 'Sending the approved response outward, and capturing the receipt that proves it went.'],
        ['Closure', 'A checked state, not an asserted one. Outstanding tasks and missing receipts block it.'],
        ['Archive', 'An immutable closure bundle with a hash. Reopening never mutates it — it produces a new reference.'],
        ['Workspace', 'One of the ' + HEAD.visibleWorkspaces + ' doors a person is asked to choose between.'],
        ['Technical route', 'One of the ' + HEAD.technicalRoutes + ' routable, governed destinations reached through a workspace rather than a menu.'],
        ['Boundary', 'What a module owns, may view, and must not own. Enforced at the call, not in review.'],
        ['Contract key', 'A named action such as <code>FETCH_ALL</code>. The client names the action; only the proxy knows the URL.'],
        ['Persona', 'A coarse grouping (' + h(P.security.personas.join(', ')) + ') that governs scope. A role governs permissions; a persona governs reach.'],
        ['DSU', 'Departmental service unit — the organisational unit work is assigned to alongside a named officer.'],
        ['Inert posture', 'Authentication provisioned but switched off. Development behaves as it always has; nothing is being enforced, and the platform says so.'],
        ['Ratchet', 'A check that may only improve — the secrets baseline can shrink and never grow.']
      ];
      var out = '<div class="grid g2">' + terms.map(function (t) {
        return '<div class="card sunk"><h4>' + h(t[0]) + '</h4><p>' + t[1] + '</p></div>';
      }).join('') + '</div>';

      out += '<h3 class="sub">Provenance</h3>';
      out += tbl(['Property', 'Value'], [
        ['Source commit', '<code>' + h(P.provenance.commit) + '</code> on <code>' + h(P.provenance.branch) + '</code>, dated ' + h(P.provenance.commitDate)],
        ['Generated by', '<code>' + h(P.provenance.generatedFrom) + '</code> — run <code>npm run visual</code>'],
        ['Verified by', '<code>tests/visual-docs.test.mjs</code> — <code>npm run test:visual</code>'],
        ['Platform version', '<code>' + h(P.product.version) + '</code> (<code>' + h(P.product.appId) + '</code>)']
      ]);

      out += '<h3 class="sub">Companion documents</h3>';
      out += tbl(['Document', 'What it carries'], [
        ['<code>README.md</code>', 'How to run it, the repository layout, and the current security status.'],
        ['<code>docs/architecture/AUTHENTICATION_CONTRACT.md</code>', 'The activation specification and every server-side obligation, clause by clause.'],
        ['<code>docs/architecture/TARGET_ARCHITECTURE.md</code>', 'The full architecture narrative and the numbered build sequence.'],
        ['<code>docs/architecture/components.html</code>', 'The drift-tested component and relationship sheets this atlas expands on.'],
        ['<code>docs/deployment/CLOUDFLARE.md</code>', 'The click-by-click deployment walkthrough, with evidence templates.'],
        ['<code>docs/cutover/FLOW_DECOMMISSION_INVENTORY.md</code>', 'Every published workflow signature and its disposition.'],
        ['<code>docs/audits/CAPABILITY_ASSESSMENT_R11.6.md</code>', 'The gap analysis behind the open items in sheet 16.']
      ]);

      out += '<div class="callout"><div class="lbl">How to keep this page true</div>' +
        '<p>Change the code, then run <code>npm run visual</code>. The dataset is re-derived and every figure here moves with it. If you change the code and do not, <code>npm test</code> fails and tells you which claim went stale — which is the only durable way to make visual documentation worth trusting.</p></div>';
      return out;
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════════════════ */

  var doc = document.getElementById('doc');
  var html = '';

  html += '<div class="hero">' +
    '<div class="eyebrow">' + h(P.product.office) + '</div>' +
    '<h1>' + h(P.product.name) + '<br>Platform Atlas</h1>' +
    '<p class="lede">A complete visual account of the platform — <strong>architecture, components, modules, data, security, lifecycle and delivery</strong>, front end and back end, in one navigable page. ' +
    'Every number, name and edge on this page is derived from the source tree by <code>scripts/visual-docs-data.mjs</code> and checked against the live configuration by the build, so nothing here can quietly go out of date.</p>' +
    '<div class="stamp">' +
    '<span>commit <b>' + h(P.provenance.commit) + '</b></span>' +
    '<span><b>' + HEAD.routes + '</b> routes</span>' +
    '<span><b>' + HEAD.visibleWorkspaces + '</b> visible workspaces</span>' +
    '<span><b>' + HEAD.technicalRoutes + '</b> technical routes</span>' +
    '<span><b>' + HEAD.stateCollections + '</b> state collections</span>' +
    '<span><b>' + HEAD.contractKeys + '</b> contract keys</span>' +
    '<span><b>' + P.dataModel.listCount + '</b> lists · <b>' + P.dataModel.fieldCount + '</b> fields</span>' +
    '<span><b>' + HEAD.zones + '</b> trust zones</span>' +
    '<span>static layers: <b>' + (P.layers.acyclic ? 'acyclic' : 'cyclic') + '</b></span>' +
    '</div></div>';

  SECTIONS.forEach(function (sec, i) {
    html += '<section class="sheet" id="' + sec.id + '" data-aud="' + h(sec.aud) + '">' +
      '<header><div class="sheet-no"><i></i>' + h(sec.eyebrow) + '</div>' +
      '<h2>' + h(sec.title) + '<a class="anchor" href="#' + sec.id + '" aria-label="Link to this section">#</a></h2>' +
      (sec.note ? '<p class="note">' + sec.note + '</p>' : '') +
      '</header><div class="body">' + sec.render() + '</div></section>';
  });
  doc.innerHTML = html;

  /* nav */
  var toc = document.getElementById('toc'), tocHtml = '', part = '';
  SECTIONS.forEach(function (sec, i) {
    if (sec.part !== part) { part = sec.part; tocHtml += '<div class="toc-part">' + h(part) + '</div>'; }
    tocHtml += '<a href="#' + sec.id + '" data-sec="' + sec.id + '" data-aud="' + h(sec.aud) + '"><span class="n">' + (i + 1) + '</span>' + h(sec.title) + '</a>';
  });
  toc.innerHTML = tocHtml;

  document.getElementById('railFoot').innerHTML =
    'Derived from <b>' + h(P.provenance.commit) + '</b><br>' +
    n(sum([P.layers.sloc.config, P.layers.sloc.core, P.layers.sloc.shared, P.layers.sloc.modules])) + ' front-end lines<br>' +
    'no proxy tier<br>' +
    '<span style="opacity:.75">npm run visual</span>';

  /* ── interactions ───────────────────────────────────────────────────────────────── */

  /* Audience lens. It removes content rather than dimming it: a briefing that still shows
     an executive the file inventory in grey has not simplified anything. */
  function applyLens(l) {
    document.documentElement.setAttribute('data-lens', l);
    var nodes = document.querySelectorAll('[data-aud]');
    for (var i = 0; i < nodes.length; i++) {
      var aud = nodes[i].getAttribute('data-aud').split(/\s+/);
      nodes[i].hidden = (l !== 'all' && aud.indexOf(l) === -1);
    }
    var btns = document.querySelectorAll('#lens button');
    for (var j = 0; j < btns.length; j++) {
      btns[j].setAttribute('aria-pressed', String(btns[j].getAttribute('data-lens') === l));
    }
    try { localStorage.setItem('dgo.visual.lens', l); } catch (e) { }
  }
  document.getElementById('lens').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-lens]');
    if (b) applyLens(b.getAttribute('data-lens'));
  });
  var savedLens = 'all';
  try { savedLens = localStorage.getItem('dgo.visual.lens') || 'all'; } catch (e) { }
  applyLens(savedLens);

  /* theme */
  document.getElementById('themeToggle').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    if (!cur) cur = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('dgo.visual.theme', next); } catch (e) { }
  });

  document.getElementById('printBtn').addEventListener('click', function () {
    var d = document.querySelectorAll('details.acc');
    for (var i = 0; i < d.length; i++) d[i].open = true;
    window.print();
  });

  document.getElementById('expandAll').addEventListener('click', function () {
    var d = document.querySelectorAll('details.acc');
    var anyClosed = false;
    for (var i = 0; i < d.length; i++) if (!d[i].open) anyClosed = true;
    for (var j = 0; j < d.length; j++) d[j].open = anyClosed;
    this.textContent = anyClosed ? 'Collapse all' : 'Expand all';
  });

  /* mobile rail */
  var navToggle = document.getElementById('navToggle');
  navToggle.addEventListener('click', function () {
    var open = document.body.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  toc.addEventListener('click', function () { document.body.classList.remove('nav-open'); });

  /* scroll spy + breadcrumb */
  var crumb = document.getElementById('crumb');
  var links = {};
  SECTIONS.forEach(function (s) { links[s.id] = toc.querySelector('[data-sec="' + s.id + '"]'); });
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var id = en.target.id, sec = SECTIONS.filter(function (s) { return s.id === id; })[0];
      for (var k in links) if (links[k]) links[k].classList.toggle('on', k === id);
      if (sec) crumb.textContent = sec.part + ' — ' + sec.title;
    });
  }, { rootMargin: '-84px 0px -70% 0px' });
  SECTIONS.forEach(function (s) {
    var el = document.getElementById(s.id);
    if (el) spy.observe(el);
  });

  /* module filters */
  (function () {
    var bar = document.querySelector('[data-filter="modules"]');
    if (!bar) return;
    var list = document.querySelector('[data-list="modules"]');
    var cards = list.querySelectorAll('.mcard');
    var input = bar.querySelector('input');
    var counter = bar.querySelector('.count');
    var mode = 'all';
    function run() {
      var q = input.value.trim().toLowerCase(), shown = 0;
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        var okQ = !q || c.getAttribute('data-hay').indexOf(q) > -1;
        var okM = mode === 'all' ||
          (mode === 'visible' && c.getAttribute('data-vis') === 'visible') ||
          (mode === 'technical' && c.getAttribute('data-vis') === 'technical') ||
          (mode.indexOf('g:') === 0 && c.getAttribute('data-group') === mode.slice(2));
        c.hidden = !(okQ && okM);
        if (!c.hidden) shown++;
      }
      counter.textContent = shown + ' of ' + cards.length;
    }
    input.addEventListener('input', run);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      mode = b.getAttribute('data-f');
      var chips = bar.querySelectorAll('.chip');
      for (var i = 0; i < chips.length; i++) chips[i].setAttribute('aria-pressed', String(chips[i] === b));
      run();
    });
    run();
  })();

  /* Diagram focus. Hovering a node isolates its edges — with 26 lifecycle states and
     20 technical routes, a static picture is a hairball and an isolating one is a map. */
  document.addEventListener('mouseover', function (e) {
    var g = e.target.closest('svg .hit');
    if (!g) return;
    var svg = g.closest('svg');
    var id = g.getAttribute('data-node');
    if (!id) return;
    var edges = svg.querySelectorAll('.edge');
    for (var i = 0; i < edges.length; i++) {
      var on = edges[i].getAttribute('data-from') === id || edges[i].getAttribute('data-to') === id;
      edges[i].classList.toggle('dim', !on);
      edges[i].setAttribute('stroke-width', on ? '2.4' : '1.2');
      edges[i].setAttribute('opacity', on ? '1' : '.18');
    }
  });
  document.addEventListener('mouseout', function (e) {
    if (!e.target.closest || !e.target.closest('svg')) return;
    var svg = e.target.closest('svg');
    if (svg.querySelector('.hit:hover')) return;
    var edges = svg.querySelectorAll('.edge');
    for (var i = 0; i < edges.length; i++) {
      edges[i].classList.remove('dim');
      edges[i].setAttribute('stroke-width', '1.2');
      edges[i].removeAttribute('opacity');
    }
  });

  /* ── search ─────────────────────────────────────────────────────────────────────── */
  var INDEX = [];
  function idx(kind, title, sub, target) { INDEX.push({ kind: kind, title: title, sub: sub, target: target }); }
  SECTIONS.forEach(function (s) { idx('Section', s.title, s.part + ' · ' + s.eyebrow, s.id); });
  ROUTES.forEach(function (r) {
    idx(r.visible ? 'Workspace' : 'Route', r.label + '  ·  ' + r.path,
      (r.purpose || r.boundaryRole || '') + (r.reachedThrough ? ' — via ' + r.reachedThrough : ''), 'route-' + r.path);
  });
  P.inventory.core.forEach(function (f) { idx('Service', 'core/' + f.name, f.exports.slice(0, 6).join(' · ') || (f.lines + ' lines'), 'services'); });
  P.inventory.shared.forEach(function (f) { idx('Shell', 'shared/' + f.name, f.exports.slice(0, 6).join(' · ') || '', 'services'); });
  P.inventory.config.forEach(function (f) { idx('Config', 'config/' + f.name, f.exports.slice(0, 6).join(' · ') || '', 'services'); });
  P.endpoints.keys.forEach(function (k) { idx('Endpoint', k, 'contract key — resolved server-side', 'backend'); });
  P.security.roles.forEach(function (r) { idx('Role', r.id, r.label + ' — ' + r.permissions.length + ' permissions', 'security'); });
  P.security.permissions.forEach(function (p) { idx('Permission', p, 'capability', 'security'); });
  P.dataModel.lists.forEach(function (l) {
    idx('List', l.title, l.purpose || l.description, 'data');
    l.fields.forEach(function (f) { idx('Field', f.name, l.title + ' · ' + f.type + (f.required ? ' · required' : ''), 'data'); });
  });
  P.dataModel.stateCollections.forEach(function (c) { idx('Collection', c, 'runtime state', 'data'); });
  P.lifecycle.states.forEach(function (s) {
    idx('State', s, 'transitions to: ' + (P.lifecycle.transitions[s] || []).join(', ') || 'terminal', 'lifecycle');
  });
  P.design.components.forEach(function (c) { idx('Component', c, 'shared/components.js', 'design'); });

  var palette = document.getElementById('palette');
  var pInput = document.getElementById('paletteInput');
  var pResults = document.getElementById('paletteResults');
  var sel = 0, current = [];

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return INDEX.filter(function (r) { return r.kind === 'Section'; });
    var terms = q.split(/\s+/);
    return INDEX.map(function (r) {
      var hay = (r.title + ' ' + r.sub + ' ' + r.kind).toLowerCase();
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        var at = hay.indexOf(terms[i]);
        if (at === -1) return null;
        score += at === 0 ? 3 : (r.title.toLowerCase().indexOf(terms[i]) > -1 ? 2 : 1);
      }
      return { r: r, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 60)
      .map(function (x) { return x.r; });
  }
  function drawResults() {
    if (!current.length) { pResults.innerHTML = '<div class="empty">Nothing matches. Try a route, a role, a field name or a term.</div>'; return; }
    pResults.innerHTML = current.map(function (r, i) {
      return '<div class="r" role="option" data-i="' + i + '" aria-selected="' + (i === sel) + '">' +
        '<span class="k">' + h(r.kind) + '</span>' +
        '<span><span class="t">' + h(r.title) + '</span>' + (r.sub ? '<div class="s">' + h(String(r.sub).slice(0, 96)) + '</div>' : '') + '</span></div>';
    }).join('');
    var on = pResults.querySelector('[aria-selected="true"]');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    palette.hidden = false; pInput.value = ''; sel = 0;
    current = search(''); drawResults(); pInput.focus();
  }
  function closePalette() { palette.hidden = true; }
  function go(r) {
    if (!r) return;
    closePalette();
    /* A hidden target means the current lens removed it. Fall back to Everything rather
       than scrolling to nothing — the search reaches the whole atlas by design. */
    var el = document.getElementById(r.target);
    if (el && el.offsetParent === null) applyLens('all');
    el = document.getElementById(r.target);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    var card = el.closest('.mcard') ? el : el;
    card.classList.add('flash');
    setTimeout(function () { card.classList.remove('flash'); }, 1200);
    if (history.replaceState) history.replaceState(null, '', '#' + r.target);
  }

  document.getElementById('openSearch').addEventListener('click', openPalette);
  pInput.addEventListener('input', function () { sel = 0; current = search(pInput.value); drawResults(); });
  pResults.addEventListener('click', function (e) {
    var row = e.target.closest('.r');
    if (row) go(current[Number(row.getAttribute('data-i'))]);
  });
  palette.addEventListener('mousedown', function (e) { if (e.target === palette) closePalette(); });
  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (!palette.hidden) {
      if (e.key === 'Escape') { closePalette(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, current.length - 1); drawResults(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); drawResults(); return; }
      if (e.key === 'Enter') { e.preventDefault(); go(current[sel]); return; }
      return;
    }
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openPalette(); return; }
    if (e.key === '/' && !typing) { e.preventDefault(); openPalette(); }
  });

  /* deep link on load */
  if (location.hash) {
    var t = document.getElementById(location.hash.slice(1));
    if (t) setTimeout(function () { t.scrollIntoView({ block: 'start' }); }, 60);
  }
})();
