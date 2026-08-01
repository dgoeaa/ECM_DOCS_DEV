/* @ds-bundle: {"format":3,"namespace":"NITDADesignSystem_019ddc","components":[],"sourceHashes":{"dgo_digital_ops/ui_kits/dashboard/design-canvas.jsx":"fb642362a04d","ui_kits/dgo/App.jsx":"ddd71a37d28d","ui_kits/dgo/Dashboard.jsx":"009135ef56c2","ui_kits/dgo/Icons.jsx":"23e6e83f4c32","ui_kits/dgo/Mark.jsx":"f3ddfa2855d7","ui_kits/dgo/Screens.jsx":"0d2f2657ea0d","ui_kits/dgo/SignIn.jsx":"1dac60899ef2","ui_kits/dgo/design-canvas.jsx":"1ac1992714b2","ui_kits/dgo/tweaks-panel.jsx":"3de8e8c1af99","ui_kits/web/Components.jsx":"db2368ae8ae6","ui_kits/web/Sections.jsx":"7525212ccb3e","ui_kits/web/WebApp.jsx":"1bfac4de978a"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.NITDADesignSystem_019ddc = window.NITDADesignSystem_019ddc || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// dgo_digital_ops/ui_kits/dashboard/design-canvas.jsx
try { (() => {
// DesignCanvas.jsx — Figma-ish design canvas wrapper
// Warm gray grid bg + Sections + Artboards + PostIt notes.
// Artboards are reorderable (grip-drag), deletable, labels/titles are
// inline-editable, and any artboard can be opened in a fullscreen focus
// overlay (←/→/Esc). State persists to a .design-canvas.state.json sidecar
// via the host bridge. No assets, no deps.
//
// Usage:
//   <DesignCanvas>
//     <DCSection id="onboarding" title="Onboarding" subtitle="First-run variants">
//       <DCArtboard id="a" label="A · Dusk" width={260} height={480}>…</DCArtboard>
//       <DCArtboard id="b" label="B · Minimal" width={260} height={480}>…</DCArtboard>
//     </DCSection>
//   </DesignCanvas>

const DC = {
  bg: '#f0eee9',
  grid: 'rgba(0,0,0,0.06)',
  label: 'rgba(60,50,40,0.7)',
  title: 'rgba(40,30,20,0.85)',
  subtitle: 'rgba(60,50,40,0.6)',
  postitBg: '#fef4a8',
  postitText: '#5a4a2a',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
};

// One-time CSS injection (classes are dc-prefixed so they don't collide with
// the hosted design's own styles).
if (typeof document !== 'undefined' && !document.getElementById('dc-styles')) {
  const s = document.createElement('style');
  s.id = 'dc-styles';
  s.textContent = ['.dc-editable{cursor:text;outline:none;white-space:nowrap;border-radius:3px;padding:0 2px;margin:0 -2px}', '.dc-editable:focus{background:#fff;box-shadow:0 0 0 1.5px #c96442}', '[data-dc-slot]{transition:transform .18s cubic-bezier(.2,.7,.3,1)}', '[data-dc-slot].dc-dragging{transition:none;z-index:10;pointer-events:none}', '[data-dc-slot].dc-dragging .dc-card{box-shadow:0 12px 40px rgba(0,0,0,.25),0 0 0 2px #c96442;transform:scale(1.02)}',
  // isolation:isolate contains artboard content's z-indexes so a
  // z-indexed child (sticky navbar etc.) can't paint over .dc-header or
  // the .dc-menu popover that drops into the top of the card.
  '.dc-card{isolation:isolate;transition:box-shadow .15s,transform .15s}', '.dc-card *{scrollbar-width:none}', '.dc-card *::-webkit-scrollbar{display:none}',
  // Per-artboard header: grip + label on the left, delete/expand on the
  // right. Single flex row; when the artboard's on-screen width is too
  // narrow for both the label yields (ellipsis, then hidden entirely below
  // ~4ch via the container query) and the buttons stay on the row.
  '.dc-header{position:absolute;bottom:100%;left:-4px;margin-bottom:calc(4px * var(--dc-inv-zoom,1));z-index:2;', '  display:flex;align-items:center;container-type:inline-size}', '.dc-labelrow{display:flex;align-items:center;gap:4px;height:24px;flex:1 1 auto;min-width:0}', '.dc-grip{flex:0 0 auto;cursor:grab;display:flex;align-items:center;padding:5px 4px;border-radius:4px;transition:background .12s,opacity .12s}', '.dc-grip:hover{background:rgba(0,0,0,.08)}', '.dc-grip:active{cursor:grabbing}', '.dc-labeltext{flex:1 1 auto;min-width:0;cursor:pointer;border-radius:4px;padding:3px 6px;', '  display:flex;align-items:center;transition:background .12s;overflow:hidden}',
  // Below ~4ch of label room: hide the label entirely, and drop the grip to
  // hover-only (same reveal rule as .dc-btns) so a narrow header is clean
  // until the card is moused.
  '@container (max-width: 110px){', '  .dc-labeltext{display:none}', '  .dc-grip{opacity:0}', '  [data-dc-slot]:hover .dc-grip{opacity:1}', '}', '.dc-labeltext:hover{background:rgba(0,0,0,.05)}', '.dc-labeltext .dc-editable{overflow:hidden;text-overflow:ellipsis;max-width:100%}', '.dc-labeltext .dc-editable:focus{overflow:visible;text-overflow:clip}', '.dc-btns{flex:0 0 auto;margin-left:auto;display:flex;gap:2px;opacity:0;transition:opacity .12s}', '[data-dc-slot]:hover .dc-btns,.dc-btns:has(.dc-menu){opacity:1}', '.dc-expand,.dc-kebab{width:22px;height:22px;border-radius:5px;border:none;cursor:pointer;padding:0;', '  background:transparent;color:rgba(60,50,40,.7);display:flex;align-items:center;justify-content:center;', '  font:inherit;transition:background .12s,color .12s}', '.dc-expand:hover,.dc-kebab:hover{background:rgba(0,0,0,.06);color:#2a251f}',
  // Slot hosting an open menu floats above later siblings (which otherwise
  // paint on top — same z-index:auto, later DOM order) so the popup isn't
  // clipped by the next card.
  '[data-dc-slot]:has(.dc-menu){z-index:10}', '.dc-menu{position:absolute;top:100%;right:0;margin-top:4px;background:#fff;border-radius:8px;', '  box-shadow:0 8px 28px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.05);padding:4px;min-width:160px;z-index:10}', '.dc-menu button{display:block;width:100%;padding:7px 10px;border:0;background:transparent;', '  border-radius:5px;font-family:inherit;font-size:13px;font-weight:500;line-height:1.2;', '  color:#29261b;cursor:pointer;text-align:left;transition:background .12s;white-space:nowrap}', '.dc-menu button:hover{background:rgba(0,0,0,.05)}', '.dc-menu hr{border:0;border-top:1px solid rgba(0,0,0,.08);margin:4px 2px}', '.dc-menu .dc-danger{color:#c96442}', '.dc-menu .dc-danger:hover{background:rgba(201,100,66,.1)}',
  // Chrome (titles / labels / buttons) counter-scales against the viewport
  // zoom so it stays a constant on-screen size. --dc-inv-zoom is set by
  // DCViewport on every transform update and inherits to all descendants —
  // any overlay inside the world (e.g. a TweaksPanel on an artboard) can use
  // it the same way.
  //
  // The header uses transform:scale (out-of-flow, so layout impact doesn't
  // matter) with its world-space width set to card-width / inv-zoom so that
  // after counter-scaling its on-screen width exactly matches the card's —
  // that's what lets the container query + text-overflow behave against the
  // card's visible edge at every zoom level.
  //
  // The section head uses CSS zoom instead of transform so its layout box
  // grows with the counter-scale, pushing the card row down — otherwise the
  // constant-screen-size title would overflow into the (shrinking) world-
  // space gap and overlap the artboard headers at low zoom.
  '.dc-header{width:calc((100% + 4px) / var(--dc-inv-zoom,1));', '  transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom left}', '.dc-sectionhead{zoom:var(--dc-inv-zoom,1)}'].join('\n');
  document.head.appendChild(s);
}
const DCCtx = React.createContext(null);

// Recursively unwrap React.Fragment so <>…</> grouping doesn't hide
// DCSection/DCArtboard children from the type-based walks below.
function dcFlatten(children) {
  const out = [];
  React.Children.forEach(children, c => {
    if (c && c.type === React.Fragment) out.push(...dcFlatten(c.props.children));else out.push(c);
  });
  return out;
}

// ─────────────────────────────────────────────────────────────
// DesignCanvas — stateful wrapper around the pan/zoom viewport.
// Owns runtime state (per-section order, renamed titles/labels, hidden
// artboards, focused artboard). Order/titles/labels/hidden persist to a
// .design-canvas.state.json
// sidecar next to the HTML. Reads go via plain fetch() so the saved
// arrangement is visible anywhere the HTML + sidecar are served together
// (omelette preview, direct link, downloaded zip). Writes go through the
// host's window.omelette bridge — editing requires the omelette runtime.
// Focus is ephemeral.
// ─────────────────────────────────────────────────────────────
const DC_STATE_FILE = '.design-canvas.state.json';
function DesignCanvas({
  children,
  minScale,
  maxScale,
  style
}) {
  const [state, setState] = React.useState({
    sections: {},
    focus: null
  });
  // Hold rendering until the sidecar read settles so the saved order/titles
  // appear on first paint (no source-order flash). didRead gates writes until
  // the read settles so the empty initial state can't clobber a slow read;
  // skipNextWrite suppresses the one echo-write that would otherwise follow
  // hydration.
  const [ready, setReady] = React.useState(false);
  const didRead = React.useRef(false);
  const skipNextWrite = React.useRef(false);
  React.useEffect(() => {
    let off = false;
    fetch('./' + DC_STATE_FILE).then(r => r.ok ? r.json() : null).then(saved => {
      if (off || !saved || !saved.sections) return;
      skipNextWrite.current = true;
      setState(s => ({
        ...s,
        sections: saved.sections
      }));
    }).catch(() => {}).finally(() => {
      didRead.current = true;
      if (!off) setReady(true);
    });
    const t = setTimeout(() => {
      if (!off) setReady(true);
    }, 150);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, []);
  React.useEffect(() => {
    if (!didRead.current) return;
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    const t = setTimeout(() => {
      window.omelette?.writeFile(DC_STATE_FILE, JSON.stringify({
        sections: state.sections
      })).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [state.sections]);

  // Build registries synchronously from children so FocusOverlay can read
  // them in the same render. Fragments are flattened; wrapping in other
  // elements still opts out of focus/reorder.
  const registry = {}; // slotId -> { sectionId, artboard }
  const sectionMeta = {}; // sectionId -> { title, subtitle, slotIds[] }
  const sectionOrder = [];
  dcFlatten(children).forEach(sec => {
    if (!sec || sec.type !== DCSection) return;
    const sid = sec.props.id ?? sec.props.title;
    if (!sid) return;
    sectionOrder.push(sid);
    const persisted = state.sections[sid] || {};
    const abs = [];
    dcFlatten(sec.props.children).forEach(ab => {
      if (!ab || ab.type !== DCArtboard) return;
      const aid = ab.props.id ?? ab.props.label;
      if (aid) abs.push([aid, ab]);
    });
    // hidden is scoped to one source revision — when the agent regenerates
    // (artboard-ID set changes), prior deletes don't apply to new content.
    const srcKey = abs.map(([k]) => k).join('\x1f');
    const hidden = persisted.srcKey === srcKey ? persisted.hidden || [] : [];
    const srcIds = [];
    abs.forEach(([aid, ab]) => {
      if (hidden.includes(aid)) return;
      registry[`${sid}/${aid}`] = {
        sectionId: sid,
        artboard: ab
      };
      srcIds.push(aid);
    });
    const kept = (persisted.order || []).filter(k => srcIds.includes(k));
    sectionMeta[sid] = {
      title: persisted.title ?? sec.props.title,
      subtitle: sec.props.subtitle,
      slotIds: [...kept, ...srcIds.filter(k => !kept.includes(k))]
    };
  });
  const api = React.useMemo(() => ({
    state,
    section: id => state.sections[id] || {},
    patchSection: (id, p) => setState(s => ({
      ...s,
      sections: {
        ...s.sections,
        [id]: {
          ...s.sections[id],
          ...(typeof p === 'function' ? p(s.sections[id] || {}) : p)
        }
      }
    })),
    setFocus: slotId => setState(s => ({
      ...s,
      focus: slotId
    }))
  }), [state]);

  // Esc exits focus; any outside pointerdown commits an in-progress rename.
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') api.setFocus(null);
    };
    const onPd = e => {
      const ae = document.activeElement;
      if (ae && ae.isContentEditable && !ae.contains(e.target)) ae.blur();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPd, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPd, true);
    };
  }, [api]);
  return /*#__PURE__*/React.createElement(DCCtx.Provider, {
    value: api
  }, /*#__PURE__*/React.createElement(DCViewport, {
    minScale: minScale,
    maxScale: maxScale,
    style: style
  }, ready && children), state.focus && registry[state.focus] && /*#__PURE__*/React.createElement(DCFocusOverlay, {
    entry: registry[state.focus],
    sectionMeta: sectionMeta,
    sectionOrder: sectionOrder
  }));
}

