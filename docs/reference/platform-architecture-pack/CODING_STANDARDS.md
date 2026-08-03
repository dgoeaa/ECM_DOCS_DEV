# Coding Standards

## 1. JavaScript

- Use ES modules.
- Use `const` by default.
- Use `let` only when reassignment is required.
- Avoid globals.
- Avoid inline event attributes such as `onclick="..."`.
- Prefer `addEventListener`.
- Keep functions small and purposeful.
- Return consistent result objects from validators and API wrappers.

## 2. Imports

Allowed:

```js
import { callFlow } from "../../core/api/flow-client.js";
```

Avoid circular imports.

Do not import internals of another module.

## 3. DOM Updates

Preferred:

```js
const el = document.createElement("div");
el.textContent = value;
```

Use `innerHTML` only with controlled templates. Never inject unsanitized user data using `innerHTML`.

## 4. CSS

- Use shared tokens.
- Keep module-specific styling inside module `styles.css`.
- Promote reusable styles to shared styles only after reuse is proven.
- Avoid excessive global selectors.

## 5. Naming

Files:

```text
kebab-case.js
kebab-case.css
```

Functions:

```text
camelCase
```

Constants:

```text
UPPER_SNAKE_CASE
```

Modules:

```text
kebab-case-folder-name
```

## 6. Error Handling

Every async flow call must handle:

- success
- validation error
- network error
- timeout
- unexpected response

## 7. Logging

Use platform logger. Do not scatter uncontrolled `console.log` in production code.

## 8. Accessibility Baseline

- Buttons must be buttons.
- Inputs must have labels.
- Modals must be keyboard-aware where practical.
- Text contrast must be readable.
- Do not rely on color alone for status.
