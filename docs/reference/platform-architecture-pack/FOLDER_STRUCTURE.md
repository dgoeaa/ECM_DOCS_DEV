# Folder Structure

## Root

```text
platform/
├── index.html
├── manifest.json
├── service-worker.js
├── config/
├── shell/
├── core/
├── shared/
├── modules/
└── tools/
```

## Complete Structure

```text
platform/
├── index.html
├── manifest.json
├── service-worker.js
│
├── config/
│   ├── app.config.js
│   ├── flows.config.js
│   ├── modules.config.js
│   ├── routes.config.js
│   └── security.config.js
│
├── shell/
│   ├── shell.js
│   ├── layout.js
│   ├── navigation.js
│   ├── module-loader.js
│   ├── permissions.js
│   └── error-boundary.js
│
├── core/
│   ├── api/
│   │   ├── flow-client.js
│   │   ├── request-builder.js
│   │   ├── response-normalizer.js
│   │   └── retry-policy.js
│   ├── auth/
│   │   ├── identity.js
│   │   ├── session.js
│   │   └── access-policy.js
│   ├── events/
│   │   ├── event-bus.js
│   │   ├── events.constants.js
│   │   └── subscriptions.js
│   ├── router/
│   │   ├── router.js
│   │   ├── guards.js
│   │   └── route-registry.js
│   ├── state/
│   │   ├── store.js
│   │   ├── actions.js
│   │   ├── selectors.js
│   │   └── persistence.js
│   └── utils/
│       ├── dom.js
│       ├── dates.js
│       ├── ids.js
│       ├── logger.js
│       ├── sanitizer.js
│       └── errors.js
│
├── shared/
│   ├── components/
│   │   ├── button.js
│   │   ├── modal.js
│   │   ├── table.js
│   │   ├── form-field.js
│   │   ├── toast.js
│   │   └── loading.js
│   ├── assets/
│   │   ├── icons/
│   │   ├── images/
│   │   └── fonts/
│   ├── styles/
│   │   ├── reset.css
│   │   ├── tokens.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   └── themes.css
│   ├── hooks/
│   │   ├── use-state.js
│   │   ├── use-form.js
│   │   └── use-flow.js
│   ├── validators/
│   │   ├── required.js
│   │   ├── schema.js
│   │   └── business-rules.js
│   └── transformers/
│       ├── flow-payloads.js
│       ├── legacy-spa-adapter.js
│       └── view-models.js
│
├── modules/
│   ├── _template/
│   │   ├── module.manifest.js
│   │   ├── index.js
│   │   ├── routes.js
│   │   ├── state.js
│   │   ├── api.js
│   │   ├── components/
│   │   ├── views/
│   │   ├── validators/
│   │   ├── transformers/
│   │   └── styles.css
│   └── legacy-imports/
│       └── converted-spa-name/
│           ├── module.manifest.js
│           ├── index.js
│           ├── routes.js
│           ├── state.js
│           ├── api.js
│           ├── components/
│           ├── views/
│           ├── validators/
│           ├── transformers/
│           └── compatibility-layer.js
│
└── tools/
    ├── convert-spa-checklist.md
    ├── module-contract.md
    ├── flow-contract.md
    └── release-checklist.md
```

## Android/Termux Target Paths

Preferred Android shared storage root:

```text
/storage/emulated/0/platform
/storage/emulated/0/outputs/platform-architecture
```

Termux mapped equivalent:

```text
~/storage/shared/platform
~/storage/shared/outputs/platform-architecture
```