// ─────────────────────────────────────────────────────────────
// DCViewport — transform-based pan/zoom (internal)
//
// Input mapping (Figma-style):
//   • trackpad pinch  → zoom   (ctrlKey wheel; Safari gesture* events)
//   • trackpad scroll → pan    (two-finger)
//   • mouse wheel     → zoom   (notched; distinguished from trackpad scroll)
//   • middle-drag / primary-drag-on-bg → pan
//
// Transform state lives in a ref and is written straight to the DOM
// (translate3d + will-change) so wheel ticks don't go through React —
// keeps pans at 60fps on dense canvases.
// ─────────────────────────────────────────────────────────────
function DCViewport({
  children,
  minScale = 0.1,
  maxScale = 8,
  style = {}
}) {
  const vpRef = React.useRef(null);
  const worldRef = React.useRef(null);
  const tf = React.useRef({
    x: 0,
    y: 0,
    scale: 1
  });
  // Persist viewport across reloads so the user lands back where they were
  // after an agent edit or browser refresh. The sandbox origin is already
  // per-project; pathname keeps multiple canvas files in one project apart.
  const tfKey = 'dc-viewport:' + location.pathname;
  const saveT = React.useRef(0);
  const lastPostedScale = React.useRef();
  const apply = React.useCallback(() => {
    const {
      x,
      y,
      scale
    } = tf.current;
    const el = worldRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    // Exposed for zoom-invariant chrome (labels, buttons, TweaksPanel).
    el.style.setProperty('--dc-inv-zoom', String(1 / scale));
    // Keep the host toolbar's % readout in sync with the canvas scale. Pan
    // ticks leave scale unchanged — skip the cross-frame post for those.
    if (lastPostedScale.current !== scale) {
      lastPostedScale.current = scale;
      window.parent.postMessage({
        type: '__dc_zoom',
        scale
      }, '*');
    }
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => {
      try {
        localStorage.setItem(tfKey, JSON.stringify(tf.current));
      } catch {}
    }, 200);
  }, [tfKey]);
  React.useLayoutEffect(() => {
    const flush = () => {
      clearTimeout(saveT.current);
      try {
        localStorage.setItem(tfKey, JSON.stringify(tf.current));
      } catch {}
    };
    try {
      const s = JSON.parse(localStorage.getItem(tfKey) || 'null');
      if (s && Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.scale)) {
        tf.current = {
          x: s.x,
          y: s.y,
          scale: Math.min(maxScale, Math.max(minScale, s.scale))
        };
        apply();
      }
    } catch {}
    // Flush on pagehide and unmount so a reload within the 200ms debounce
    // window doesn't drop the last pan/zoom.
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
  React.useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const zoomAt = (cx, cy, factor) => {
      const r = vp.getBoundingClientRect();
      const px = cx - r.left,
        py = cy - r.top;
      const t = tf.current;
      const next = Math.min(maxScale, Math.max(minScale, t.scale * factor));
      const k = next / t.scale;
      // --dc-inv-zoom consumers (.dc-sectionhead's CSS zoom, each section's
      // marginBottom) reflow on every scale change, vertically shifting the
      // world layout — so a world point mathematically pinned under the cursor
      // drifts as you zoom (content creeps up on zoom-in, down on zoom-out).
      // Anchor the DOM element under the cursor instead: record its screen Y,
      // apply the transform + --dc-inv-zoom, then cancel whatever vertical
      // drift the reflow introduced so it stays put on screen.
      let marker = null,
        markerY0 = 0;
      if (k !== 1) {
        const hit = document.elementFromPoint(cx, cy);
        marker = hit && hit.closest ? hit.closest('[data-dc-slot],[data-dc-section]') : null;
        if (marker) markerY0 = marker.getBoundingClientRect().top;
      }
      // keep the world point under the cursor fixed
      t.x = px - (px - t.x) * k;
      t.y = py - (py - t.y) * k;
      t.scale = next;
      apply();
      if (marker) {
        // A pure zoom around (cx, cy) maps screen Y → cy + (Y - cy) * k. Any
        // departure after the --dc-inv-zoom reflow is the layout drift.
        const drift = marker.getBoundingClientRect().top - (cy + (markerY0 - cy) * k);
        if (Math.abs(drift) > 0.1) {
          t.y -= drift;
          apply();
        }
      }
    };

    // Mouse-wheel vs trackpad-scroll heuristic. A physical wheel sends
    // line-mode deltas (Firefox) or large integer pixel deltas with no X
    // component (Chrome/Safari, typically multiples of 100/120). Trackpad
    // two-finger scroll sends small/fractional pixel deltas, often with
    // non-zero deltaX. ctrlKey is set by the browser for trackpad pinch.
    const isMouseWheel = e => e.deltaMode !== 0 || e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40;
    const onWheel = e => {
      e.preventDefault();
      if (isGesturing) return; // Safari: gesture* owns the pinch — discard concurrent wheels
      if ((e.ctrlKey || e.metaKey) && !isMouseWheel(e)) {
        // trackpad pinch, or ctrl/cmd + smooth-scroll mouse. Notched
        // wheels fall through to the fixed-step branch below.
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      } else if (isMouseWheel(e)) {
        // notched mouse wheel — fixed-ratio step per click
        zoomAt(e.clientX, e.clientY, Math.exp(-Math.sign(e.deltaY) * 0.18));
      } else {
        // trackpad two-finger scroll — pan
        tf.current.x -= e.deltaX;
        tf.current.y -= e.deltaY;
        apply();
      }
    };

    // Safari sends native gesture* events for trackpad pinch with a smooth
    // e.scale; preferring these over the ctrl+wheel fallback gives a much
    // better feel there. No-ops on other browsers. Safari also fires
    // ctrlKey wheel events during the same pinch — isGesturing makes
    // onWheel drop those entirely so they neither zoom nor pan.
    let gsBase = 1;
    let isGesturing = false;
    const onGestureStart = e => {
      e.preventDefault();
      isGesturing = true;
      gsBase = tf.current.scale;
    };
    const onGestureChange = e => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, gsBase * e.scale / tf.current.scale);
    };
    const onGestureEnd = e => {
      e.preventDefault();
      isGesturing = false;
    };

    // Drag-pan: middle button anywhere, or primary button on canvas
    // background (anything that isn't an artboard or an inline editor).
    let drag = null;
    const onPointerDown = e => {
      const onBg = !e.target.closest('[data-dc-slot], .dc-editable');
      if (!(e.button === 1 || e.button === 0 && onBg)) return;
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      drag = {
        id: e.pointerId,
        lx: e.clientX,
        ly: e.clientY
      };
      vp.style.cursor = 'grabbing';
    };
    const onPointerMove = e => {
      if (!drag || e.pointerId !== drag.id) return;
      tf.current.x += e.clientX - drag.lx;
      tf.current.y += e.clientY - drag.ly;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      apply();
    };
    const onPointerUp = e => {
      if (!drag || e.pointerId !== drag.id) return;
      vp.releasePointerCapture(e.pointerId);
      drag = null;
      vp.style.cursor = '';
    };

    // Host-driven zoom (toolbar % menu). Zooms around viewport centre so the
    // visible midpoint stays fixed — matching the host's iframe-zoom feel.
    const onHostMsg = e => {
      const d = e.data;
      if (d && d.type === '__dc_set_zoom' && typeof d.scale === 'number') {
        const r = vp.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, d.scale / tf.current.scale);
      } else if (d && d.type === '__dc_probe') {
        // Host's [readyGen] reset asks whether a canvas is present; it
        // fires on the iframe's native 'load', which for canvases with
        // images/fonts is after our mount-time announce, so re-announce.
        // Clear the pan-tick guard so apply() re-posts the current scale
        // even if it's unchanged — the host just reset dcScale to 1.
        window.parent.postMessage({
          type: '__dc_present'
        }, '*');
        lastPostedScale.current = undefined;
        apply();
      }
    };
    window.addEventListener('message', onHostMsg);
    // Announce canvas mode so the host toolbar proxies its % control here
    // instead of scaling the iframe element (which would just shrink the
    // viewport window of an infinite canvas). The apply() that follows emits
    // the initial __dc_zoom so the toolbar % is correct before first pinch.
    // lastPostedScale reset mirrors the __dc_probe handler: the layout
    // effect's restore-path apply() may already have posted the restored
    // scale (before __dc_present), so clear the guard to re-post it in order.
    window.parent.postMessage({
      type: '__dc_present'
    }, '*');
    lastPostedScale.current = undefined;
    apply();
    vp.addEventListener('wheel', onWheel, {
      passive: false
    });
    vp.addEventListener('gesturestart', onGestureStart, {
      passive: false
    });
    vp.addEventListener('gesturechange', onGestureChange, {
      passive: false
    });
    vp.addEventListener('gestureend', onGestureEnd, {
      passive: false
    });
    vp.addEventListener('pointerdown', onPointerDown);
    vp.addEventListener('pointermove', onPointerMove);
    vp.addEventListener('pointerup', onPointerUp);
    vp.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('message', onHostMsg);
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('gesturestart', onGestureStart);
      vp.removeEventListener('gesturechange', onGestureChange);
      vp.removeEventListener('gestureend', onGestureEnd);
      vp.removeEventListener('pointerdown', onPointerDown);
      vp.removeEventListener('pointermove', onPointerMove);
      vp.removeEventListener('pointerup', onPointerUp);
      vp.removeEventListener('pointercancel', onPointerUp);
    };
  }, [apply, minScale, maxScale]);
  const gridSvg = `url("data:image/svg+xml,%3Csvg width='120' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M120 0H0v120' fill='none' stroke='${encodeURIComponent(DC.grid)}' stroke-width='1'/%3E%3C/svg%3E")`;
  return /*#__PURE__*/React.createElement("div", {
    ref: vpRef,
    className: "design-canvas",
    style: {
      height: '100vh',
      width: '100vw',
      background: DC.bg,
      overflow: 'hidden',
      overscrollBehavior: 'none',
      touchAction: 'none',
      position: 'relative',
      fontFamily: DC.font,
      boxSizing: 'border-box',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: worldRef,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      transformOrigin: '0 0',
      willChange: 'transform',
      width: 'max-content',
      minWidth: '100%',
      minHeight: '100%',
      padding: '60px 0 80px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: -6000,
      backgroundImage: gridSvg,
      backgroundSize: '120px 120px',
      pointerEvents: 'none',
      zIndex: -1
    }
  }), children));
}

// ─────────────────────────────────────────────────────────────
// DCSection — editable title + h-row of artboards in persisted order
// ─────────────────────────────────────────────────────────────
function DCSection({
  id,
  title,
  subtitle,
  children,
  gap = 48
}) {
  const ctx = React.useContext(DCCtx);
  const sid = id ?? title;
  const all = React.Children.toArray(dcFlatten(children));
  const artboards = all.filter(c => c && c.type === DCArtboard);
  const rest = all.filter(c => !(c && c.type === DCArtboard));
  const sec = ctx && sid && ctx.section(sid) || {};
  // Must match DesignCanvas's srcKey computation exactly (it filters falsy
  // IDs), or onDelete persists a srcKey that DesignCanvas never recognizes.
  const allIds = artboards.map(a => a.props.id ?? a.props.label).filter(Boolean);
  const srcKey = allIds.join('\x1f');
  const hidden = sec.srcKey === srcKey ? sec.hidden || [] : [];
  const srcOrder = allIds.filter(k => !hidden.includes(k));
  const order = React.useMemo(() => {
    const kept = (sec.order || []).filter(k => srcOrder.includes(k));
    return [...kept, ...srcOrder.filter(k => !kept.includes(k))];
  }, [sec.order, srcOrder.join('|')]);
  const byId = Object.fromEntries(artboards.map(a => [a.props.id ?? a.props.label, a]));

  // marginBottom counter-scales so the on-screen gap between sections stays
  // constant — otherwise at low zoom the (world-space) gap collapses while
  // the screen-constant sectionhead below it doesn't, and the title reads as
  // belonging to the section above. paddingBottom below is just enough for
  // the 24px artboard-header (abs-positioned above each card) plus ~8px, so
  // the title sits tight against its own row at every zoom.
  return /*#__PURE__*/React.createElement("div", {
    "data-dc-section": sid,
    style: {
      marginBottom: 'calc(80px * var(--dc-inv-zoom, 1))',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 60px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-sectionhead",
    style: {
      paddingBottom: 36
    }
  }, /*#__PURE__*/React.createElement(DCEditable, {
    tag: "div",
    value: sec.title ?? title,
    onChange: v => ctx && sid && ctx.patchSection(sid, {
      title: v
    }),
    style: {
      fontSize: 28,
      fontWeight: 600,
      color: DC.title,
      letterSpacing: -0.4,
      marginBottom: 6,
      display: 'inline-block'
    }
  }), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: DC.subtitle
    }
  }, subtitle))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap,
      padding: '0 60px',
      alignItems: 'flex-start',
      width: 'max-content'
    }
  }, order.map(k => /*#__PURE__*/React.createElement(DCArtboardFrame, {
    key: k,
    sectionId: sid,
    artboard: byId[k],
    order: order,
    label: (sec.labels || {})[k] ?? byId[k].props.label,
    onRename: v => ctx && ctx.patchSection(sid, x => ({
      labels: {
        ...x.labels,
        [k]: v
      }
    })),
    onReorder: next => ctx && ctx.patchSection(sid, {
      order: next
    }),
    onDelete: () => ctx && ctx.patchSection(sid, x => ({
      hidden: [...(x.srcKey === srcKey ? x.hidden || [] : []), k],
      srcKey
    })),
    onFocus: () => ctx && ctx.setFocus(`${sid}/${k}`)
  }))), rest);
}

// DCArtboard — marker; rendered by DCArtboardFrame via DCSection.
function DCArtboard() {
  return null;
}

// Per-artboard export (kind: 'png' | 'html'). Both paths share the same
// self-contained clone: computed styles baked in, @font-face / <img> /
// inline-style background-image urls inlined as data URIs. PNG wraps the
// clone in foreignObject→canvas at 3× the artboard's natural width×height
// (same pipeline the host uses for page captures); HTML wraps it in a
// minimal standalone document. Both are independent of viewport zoom.
async function dcExport(node, w, h, name, kind) {
  try {
    await document.fonts.ready;
  } catch {}
  const toDataURL = url => fetch(url).then(r => r.blob()).then(b => new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => res(url);
    fr.readAsDataURL(b);
  })).catch(() => url);

  // Collect @font-face rules. ss.cssRules throws SecurityError on
  // cross-origin sheets (e.g. fonts.googleapis.com) — in that case fetch
  // the CSS text directly (those endpoints send ACAO:*) and regex-extract
  // the blocks. @import and @media/@supports are walked so nested
  // @font-face rules aren't missed.
  const fontRules = [],
    pending = [],
    seen = new Set();
  const scrapeCss = href => {
    if (seen.has(href)) return;
    seen.add(href);
    pending.push(fetch(href).then(r => r.text()).then(css => {
      for (const m of css.match(/@font-face\s*{[^}]*}/g) || []) fontRules.push({
        css: m,
        base: href
      });
      for (const m of css.matchAll(/@import\s+(?:url\()?['"]?([^'")\s;]+)/g)) scrapeCss(new URL(m[1], href).href);
    }).catch(() => {}));
  };
  const walk = (rules, base) => {
    for (const r of rules) {
      if (r.type === CSSRule.FONT_FACE_RULE) fontRules.push({
        css: r.cssText,
        base
      });else if (r.type === CSSRule.IMPORT_RULE && r.styleSheet) {
        const ibase = r.styleSheet.href || base;
        try {
          walk(r.styleSheet.cssRules, ibase);
        } catch {
          scrapeCss(ibase);
        }
      } else if (r.cssRules) walk(r.cssRules, base);
    }
  };
  for (const ss of document.styleSheets) {
    const base = ss.href || location.href;
    try {
      walk(ss.cssRules, base);
    } catch {
      if (ss.href) scrapeCss(ss.href);
    }
  }
  while (pending.length) await pending.shift();
  const fontCss = (await Promise.all(fontRules.map(async rule => {
    let out = rule.css,
      m;
    const re = /url\((['"]?)([^'")]+)\1\)/g;
    while (m = re.exec(rule.css)) {
      if (m[2].indexOf('data:') === 0) continue;
      let abs;
      try {
        abs = new URL(m[2], rule.base).href;
      } catch {
        continue;
      }
      out = out.split(m[0]).join('url("' + (await toDataURL(abs)) + '")');
    }
    return out;
  }))).join('\n');
  const cloneStyled = src => {
    if (src.nodeType === 8 || src.nodeType === 1 && src.tagName === 'SCRIPT') return document.createTextNode('');
    const dst = src.cloneNode(false);
    if (src.nodeType === 1) {
      const cs = getComputedStyle(src);
      let txt = '';
      for (let i = 0; i < cs.length; i++) txt += cs[i] + ':' + cs.getPropertyValue(cs[i]) + ';';
      dst.setAttribute('style', txt + 'animation:none;transition:none;');
      if (src.tagName === 'CANVAS') try {
        const im = document.createElement('img');
        im.src = src.toDataURL();
        im.setAttribute('style', txt);
        return im;
      } catch {}
    }
    for (let c = src.firstChild; c; c = c.nextSibling) dst.appendChild(cloneStyled(c));
    return dst;
  };
  const clone = cloneStyled(node);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  // Drop the card's own shadow/radius so the export is a flush w×h rect;
  // the artboard's own background (if any) is already in the computed style.
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  const jobs = [];
  clone.querySelectorAll('img').forEach(el => {
    const s = el.getAttribute('src');
    if (s && s.indexOf('data:') !== 0) jobs.push(toDataURL(el.src).then(d => el.setAttribute('src', d)));
  });
  [clone, ...clone.querySelectorAll('*')].forEach(el => {
    const bg = el.style.backgroundImage;
    if (!bg) return;
    let m;
    const re = /url\(["']?([^"')]+)["']?\)/g;
    while (m = re.exec(bg)) {
      const tok = m[0],
        url = m[1];
      if (url.indexOf('data:') === 0) continue;
      jobs.push(toDataURL(url).then(d => {
        el.style.backgroundImage = el.style.backgroundImage.split(tok).join('url("' + d + '")');
      }));
    }
  });
  await Promise.all(jobs);
  const xml = new XMLSerializer().serializeToString(clone);
  const save = (blob, ext) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.' + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  if (kind === 'html') {
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + name + '</title>' + (fontCss ? '<style>' + fontCss + '</style>' : '') + '</head><body style="margin:0">' + xml + '</body></html>';
    return save(new Blob([html], {
      type: 'text/html'
    }), 'html');
  }

  // PNG: the SVG's own width/height must be the output resolution — an
  // <img>-loaded SVG rasterizes at its intrinsic size, so sizing it at 1×
  // and ctx.scale()-ing up would just upscale a 1× bitmap. viewBox maps the
  // w×h foreignObject onto the px·w × px·h SVG canvas so the browser renders
  // the HTML at full resolution.
  const px = 3;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w * px + '" height="' + h * px + '" viewBox="0 0 ' + w + ' ' + h + '"><foreignObject width="' + w + '" height="' + h + '">' + (fontCss ? '<style><![CDATA[' + fontCss + ']]></style>' : '') + xml + '</foreignObject></svg>';
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error('svg load failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const cv = document.createElement('canvas');
  cv.width = w * px;
  cv.height = h * px;
  cv.getContext('2d').drawImage(img, 0, 0);
  cv.toBlob(blob => save(blob, 'png'), 'image/png');
}
function DCArtboardFrame({
  sectionId,
  artboard,
  label,
  order,
  onRename,
  onReorder,
  onFocus,
  onDelete
}) {
  const {
    id: rawId,
    label: rawLabel,
    width = 260,
    height = 480,
    children,
    style = {}
  } = artboard.props;
  const id = rawId ?? rawLabel;
  const ref = React.useRef(null);
  const cardRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  // ⋯ menu: close on any outside pointerdown. Two-click delete lives inside
  // the menu — first click arms the row, second commits; closing disarms.
  React.useEffect(() => {
    if (!menuOpen) {
      setConfirming(false);
      return;
    }
    const off = e => {
      if (!menuRef.current || !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', off, true);
    return () => document.removeEventListener('pointerdown', off, true);
  }, [menuOpen]);
  const doExport = kind => {
    setMenuOpen(false);
    if (!cardRef.current) return;
    const name = String(label || id || 'artboard').replace(/[^\w\s.-]+/g, '_');
    dcExport(cardRef.current, width, height, name, kind).catch(e => console.error('[design-canvas] export failed:', e));
  };

  // Live drag-reorder: dragged card sticks to cursor; siblings slide into
  // their would-be slots in real time via transforms. DOM order only
  // changes on drop.
  const onGripDown = e => {
    e.preventDefault();
    e.stopPropagation();
    const me = ref.current;
    // translateX is applied in local (pre-scale) space but pointer deltas and
    // getBoundingClientRect().left are screen-space — divide by the viewport's
    // current scale so the dragged card tracks the cursor at any zoom level.
    const scale = me.getBoundingClientRect().width / me.offsetWidth || 1;
    const peers = Array.from(document.querySelectorAll(`[data-dc-section="${sectionId}"] [data-dc-slot]`));
    const homes = peers.map(el => ({
      el,
      id: el.dataset.dcSlot,
      x: el.getBoundingClientRect().left
    }));
    const slotXs = homes.map(h => h.x);
    const startIdx = order.indexOf(id);
    const startX = e.clientX;
    let liveOrder = order.slice();
    me.classList.add('dc-dragging');
    const layout = () => {
      for (const h of homes) {
        if (h.id === id) continue;
        const slot = liveOrder.indexOf(h.id);
        h.el.style.transform = `translateX(${(slotXs[slot] - h.x) / scale}px)`;
      }
    };
    const move = ev => {
      const dx = ev.clientX - startX;
      me.style.transform = `translateX(${dx / scale}px)`;
      const cur = homes[startIdx].x + dx;
      let nearest = 0,
        best = Infinity;
      for (let i = 0; i < slotXs.length; i++) {
        const d = Math.abs(slotXs[i] - cur);
        if (d < best) {
          best = d;
          nearest = i;
        }
      }
      if (liveOrder.indexOf(id) !== nearest) {
        liveOrder = order.filter(k => k !== id);
        liveOrder.splice(nearest, 0, id);
        layout();
      }
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      const finalSlot = liveOrder.indexOf(id);
      me.classList.remove('dc-dragging');
      me.style.transform = `translateX(${(slotXs[finalSlot] - homes[startIdx].x) / scale}px)`;
      // After the settle transition, kill transitions + clear transforms +
      // commit the reorder in the same frame so there's no visual snap-back.
      setTimeout(() => {
        for (const h of homes) {
          h.el.style.transition = 'none';
          h.el.style.transform = '';
        }
        if (liveOrder.join('|') !== order.join('|')) onReorder(liveOrder);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          for (const h of homes) h.el.style.transition = '';
        }));
      }, 180);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    "data-dc-slot": id,
    style: {
      position: 'relative',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-header",
    style: {
      color: DC.label
    },
    onPointerDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-labelrow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-grip",
    onPointerDown: onGripDown,
    title: "Drag to reorder"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "13",
    viewBox: "0 0 9 13",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "2",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "2",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "6.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "6.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "11",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "11",
    r: "1.1"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dc-labeltext",
    onClick: onFocus,
    title: "Click to focus"
  }, /*#__PURE__*/React.createElement(DCEditable, {
    value: label,
    onChange: onRename,
    onClick: e => e.stopPropagation(),
    style: {
      fontSize: 15,
      fontWeight: 500,
      color: DC.label,
      lineHeight: 1
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dc-btns"
  }, /*#__PURE__*/React.createElement("div", {
    ref: menuRef,
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "dc-kebab",
    title: "More",
    onClick: () => setMenuOpen(o => !o)
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "2.5",
    cy: "6",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "6",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9.5",
    cy: "6",
    r: "1.1"
  }))), menuOpen && /*#__PURE__*/React.createElement("div", {
    className: "dc-menu",
    onPointerDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => doExport('png')
  }, "Download PNG"), /*#__PURE__*/React.createElement("button", {
    onClick: () => doExport('html')
  }, "Download HTML"), /*#__PURE__*/React.createElement("hr", null), /*#__PURE__*/React.createElement("button", {
    className: "dc-danger",
    onClick: () => {
      if (confirming) {
        setMenuOpen(false);
        onDelete();
      } else setConfirming(true);
    }
  }, confirming ? 'Click again to delete' : 'Delete'))), /*#__PURE__*/React.createElement("button", {
    className: "dc-expand",
    onClick: onFocus,
    title: "Focus"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 1h4v4M5 11H1V7M11 1L7.5 4.5M1 11l3.5-3.5"
  }))))), /*#__PURE__*/React.createElement("div", {
    ref: cardRef,
    className: "dc-card",
    style: {
      borderRadius: 2,
      boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06)',
      overflow: 'hidden',
      width,
      height,
      background: '#fff',
      ...style
    }
  }, children || /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#bbb',
      fontSize: 13,
      fontFamily: DC.font
    }
  }, id)));
}

