#!/usr/bin/env node
/**
 * Governance spine tests.
 *
 * The platform's strongest engineering — action ownership, module boundaries, RBAC,
 * idempotency, the audit log and the receipt/queue chain — had NO test coverage. The smoke
 * suite proves pages render; it proves nothing about whether an unowned action is still
 * refused. A refactor could quietly gut every control here and CI would stay green.
 *
 * These are pure-logic assertions: no browser, no network, no fixtures beyond a minimal
 * localStorage shim.
 *
 * Usage:  node tests/governance.test.mjs
 * Exit:   0 = all assertions hold, 1 = otherwise
 */

let passed = 0;
const failures = [];
const group = n => console.log(`\n── ${n}`);
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failures.push(name + (detail ? ` — ${detail}` : "")); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
}
async function throws(fn) { try { await fn(); return false; } catch { return true; } }

// Minimal browser surface so the runtime modules import under Node.
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
globalThis.window = { DGO_CONFIG: {} };
globalThis.document = undefined;
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = { ...(globalThis.crypto || {}), randomUUID: () => "test-uuid" };
}

/* ═══════════════ ACTION OWNERSHIP ═══════════════ */
group("Action ownership — config/action-ownership.config.js");
{
  const { actionSpec } = await import("../config/action-ownership.config.js");
  const { boundaryFor, ownsAction } = await import("../config/module-boundaries.config.js");

  const spec = actionSpec("approve");
  check("a declared action resolves to a spec", !!spec);
  check("the spec names an owning module", !!spec?.owner, `owner=${spec?.owner}`);
  check("'approve' is owned by the approvals module", spec?.owner === "approvals", `got ${spec?.owner}`);
  check("an undeclared action resolves to nothing", !actionSpec("definitely-not-an-action"));

  check("every module has a declared boundary", ["correspondence", "approvals", "dispatch", "archive"]
    .every(m => !!boundaryFor(m)));
  check("an unknown module has no boundary", !boundaryFor("no-such-module"));
  check("boundaries declare what a module owns", (boundaryFor("approvals")?.owns || []).length > 0);
  check("boundaries declare what a module must NOT own",
    (boundaryFor("approvals")?.mustNotOwn || []).length > 0);
  check("ownsAction agrees with the boundary", ownsAction("dispatch", "send-dispatch") === true);
  check("a module does not own another's action", ownsAction("dispatch", "approve") === false);
}

/* ═══════════════ THE OWNERSHIP GATE ═══════════════ */
group("Ownership enforcement — core/action-authority.js");
{
  const { assertModuleAction } = await import("../core/action-authority.js");

  check("an owned action passes the gate",
    !(await throws(() => assertModuleAction("approvals", "approve"))));
  check("an unknown module is REFUSED",
    await throws(() => assertModuleAction("not-a-module", "approve")));
  check("a foreign action is REFUSED",
    await throws(() => assertModuleAction("dispatch", "approve")));
  check("an undeclared action is REFUSED",
    await throws(() => assertModuleAction("approvals", "totally-made-up-action")));
}

/* ═══════════════ RBAC ═══════════════ */
group("Access control — config/rbac.config.js");
{
  const { Roles, Permissions, canAccess } = await import("../config/rbac.config.js");

  check("six roles are defined", Object.keys(Roles).length === 6, `got ${Object.keys(Roles).length}`);
  check("thirteen permissions are defined", Object.keys(Permissions).length === 13);
  check("systemAdmin holds every permission",
    Roles.systemAdmin.permissions.length === Object.keys(Permissions).length);
  check("viewer holds no permissions", Roles.viewer.permissions.length === 0);

  const active = r => ({ role: r, status: "active" });
  check("systemAdmin may open user-admin", canAccess(active("systemAdmin"), "user-admin") === true);
  check("viewer may NOT open user-admin", canAccess(active("viewer"), "user-admin") === false);
  check("viewer may NOT open settings", canAccess(active("viewer"), "settings") === false);
  check("viewer MAY open reports", canAccess(active("viewer"), "reports") === true);
  check("operator may NOT open user-admin", canAccess(active("operator"), "user-admin") === false);
  check("executive may NOT open settings", canAccess(active("executive"), "settings") === false);
  check("director may open approvals", canAccess(active("director"), "approvals") === true);

  // Status gating: a non-active account is refused regardless of role.
  check("a DISABLED systemAdmin is refused",
    canAccess({ role: "systemAdmin", status: "disabled" }, "home") === false);
  check("an UNREGISTERED systemAdmin is refused",
    canAccess({ role: "systemAdmin", status: "unregistered" }, "home") === false);
}

