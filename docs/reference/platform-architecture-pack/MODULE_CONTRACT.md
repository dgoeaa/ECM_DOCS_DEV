# Module Contract

## 1. Purpose

The module contract ensures that every migrated SPA and every new feature can be loaded, routed, mounted, unmounted, secured, and maintained consistently.

## 2. Required Module Structure

```text
modules/module-name/
├── module.manifest.js
├── index.js
├── routes.js
├── state.js
├── api.js
├── components/
├── views/
├── validators/
├── transformers/
└── styles.css
```

## 3. Required Manifest

```js
export const manifest = {
  id: "module-name",
  name: "Human Friendly Module Name",
  version: "1.0.0",
  description: "What this module does",
  routeBase: "/module-name",
  permissions: ["module-name.read"],
  flows: [],
  navigation: {
    label: "Module Name",
    icon: "box",
    order: 100
  }
};
```

## 4. Required Module Export

```js
import { manifest } from "./module.manifest.js";
import { routes } from "./routes.js";

let root = null;
let contextRef = null;

export default {
  ...manifest,
  routes,

  init(context) {
    contextRef = context;
  },

  mount(container, params = {}) {
    root = container;
    root.innerHTML = `<section class="module"><h1>${manifest.name}</h1></section>`;
  },

  unmount() {
    if (root) root.innerHTML = "";
    root = null;
    contextRef = null;
  }
};
```

## 5. Lifecycle Rules

### init(context)

Called once when the module is loaded. Use for:

- Storing platform context.
- Registering module-level services.
- Preparing initial state.

Do not render UI here.

### mount(container, params)

Called when the route becomes active. Use for:

- Rendering views.
- Binding event listeners.
- Loading required data.

### unmount()

Called before leaving the module. Must:

- Clear DOM.
- Remove event listeners.
- Cancel timers.
- Abort in-flight requests where possible.
- Clear temporary references.

## 6. Route Contract

```js
export const routes = [
  {
    path: "/module-name",
    title: "Module Name",
    view: "main",
    permission: "module-name.read"
  }
];
```

## 7. Module API Contract

Each module may expose an `api.js` that wraps flow calls:

```js
import { callFlow } from "../../core/api/flow-client.js";

export function createRecord(data, context) {
  return callFlow("moduleCreateRecord", data, context);
}
```

Modules must not duplicate generic request building logic.

## 8. State Contract

Module state should be local by default:

```js
const state = {
  items: [],
  selectedId: null,
  loading: false,
  error: null
};

export function getModuleState() {
  return structuredClone(state);
}

export function patchModuleState(patch) {
  Object.assign(state, patch);
}
```

## 9. Component Contract

Components must be pure where possible:

```js
export function renderButton({ label, onClick }) {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}
```

## 10. Validation Contract

Validators return a consistent shape:

```js
export function validateInput(data) {
  const errors = [];

  if (!data.name) {
    errors.push({ field: "name", message: "Name is required" });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

## 11. Transformer Contract

Transformers convert UI data to flow data and flow data to UI data:

```js
export function toFlowPayload(form) {
  return {
    name: form.name.trim()
  };
}

export function toViewModel(flowData) {
  return {
    name: flowData.name || ""
  };
}
```

## 12. Submodule Rules

A module may contain submodules when it has multiple major features:

```text
modules/customer-management/
├── submodules/
│   ├── onboarding/
│   ├── records/
│   └── reporting/
```

Submodules must still be owned by the parent module and must not become hidden independent platforms.