// Inline rename — commits on blur or Enter.
function DCEditable({
  value,
  onChange,
  style,
  tag = 'span',
  onClick
}) {
  const T = tag;
  return /*#__PURE__*/React.createElement(T, {
    className: "dc-editable",
    contentEditable: true,
    suppressContentEditableWarning: true,
    onClick: onClick,
    onPointerDown: e => e.stopPropagation(),
    onBlur: e => onChange && onChange(e.currentTarget.textContent),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
    style: style
  }, value);
}

// ─────────────────────────────────────────────────────────────
// Focus mode — overlay one artboard; ←/→ within section, ↑/↓ across
// sections, Esc or backdrop click to exit.
// ─────────────────────────────────────────────────────────────
function DCFocusOverlay({
  entry,
  sectionMeta,
  sectionOrder
}) {
  const ctx = React.useContext(DCCtx);
  const {
    sectionId,
    artboard
  } = entry;
  const sec = ctx.section(sectionId);
  const meta = sectionMeta[sectionId];
  const peers = meta.slotIds;
  const aid = artboard.props.id ?? artboard.props.label;
  const idx = peers.indexOf(aid);
  const secIdx = sectionOrder.indexOf(sectionId);
  const go = d => {
    const n = peers[(idx + d + peers.length) % peers.length];
    if (n) ctx.setFocus(`${sectionId}/${n}`);
  };
  const goSection = d => {
    // Sections whose artboards are all deleted have slotIds:[] — step past
    // them to the next non-empty section so ↑/↓ doesn't dead-end.
    const n = sectionOrder.length;
    for (let i = 1; i < n; i++) {
      const ns = sectionOrder[((secIdx + d * i) % n + n) % n];
      const first = sectionMeta[ns] && sectionMeta[ns].slotIds[0];
      if (first) {
        ctx.setFocus(`${ns}/${first}`);
        return;
      }
    }
  };
  React.useEffect(() => {
    const k = e => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        goSection(-1);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goSection(1);
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });
  const {
    width = 260,
    height = 480,
    children
  } = artboard.props;
  const [vp, setVp] = React.useState({
    w: window.innerWidth,
    h: window.innerHeight
  });
  React.useEffect(() => {
    const r = () => setVp({
      w: window.innerWidth,
      h: window.innerHeight
    });
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  const scale = Math.max(0.1, Math.min((vp.w - 200) / width, (vp.h - 260) / height, 2));
  const [ddOpen, setDd] = React.useState(false);
  const Arrow = ({
    dir,
    onClick
  }) => /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onClick();
    },
    style: {
      position: 'absolute',
      top: '50%',
      [dir]: 28,
      transform: 'translateY(-50%)',
      border: 'none',
      background: 'rgba(255,255,255,.08)',
      color: 'rgba(255,255,255,.9)',
      width: 44,
      height: 44,
      borderRadius: 22,
      fontSize: 18,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background .15s'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(255,255,255,.18)',
    onMouseLeave: e => e.currentTarget.style.background = 'rgba(255,255,255,.08)'
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 18 18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: dir === 'left' ? 'M11 3L5 9l6 6' : 'M7 3l6 6-6 6'
  })));

  // Portal to body so position:fixed is the real viewport regardless of any
  // transform on DesignCanvas's ancestors (including the canvas zoom itself).
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    onClick: () => ctx.setFocus(null),
    onWheel: e => e.preventDefault(),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(24,20,16,.6)',
      backdropFilter: 'blur(14px)',
      fontFamily: DC.font,
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 72,
      display: 'flex',
      alignItems: 'flex-start',
      padding: '16px 20px 0',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDd(o => !o),
    style: {
      border: 'none',
      background: 'transparent',
      color: '#fff',
      cursor: 'pointer',
      padding: '6px 8px',
      borderRadius: 6,
      textAlign: 'left',
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 600,
      letterSpacing: -0.3
    }
  }, meta.title), /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 11 11",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    style: {
      opacity: .7
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 4l3.5 3.5L9 4"
  }))), meta.subtitle && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 13,
      opacity: .6,
      fontWeight: 400,
      marginTop: 2
    }
  }, meta.subtitle)), ddOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '100%',
      left: 0,
      marginTop: 4,
      background: '#2a251f',
      borderRadius: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      padding: 4,
      minWidth: 200,
      zIndex: 10
    }
  }, sectionOrder.filter(sid => sectionMeta[sid].slotIds.length).map(sid => /*#__PURE__*/React.createElement("button", {
    key: sid,
    onClick: () => {
      setDd(false);
      const f = sectionMeta[sid].slotIds[0];
      if (f) ctx.setFocus(`${sid}/${f}`);
    },
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      border: 'none',
      cursor: 'pointer',
      background: sid === sectionId ? 'rgba(255,255,255,.1)' : 'transparent',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: 5,
      fontSize: 14,
      fontWeight: sid === sectionId ? 600 : 400,
      fontFamily: 'inherit'
    }
  }, sectionMeta[sid].title)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => ctx.setFocus(null),
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(255,255,255,.12)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent',
    style: {
      border: 'none',
      background: 'transparent',
      color: 'rgba(255,255,255,.7)',
      width: 32,
      height: 32,
      borderRadius: 16,
      fontSize: 20,
      cursor: 'pointer',
      lineHeight: 1,
      transition: 'background .12s'
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 64,
      bottom: 56,
      left: 100,
      right: 100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: width * scale,
      height: height * scale,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      background: '#fff',
      borderRadius: 2,
      overflow: 'hidden',
      boxShadow: '0 20px 80px rgba(0,0,0,.4)'
    }
  }, children || /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#bbb'
    }
  }, aid))), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      fontSize: 14,
      fontWeight: 500,
      opacity: .85,
      textAlign: 'center'
    }
  }, (sec.labels || {})[aid] ?? artboard.props.label, /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: .5,
      marginLeft: 10,
      fontVariantNumeric: 'tabular-nums'
    }
  }, idx + 1, " / ", peers.length))), /*#__PURE__*/React.createElement(Arrow, {
    dir: "left",
    onClick: () => go(-1)
  }), /*#__PURE__*/React.createElement(Arrow, {
    dir: "right",
    onClick: () => go(1)
  }), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 8
    }
  }, peers.map((p, i) => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => ctx.setFocus(`${sectionId}/${p}`),
    style: {
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      width: 6,
      height: 6,
      borderRadius: 3,
      background: i === idx ? '#fff' : 'rgba(255,255,255,.3)'
    }
  })))), document.body);
}

// ─────────────────────────────────────────────────────────────
// Post-it — absolute-positioned sticky note
// ─────────────────────────────────────────────────────────────
function DCPostIt({
  children,
  top,
  left,
  right,
  bottom,
  rotate = -2,
  width = 180
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      width,
      background: DC.postitBg,
      padding: '14px 16px',
      fontFamily: '"Comic Sans MS", "Marker Felt", "Segoe Print", cursive',
      fontSize: 14,
      lineHeight: 1.4,
      color: DC.postitText,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      transform: `rotate(${rotate}deg)`,
      zIndex: 5
    }
  }, children);
}
Object.assign(window, {
  DesignCanvas,
  DCSection,
  DCArtboard,
  DCPostIt
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "dgo_digital_ops/ui_kits/dashboard/design-canvas.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dgo/App.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// DGO App — composes design canvas with 3 directions × 6 screens + Tweaks
const {
  useState,
  useEffect
} = React;
const {
  DesignCanvas,
  DCSection,
  DCArtboard,
  TweaksPanel,
  useTweaks,
  TweakSection,
  TweakRadio,
  TweakColor
} = window;
const {
  DGO_SignIn,
  DGO_Dashboard,
  DGO_DetailRecord,
  DGO_MultiStepForm,
  DGO_Email,
  DGO_Mobile
} = window;
const DEFAULTS = /*EDITMODE-BEGIN*/{
  "primary": "#05583B",
  "density": "comfortable"
} /*EDITMODE-END*/;
const DIRECTIONS = [{
  id: "statesman",
  label: "A · Statesman",
  desc: "Deep Green primary, exec dark surfaces. Maximum NITDA-respect.",
  attr: "default"
}, {
  id: "indigo",
  label: "B · Civic Indigo",
  desc: "Indigo primary #4538D9. Modern SaaS, NITDA endorses.",
  attr: "indigo"
}, {
  id: "amber",
  label: "C · Signal Amber",
  desc: "Amber primary #D97706. Dispatch energy; Deep Green as accent.",
  attr: "amber"
}];
const SCREENS = [{
  id: "signin",
  label: "Sign in",
  w: 1100,
  h: 720,
  comp: DGO_SignIn
}, {
  id: "dashboard",
  label: "Dashboard",
  w: 1280,
  h: 820,
  comp: DGO_Dashboard
}, {
  id: "detail",
  label: "Detail / record",
  w: 1100,
  h: 820,
  comp: DGO_DetailRecord
}, {
  id: "form",
  label: "Multi-step form",
  w: 1000,
  h: 820,
  comp: DGO_MultiStepForm
}, {
  id: "email",
  label: "Email notification",
  w: 720,
  h: 820,
  comp: DGO_Email
}, {
  id: "mobile",
  label: "Mobile responsive",
  w: 440,
  h: 820,
  comp: DGO_Mobile
}];
function Frame({
  direction,
  density,
  children
}) {
  // direction.attr = "default" | "indigo" | "amber"
  const attrs = {};
  if (direction.attr !== "default") attrs["data-dgo"] = direction.attr;
  attrs["data-dgo-density"] = density;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "dgo"
  }, attrs, {
    style: {
      height: "100%",
      width: "100%"
    }
  }), children);
}
function App() {
  const [tweaks, setTweak] = useTweaks(DEFAULTS);

  // Per-direction primary override (Tweaks color picker)
  // Apply on each artboard via inline style
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DesignCanvas, {
    title: "DGO Digital Ops \u2014 sub-brand directions",
    subtitle: "A NITDA Platform \xB7 3 directions \xD7 6 screens \xB7 Tweaks: primary color & density"
  }, DIRECTIONS.map(dir => /*#__PURE__*/React.createElement(DCSection, {
    key: dir.id,
    id: dir.id,
    title: dir.label,
    description: dir.desc
  }, SCREENS.map(s => {
    const Comp = s.comp;
    return /*#__PURE__*/React.createElement(DCArtboard, {
      key: s.id,
      id: `${dir.id}-${s.id}`,
      label: s.label,
      width: s.w,
      height: s.h
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: "100%",
        "--dgo-primary": dir.id === "statesman" ? tweaks.primary : undefined
      }
    }, /*#__PURE__*/React.createElement(Frame, {
      direction: dir,
      density: tweaks.density
    }, /*#__PURE__*/React.createElement(Comp, null))));
  })))), /*#__PURE__*/React.createElement(TweaksPanel, {
    title: "DGO Tweaks"
  }, /*#__PURE__*/React.createElement(TweakSection, {
    title: "Primary color"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 11,
      color: "#5F5C5D",
      marginBottom: 8,
      lineHeight: 1.5
    }
  }, "Applies to Direction A (Statesman). B & C keep their direction colors."), /*#__PURE__*/React.createElement(TweakColor, {
    value: tweaks.primary,
    onChange: v => setTweak("primary", v),
    label: "Statesman primary"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginTop: 8
    }
  }, ["#05583B", "#0B6BB0", "#7A1F4F", "#1B1A1A"].map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    onClick: () => setTweak("primary", c),
    style: {
      width: 28,
      height: 28,
      borderRadius: 6,
      background: c,
      border: tweaks.primary === c ? "2px solid #17B255" : "1px solid #E8E6E7",
      cursor: "pointer"
    }
  })))), /*#__PURE__*/React.createElement(TweakSection, {
    title: "Density"
  }, /*#__PURE__*/React.createElement(TweakRadio, {
    value: tweaks.density,
    onChange: v => setTweak("density", v),
    options: [{
      value: "comfortable",
      label: "Comfortable"
    }, {
      value: "compact",
      label: "Compact"
    }]
  }))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dgo/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dgo/Dashboard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// DGO Dashboard
