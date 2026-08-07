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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

  /* Every `backend` label must name a real endpoint.
   *
   * `scan-deposit` declared `SCAN_UPLOAD.required` — a key that exists nowhere in the
   * endpoint registry; the endpoint is SCAN_INTAKE. Nothing failed at runtime, because
   * core/scan-intake-service.js resolves SCAN_INTAKE for itself and never reads this
   * label. The cost was to anyone reading the governance config to decide which flows to
   * build: docs/deployment/FLOW-BUILD-PLAN.md is generated from exactly this table, and a
   * phantom key there sends someone off to build a flow the client will never call.
   *
   * `none` is a legitimate sentinel — the eight client-only actions declare it. */
  const ownership = (await import("../config/action-ownership.config.js")).ActionOwnership || {};
  const { EndpointContracts, EndpointUrls } = await import("../config/endpoints.config.js");
  const known = new Set([...Object.keys(EndpointContracts), ...Object.keys(EndpointUrls), "none"]);
  const phantom = Object.entries(ownership)
    .filter(([, v]) => v?.backend)
    .map(([action, v]) => [action, String(v.backend).split(".")[0]])
    .filter(([, key]) => !known.has(key));
  check("every declared backend names a real endpoint key",
    phantom.length === 0,
    phantom.map(([a, k]) => `${a} → ${k}`).join(", "));
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

  // 26 since step 7 added scan-intake (channel C). It is a HIDDEN technical route under
  // Intake & Assignment, so the visible-workspace count is deliberately unchanged.
  // 29 since D6(b) brought briefs, meetings and projects across from the ECM Activity
  // Hub. All three are HIDDEN technical routes, so the visible-workspace count is unchanged.
  check("29 routes are declared", declared.length === 29, `got ${declared.length}`);
  check("9 visible workspaces", VisibleWorkspaces.length === 9, `got ${VisibleWorkspaces.length}`);
}

/* ═══════════════ PROVISIONING PARITY ═══════════════ */
group("Provisioning parity — config/platform-provisioning.config.js");
{
  /* The activation manifest is what core/platform-provisioner.js validates at boot and
     modules/diagnostics.js renders as provisioning health. It had drifted five routes
     behind the router: briefs, meetings, projects (D6(b)), scan-intake and
     ecm-erp-charter had no entry, so `validate()` enumerated 24 modules, computed `ok`
     over those 24 and returned true while the platform served 29. A module that was never
     provisioned could not make the report false — the failure mode is not a broken
     workspace, it is a readiness surface that cannot see what it is missing. */
  const { PlatformProvisioning } = await import("../config/platform-provisioning.config.js");
  const { Routes } = await import("../config/routes.config.js");
  const { ActionOwnership } = await import("../config/action-ownership.config.js");

  const routeIds = Routes.map(r => r.path);
  const provisioned = Object.keys(PlatformProvisioning);

  const unprovisioned = routeIds.filter(id => !provisioned.includes(id));
  check("every declared route has a provisioning entry",
    unprovisioned.length === 0, unprovisioned.join(", "));

  const phantom = provisioned.filter(id => !routeIds.includes(id));
  check("every provisioning entry has a declared route",
    phantom.length === 0, phantom.join(", "));

  /* NEGATIVE CONTROL for the `readOnly` escape hatch. A workspace may declare no actions
     only when it says it is read-only; otherwise an empty action list is indistinguishable
     from a module whose actions were lost, and ActionRuntime.canRun() would refuse every
     one of them at the desk while provisioning health stayed green. */
  const silentlyActionless = Object.entries(PlatformProvisioning)
    .filter(([, s]) => !s.readOnly && (s.actions || []).length === 0)
    .map(([m]) => m);
  check("no workspace declares an empty action list without declaring itself read-only",
    silentlyActionless.length === 0, silentlyActionless.join(", "));

  const readOnlyWithActions = Object.entries(PlatformProvisioning)
    .filter(([, s]) => s.readOnly && (s.actions || []).length > 0)
    .map(([m]) => m);
  check("a read-only workspace declares no actions",
    readOnlyWithActions.length === 0, readOnlyWithActions.join(", "));

  /* ActionRuntime.canRun() gates on this list, so a call site naming an action the
     manifest does not carry throws "Action X is not enabled for Y" at the moment a user
     presses the button — the one place the failure is most expensive and least
     diagnosable. Read from the module sources rather than asserted from memory.

     Note that two vocabularies coexist by design and are NOT interchangeable:
     config/action-ownership.config.js names governance actions (`bulk-assign`), while this
     manifest names what a workspace offers (`submit-bulk`). They overlap where a workspace
     surfaces its governed action directly. Only the ActionRuntime path is checkable
     mechanically, because only it resolves a name against this list at runtime. */
  const moduleSources = fs.readdirSync(path.join(ROOT, "modules"))
    .filter(f => f.endsWith(".js"))
    .map(f => fs.readFileSync(path.join(ROOT, "modules", f), "utf8"))
    .join("\n");
  const runCalls = [...moduleSources.matchAll(/ActionRuntime\.run\(\s*'([^']+)'\s*,\s*'([^']+)'/g)]
    .map(m => ({ module: m[1], action: m[2] }));
  const unrunnable = runCalls
    .filter(c => !(PlatformProvisioning[c.module]?.actions || []).includes(c.action))
    .map(c => `${c.module}:${c.action}`);
  check(`every ActionRuntime.run() call names a provisioned action (${runCalls.length} call sites)`,
    runCalls.length > 0 && unrunnable.length === 0, unrunnable.join(", "));

  /* Every owner named by the governance config must be a workspace this manifest knows
     about. A governed action owned by a module with no entry is unreachable through
     ActionRuntime and invisible to provisioning health. */
  const unknownOwners = [...new Set(Object.values(ActionOwnership).map(s => s.owner))]
    .filter(owner => !provisioned.includes(owner));
  check("every action owner is a provisioned workspace",
    unknownOwners.length === 0, unknownOwners.join(", "));

  const { PlatformProvisioner } = await import("../core/platform-provisioner.js");
  const report = PlatformProvisioner.validate();
  check("provisioning health enumerates every route",
    report.modules.length === routeIds.length, `${report.modules.length} of ${routeIds.length}`);
  check("every provisioned module reports healthy",
    report.modules.every(m => m.ok),
    report.modules.filter(m => !m.ok).map(m => m.module).join(", "));
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

console.log(`\n${failures.length ? "❌" : "✅"} ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach(f => console.error(`   · ${f}`)); process.exit(1); }
process.exit(0);
