# Release Checklist

## 1. Configuration

- [ ] `app.config.js` has correct environment.
- [ ] `modules.config.js` lists only intended modules.
- [ ] `flows.config.js` contains correct environment endpoints.
- [ ] No development/test endpoints in production.
- [ ] `security.config.js` reflects approved roles.

## 2. Structure

- [ ] Required folders exist.
- [ ] Every module has required files.
- [ ] Every module has a valid manifest.
- [ ] Every module has routes where needed.
- [ ] Every flow used by a module is registered.

## 3. Dependency Policy

- [ ] No external JS libraries.
- [ ] No CSS framework dependency.
- [ ] No CDN dependency.
- [ ] No package manager requirement.
- [ ] No hidden third-party runtime dependency.

## 4. Module Behavior

- [ ] All enabled modules appear in navigation if intended.
- [ ] Disabled modules do not appear.
- [ ] Every route opens correctly.
- [ ] Every module unmounts safely.
- [ ] Forms validate correctly.
- [ ] Errors display cleanly.

## 5. Power Automate

- [ ] Every flow endpoint tested.
- [ ] Every request uses standard envelope.
- [ ] Every response uses standard envelope or is normalized.
- [ ] Flow-side validation exists.
- [ ] Unknown module/action pairs are rejected.
- [ ] requestId is traceable.

## 6. Security

- [ ] No secrets in frontend code.
- [ ] Role-based access checked.
- [ ] Sensitive data not stored unnecessarily.
- [ ] Flow URLs reviewed.
- [ ] Error messages do not expose sensitive internals.

## 7. Migration

- [ ] Migrated SPAs match original baseline behavior.
- [ ] Original SPA backup retained.
- [ ] Shared components extracted where appropriate.
- [ ] Duplicated logic reduced where practical.

## 8. Documentation

- [ ] Module registry updated.
- [ ] Flow registry updated.
- [ ] Architecture decisions updated.
- [ ] Release notes prepared.
- [ ] Known issues documented.

## 9. Final Approval

- [ ] Smoke test passed.
- [ ] Regression test passed.
- [ ] Rollback plan available.
- [ ] Release approved.