const {
  DGOMark,
  IInbox,
  IRoute,
  ITrack,
  IBell,
  ISpark,
  ISearch,
  IFile,
  IMail,
  IGavel,
  IUser,
  IPlus,
  IChevR,
  ICheck
} = window;
function Sidebar({
  active = "Inbox"
}) {
  const items = [{
    name: "Inbox",
    icon: /*#__PURE__*/React.createElement(IInbox, null),
    count: 12
  }, {
    name: "Routed",
    icon: /*#__PURE__*/React.createElement(IRoute, null),
    count: 4
  }, {
    name: "Awaiting Reply",
    icon: /*#__PURE__*/React.createElement(ITrack, null),
    count: 7
  }, {
    name: "Drafts",
    icon: /*#__PURE__*/React.createElement(IFile, null)
  }, {
    name: "Sent",
    icon: /*#__PURE__*/React.createElement(IMail, null)
  }, {
    name: "Directives",
    icon: /*#__PURE__*/React.createElement(IGavel, null),
    count: 2
  }];
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      background: "var(--dgo-surface-inverse)",
      color: "#fff",
      padding: "20px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 4px 16px"
    }
  }, /*#__PURE__*/React.createElement(DGOMark, {
    onDark: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "dgo-endorse",
    style: {
      color: "rgba(255,255,255,0.55)",
      padding: "0 4px 18px"
    }
  }, "A NITDA Platform"), items.map(i => /*#__PURE__*/React.createElement("div", {
    key: i.name,
    className: "dgo-nav-item" + (i.name === active ? " active" : "")
  }, i.icon, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, i.name), i.count && /*#__PURE__*/React.createElement("span", {
    style: {
      background: i.name === active ? "var(--dgo-accent)" : "rgba(255,255,255,0.12)",
      color: "#fff",
      fontSize: 10,
      fontWeight: 700,
      padding: "1px 7px",
      borderRadius: 10
    }
  }, i.count))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto",
      padding: "12px 8px",
      borderTop: "1px solid rgba(255,255,255,0.1)",
      display: "flex",
      gap: 10,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 16,
      background: "var(--dgo-accent)",
      color: "#fff",
      display: "grid",
      placeItems: "center",
      fontFamily: "var(--font-sans)",
      fontWeight: 700,
      fontSize: 12
    }
  }, "KA"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      lineHeight: 1.3
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600
    }
  }, "Kashifu Abdullahi"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "rgba(255,255,255,0.55)",
      fontSize: 10
    }
  }, "Director General"))));
}
function Topbar() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "14px 24px",
      borderBottom: "1px solid var(--dgo-border)",
      background: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      background: "var(--dgo-surface-alt)",
      borderRadius: 8,
      flex: 1,
      maxWidth: 480
    }
  }, /*#__PURE__*/React.createElement(ISearch, null), /*#__PURE__*/React.createElement("input", {
    placeholder: "Search correspondence, contacts, directives\u2026",
    style: {
      border: 0,
      outline: 0,
      background: "transparent",
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      color: "var(--dgo-ink-muted)",
      padding: "1px 6px",
      border: "1px solid var(--dgo-border)",
      borderRadius: 4
    }
  }, "\u2318K")), /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-ghost"
  }, /*#__PURE__*/React.createElement(ISpark, null), " Ask DGO AI"), /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-ghost",
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(IBell, null), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 4,
      right: 6,
      width: 7,
      height: 7,
      borderRadius: 4,
      background: "#C8102E"
    }
  })), /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-primary"
  }, /*#__PURE__*/React.createElement(IPlus, null), " New"));
}
function StatTile({
  label,
  value,
  delta,
  accent
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "dgo-card",
    style: {
      padding: "var(--dgo-density-pad)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--dgo-ink-muted)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 30,
      fontWeight: 700,
      color: accent ? "var(--dgo-primary)" : "var(--dgo-ink)",
      letterSpacing: "-0.02em"
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 600,
      color: delta?.startsWith("−") ? "#A30D26" : "var(--dgo-accent)"
    }
  }, delta)));
}
function CorrespondenceRow({
  from,
  subject,
  status,
  time,
  priority
}) {
  const pill = {
    Pending: "dgo-pill-pending",
    Routed: "dgo-pill-routed",
    Replied: "dgo-pill-replied",
    "Action Reqd.": "dgo-pill-action",
    Draft: "dgo-pill-draft"
  }[status] || "dgo-pill-routed";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "20px 1.5fr 3fr 1fr 80px",
      gap: 12,
      alignItems: "center",
      padding: "0 14px",
      height: "var(--dgo-density-row)",
      borderBottom: "1px solid var(--dgo-border)",
      background: "#fff"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      minWidth: 0
    }
  }, priority && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: priority === "high" ? "#C8102E" : "var(--dgo-accent)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 14,
      background: "var(--dgo-primary-soft)",
      color: "var(--dgo-primary)",
      display: "grid",
      placeItems: "center",
      fontFamily: "var(--font-sans)",
      fontWeight: 700,
      fontSize: 11
    }
  }, from.split(" ").map(w => w[0]).slice(0, 2).join("")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: 13,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, from)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      color: "var(--dgo-ink)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, subject), /*#__PURE__*/React.createElement("span", {
    className: "dgo-pill " + pill
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), status), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 12,
      color: "var(--dgo-ink-muted)",
      textAlign: "right"
    }
  }, time));
}
function Dashboard() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "240px 1fr",
      height: "100%",
      background: "var(--dgo-surface-alt)"
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    active: "Inbox"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement(Topbar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "dgo-endorse",
    style: {
      marginBottom: 8
    }
  }, "Today \xB7 1 May 2026"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 28,
      fontWeight: 700,
      color: "var(--dgo-ink)",
      margin: 0,
      letterSpacing: "-0.02em"
    }
  }, "Good afternoon, Kashifu"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      color: "var(--dgo-ink-muted)",
      margin: "4px 0 0"
    }
  }, "23 items in your inbox \xB7 7 awaiting your reply \xB7 2 directives pending sign-off"))), /*#__PURE__*/React.createElement("div", {
    className: "dgo-card",
    style: {
      background: "linear-gradient(180deg, var(--dgo-primary-soft), #fff)",
      borderColor: "var(--dgo-primary-soft)",
      padding: 16,
      marginBottom: 20,
      display: "flex",
      gap: 14,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      background: "var(--dgo-primary)",
      color: "#fff",
      display: "grid",
      placeItems: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(ISpark, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 600,
      color: "var(--dgo-primary)"
    }
  }, "DGO AI \xB7 Daily brief"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      lineHeight: 1.5,
      color: "var(--dgo-ink)",
      margin: "6px 0 10px"
    }
  }, "Three high-priority items today: the ", /*#__PURE__*/React.createElement("b", null, "NCC inter-agency MoU"), " needs your signature by 3pm; ", /*#__PURE__*/React.createElement("b", null, "Min. of Finance"), " awaits a reply on the AI Policy budget memo (due Friday); and the ", /*#__PURE__*/React.createElement("b", null, "Senate ICT Committee"), " requested a brief by Monday."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-primary"
  }, "Open queue"), /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-ghost"
  }, "Draft replies for me")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 12,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    label: "Awaiting Reply",
    value: "7",
    delta: "+2",
    accent: true
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Routed Today",
    value: "14",
    delta: "+5"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Avg. Reply Time",
    value: "4.2h",
    delta: "\u221218%"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Directives Pending",
    value: "2",
    delta: "0"
  })), /*#__PURE__*/React.createElement("div", {
    className: "dgo-card",
    style: {
      padding: 0,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 16px",
      borderBottom: "1px solid var(--dgo-border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      background: 0,
      border: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 600,
      color: "var(--dgo-primary)",
      borderBottom: "2px solid var(--dgo-primary)",
      paddingBottom: 4,
      cursor: "pointer"
    }
  }, "Inbox ", /*#__PURE__*/React.createElement("span", {
    style: {
      background: "var(--dgo-primary-soft)",
      color: "var(--dgo-primary)",
      padding: "1px 6px",
      borderRadius: 8,
      marginLeft: 4,
      fontSize: 10
    }
  }, "12")), /*#__PURE__*/React.createElement("button", {
    style: {
      background: 0,
      border: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 500,
      color: "var(--dgo-ink-muted)",
      paddingBottom: 4,
      cursor: "pointer"
    }
  }, "Mentions"), /*#__PURE__*/React.createElement("button", {
    style: {
      background: 0,
      border: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 500,
      color: "var(--dgo-ink-muted)",
      paddingBottom: 4,
      cursor: "pointer"
    }
  }, "From MDAs"), /*#__PURE__*/React.createElement("button", {
    style: {
      background: 0,
      border: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 500,
      color: "var(--dgo-ink-muted)",
      paddingBottom: 4,
      cursor: "pointer"
    }
  }, "Public")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-secondary"
  }, "Filter"), /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-secondary"
  }, "Sort"))), [{
    from: "Federal Min. of Finance",
    subject: "Re: AI Policy budget — supplementary memo",
    status: "Action Reqd.",
    time: "10:24",
    priority: "high"
  }, {
    from: "NCC — Office of EVC",
    subject: "Inter-agency MoU on spectrum allocation: signature requested",
    status: "Pending",
    time: "09:46",
    priority: "high"
  }, {
    from: "Senate ICT Committee",
    subject: "Briefing request for sitting on 5 May",
    status: "Routed",
    time: "08:12"
  }, {
    from: "MDA — Min. of Education",
    subject: "EdTech procurement clearance — Lot 3",
    status: "Replied",
    time: "Yesterday"
  }, {
    from: "Office of the Vice President",
    subject: "Digital economy quarterly review attendance",
    status: "Pending",
    time: "Yesterday",
    priority: "high"
  }, {
    from: "Press Secretary",
    subject: "Statement draft on data protection enforcement",
    status: "Draft",
    time: "Yesterday"
  }, {
    from: "MDA — NIMC",
    subject: "Identity systems integration update",
    status: "Routed",
    time: "30 Apr"
  }].map((c, i) => /*#__PURE__*/React.createElement(CorrespondenceRow, _extends({
    key: i
  }, c)))))));
}
window.DGO_Dashboard = Dashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dgo/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dgo/Icons.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// DGO icons (Lucide-style outline)
const I = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
function IInbox(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("path", {
    d: "M22 12h-6l-2 3h-4l-2-3H2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
  }));
}
function IRoute(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "19",
    r: "3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "5",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6.7 16.7 17.3 7.3M9 19h6a4 4 0 0 0 4-4"
  }));
}
function ITrack(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 6v6l4 2"
  }));
}
function IUser(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 21a8 8 0 0 1 16 0"
  }));
}
function IBell(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("path", {
    d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 21a2 2 0 0 0 4 0"
  }));
}
function ISpark(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("path", {
    d: "M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"
  }));
}
function IChevR(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("path", {
    d: "m9 6 6 6-6 6"
  }));
}
function IFile(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 2v6h6"
  }));
}
function ISearch(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m20 20-3.5-3.5"
  }));
}
function ICheck(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("path", {
    d: "M20 6 9 17l-5-5"
  }));
}
function IMail(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "4",
    width: "20",
    height: "16",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m2 7 10 6 10-6"
  }));
}
function IPaper(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("path", {
    d: "M22 2 11 13"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M22 2 15 22l-4-9-9-4z"
  }));
}
function IPlus(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14"
  }));
}
function IGavel(p) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, I, p), /*#__PURE__*/React.createElement("path", {
    d: "m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m16 16 6-6m-7-5 6 6m-3-9 7 7"
  }));
}
Object.assign(window, {
  IInbox,
  IRoute,
  ITrack,
  IUser,
  IBell,
  ISpark,
  IChevR,
  IFile,
  ISearch,
  ICheck,
  IMail,
  IPaper,
  IPlus,
  IGavel
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dgo/Icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dgo/Mark.jsx
try { (() => {
// DGO mark — wordmark "DGO" with atomic-O motif + "Digital Ops" subline
function DGOMark({
  size = "md",
  onDark = false
}) {
  const scale = size === "sm" ? 0.75 : size === "lg" ? 1.4 : 1;
  return /*#__PURE__*/React.createElement("div", {
    className: "dgo-mark" + (onDark ? " on-dark" : ""),
    style: {
      "--s": scale
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement("div", {
    className: "word",
    style: {
      fontSize: 22 * scale
    }
  }, "D", /*#__PURE__*/React.createElement("span", {
    className: "o-orbit",
    style: {
      width: 18 * scale,
      height: 18 * scale
    }
  }), "O"), /*#__PURE__*/React.createElement("div", {
    className: "sub",
    style: {
      fontSize: 10 * scale
    }
  }, "Digital Ops")));
}
window.DGOMark = DGOMark;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dgo/Mark.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dgo/Screens.jsx
try { (() => {
// DGO Detail / record + multi-step form + email + mobile
const {
  DGOMark,
  ISpark,
  ICheck,
  IChevR,
  IPaper,
  IUser,
  IMail,
  IBell,
  IRoute
} = window;
function DetailRecord() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      overflow: "auto",
      background: "var(--dgo-surface-alt)",
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      color: "var(--dgo-ink-muted)",
      marginBottom: 8
    }
  }, "Inbox \u203A From MDAs \u203A ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--dgo-ink)"
    }
  }, "NCC \u2014 Inter-agency MoU")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 320px",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dgo-card",
    style: {
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "dgo-pill dgo-pill-pending"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "Pending Signature"), /*#__PURE__*/React.createElement("span", {
    className: "dgo-endorse"
  }, "CRSP-2026-0419")), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 24,
      fontWeight: 700,
      color: "var(--dgo-ink)",
      margin: "0 0 6px",
      letterSpacing: "-0.02em",
      lineHeight: 1.25
    }
  }, "Inter-agency Memorandum of Understanding on spectrum allocation for digital economy initiatives"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 12,
      color: "var(--dgo-ink-muted)",
      marginBottom: 18
    }
  }, "From ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--dgo-ink)"
    }
  }, "Office of the EVC, Nigerian Communications Commission"), " \xB7 Received 30 April 2026, 09:46 \xB7 Original via email"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--dgo-primary-soft)",
      border: "1px solid color-mix(in srgb, var(--dgo-primary) 18%, transparent)",
      borderRadius: 10,
      padding: 14,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      color: "var(--dgo-primary)",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(ISpark, {
    width: 14,
    height: 14
  }), "AI summary"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      lineHeight: 1.55,
      color: "var(--dgo-ink)",
      margin: 0
    }
  }, "The NCC proposes a 3-year MoU establishing a joint working group on spectrum allocation for IoT, AI infrastructure and 6G research. Three commitments require Agency sign-off: (1) joint advisory body, (2) shared compliance framework, (3) annual spectrum review. ", /*#__PURE__*/React.createElement("b", null, "Action: review clause 4.2 (data sharing) before signing."))), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 15,
      fontWeight: 600,
      margin: "0 0 8px"
    }
  }, "Original correspondence"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      lineHeight: 1.65,
      color: "var(--dgo-ink)",
      margin: "0 0 10px"
    }
  }, "Director General,"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      lineHeight: 1.65,
      color: "var(--dgo-ink)",
      margin: "0 0 10px"
    }
  }, "Further to our discussions during the Inter-Ministerial Committee on Digital Economy held on 14 April 2026, please find attached the draft Memorandum of Understanding for execution between the Nigerian Communications Commission and the National Information Technology Development Agency."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      lineHeight: 1.65,
      color: "var(--dgo-ink)",
      margin: "0 0 16px"
    }
  }, "The instrument formalises the collaboration framework outlined in section 8 of the Nigerian National Broadband Plan\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      padding: 12,
      border: "1px solid var(--dgo-border)",
      borderRadius: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(IPaper, null), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: "Verdana, sans-serif",
      fontSize: 13
    }
  }, "NCC-NITDA-MoU-Draft-v3.pdf", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--dgo-ink-muted)",
      fontSize: 11
    }
  }, "2.4 MB \xB7 18 pages")), /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-secondary"
  }, "View")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      paddingTop: 14,
      borderTop: "1px solid var(--dgo-border)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-primary"
  }, /*#__PURE__*/React.createElement(ICheck, null), " Sign & Reply"), /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-secondary"
  }, "Forward to Legal"), /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-ghost"
  }, "Add note"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dgo-card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--dgo-ink-muted)",
      marginBottom: 10
    }
  }, "Activity"), [{
    t: "Routed to DG by Asst. Director",
    time: "30 Apr 09:50"
  }, {
    t: "AI flagged: high priority",
    time: "30 Apr 09:48"
  }, {
    t: "Received from NCC",
    time: "30 Apr 09:46"
  }].map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      gap: 10,
      paddingBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: i === 0 ? "var(--dgo-accent)" : "var(--dgo-border)",
      marginTop: 5
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 12,
      lineHeight: 1.4
    }
  }, a.t, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--dgo-ink-muted)",
      fontSize: 11
    }
  }, a.time))))), /*#__PURE__*/React.createElement("div", {
    className: "dgo-card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--dgo-ink-muted)",
      marginBottom: 10
    }
  }, "Stakeholders"), [{
    n: "Aminu Maida",
    r: "EVC, NCC"
  }, {
    n: "DG's Legal Counsel",
    r: "Reviewer"
  }, {
    n: "Director, Reg. Affairs",
    r: "CC"
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      gap: 10,
      alignItems: "center",
      paddingBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 14,
      background: "var(--dgo-primary-soft)",
      color: "var(--dgo-primary)",
      display: "grid",
      placeItems: "center",
      fontSize: 10,
      fontWeight: 700
    }
  }, s.n.split(" ").map(w => w[0]).slice(0, 2).join("")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Verdana,sans-serif",
      fontSize: 12
    }
  }, s.n, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--dgo-ink-muted)",
      fontSize: 11
    }
  }, s.r))))), /*#__PURE__*/React.createElement("div", {
    className: "dgo-card",
    style: {
      background: "var(--dgo-primary-soft)",
      borderColor: "var(--dgo-primary-soft)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(ISpark, {
    width: 14,
    height: 14
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      color: "var(--dgo-primary)"
    }
  }, "Suggested action")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 12,
      color: "var(--dgo-ink)",
      margin: 0,
      lineHeight: 1.5
    }
  }, "Forward clause 4.2 to Legal for review before signing. Standard turnaround: 4h.")))));
}
function MultiStepForm() {
  const steps = ["Subject", "Recipients", "Routing", "AI Draft", "Review"];
  const current = 3;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      padding: 36,
      background: "var(--dgo-surface-alt)",
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 0,
      marginBottom: 28
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 2,
      background: i <= current ? "var(--dgo-primary)" : "var(--dgo-border)",
      visibility: i === 0 ? "hidden" : "visible"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 14,
      background: i < current ? "var(--dgo-primary)" : i === current ? "#fff" : "#fff",
      border: i === current ? "2px solid var(--dgo-primary)" : "2px solid var(--dgo-border)",
      color: i < current ? "#fff" : i === current ? "var(--dgo-primary)" : "var(--dgo-ink-muted)",
      display: "grid",
      placeItems: "center",
      fontFamily: "var(--font-sans)",
      fontWeight: 700,
      fontSize: 11
    }
  }, i < current ? "✓" : i + 1), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 2,
      background: i < current ? "var(--dgo-primary)" : "var(--dgo-border)",
      visibility: i === steps.length - 1 ? "hidden" : "visible"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: i === current ? 700 : 500,
      color: i === current ? "var(--dgo-ink)" : "var(--dgo-ink-muted)"
    }
  }, s)))), /*#__PURE__*/React.createElement("div", {
    className: "dgo-card",
    style: {
      padding: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dgo-endorse",
    style: {
      marginBottom: 8
    }
  }, "Step 4 of 5"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 22,
      fontWeight: 700,
      color: "var(--dgo-ink)",
      margin: "0 0 4px",
      letterSpacing: "-0.02em"
    }
  }, "Generate AI draft reply"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      color: "var(--dgo-ink-muted)",
      margin: "0 0 20px"
    }
  }, "DGO AI will draft based on the original correspondence, your past replies, and the routing context. You'll be able to edit before sending."), /*#__PURE__*/React.createElement("label", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      marginBottom: 6,
      display: "block"
    }
  }, "Tone"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 18
    }
  }, ["Formal", "Diplomatic", "Direct", "Cordial"].map((t, i) => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: "dgo-btn",
    style: {
      background: i === 1 ? "var(--dgo-primary)" : "#fff",
      color: i === 1 ? "#fff" : "var(--dgo-ink)",
      border: i === 1 ? "1px solid var(--dgo-primary)" : "1px solid var(--dgo-border)"
    }
  }, t))), /*#__PURE__*/React.createElement("label", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      marginBottom: 6,
      display: "block"
    }
  }, "Length"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 18
    }
  }, ["Brief", "Standard", "Detailed"].map((t, i) => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: "dgo-btn",
    style: {
      background: i === 1 ? "var(--dgo-primary)" : "#fff",
      color: i === 1 ? "#fff" : "var(--dgo-ink)",
      border: i === 1 ? "1px solid var(--dgo-primary)" : "1px solid var(--dgo-border)"
    }
  }, t))), /*#__PURE__*/React.createElement("label", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      marginBottom: 6,
      display: "block"
    }
  }, "Key points to include"), /*#__PURE__*/React.createElement("textarea", {
    className: "dgo-input",
    rows: 4,
    defaultValue: "\u2022 Confirm acceptance of MoU framework\n\u2022 Request modification to clause 4.2 (data sharing) \u2014 limit to anonymised aggregates\n\u2022 Propose first JWG meeting in week of 19 May 2026",
    style: {
      fontFamily: "Verdana, sans-serif",
      marginBottom: 18,
      resize: "vertical"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      paddingTop: 18,
      borderTop: "1px solid var(--dgo-border)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-ghost"
  }, "\u2190 Back to Routing"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-secondary"
  }, "Save draft"), /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-primary"
  }, /*#__PURE__*/React.createElement(ISpark, null), " Generate & Continue"))))));
}
function EmailNotification() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      padding: 32,
      background: "var(--dgo-surface-alt)",
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 600,
      margin: "0 auto",
      background: "#fff",
      border: "1px solid var(--dgo-border)",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "var(--shadow-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 18px",
      borderBottom: "1px solid var(--dgo-border)",
      fontFamily: "Verdana, sans-serif",
      fontSize: 11,
      color: "var(--dgo-ink-muted)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--dgo-ink)"
    }
  }, "From:"), " DGO Digital Ops <noreply@dgo.nitda.gov.ng>"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--dgo-ink)"
    }
  }, "To:"), " Kashifu Inuwa Abdullahi <k.abdullahi@nitda.gov.ng>"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--dgo-ink)"
    }
  }, "Subject:"), " Action required: NCC inter-agency MoU awaits your signature")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--dgo-surface-inverse)",
      padding: "20px 24px",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(DGOMark, {
    onDark: true,
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dgo-endorse",
    style: {
      color: "rgba(255,255,255,0.6)"
    }
  }, "Daily brief")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dgo-pill dgo-pill-action",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "Action Required"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 22,
      fontWeight: 700,
      color: "var(--dgo-ink)",
      margin: "0 0 8px",
      letterSpacing: "-0.02em",
      lineHeight: 1.25
    }
  }, "Director General, an inter-agency MoU is awaiting your signature."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 14,
      lineHeight: 1.6,
      color: "var(--dgo-ink)",
      margin: "0 0 16px"
    }
  }, "The Nigerian Communications Commission has submitted a draft Memorandum of Understanding on spectrum allocation. DGO AI has prepared a summary and flagged clause 4.2 for legal review before signing."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--dgo-surface-alt)",
      border: "1px solid var(--dgo-border)",
      borderRadius: 8,
      padding: 14,
      marginBottom: 18,
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement("b", null, "Reference:"), " CRSP-2026-0419", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("b", null, "From:"), " Office of the EVC, NCC", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("b", null, "Received:"), " 30 April 2026, 09:46", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("b", null, "Priority:"), " High \xB7 ", /*#__PURE__*/React.createElement("b", null, "Due:"), " 1 May 2026, 15:00"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "dgo-btn dgo-btn-primary",
    style: {
      textDecoration: "none",
      padding: "12px 22px"
    }
  }, "Open in DGO"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 11,
      color: "var(--dgo-ink-muted)",
      marginTop: 24,
      lineHeight: 1.6
    }
  }, "You're receiving this because you have correspondence routed to your queue. ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "var(--dgo-primary)"
    }
  }, "Notification settings"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--dgo-surface-alt)",
      padding: "16px 24px",
      fontFamily: "Verdana, sans-serif",
      fontSize: 11,
      color: "var(--dgo-ink-muted)",
      borderTop: "1px solid var(--dgo-border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dgo-endorse",
    style: {
      marginBottom: 6
    }
  }, "A NITDA Platform"), "National Information Technology Development Agency \xB7 No. 28, Port Harcourt Crescent, Garki, Abuja \xB7 This message is confidential and intended for the addressee only.")));
}
function MobileView() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      padding: 24,
      background: "var(--dgo-surface-alt)",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 360,
      height: 720,
      background: "#fff",
      borderRadius: 36,
      border: "10px solid #1B1A1A",
      boxShadow: "var(--shadow-lg)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--dgo-surface-inverse)",
      color: "#fff",
      padding: "10px 20px 8px",
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 600,
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", null, "14:32"), /*#__PURE__*/React.createElement("span", null, "\u25CF \u25CF \u25CF"), /*#__PURE__*/React.createElement("span", null, "87%")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--dgo-surface-inverse)",
      color: "#fff",
      padding: "8px 20px 18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(DGOMark, {
    onDark: true,
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(IBell, null), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: -2,
      right: -2,
      width: 6,
      height: 6,
      background: "#C8102E",
      borderRadius: 3
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 18px 8px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dgo-endorse",
    style: {
      marginBottom: 4
    }
  }, "1 May \xB7 Today"), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 18,
      fontWeight: 700,
      margin: 0,
      letterSpacing: "-0.02em"
    }
  }, "23 items in queue")), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "8px 16px 12px",
      padding: 12,
      background: "var(--dgo-primary-soft)",
      borderRadius: 10,
      display: "flex",
      gap: 10,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: "var(--dgo-primary)",
      color: "#fff",
      display: "grid",
      placeItems: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(ISpark, null)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 600,
      color: "var(--dgo-primary)"
    }
  }, "Brief"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 12,
      lineHeight: 1.5,
      color: "var(--dgo-ink)",
      marginTop: 2
    }
  }, "3 high-priority items. NCC MoU due 3pm."))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto"
    }
  }, [{
    from: "NCC",
    subj: "MoU on spectrum…",
    t: "09:46",
    p: "high"
  }, {
    from: "Min. of Finance",
    subj: "Re: AI Policy budget",
    t: "10:24",
    p: "high"
  }, {
    from: "Senate ICT Cmte.",
    subj: "Briefing request — 5 May",
    t: "08:12"
  }, {
    from: "OVP",
    subj: "Q-review attendance",
    t: "Yest.",
    p: "high"
  }, {
    from: "Press Sec.",
    subj: "Statement on data protection",
    t: "Yest."
  }].map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      gap: 10,
      padding: "12px 18px",
      borderBottom: "1px solid var(--dgo-border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 16,
      background: "var(--dgo-primary-soft)",
      color: "var(--dgo-primary)",
      display: "grid",
      placeItems: "center",
      fontFamily: "var(--font-sans)",
      fontWeight: 700,
      fontSize: 10,
      flexShrink: 0
    }
  }, r.from.split(" ").map(w => w[0]).slice(0, 2).join("")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: 12
    }
  }, r.from), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 10,
      color: "var(--dgo-ink-muted)"
    }
  }, r.t)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 12,
      color: "var(--dgo-ink-muted)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      marginTop: 2
    }
  }, r.subj)), r.p === "high" && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: "#C8102E",
      marginTop: 14
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      borderTop: "1px solid var(--dgo-border)",
      padding: "8px 0",
      background: "#fff"
    }
  }, [{
    ic: /*#__PURE__*/React.createElement(window.IInbox, null),
    l: "Inbox",
    a: true
  }, {
    ic: /*#__PURE__*/React.createElement(IRoute, null),
    l: "Route"
  }, {
    ic: /*#__PURE__*/React.createElement(window.ITrack, null),
    l: "Track"
  }, {
    ic: /*#__PURE__*/React.createElement(IUser, null),
    l: "Me"
  }].map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      color: t.a ? "var(--dgo-primary)" : "var(--dgo-ink-muted)"
    }
  }, t.ic, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 9,
      fontWeight: 600
    }
  }, t.l))))));
}
Object.assign(window, {
  DGO_DetailRecord: DetailRecord,
  DGO_MultiStepForm: MultiStepForm,
  DGO_Email: EmailNotification,
  DGO_Mobile: MobileView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dgo/Screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dgo/SignIn.jsx
try { (() => {
// DGO Sign-in screen
const {
  DGOMark,
  IInbox,
  ISpark
} = window;
function SignIn() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      display: "grid",
      gridTemplateColumns: "1.1fr 1fr",
      background: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--dgo-surface-inverse)",
      padding: 36,
      color: "#fff",
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: typeof window !== "undefined" && window.__resources && window.__resources.infoweb || "../../assets/symbol-infoweb-mark.png",
    alt: "",
    style: {
      position: "absolute",
      right: -60,
      bottom: -60,
      height: 320,
      opacity: 0.08,
      filter: "brightness(0) invert(1)"
    }
  }), /*#__PURE__*/React.createElement(DGOMark, {
    onDark: true,
    size: "lg"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 64
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dgo-endorse",
    style: {
      color: "rgba(255,255,255,0.7)",
      marginBottom: 14
    }
  }, "A NITDA Platform"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 36,
      fontWeight: 700,
      lineHeight: 1.15,
      letterSpacing: "-0.02em",
      margin: 0,
      color: "#fff"
    }
  }, "Correspondence,", /*#__PURE__*/React.createElement("br", null), "routed at the speed", /*#__PURE__*/React.createElement("br", null), "of the Director General."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 14,
      lineHeight: 1.6,
      color: "rgba(255,255,255,0.78)",
      marginTop: 18,
      maxWidth: 380
    }
  }, "AI-assisted intake, routing, tracking and replies for the DG's Office. Internal use only.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 28,
      left: 36,
      fontFamily: "Verdana, sans-serif",
      fontSize: 11,
      color: "rgba(255,255,255,0.5)"
    }
  }, "National Information Technology Development Agency \xB7 Federal Ministry of Communications and Digital Economy")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "56px 48px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 26,
      fontWeight: 700,
      color: "var(--dgo-ink)",
      margin: "0 0 6px",
      letterSpacing: "-0.02em"
    }
  }, "Sign in"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      color: "var(--dgo-ink-muted)",
      margin: "0 0 28px"
    }
  }, "Use your NITDA staff credentials."), /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      fontFamily: "var(--font-sans)",
      marginBottom: 6
    }
  }, "Staff email"), /*#__PURE__*/React.createElement("input", {
    className: "dgo-input",
    defaultValue: "k.abdullahi@nitda.gov.ng",
    style: {
      marginBottom: 14
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      fontFamily: "var(--font-sans)",
      marginBottom: 6
    }
  }, "Password"), /*#__PURE__*/React.createElement("input", {
    className: "dgo-input",
    type: "password",
    defaultValue: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    style: {
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 12,
      color: "var(--dgo-ink-muted)",
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    defaultChecked: true
  }), " Remember on this device"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      color: "var(--dgo-primary)"
    }
  }, "Forgot password?")), /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-primary",
    style: {
      width: "100%",
      justifyContent: "center",
      padding: "12px"
    }
  }, "Continue"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      margin: "20px 0",
      color: "var(--dgo-ink-muted)",
      fontSize: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: "var(--dgo-border)"
    }
  }), " OR ", /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: "var(--dgo-border)"
    }
  })), /*#__PURE__*/React.createElement("button", {
    className: "dgo-btn dgo-btn-secondary",
    style: {
      width: "100%",
      justifyContent: "center",
      padding: "12px"
    }
  }, "Continue with NITDA Single Sign-On"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28,
      fontSize: 11,
      fontFamily: "Verdana, sans-serif",
      color: "var(--dgo-ink-muted)",
      lineHeight: 1.6
    }
  }, "By continuing you agree to the DG's Office acceptable-use policy. All sessions are logged.")));
}
window.DGO_SignIn = SignIn;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dgo/SignIn.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dgo/design-canvas.jsx
try { (() => {
// DesignCanvas.jsx — Figma-ish design canvas wrapper
// Warm gray grid bg + Sections + Artboards + PostIt notes.
// Artboards are reorderable (grip-drag), deletable, labels/titles are
// inline-editable, and any artboard can be opened in a fullscreen focus
// overlay (←/→/Esc). State persists to a .design-canvas.state.json sidecar
// via the host bridge. No assets, no deps.
//
// Usage:
//   <DesignCanvas>
//     <DCSection id="onboarding" title="Onboarding" subtitle="First-run variants">
//       <DCArtboard id="a" label="A · Dusk" width={260} height={480}>…</DCArtboard>
//       <DCArtboard id="b" label="B · Minimal" width={260} height={480}>…</DCArtboard>
//     </DCSection>
//   </DesignCanvas>

const DC = {
  bg: '#f0eee9',
  grid: 'rgba(0,0,0,0.06)',
  label: 'rgba(60,50,40,0.7)',
  title: 'rgba(40,30,20,0.85)',
  subtitle: 'rgba(60,50,40,0.6)',
  postitBg: '#fef4a8',
  postitText: '#5a4a2a',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
};

// One-time CSS injection (classes are dc-prefixed so they don't collide with
// the hosted design's own styles).
if (typeof document !== 'undefined' && !document.getElementById('dc-styles')) {
  const s = document.createElement('style');
  s.id = 'dc-styles';
  s.textContent = ['.dc-editable{cursor:text;outline:none;white-space:nowrap;border-radius:3px;padding:0 2px;margin:0 -2px}', '.dc-editable:focus{background:#fff;box-shadow:0 0 0 1.5px #c96442}', '[data-dc-slot]{transition:transform .18s cubic-bezier(.2,.7,.3,1)}', '[data-dc-slot].dc-dragging{transition:none;z-index:10;pointer-events:none}', '[data-dc-slot].dc-dragging .dc-card{box-shadow:0 12px 40px rgba(0,0,0,.25),0 0 0 2px #c96442;transform:scale(1.02)}', '.dc-card{transition:box-shadow .15s,transform .15s}', '.dc-card *{scrollbar-width:none}', '.dc-card *::-webkit-scrollbar{display:none}',
  // Per-artboard header: grip + label on the left, delete/expand on the
  // right. Single flex row; when the artboard's on-screen width is too
  // narrow for both the label yields (ellipsis, then hidden entirely below
  // ~4ch via the container query) and the buttons stay on the row.
  '.dc-header{position:absolute;bottom:100%;left:-4px;margin-bottom:calc(4px * var(--dc-inv-zoom,1));z-index:2;', '  display:flex;align-items:center;container-type:inline-size}', '.dc-labelrow{display:flex;align-items:center;gap:4px;height:24px;flex:1 1 auto;min-width:0}', '.dc-grip{flex:0 0 auto;cursor:grab;display:flex;align-items:center;padding:5px 4px;border-radius:4px;transition:background .12s,opacity .12s}', '.dc-grip:hover{background:rgba(0,0,0,.08)}', '.dc-grip:active{cursor:grabbing}', '.dc-labeltext{flex:1 1 auto;min-width:0;cursor:pointer;border-radius:4px;padding:3px 6px;', '  display:flex;align-items:center;transition:background .12s;overflow:hidden}',
  // Below ~4ch of label room: hide the label entirely, and drop the grip to
  // hover-only (same reveal rule as .dc-btns) so a narrow header is clean
  // until the card is moused.
  '@container (max-width: 110px){', '  .dc-labeltext{display:none}', '  .dc-grip{opacity:0}', '  [data-dc-slot]:hover .dc-grip{opacity:1}', '}', '.dc-labeltext:hover{background:rgba(0,0,0,.05)}', '.dc-labeltext .dc-editable{overflow:hidden;text-overflow:ellipsis;max-width:100%}', '.dc-labeltext .dc-editable:focus{overflow:visible;text-overflow:clip}', '.dc-btns{flex:0 0 auto;margin-left:auto;display:flex;gap:2px;opacity:0;transition:opacity .12s}', '[data-dc-slot]:hover .dc-btns,.dc-btns:has(.dc-confirm){opacity:1}', '.dc-expand,.dc-delete{width:22px;height:22px;border-radius:5px;border:none;cursor:pointer;padding:0;', '  background:transparent;color:rgba(60,50,40,.7);display:flex;align-items:center;justify-content:center;', '  font:inherit;transition:background .12s,color .12s}', '.dc-expand:hover{background:rgba(0,0,0,.06);color:#2a251f}', '.dc-delete:hover{background:rgba(201,100,66,.12);color:#c96442}', '.dc-delete.dc-confirm{width:auto;padding:0 7px;gap:5px;background:#c96442;color:#fff;', '  font-size:12px;font-weight:500}', '.dc-delete.dc-confirm:hover{background:#b5563a}',
  // Chrome (titles / labels / buttons) counter-scales against the viewport
  // zoom so it stays a constant on-screen size. --dc-inv-zoom is set by
  // DCViewport on every transform update and inherits to all descendants —
  // any overlay inside the world (e.g. a TweaksPanel on an artboard) can use
  // it the same way.
  //
  // The header uses transform:scale (out-of-flow, so layout impact doesn't
  // matter) with its world-space width set to card-width / inv-zoom so that
  // after counter-scaling its on-screen width exactly matches the card's —
  // that's what lets the container query + text-overflow behave against the
  // card's visible edge at every zoom level.
  //
  // The section head uses CSS zoom instead of transform so its layout box
  // grows with the counter-scale, pushing the card row down — otherwise the
  // constant-screen-size title would overflow into the (shrinking) world-
  // space gap and overlap the artboard headers at low zoom.
  '.dc-header{width:calc((100% + 4px) / var(--dc-inv-zoom,1));', '  transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom left}', '.dc-sectionhead{zoom:var(--dc-inv-zoom,1)}'].join('\n');
  document.head.appendChild(s);
}
const DCCtx = React.createContext(null);

// ─────────────────────────────────────────────────────────────
// DesignCanvas — stateful wrapper around the pan/zoom viewport.
// Owns runtime state (per-section order, renamed titles/labels, hidden
// artboards, focused artboard). Order/titles/labels/hidden persist to a
// .design-canvas.state.json
// sidecar next to the HTML. Reads go via plain fetch() so the saved
// arrangement is visible anywhere the HTML + sidecar are served together
// (omelette preview, direct link, downloaded zip). Writes go through the
// host's window.omelette bridge — editing requires the omelette runtime.
// Focus is ephemeral.
// ─────────────────────────────────────────────────────────────
const DC_STATE_FILE = '.design-canvas.state.json';
function DesignCanvas({
  children,
  minScale,
  maxScale,
  style
}) {
  const [state, setState] = React.useState({
    sections: {},
    focus: null
  });
  // Hold rendering until the sidecar read settles so the saved order/titles
  // appear on first paint (no source-order flash). didRead gates writes until
  // the read settles so the empty initial state can't clobber a slow read;
  // skipNextWrite suppresses the one echo-write that would otherwise follow
  // hydration.
  const [ready, setReady] = React.useState(false);
  const didRead = React.useRef(false);
  const skipNextWrite = React.useRef(false);
  React.useEffect(() => {
    let off = false;
    fetch('./' + DC_STATE_FILE).then(r => r.ok ? r.json() : null).then(saved => {
      if (off || !saved || !saved.sections) return;
      skipNextWrite.current = true;
      setState(s => ({
        ...s,
        sections: saved.sections
      }));
    }).catch(() => {}).finally(() => {
      didRead.current = true;
      if (!off) setReady(true);
    });
    const t = setTimeout(() => {
      if (!off) setReady(true);
    }, 150);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, []);
  React.useEffect(() => {
    if (!didRead.current) return;
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    const t = setTimeout(() => {
      window.omelette?.writeFile(DC_STATE_FILE, JSON.stringify({
        sections: state.sections
      })).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [state.sections]);

  // Build registries synchronously from children so FocusOverlay can read
  // them in the same render. Only direct DCSection > DCArtboard children are
  // walked — wrapping them in other elements opts out of focus/reorder.
  const registry = {}; // slotId -> { sectionId, artboard }
  const sectionMeta = {}; // sectionId -> { title, subtitle, slotIds[] }
  const sectionOrder = [];
  React.Children.forEach(children, sec => {
    if (!sec || sec.type !== DCSection) return;
    const sid = sec.props.id ?? sec.props.title;
    if (!sid) return;
    sectionOrder.push(sid);
    const persisted = state.sections[sid] || {};
    const abs = [];
    React.Children.forEach(sec.props.children, ab => {
      if (!ab || ab.type !== DCArtboard) return;
      const aid = ab.props.id ?? ab.props.label;
      if (aid) abs.push([aid, ab]);
    });
    // hidden is scoped to one source revision — when the agent regenerates
    // (artboard-ID set changes), prior deletes don't apply to new content.
    const srcKey = abs.map(([k]) => k).join('\x1f');
    const hidden = persisted.srcKey === srcKey ? persisted.hidden || [] : [];
    const srcIds = [];
    abs.forEach(([aid, ab]) => {
      if (hidden.includes(aid)) return;
      registry[`${sid}/${aid}`] = {
        sectionId: sid,
        artboard: ab
      };
      srcIds.push(aid);
    });
    const kept = (persisted.order || []).filter(k => srcIds.includes(k));
    sectionMeta[sid] = {
      title: persisted.title ?? sec.props.title,
      subtitle: sec.props.subtitle,
      slotIds: [...kept, ...srcIds.filter(k => !kept.includes(k))]
    };
  });
  const api = React.useMemo(() => ({
    state,
    section: id => state.sections[id] || {},
    patchSection: (id, p) => setState(s => ({
      ...s,
      sections: {
        ...s.sections,
        [id]: {
          ...s.sections[id],
          ...(typeof p === 'function' ? p(s.sections[id] || {}) : p)
        }
      }
    })),
    setFocus: slotId => setState(s => ({
      ...s,
      focus: slotId
    }))
  }), [state]);

  // Esc exits focus; any outside pointerdown commits an in-progress rename.
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') api.setFocus(null);
    };
    const onPd = e => {
      const ae = document.activeElement;
      if (ae && ae.isContentEditable && !ae.contains(e.target)) ae.blur();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPd, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPd, true);
    };
  }, [api]);
  return /*#__PURE__*/React.createElement(DCCtx.Provider, {
    value: api
  }, /*#__PURE__*/React.createElement(DCViewport, {
    minScale: minScale,
    maxScale: maxScale,
    style: style
  }, ready && children), state.focus && registry[state.focus] && /*#__PURE__*/React.createElement(DCFocusOverlay, {
    entry: registry[state.focus],
    sectionMeta: sectionMeta,
    sectionOrder: sectionOrder
  }));
}

// ─────────────────────────────────────────────────────────────
// DCViewport — transform-based pan/zoom (internal)
//
// Input mapping (Figma-style):
//   • trackpad pinch  → zoom   (ctrlKey wheel; Safari gesture* events)
//   • trackpad scroll → pan    (two-finger)
//   • mouse wheel     → zoom   (notched; distinguished from trackpad scroll)
//   • middle-drag / primary-drag-on-bg → pan
//
// Transform state lives in a ref and is written straight to the DOM
// (translate3d + will-change) so wheel ticks don't go through React —
// keeps pans at 60fps on dense canvases.
// ─────────────────────────────────────────────────────────────
function DCViewport({
  children,
  minScale = 0.1,
  maxScale = 8,
  style = {}
}) {
  const vpRef = React.useRef(null);
  const worldRef = React.useRef(null);
  const tf = React.useRef({
    x: 0,
    y: 0,
    scale: 1
  });
  // Persist viewport across reloads so the user lands back where they were
  // after an agent edit or browser refresh. The sandbox origin is already
  // per-project; pathname keeps multiple canvas files in one project apart.
  const tfKey = 'dc-viewport:' + location.pathname;
  const saveT = React.useRef(0);
  const lastPostedScale = React.useRef();
  const apply = React.useCallback(() => {
    const {
      x,
      y,
      scale
    } = tf.current;
    const el = worldRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    // Exposed for zoom-invariant chrome (labels, buttons, TweaksPanel).
    el.style.setProperty('--dc-inv-zoom', String(1 / scale));
    // Keep the host toolbar's % readout in sync with the canvas scale. Pan
    // ticks leave scale unchanged — skip the cross-frame post for those.
    if (lastPostedScale.current !== scale) {
      lastPostedScale.current = scale;
      window.parent.postMessage({
        type: '__dc_zoom',
        scale
      }, '*');
    }
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => {
      try {
        localStorage.setItem(tfKey, JSON.stringify(tf.current));
      } catch {}
    }, 200);
  }, [tfKey]);
  React.useLayoutEffect(() => {
    const flush = () => {
      clearTimeout(saveT.current);
      try {
        localStorage.setItem(tfKey, JSON.stringify(tf.current));
      } catch {}
    };
    try {
      const s = JSON.parse(localStorage.getItem(tfKey) || 'null');
      if (s && Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.scale)) {
        tf.current = {
          x: s.x,
          y: s.y,
          scale: Math.min(maxScale, Math.max(minScale, s.scale))
        };
        apply();
      }
    } catch {}
    // Flush on pagehide and unmount so a reload within the 200ms debounce
    // window doesn't drop the last pan/zoom.
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
  React.useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const zoomAt = (cx, cy, factor) => {
      const r = vp.getBoundingClientRect();
      const px = cx - r.left,
        py = cy - r.top;
      const t = tf.current;
      const next = Math.min(maxScale, Math.max(minScale, t.scale * factor));
      const k = next / t.scale;
      // keep the world point under the cursor fixed
      t.x = px - (px - t.x) * k;
      t.y = py - (py - t.y) * k;
      t.scale = next;
      apply();
    };

    // Mouse-wheel vs trackpad-scroll heuristic. A physical wheel sends
    // line-mode deltas (Firefox) or large integer pixel deltas with no X
    // component (Chrome/Safari, typically multiples of 100/120). Trackpad
    // two-finger scroll sends small/fractional pixel deltas, often with
    // non-zero deltaX. ctrlKey is set by the browser for trackpad pinch.
    const isMouseWheel = e => e.deltaMode !== 0 || e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40;
    const onWheel = e => {
      e.preventDefault();
      if (isGesturing) return; // Safari: gesture* owns the pinch — discard concurrent wheels
      if (e.ctrlKey) {
        // trackpad pinch (or explicit ctrl+wheel)
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      } else if (isMouseWheel(e)) {
        // notched mouse wheel — fixed-ratio step per click
        zoomAt(e.clientX, e.clientY, Math.exp(-Math.sign(e.deltaY) * 0.18));
      } else {
        // trackpad two-finger scroll — pan
        tf.current.x -= e.deltaX;
        tf.current.y -= e.deltaY;
        apply();
      }
    };

    // Safari sends native gesture* events for trackpad pinch with a smooth
    // e.scale; preferring these over the ctrl+wheel fallback gives a much
    // better feel there. No-ops on other browsers. Safari also fires
    // ctrlKey wheel events during the same pinch — isGesturing makes
    // onWheel drop those entirely so they neither zoom nor pan.
    let gsBase = 1;
    let isGesturing = false;
    const onGestureStart = e => {
      e.preventDefault();
      isGesturing = true;
      gsBase = tf.current.scale;
    };
    const onGestureChange = e => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, gsBase * e.scale / tf.current.scale);
    };
    const onGestureEnd = e => {
      e.preventDefault();
      isGesturing = false;
    };

    // Drag-pan: middle button anywhere, or primary button on canvas
    // background (anything that isn't an artboard or an inline editor).
    let drag = null;
    const onPointerDown = e => {
      const onBg = !e.target.closest('[data-dc-slot], .dc-editable');
      if (!(e.button === 1 || e.button === 0 && onBg)) return;
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      drag = {
        id: e.pointerId,
        lx: e.clientX,
        ly: e.clientY
      };
      vp.style.cursor = 'grabbing';
    };
    const onPointerMove = e => {
      if (!drag || e.pointerId !== drag.id) return;
      tf.current.x += e.clientX - drag.lx;
      tf.current.y += e.clientY - drag.ly;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      apply();
    };
    const onPointerUp = e => {
      if (!drag || e.pointerId !== drag.id) return;
      vp.releasePointerCapture(e.pointerId);
      drag = null;
      vp.style.cursor = '';
    };

    // Host-driven zoom (toolbar % menu). Zooms around viewport centre so the
    // visible midpoint stays fixed — matching the host's iframe-zoom feel.
    const onHostMsg = e => {
      const d = e.data;
      if (d && d.type === '__dc_set_zoom' && typeof d.scale === 'number') {
        const r = vp.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, d.scale / tf.current.scale);
      } else if (d && d.type === '__dc_probe') {
        // Host's [readyGen] reset asks whether a canvas is present; it
        // fires on the iframe's native 'load', which for canvases with
        // images/fonts is after our mount-time announce, so re-announce.
        // Clear the pan-tick guard so apply() re-posts the current scale
        // even if it's unchanged — the host just reset dcScale to 1.
        window.parent.postMessage({
          type: '__dc_present'
        }, '*');
        lastPostedScale.current = undefined;
        apply();
      }
    };
    window.addEventListener('message', onHostMsg);
    // Announce canvas mode so the host toolbar proxies its % control here
    // instead of scaling the iframe element (which would just shrink the
    // viewport window of an infinite canvas). The apply() that follows emits
    // the initial __dc_zoom so the toolbar % is correct before first pinch.
    // lastPostedScale reset mirrors the __dc_probe handler: the layout
    // effect's restore-path apply() may already have posted the restored
    // scale (before __dc_present), so clear the guard to re-post it in order.
    window.parent.postMessage({
      type: '__dc_present'
    }, '*');
    lastPostedScale.current = undefined;
    apply();
    vp.addEventListener('wheel', onWheel, {
      passive: false
    });
    vp.addEventListener('gesturestart', onGestureStart, {
      passive: false
    });
    vp.addEventListener('gesturechange', onGestureChange, {
      passive: false
    });
    vp.addEventListener('gestureend', onGestureEnd, {
      passive: false
    });
    vp.addEventListener('pointerdown', onPointerDown);
    vp.addEventListener('pointermove', onPointerMove);
    vp.addEventListener('pointerup', onPointerUp);
    vp.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('message', onHostMsg);
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('gesturestart', onGestureStart);
      vp.removeEventListener('gesturechange', onGestureChange);
      vp.removeEventListener('gestureend', onGestureEnd);
      vp.removeEventListener('pointerdown', onPointerDown);
      vp.removeEventListener('pointermove', onPointerMove);
      vp.removeEventListener('pointerup', onPointerUp);
      vp.removeEventListener('pointercancel', onPointerUp);
    };
  }, [apply, minScale, maxScale]);
  const gridSvg = `url("data:image/svg+xml,%3Csvg width='120' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M120 0H0v120' fill='none' stroke='${encodeURIComponent(DC.grid)}' stroke-width='1'/%3E%3C/svg%3E")`;
  return /*#__PURE__*/React.createElement("div", {
    ref: vpRef,
    className: "design-canvas",
    style: {
      height: '100vh',
      width: '100vw',
      background: DC.bg,
      overflow: 'hidden',
      overscrollBehavior: 'none',
      touchAction: 'none',
      position: 'relative',
      fontFamily: DC.font,
      boxSizing: 'border-box',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: worldRef,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      transformOrigin: '0 0',
      willChange: 'transform',
      width: 'max-content',
      minWidth: '100%',
      minHeight: '100%',
      padding: '60px 0 80px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: -6000,
      backgroundImage: gridSvg,
      backgroundSize: '120px 120px',
      pointerEvents: 'none',
      zIndex: -1
    }
  }), children));
}

