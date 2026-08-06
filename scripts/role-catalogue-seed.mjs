#!/usr/bin/env node
/**
 * DGO_RoleCatalogue seed rows, derived from config/rbac.config.js.
 *
 *   npm run seed:roles           # write docs/reference/role-catalogue-seed.json
 *   npm run seed:roles -- --check   # fail if the file is stale (CI)
 *
 * WHY THIS IS GENERATED RATHER THAN EDITED.
 *
 * docs/reference/sharepoint-provisioning-spec.json is a verbatim extraction of the
 * provisioning workbook, and its own integrityPolicy promises no summarisation and no
 * truncation. Hand-editing it to correct a value would break exactly the property that
 * makes it worth keeping — it would stop being a record of the workbook.
 *
 * And the workbook is stale. It was extracted before decision D6(b) ported briefs,
 * meetings and projects out of the retired ECM Activity Hub, and before scan-intake
 * existed. Measured against the live RoleRouteAccess:
 *
 *     executive   9 routes in the workbook, 12 in the code   (briefs, meetings, projects)
 *     director   11 routes in the workbook, 15 in the code   (+ scan-intake)
 *     operator   13 routes in the workbook, 16 in the code   (+ scan-intake)
 *
 * Seeding DGO_RoleCatalogue from the workbook would therefore hand three roles a smaller
 * route set than the platform actually grants them, and the mismatch would present as
 * users losing pages they use daily.
 *
 * So the record stays a record, and the seed is derived from the code that actually
 * decides access. `--check` runs in CI, so the two can never drift apart again silently.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/reference/role-catalogue-seed.json');
const CHECK = process.argv.includes('--check');

const { Roles, RoleList, RoleRouteAccess, RolePersonaMap, Permissions } =
  await import('../config/rbac.config.js');
const { AppConfig } = await import('../config/app.config.js');

/**
 * The workbook stamps every role row with a Version. It used the literal 'R11.6-PILOT';
 * deriving it from AppConfig instead means a release bump is visible in the seed rather
 * than requiring somebody to remember this file exists.
 */
const VERSION = `R${AppConfig.version.split('.').slice(0, 2).join('.')}-PILOT`;

/**
 * The three booleans the workbook carries alongside the permission list. They are
 * denormalised views of the permissions — kept because DGO_RoleCatalogue declares them as
 * required Boolean columns, and derived rather than restated so they cannot disagree with
 * the permission array beside them.
 */
const capabilities = permissions => ({
  CanAssignRoles: permissions.includes(Permissions.ROLE_ASSIGN),
  CanManageSettings: permissions.includes(Permissions.SETTINGS_MANAGE),
  CanViewAudit: permissions.includes(Permissions.AUDIT_VIEW),
});

const rows = RoleList.map(role => {
  const permissions = role.permissions || [];
  const routes = RoleRouteAccess[role.id] || [];
  return {
    Title: role.id,
    RoleId: role.id,
    Persona: RolePersonaMap[role.id] || 'general',
    PermissionsJson: JSON.stringify(permissions),
    AllowedRoutesJson: JSON.stringify(routes),
    ...capabilities(permissions),
    Active: true,
    Version: VERSION,
  };
});

const payload = {
  generatedBy: 'scripts/role-catalogue-seed.mjs',
  generatedFrom: 'config/rbac.config.js',
  listTitle: 'DGO_RoleCatalogue',
  keyField: 'RoleId',
  note:
    'Generated. Do not edit by hand — change config/rbac.config.js and re-run ' +
    '`npm run seed:roles`. This supersedes the DGO_RoleCatalogue rows in ' +
    'sharepoint-provisioning-spec.json, which are a verbatim record of a workbook ' +
    'extracted before D6(b) and scan-intake and are therefore three roles short of the ' +
    'routes the platform grants.',
  roleCount: rows.length,
  rows,
};

const rendered = JSON.stringify(payload, null, 2) + '\n';

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== rendered) {
    console.error(
      '\n  ✖  docs/reference/role-catalogue-seed.json is stale.\n' +
      '     config/rbac.config.js has changed since it was generated.\n' +
      '     Run: npm run seed:roles\n'
    );
    process.exit(1);
  }
  console.log(`\n  ✅ role catalogue seed is current — ${rows.length} roles, version ${VERSION}\n`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, rendered);

console.log(`\n  ✅ wrote docs/reference/role-catalogue-seed.json`);
console.log(`     ${rows.length} roles, version ${VERSION}\n`);
for (const r of rows) {
  const perms = JSON.parse(r.PermissionsJson).length;
  const routes = JSON.parse(r.AllowedRoutesJson);
  const shown = routes.includes('*') ? 'all routes' : `${routes.length} routes`;
  console.log(`     ${r.RoleId.padEnd(12)} ${r.Persona.padEnd(10)} ${String(perms).padStart(2)} permissions · ${shown}`);
}
console.log('');
