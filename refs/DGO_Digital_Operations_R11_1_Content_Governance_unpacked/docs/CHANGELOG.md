# Content Governance corrections

- KPIs restricted to dashboard and monitoring modules.
- Duplicate active module titles removed.
- Branded footer added.
- Contextual compact header added.
- Automatic navigation collapse retained.

## Viewport Containment Compliance

- Enforced full application-frame containment across `html`, `body`, `#app`, `dgo-shell`, `.shell`, `.content`, and `main`.
- Footer now remains visible inside the application frame and is no longer discoverable only through page scrolling.
- Body/page scrolling is disabled; scrolling is delegated to contained regions only: navigation, main workspace, table wrappers, detail panes, and modal bodies.
- Main workspace now scrolls independently with horizontal overflow suppressed.
- Forms now collapse responsively using `repeat(auto-fit, minmax(220px, 1fr))`.
- Records, panels, KPI cards, data rows, headings, and text-heavy areas now enforce `min-width:0` and safe word wrapping.
- Activity records now use dense responsive packing via `repeat(auto-fill, minmax(min(100%, 380px), 1fr))`.
- Added table-wrapper containment contract so tables scroll internally instead of breaking the page layout.