// ─────────────────────────────────────────────────────────────
// DCSection — editable title + h-row of artboards in persisted order
// ─────────────────────────────────────────────────────────────
function DCSection({
  id,
  title,
  subtitle,
  children,
  gap = 48
}) {
  const ctx = React.useContext(DCCtx);
  const sid = id ?? title;
  const all = React.Children.toArray(children);
  const artboards = all.filter(c => c && c.type === DCArtboard);
  const rest = all.filter(c => !(c && c.type === DCArtboard));
  const sec = ctx && sid && ctx.section(sid) || {};
  // Must match DesignCanvas's srcKey computation exactly (it filters falsy
  // IDs), or onDelete persists a srcKey that DesignCanvas never recognizes.
  const allIds = artboards.map(a => a.props.id ?? a.props.label).filter(Boolean);
  const srcKey = allIds.join('\x1f');
  const hidden = sec.srcKey === srcKey ? sec.hidden || [] : [];
  const srcOrder = allIds.filter(k => !hidden.includes(k));
  const order = React.useMemo(() => {
    const kept = (sec.order || []).filter(k => srcOrder.includes(k));
    return [...kept, ...srcOrder.filter(k => !kept.includes(k))];
  }, [sec.order, srcOrder.join('|')]);
  const byId = Object.fromEntries(artboards.map(a => [a.props.id ?? a.props.label, a]));

  // marginBottom counter-scales so the on-screen gap between sections stays
  // constant — otherwise at low zoom the (world-space) gap collapses while
  // the screen-constant sectionhead below it doesn't, and the title reads as
  // belonging to the section above. paddingBottom below is just enough for
  // the 24px artboard-header (abs-positioned above each card) plus ~8px, so
  // the title sits tight against its own row at every zoom.
  return /*#__PURE__*/React.createElement("div", {
    "data-dc-section": sid,
    style: {
      marginBottom: 'calc(80px * var(--dc-inv-zoom, 1))',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 60px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-sectionhead",
    style: {
      paddingBottom: 36
    }
  }, /*#__PURE__*/React.createElement(DCEditable, {
    tag: "div",
    value: sec.title ?? title,
    onChange: v => ctx && sid && ctx.patchSection(sid, {
      title: v
    }),
    style: {
      fontSize: 28,
      fontWeight: 600,
      color: DC.title,
      letterSpacing: -0.4,
      marginBottom: 6,
      display: 'inline-block'
    }
  }), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: DC.subtitle
    }
  }, subtitle))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap,
      padding: '0 60px',
      alignItems: 'flex-start',
      width: 'max-content'
    }
  }, order.map(k => /*#__PURE__*/React.createElement(DCArtboardFrame, {
    key: k,
    sectionId: sid,
    artboard: byId[k],
    order: order,
    label: (sec.labels || {})[k] ?? byId[k].props.label,
    onRename: v => ctx && ctx.patchSection(sid, x => ({
      labels: {
        ...x.labels,
        [k]: v
      }
    })),
    onReorder: next => ctx && ctx.patchSection(sid, {
      order: next
    }),
    onDelete: () => ctx && ctx.patchSection(sid, x => ({
      hidden: [...(x.srcKey === srcKey ? x.hidden || [] : []), k],
      srcKey
    })),
    onFocus: () => ctx && ctx.setFocus(`${sid}/${k}`)
  }))), rest);
}

