export const BrowserCertification = Object.freeze({
  viewports: [320,375,430,600,768,1024,1280,1440,1920],
  contracts: ['no-page-scroll','footer-visible','contained-main-scroll','contained-nav-scroll','contained-pane-scroll','table-internal-scroll','responsive-forms','adaptive-records','keyboard-focus','reduced-motion'],
  priorityRoutes: ['#/home','#/activities','#/bulk-assignment','#/executive','#/user-admin','#/settings','#/diagnostics','#/archive'],
  // Route-scoped live-DOM certification, run at every certified viewport in addition to the
  // generic probes. #/activities carries the Canvas Activities parity surface (record queue,
  // status tabs, filter bar, attachment/PDF preview and the lifecycle actions), so its
  // containment, keyboard and sandboxing guarantees are certified explicitly rather than
  // inferred from the shared layout primitives.
  routeContracts: Object.freeze({
    '#/activities': Object.freeze([
      'no-page-scroll',
      'no-horizontal-scroll',
      'footer-visible',
      'toolbar-not-clipped',
      'source-view-chips-internal-scroll',
      'record-list-owns-scroll',
      'detail-pane-owns-scroll',
      'status-tabs-visible',
      'lifecycle-actions-keyboard-reachable',
      'pdf-preview-sandboxed',
      'focus-ring-visible'
    ])
  })
});