/* ═══════════════ IDEMPOTENCY ═══════════════ */
group("Idempotency — core/idempotency.js");
{
  const { key, bucket, remember, seen } = await import("../core/idempotency.js");
  const base = { operation: "approve", ref: "REF-1", actor: { email: "A@x.gov" }, payload: { a: 1, b: 2 } };

  const k1 = await key(base);
  const k2 = await key(base);
  check("the same input yields the same key", k1 === k2);
  check("the key carries operation and reference", k1.includes("approve") && k1.includes("REF-1"));
  check("actor email is normalised to lower case", k1.includes("a@x.gov"));

  check("a different payload yields a different key",
    (await key({ ...base, payload: { a: 1, b: 3 } })) !== k1);
  check("a different reference yields a different key",
    (await key({ ...base, ref: "REF-2" })) !== k1);
  check("a different actor yields a different key",
    (await key({ ...base, actor: { email: "B@x.gov" } })) !== k1);

  // Key order must not matter — the digest sorts keys before hashing.
  check("payload key ORDER does not change the digest",
    (await key({ ...base, payload: { b: 2, a: 1 } })) === k1);

  check("the time bucket advances with the window", bucket(1) !== bucket(100000));
  remember("k-test");
  check("a remembered key is seen", seen("k-test") === true);
  check("an unknown key is not seen", seen("k-never") === false);
}

/* ═══════════════ AUDIT LOG ═══════════════ */
group("Audit log — core/audit-log.js");
{
  const { record, byReference, query, snapshot } = await import("../core/audit-log.js");

  const ev = record({ ref: "REF-A", event: "audit:test", actor: { email: "a@x" }, entityType: "task" });
  check("a recorded event is returned", !!ev?.id);
  check("the event is timestamped", !!ev?.at);
  check("the returned event is frozen", Object.isFrozen(ev));

  record({ ref: "REF-A", event: "audit:test-2" });
  record({ ref: "REF-B", event: "audit:other" });
  check("events are indexed by reference", byReference("REF-A").length === 2,
    `got ${byReference("REF-A").length}`);
  check("an unknown reference yields none", byReference("REF-NOPE").length === 0);
  check("events are filterable", query({ event: "audit:other" }).length === 1);
  check("a snapshot exposes the event stream", Array.isArray(snapshot().events));

  // Attempting to mutate a returned record must not corrupt the log.
  const before = byReference("REF-A").length;
  try { byReference("REF-A").push({ forged: true }); } catch { /* frozen — expected */ }
  check("the log cannot be mutated through a returned array", byReference("REF-A").length === before);
}

/* ═══════════════ MODULE BOUNDARY INTEGRITY ═══════════════ */
group("Boundary integrity — cross-config consistency");
{
  const { actionSpec } = await import("../config/action-ownership.config.js");
  const { boundaryFor } = await import("../config/module-boundaries.config.js");
  const { Routes } = await import("../config/routes.config.js");
  const { VisibleWorkspaces, HiddenTechnicalRoutes } = await import("../config/workflow-clarity.config.js");
  const { RoleRouteAccess } = await import("../config/rbac.config.js");

  // Every declared action's owner must be a module with a real boundary.
  const owners = new Set();
  ["approve", "send-dispatch", "acknowledge", "classify", "archive-reference"]
    .forEach(a => { const s = actionSpec(a); if (s?.owner) owners.add(s.owner); });
  check("every sampled action owner has a boundary", [...owners].every(m => !!boundaryFor(m)),
    [...owners].filter(m => !boundaryFor(m)).join(", "));

  // Workflow clarity must account for every declared route.
  const declared = Routes.map(r => r.path);
  const accounted = new Set([...VisibleWorkspaces.map(w => w.route), ...Object.keys(HiddenTechnicalRoutes)]);
  const unaccounted = declared.filter(r => !accounted.has(r));
  check("every route is either a visible workspace or a declared internal route",
    unaccounted.length === 0, unaccounted.join(", "));

  // Every route a role may reach must actually exist.
  const bad = [];
  for (const [role, routes] of Object.entries(RoleRouteAccess)) {
    for (const r of routes) if (r !== "*" && !declared.includes(r)) bad.push(`${role}→${r}`);
  }
  check("RBAC never grants access to a route that does not exist", bad.length === 0, bad.join(", "));

  check("25 routes are declared", declared.length === 25, `got ${declared.length}`);
  check("9 visible workspaces", VisibleWorkspaces.length === 9, `got ${VisibleWorkspaces.length}`);
}