// DCArtboard — marker; rendered by DCArtboardFrame via DCSection.
function DCArtboard() {
  return null;
}
function DCArtboardFrame({
  sectionId,
  artboard,
  label,
  order,
  onRename,
  onReorder,
  onFocus,
  onDelete
}) {
  const {
    id: rawId,
    label: rawLabel,
    width = 260,
    height = 480,
    children,
    style = {}
  } = artboard.props;
  const id = rawId ?? rawLabel;
  const ref = React.useRef(null);
  const delRef = React.useRef(null);
  const [confirming, setConfirming] = React.useState(false);

  // Two-click delete: first click arms the button (turns into an inline
  // "Delete?" pill), second click commits. Any pointerdown outside the
  // button disarms.
  React.useEffect(() => {
    if (!confirming) return;
    const off = e => {
      if (!delRef.current || !delRef.current.contains(e.target)) setConfirming(false);
    };
    document.addEventListener('pointerdown', off, true);
    return () => document.removeEventListener('pointerdown', off, true);
  }, [confirming]);

  // Live drag-reorder: dragged card sticks to cursor; siblings slide into
  // their would-be slots in real time via transforms. DOM order only
  // changes on drop.
  const onGripDown = e => {
    e.preventDefault();
    e.stopPropagation();
    const me = ref.current;
    // translateX is applied in local (pre-scale) space but pointer deltas and
    // getBoundingClientRect().left are screen-space — divide by the viewport's
    // current scale so the dragged card tracks the cursor at any zoom level.
    const scale = me.getBoundingClientRect().width / me.offsetWidth || 1;
    const peers = Array.from(document.querySelectorAll(`[data-dc-section="${sectionId}"] [data-dc-slot]`));
    const homes = peers.map(el => ({
      el,
      id: el.dataset.dcSlot,
      x: el.getBoundingClientRect().left
    }));
    const slotXs = homes.map(h => h.x);
    const startIdx = order.indexOf(id);
    const startX = e.clientX;
    let liveOrder = order.slice();
    me.classList.add('dc-dragging');
    const layout = () => {
      for (const h of homes) {
        if (h.id === id) continue;
        const slot = liveOrder.indexOf(h.id);
        h.el.style.transform = `translateX(${(slotXs[slot] - h.x) / scale}px)`;
      }
    };
    const move = ev => {
      const dx = ev.clientX - startX;
      me.style.transform = `translateX(${dx / scale}px)`;
      const cur = homes[startIdx].x + dx;
      let nearest = 0,
        best = Infinity;
      for (let i = 0; i < slotXs.length; i++) {
        const d = Math.abs(slotXs[i] - cur);
        if (d < best) {
          best = d;
          nearest = i;
        }
      }
      if (liveOrder.indexOf(id) !== nearest) {
        liveOrder = order.filter(k => k !== id);
        liveOrder.splice(nearest, 0, id);
        layout();
      }
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      const finalSlot = liveOrder.indexOf(id);
      me.classList.remove('dc-dragging');
      me.style.transform = `translateX(${(slotXs[finalSlot] - homes[startIdx].x) / scale}px)`;
      // After the settle transition, kill transitions + clear transforms +
      // commit the reorder in the same frame so there's no visual snap-back.
      setTimeout(() => {
        for (const h of homes) {
          h.el.style.transition = 'none';
          h.el.style.transform = '';
        }
        if (liveOrder.join('|') !== order.join('|')) onReorder(liveOrder);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          for (const h of homes) h.el.style.transition = '';
        }));
      }, 180);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    "data-dc-slot": id,
    style: {
      position: 'relative',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-header",
    style: {
      color: DC.label
    },
    onPointerDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-labelrow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-grip",
    onPointerDown: onGripDown,
    title: "Drag to reorder"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "13",
    viewBox: "0 0 9 13",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "2",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "2",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "6.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "6.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "11",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "11",
    r: "1.1"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dc-labeltext",
    onClick: onFocus,
    title: "Click to focus"
  }, /*#__PURE__*/React.createElement(DCEditable, {
    value: label,
    onChange: onRename,
    onClick: e => e.stopPropagation(),
    style: {
      fontSize: 15,
      fontWeight: 500,
      color: DC.label,
      lineHeight: 1
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dc-btns"
  }, /*#__PURE__*/React.createElement("button", {
    ref: delRef,
    className: 'dc-delete' + (confirming ? ' dc-confirm' : ''),
    onClick: () => {
      if (confirming) onDelete();else setConfirming(true);
    },
    title: confirming ? 'Click again to delete' : 'Delete'
  }, confirming ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 3.5h8M4.5 3.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M3 3.5v6a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-6"
  })), "Delete?") : /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 3.5h8M4.5 3.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M3 3.5v6a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-6M5 5.5v3M7 5.5v3"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "dc-expand",
    onClick: onFocus,
    title: "Focus"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 1h4v4M5 11H1V7M11 1L7.5 4.5M1 11l3.5-3.5"
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "dc-card",
    style: {
      borderRadius: 2,
      boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06)',
      overflow: 'hidden',
      width,
      height,
      background: '#fff',
      ...style
    }
  }, children || /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#bbb',
      fontSize: 13,
      fontFamily: DC.font
    }
  }, id)));
}

// Inline rename — commits on blur or Enter.
function DCEditable({
  value,
  onChange,
  style,
  tag = 'span',
  onClick
}) {
  const T = tag;
  return /*#__PURE__*/React.createElement(T, {
    className: "dc-editable",
    contentEditable: true,
    suppressContentEditableWarning: true,
    onClick: onClick,
    onPointerDown: e => e.stopPropagation(),
    onBlur: e => onChange && onChange(e.currentTarget.textContent),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
    style: style
  }, value);
}

// ─────────────────────────────────────────────────────────────
// Focus mode — overlay one artboard; ←/→ within section, ↑/↓ across
// sections, Esc or backdrop click to exit.
// ─────────────────────────────────────────────────────────────
function DCFocusOverlay({
  entry,
  sectionMeta,
  sectionOrder
}) {
  const ctx = React.useContext(DCCtx);
  const {
    sectionId,
    artboard
  } = entry;
  const sec = ctx.section(sectionId);
  const meta = sectionMeta[sectionId];
  const peers = meta.slotIds;
  const aid = artboard.props.id ?? artboard.props.label;
  const idx = peers.indexOf(aid);
  const secIdx = sectionOrder.indexOf(sectionId);
  const go = d => {
    const n = peers[(idx + d + peers.length) % peers.length];
    if (n) ctx.setFocus(`${sectionId}/${n}`);
  };
  const goSection = d => {
    // Sections whose artboards are all deleted have slotIds:[] — step past
    // them to the next non-empty section so ↑/↓ doesn't dead-end.
    const n = sectionOrder.length;
    for (let i = 1; i < n; i++) {
      const ns = sectionOrder[((secIdx + d * i) % n + n) % n];
      const first = sectionMeta[ns] && sectionMeta[ns].slotIds[0];
      if (first) {
        ctx.setFocus(`${ns}/${first}`);
        return;
      }
    }
  };
  React.useEffect(() => {
    const k = e => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        goSection(-1);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goSection(1);
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });
  const {
    width = 260,
    height = 480,
    children
  } = artboard.props;
  const [vp, setVp] = React.useState({
    w: window.innerWidth,
    h: window.innerHeight
  });
  React.useEffect(() => {
    const r = () => setVp({
      w: window.innerWidth,
      h: window.innerHeight
    });
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  const scale = Math.max(0.1, Math.min((vp.w - 200) / width, (vp.h - 260) / height, 2));
  const [ddOpen, setDd] = React.useState(false);
  const Arrow = ({
    dir,
    onClick
  }) => /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onClick();
    },
    style: {
      position: 'absolute',
      top: '50%',
      [dir]: 28,
      transform: 'translateY(-50%)',
      border: 'none',
      background: 'rgba(255,255,255,.08)',
      color: 'rgba(255,255,255,.9)',
      width: 44,
      height: 44,
      borderRadius: 22,
      fontSize: 18,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background .15s'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(255,255,255,.18)',
    onMouseLeave: e => e.currentTarget.style.background = 'rgba(255,255,255,.08)'
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 18 18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: dir === 'left' ? 'M11 3L5 9l6 6' : 'M7 3l6 6-6 6'
  })));

  // Portal to body so position:fixed is the real viewport regardless of any
  // transform on DesignCanvas's ancestors (including the canvas zoom itself).
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    onClick: () => ctx.setFocus(null),
    onWheel: e => e.preventDefault(),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(24,20,16,.6)',
      backdropFilter: 'blur(14px)',
      fontFamily: DC.font,
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 72,
      display: 'flex',
      alignItems: 'flex-start',
      padding: '16px 20px 0',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDd(o => !o),
    style: {
      border: 'none',
      background: 'transparent',
      color: '#fff',
      cursor: 'pointer',
      padding: '6px 8px',
      borderRadius: 6,
      textAlign: 'left',
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 600,
      letterSpacing: -0.3
    }
  }, meta.title), /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 11 11",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    style: {
      opacity: .7
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 4l3.5 3.5L9 4"
  }))), meta.subtitle && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 13,
      opacity: .6,
      fontWeight: 400,
      marginTop: 2
    }
  }, meta.subtitle)), ddOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '100%',
      left: 0,
      marginTop: 4,
      background: '#2a251f',
      borderRadius: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      padding: 4,
      minWidth: 200,
      zIndex: 10
    }
  }, sectionOrder.filter(sid => sectionMeta[sid].slotIds.length).map(sid => /*#__PURE__*/React.createElement("button", {
    key: sid,
    onClick: () => {
      setDd(false);
      const f = sectionMeta[sid].slotIds[0];
      if (f) ctx.setFocus(`${sid}/${f}`);
    },
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      border: 'none',
      cursor: 'pointer',
      background: sid === sectionId ? 'rgba(255,255,255,.1)' : 'transparent',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: 5,
      fontSize: 14,
      fontWeight: sid === sectionId ? 600 : 400,
      fontFamily: 'inherit'
    }
  }, sectionMeta[sid].title)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => ctx.setFocus(null),
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(255,255,255,.12)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent',
    style: {
      border: 'none',
      background: 'transparent',
      color: 'rgba(255,255,255,.7)',
      width: 32,
      height: 32,
      borderRadius: 16,
      fontSize: 20,
      cursor: 'pointer',
      lineHeight: 1,
      transition: 'background .12s'
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 64,
      bottom: 56,
      left: 100,
      right: 100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: width * scale,
      height: height * scale,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      background: '#fff',
      borderRadius: 2,
      overflow: 'hidden',
      boxShadow: '0 20px 80px rgba(0,0,0,.4)'
    }
  }, children || /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#bbb'
    }
  }, aid))), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      fontSize: 14,
      fontWeight: 500,
      opacity: .85,
      textAlign: 'center'
    }
  }, (sec.labels || {})[aid] ?? artboard.props.label, /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: .5,
      marginLeft: 10,
      fontVariantNumeric: 'tabular-nums'
    }
  }, idx + 1, " / ", peers.length))), /*#__PURE__*/React.createElement(Arrow, {
    dir: "left",
    onClick: () => go(-1)
  }), /*#__PURE__*/React.createElement(Arrow, {
    dir: "right",
    onClick: () => go(1)
  }), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 8
    }
  }, peers.map((p, i) => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => ctx.setFocus(`${sectionId}/${p}`),
    style: {
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      width: 6,
      height: 6,
      borderRadius: 3,
      background: i === idx ? '#fff' : 'rgba(255,255,255,.3)'
    }
  })))), document.body);
}

// ─────────────────────────────────────────────────────────────
// Post-it — absolute-positioned sticky note
// ─────────────────────────────────────────────────────────────
function DCPostIt({
  children,
  top,
  left,
  right,
  bottom,
  rotate = -2,
  width = 180
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      width,
      background: DC.postitBg,
      padding: '14px 16px',
      fontFamily: '"Comic Sans MS", "Marker Felt", "Segoe Print", cursive',
      fontSize: 14,
      lineHeight: 1.4,
      color: DC.postitText,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      transform: `rotate(${rotate}deg)`,
      zIndex: 5
    }
  }, children);
}
Object.assign(window, {
  DesignCanvas,
  DCSection,
  DCArtboard,
  DCPostIt
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dgo/design-canvas.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dgo/tweaks-panel.jsx
try { (() => {
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;width:100%;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-noncommentable": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;

  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}
function TweakColor({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
    type: "color",
    className: "twk-swatch",
    value: value,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dgo/tweaks-panel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web/Components.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// NITDA Web UI Kit — shared components
// Globally exports React components on `window`.

const {
  useState
} = React;

// ============================================================
// Federal credit bar
// ============================================================
function FederalBar() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--nitda-deep-green-deep)",
      color: "rgba(255,255,255,0.85)",
      fontFamily: "Verdana, sans-serif",
      fontSize: 11,
      letterSpacing: "0.06em",
      padding: "6px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: "0 auto",
      padding: "0 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", null, "FEDERAL REPUBLIC OF NIGERIA \xB7 MINISTRY OF COMMUNICATIONS AND DIGITAL ECONOMY"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "rgba(255,255,255,0.85)",
      textDecoration: "none"
    }
  }, "Contact"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "rgba(255,255,255,0.85)",
      textDecoration: "none"
    }
  }, "Sitemap"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "rgba(255,255,255,0.85)",
      textDecoration: "none"
    }
  }, "FAQ"))));
}

// ============================================================
// Header / navigation
// ============================================================
function Header({
  activePage,
  onNavigate
}) {
  const items = ["Home", "About", "Services", "News", "Publications", "Contact"];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      background: "#fff",
      borderBottom: "1px solid var(--border-default)"
    }
  }, /*#__PURE__*/React.createElement(FederalBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: "0 auto",
      padding: "18px 32px",
      display: "flex",
      alignItems: "center",
      gap: 40
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNavigate("Home");
    },
    style: {
      display: "flex",
      alignItems: "center",
      textDecoration: "none"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-horizontal-on-white.jpeg",
    alt: "NITDA",
    style: {
      height: 48
    }
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: 28,
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      fontWeight: 500
    }
  }, items.map(it => /*#__PURE__*/React.createElement("a", {
    key: it,
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNavigate(it);
    },
    style: {
      color: activePage === it ? "var(--nitda-deep-green)" : "var(--nitda-ink-900)",
      textDecoration: "none",
      paddingBottom: 6,
      borderBottom: activePage === it ? "2px solid var(--nitda-smart-green)" : "2px solid transparent",
      transition: "all .15s"
    }
  }, it))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 10,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "nitda-btn nitda-btn-ghost",
    "aria-label": "search"
  }, /*#__PURE__*/React.createElement(SearchIcon, null), " Search"), /*#__PURE__*/React.createElement("button", {
    className: "nitda-btn nitda-btn-primary"
  }, "Sign In"))));
}

// ============================================================
// Buttons
// ============================================================
function Button({
  variant = "primary",
  children,
  onClick,
  ...rest
}) {
  const cls = `nitda-btn nitda-btn-${variant}`;
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls,
    onClick: onClick
  }, rest), children);
}

// ============================================================
// Icons (Lucide-style outline)
// ============================================================
const ICON_BASE = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
function SearchIcon(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, ICON_BASE, props), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m20 20-3.5-3.5"
  }));
}
function ArrowRight(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, ICON_BASE, props), /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14M13 5l7 7-7 7"
  }));
}
function ShieldIcon(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, ICON_BASE, props), /*#__PURE__*/React.createElement("path", {
    d: "M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6z"
  }));
}
function GlobeIcon(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, ICON_BASE, props), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"
  }));
}
function FileIcon(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, ICON_BASE, props), /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 2v6h6"
  }));
}
function CheckIcon(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, ICON_BASE, props), /*#__PURE__*/React.createElement("path", {
    d: "M20 6 9 17l-5-5"
  }));
}
function UsersIcon(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, ICON_BASE, props), /*#__PURE__*/React.createElement("path", {
    d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "7",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
  }));
}
function ServerIcon(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, ICON_BASE, props), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "3",
    width: "20",
    height: "8",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "13",
    width: "20",
    height: "8",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 7h.01M6 17h.01"
  }));
}
function NewspaperIcon(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, ICON_BASE, props), /*#__PURE__*/React.createElement("path", {
    d: "M4 4h13a3 3 0 0 1 3 3v12a2 2 0 0 1-2 2H4z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M20 19V8a2 2 0 0 0-2-2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 8h6M8 12h8M8 16h8"
  }));
}
function CalendarIcon(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({}, ICON_BASE, props), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 2v4M8 2v4M3 10h18"
  }));
}