/* ═══════════════ ENDPOINT CONTRACTS ═══════════════ */
group("Endpoint contracts — core/endpoint-registry.js");
{
  const { EndpointRegistry } = await import("../core/endpoint-registry.js");

  const signed = "https://x.powerplatform.com/flow/abc?api-version=1&sp=%2Ftriggers&sv=1.0&sig=SECRETVALUE123456";
  const red = EndpointRegistry.redact(signed);
  check("redact() removes the signature", !red.includes("SECRETVALUE123456"), red);
  check("redact() keeps the URL readable", red.includes("powerplatform.com"));
  check("redact() masks sv as well", !/sv=1\.0/.test(red) || red.includes("***"));
  check("redact() tolerates an empty value", EndpointRegistry.redact("") === "");

  const c = EndpointRegistry.contract("SINGLE_ASSIGNMENT");
  check("a write contract is marked write", c?.write === true);
  check("a write contract is NOT idempotent-by-default", c?.idempotent === false);
  check("a write contract does not auto-retry", c?.retry === 0);
  const ro = EndpointRegistry.contract("FETCH_ALL");
  check("a read contract is marked readOnly", ro?.readOnly === true);
  check("a read contract is retry-safe", ro?.idempotent === true);
  check("an unknown contract resolves to nothing", EndpointRegistry.contract("NOPE") === null);

  const all = EndpointRegistry.describeAll({});
  check("describeAll() reports every contract", all.entries.length === 19, `got ${all.entries.length}`);
  check("describeAll() warns when endpoints are unconfigured",
    all.warnings.some(w => w.code === "endpoint.unconfigured"));
  check("no describeAll() target leaks a raw signature",
    all.entries.every(e => !/sig=[A-Za-z0-9_-]{20,}/.test(e.target || "")));
}

// ── URL sink guard — core/ui.js safeUrl()
//
// esc() stops attribute breakout; it does NOT stop a scheme. Attachment links, preview
// URLs and document links all arrive from Power Automate responses, so every href/src in
// the modules must run through safeUrl(). These cases lock the allow-list in place: the
// tab/newline variants are the ones that defeat a naive `startsWith("javascript:")` test.
console.log("\n── URL sink guard — core/ui.js safeUrl()");
{
  const { safeUrl } = await import("../core/ui.js");
  const ALLOWED = [
    "https://nitda.gov.ng/doc.pdf", "http://x/y", "HTTPS://X/Y",
    "mailto:registry@nitda.gov.ng", "tel:+2347000006483",
    "/reports/x.pdf", "./a.pdf", "../a.pdf", "#/lookup", "report 2024.pdf",
  ];
  const REFUSED = [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)", "java\nscript:alert(1)", "  javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)",
    "file:///etc/passwd", "", null, undefined,
  ];
  for (const u of ALLOWED) check(`safeUrl allows ${JSON.stringify(u)}`, safeUrl(u) === u);
  for (const u of REFUSED) check(`safeUrl refuses ${JSON.stringify(u)}`, safeUrl(u) === "#", String(safeUrl(u)));
  check("safeUrl honours a custom fallback", safeUrl("javascript:x", "about:blank") === "about:blank");
}

// ── Table semantics — every column header must carry scope="col"
//
// A <th> without scope leaves screen-reader users with no column association on a
// 9-column registry table. The shared builder emits it; the hand-rolled tables in the
// modules have to keep pace, so assert across the tree rather than in one place.
console.log("\n── Table semantics — th[scope]");
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const dirs = ["modules", "core", "shared"];
  const offenders = [];
  for (const d of dirs) {
    for (const file of fs.readdirSync(path.join(root, d))) {
      if (!file.endsWith(".js")) continue;
      const rel = `${d}/${file}`;
      const text = fs.readFileSync(path.join(root, d, file), "utf8");
      const bare = text.match(/<th(?=[\s>])(?![^>]*\bscope=)[^>]*>/g);
      if (bare) offenders.push(`${rel} (${bare.length})`);
    }
  }
  check("no <th> is emitted without scope", offenders.length === 0, offenders.join(", "));
}

console.log(`\n${failures.length ? "❌" : "✅"} ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach(f => console.error(`   · ${f}`)); process.exit(1); }
process.exit(0);