// ============================================================
// Card
// ============================================================
function Card({
  children,
  accent,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `nitda-card${accent ? " nitda-card-accent" : ""}`,
    style: style
  }, rest), children);
}

// ============================================================
// Service tile
// ============================================================
function ServiceTile({
  icon,
  title,
  body,
  href = "#"
}) {
  return /*#__PURE__*/React.createElement("a", {
    href: href,
    className: "nitda-service",
    onClick: e => e.preventDefault()
  }, /*#__PURE__*/React.createElement("div", {
    className: "nitda-service-icon"
  }, icon), /*#__PURE__*/React.createElement("h3", null, title), /*#__PURE__*/React.createElement("p", null, body), /*#__PURE__*/React.createElement("span", {
    className: "nitda-service-link"
  }, "Learn more ", /*#__PURE__*/React.createElement(ArrowRight, {
    width: 14,
    height: 14
  })));
}

// ============================================================
// Stat
// ============================================================
function Stat({
  value,
  label
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: 48,
      lineHeight: 1,
      color: "var(--nitda-smart-green)",
      letterSpacing: "-0.02em"
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      marginTop: 6,
      color: "rgba(255,255,255,0.85)",
      maxWidth: 220
    }
  }, label));
}

// ============================================================
// Footer
// ============================================================
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: "var(--nitda-deep-green)",
      color: "#fff",
      padding: "56px 0 0",
      marginTop: 64
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: "0 auto",
      padding: "0 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
      gap: 48
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-stacked-on-green.png",
    style: {
      height: 90,
      marginBottom: 16
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      lineHeight: 1.6,
      color: "rgba(255,255,255,0.8)",
      margin: 0
    }
  }, "National Information Technology Development Agency. An agency of the Federal Ministry of Communications and Digital Economy.")), /*#__PURE__*/React.createElement(FooterCol, {
    title: "Services",
    items: [".gov.ng Domain Registration", "IT Project Clearance", "OEM Certification", "Data Protection (NDPR)", "SERVICOM"]
  }), /*#__PURE__*/React.createElement(FooterCol, {
    title: "About",
    items: ["Mandate", "Leadership", "Departments", "Subsidiaries", "Careers"]
  }), /*#__PURE__*/React.createElement(FooterCol, {
    title: "Contact",
    items: ["No. 28, Port Harcourt Crescent", "Off Gimbiya Street, Area 11", "Garki, Abuja, Nigeria", "+234 92 920 263", "info@nitda.gov.ng"]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 48,
      paddingTop: 24,
      paddingBottom: 24,
      borderTop: "1px solid rgba(255,255,255,0.18)",
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "Verdana, sans-serif",
      fontSize: 12,
      color: "rgba(255,255,255,0.7)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 NITDA. All rights reserved."), /*#__PURE__*/React.createElement("span", null, "FEDERAL MINISTRY OF COMMUNICATIONS AND DIGITAL ECONOMY"))));
}
function FooterCol({
  title,
  items
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--nitda-smart-green)",
      marginBottom: 16
    }
  }, title), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: "none",
      padding: 0,
      margin: 0,
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, items.map(it => /*#__PURE__*/React.createElement("li", {
    key: it,
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      color: "rgba(255,255,255,0.85)"
    }
  }, it))));
}
Object.assign(window, {
  FederalBar,
  Header,
  Button,
  Card,
  ServiceTile,
  Stat,
  Footer,
  FooterCol,
  SearchIcon,
  ArrowRight,
  ShieldIcon,
  GlobeIcon,
  FileIcon,
  CheckIcon,
  UsersIcon,
  ServerIcon,
  NewspaperIcon,
  CalendarIcon
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web/Components.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web/Sections.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// NITDA Web UI Kit — page sections (Hero, Services, News, etc.)

const {
  Header,
  Button,
  Card,
  ServiceTile,
  Stat,
  Footer,
  ShieldIcon,
  GlobeIcon,
  FileIcon,
  CheckIcon,
  UsersIcon,
  ServerIcon,
  NewspaperIcon,
  CalendarIcon,
  ArrowRight,
  SearchIcon
} = window;

// ============================================================
// Hero
// ============================================================
function Hero() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: "var(--nitda-deep-green)",
      color: "#fff",
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/symbol-infoweb-mark.png",
    alt: "",
    style: {
      position: "absolute",
      right: -80,
      top: -40,
      height: 540,
      opacity: 0.10,
      filter: "brightness(0) invert(1)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: "0 auto",
      padding: "88px 32px 96px",
      position: "relative",
      zIndex: 1,
      display: "grid",
      gridTemplateColumns: "1.4fr 1fr",
      gap: 64,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "overline",
    style: {
      color: "var(--nitda-smart-green)",
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      marginBottom: 18
    }
  }, "National Information Technology Development Agency"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 800,
      fontSize: 56,
      lineHeight: 1.15,
      letterSpacing: "-0.02em",
      color: "#fff",
      margin: "0 0 24px"
    }
  }, "Empowering Nigeria's", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--nitda-smart-green)"
    }
  }, "digital economy.")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 18,
      lineHeight: 1.6,
      color: "rgba(255,255,255,0.9)",
      maxWidth: 580,
      margin: "0 0 32px"
    }
  }, "We develop, regulate and advise on Nigeria's information technology sector \u2014 from domain governance and project clearance to data protection and digital economy policy."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary-on-green"
  }, "Apply for Services"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost-on-green"
  }, "View Publications"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: 12,
      padding: 28,
      backdropFilter: "blur(2px)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      color: "var(--nitda-smart-green)",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      marginBottom: 12
    }
  }, "Quick Apply"), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 22,
      fontWeight: 600,
      color: "#fff",
      margin: "0 0 16px"
    }
  }, "What can we help you with?"), /*#__PURE__*/React.createElement("select", {
    style: {
      width: "100%",
      padding: "12px 14px",
      border: "1px solid rgba(255,255,255,0.3)",
      background: "rgba(0,0,0,0.2)",
      color: "#fff",
      borderRadius: 8,
      fontFamily: "Verdana, sans-serif",
      fontSize: 14,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("option", null, "Select a service\u2026"), /*#__PURE__*/React.createElement("option", null, ".gov.ng Domain Registration"), /*#__PURE__*/React.createElement("option", null, "IT Project Clearance"), /*#__PURE__*/React.createElement("option", null, "OEM Certification"), /*#__PURE__*/React.createElement("option", null, "NDPR Compliance Filing"), /*#__PURE__*/React.createElement("option", null, "Contractor Registration")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary-on-green",
    style: {
      width: "100%",
      justifyContent: "center"
    }
  }, "Continue ", /*#__PURE__*/React.createElement(ArrowRight, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 11,
      color: "rgba(255,255,255,0.6)",
      marginTop: 12
    }
  }, "All applications are reviewed by the Corporate Services Department."))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid rgba(255,255,255,0.18)",
      background: "var(--nitda-deep-green-deep)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: "0 auto",
      padding: "32px",
      display: "flex",
      gap: 32
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    value: "6,200+",
    label: ".gov.ng domains under stewardship"
  }), /*#__PURE__*/React.createElement(Stat, {
    value: "1,400",
    label: "IT projects cleared since 2019"
  }), /*#__PURE__*/React.createElement(Stat, {
    value: "\u20A64.3T",
    label: "Federal IT spend reviewed in 2025"
  }), /*#__PURE__*/React.createElement(Stat, {
    value: "36",
    label: "States with active digital economy plans"
  }))));
}

// ============================================================
// Services grid
// ============================================================
function ServicesGrid() {
  const services = [{
    icon: /*#__PURE__*/React.createElement(GlobeIcon, {
      width: 24,
      height: 24
    }),
    title: ".gov.ng Domain Registration",
    body: "Register and manage federal and state agency domains on Nigeria's official government namespace."
  }, {
    icon: /*#__PURE__*/React.createElement(FileIcon, {
      width: 24,
      height: 24
    }),
    title: "IT Project Clearance",
    body: "Mandatory clearance for all public-sector IT projects above the threshold prior to procurement."
  }, {
    icon: /*#__PURE__*/React.createElement(CheckIcon, {
      width: 24,
      height: 24
    }),
    title: "OEM Certification & Licensing",
    body: "Certify Original Equipment Manufacturers for participation in federal IT procurement."
  }, {
    icon: /*#__PURE__*/React.createElement(ShieldIcon, {
      width: 24,
      height: 24
    }),
    title: "Data Protection (NDPR)",
    body: "File annual audit reports and obtain compliance certification under the Nigeria Data Protection Regulation."
  }, {
    icon: /*#__PURE__*/React.createElement(UsersIcon, {
      width: 24,
      height: 24
    }),
    title: "Contractor Registration",
    body: "Register IT contractors and service providers eligible to bid on government technology contracts."
  }, {
    icon: /*#__PURE__*/React.createElement(ServerIcon, {
      width: 24,
      height: 24
    }),
    title: "SERVICOM",
    body: "Service compact between the Agency and the public, ensuring efficient and quality service delivery."
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: "var(--bg-default)",
      padding: "80px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: "0 auto",
      padding: "0 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 40,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "overline",
    style: {
      color: "var(--nitda-smart-green)",
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      marginBottom: 12
    }
  }, "What we do"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 40,
      fontWeight: 700,
      lineHeight: 1.1,
      letterSpacing: "-0.02em",
      color: "var(--nitda-deep-green)",
      margin: "0 0 16px"
    }
  }, "Services for government, business and citizens"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 16,
      lineHeight: 1.6,
      color: "var(--fg-muted)",
      margin: 0
    }
  }, "The Agency provides regulatory, advisory and registration services across Nigeria's information technology sector.")), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary"
  }, "View all services ", /*#__PURE__*/React.createElement(ArrowRight, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 20
    }
  }, services.map(s => /*#__PURE__*/React.createElement(ServiceTile, _extends({
    key: s.title
  }, s))))));
}

// ============================================================
// News & publications
// ============================================================
function NewsSection() {
  const news = [{
    tag: "Press Release",
    date: "April 28, 2026",
    title: "NITDA Releases Updated Code of Practice for Interactive Computer Service Platforms",
    body: "The Agency announces revisions to the operating guidelines for online platforms operating within Nigeria, following stakeholder consultations."
  }, {
    tag: "Initiative",
    date: "April 22, 2026",
    title: "Strategic Roadmap for Digital Transformation 2026–2030 Launched",
    body: "Director General presents the four-year roadmap aligning Agency programmes with the Federal Government's digital economy agenda."
  }, {
    tag: "Notice",
    date: "April 15, 2026",
    title: "Public Consultation: Draft National AI Policy",
    body: "NITDA invites comments from industry, academia and the public on the draft National Artificial Intelligence Policy. Submissions close 30 May."
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: "var(--bg-subtle)",
      padding: "80px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: "0 auto",
      padding: "0 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 40,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "overline",
    style: {
      color: "var(--nitda-smart-green)",
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      marginBottom: 12
    }
  }, "Newsroom"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 40,
      fontWeight: 700,
      lineHeight: 1.1,
      letterSpacing: "-0.02em",
      color: "var(--nitda-deep-green)",
      margin: 0
    }
  }, "Latest from the Agency")), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost"
  }, "All news ", /*#__PURE__*/React.createElement(ArrowRight, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.4fr 1fr 1fr",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("article", {
    className: "nitda-news-feature"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nitda-news-image"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/symbol-infoweb-large.jpg",
    alt: ""
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "24px 28px 28px"
    }
  }, /*#__PURE__*/React.createElement(NewsMeta, {
    tag: news[0].tag,
    date: news[0].date
  }), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 24,
      fontWeight: 600,
      lineHeight: 1.25,
      color: "var(--nitda-ink-900)",
      margin: "10px 0 12px"
    }
  }, news[0].title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 14,
      lineHeight: 1.6,
      color: "var(--fg-muted)",
      margin: "0 0 16px"
    }
  }, news[0].body), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "nitda-link"
  }, "Read full release ", /*#__PURE__*/React.createElement(ArrowRight, {
    width: 14,
    height: 14
  })))), news.slice(1).map(n => /*#__PURE__*/React.createElement("article", {
    key: n.title,
    className: "nitda-news"
  }, /*#__PURE__*/React.createElement(NewsMeta, {
    tag: n.tag,
    date: n.date
  }), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 18,
      fontWeight: 600,
      lineHeight: 1.3,
      color: "var(--nitda-ink-900)",
      margin: "10px 0 10px"
    }
  }, n.title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 13,
      lineHeight: 1.6,
      color: "var(--fg-muted)",
      margin: "0 0 14px"
    }
  }, n.body), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "nitda-link"
  }, "Read more ", /*#__PURE__*/React.createElement(ArrowRight, {
    width: 14,
    height: 14
  })))))));
}
function NewsMeta({
  tag,
  date
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      background: "var(--nitda-deep-green-10)",
      color: "var(--nitda-deep-green)",
      padding: "3px 8px",
      borderRadius: 4
    }
  }, tag), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fg-subtle)",
      letterSpacing: 0,
      textTransform: "none",
      fontWeight: 400,
      fontFamily: "Verdana, sans-serif",
      fontSize: 12
    }
  }, date));
}

// ============================================================
// Mandate / About strip
// ============================================================
function MandateStrip() {
  const items = [{
    num: "01",
    title: "Develop",
    body: "Build national IT capacity through strategic programmes, training and infrastructure investment."
  }, {
    num: "02",
    title: "Regulate",
    body: "Issue and enforce standards for IT systems, data protection, and public-sector procurement."
  }, {
    num: "03",
    title: "Advise",
    body: "Provide guidance to the Federal Government and MDAs on IT policy and digital economy strategy."
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: "80px 0",
      background: "var(--bg-default)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: "0 auto",
      padding: "0 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 40,
      maxWidth: 720
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "overline",
    style: {
      color: "var(--nitda-smart-green)",
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      marginBottom: 12
    }
  }, "Our Mandate"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 40,
      fontWeight: 700,
      lineHeight: 1.1,
      letterSpacing: "-0.02em",
      color: "var(--nitda-deep-green)",
      margin: "0 0 16px"
    }
  }, "Three pillars defined by the NITDA Act of 2007")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 24
    }
  }, items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.num,
    style: {
      borderTop: "2px solid var(--nitda-smart-green)",
      paddingTop: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 56,
      fontWeight: 800,
      color: "var(--nitda-deep-green-40)",
      lineHeight: 1,
      marginBottom: 12,
      letterSpacing: "-0.04em"
    }
  }, it.num), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 26,
      fontWeight: 700,
      color: "var(--nitda-deep-green)",
      margin: "0 0 12px"
    }
  }, it.title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 15,
      lineHeight: 1.6,
      color: "var(--fg-muted)",
      margin: 0
    }
  }, it.body))))));
}

// ============================================================
// CTA strip
// ============================================================
function CTAStrip() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: "var(--nitda-ink-100)",
      padding: "64px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: "0 auto",
      padding: "0 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 32,
      fontWeight: 700,
      color: "var(--nitda-deep-green)",
      margin: "0 0 8px",
      letterSpacing: "-0.02em"
    }
  }, "Subscribe to NITDA updates"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Verdana, sans-serif",
      fontSize: 15,
      color: "var(--fg-muted)",
      margin: 0
    }
  }, "Quarterly digest of Agency news, policy notices, and upcoming deadlines.")), /*#__PURE__*/React.createElement("form", {
    style: {
      display: "flex",
      gap: 8
    },
    onSubmit: e => e.preventDefault()
  }, /*#__PURE__*/React.createElement("input", {
    type: "email",
    placeholder: "you@example.gov.ng",
    style: {
      width: 320,
      padding: "12px 14px",
      border: "1px solid var(--border-strong)",
      borderRadius: 8,
      fontFamily: "Verdana, sans-serif",
      fontSize: 14
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Subscribe"))));
}
Object.assign(window, {
  Hero,
  ServicesGrid,
  NewsSection,
  MandateStrip,
  CTAStrip
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web/Sections.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web/WebApp.jsx
try { (() => {
// NITDA Web UI Kit — App
const {
  useState
} = React;
const {
  Header,
  Hero,
  ServicesGrid,
  NewsSection,
  MandateStrip,
  CTAStrip,
  Footer
} = window;
function NitdaWebApp() {
  const [page, setPage] = useState("Home");
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Header, {
    activePage: page,
    onNavigate: setPage
  }), /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement(ServicesGrid, null), /*#__PURE__*/React.createElement(MandateStrip, null), /*#__PURE__*/React.createElement(NewsSection, null), /*#__PURE__*/React.createElement(CTAStrip, null), /*#__PURE__*/React.createElement(Footer, null));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(NitdaWebApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web/WebApp.jsx", error: String((e && e.message) || e) }); }

})();
