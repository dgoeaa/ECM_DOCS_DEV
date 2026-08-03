# Operations Runbook

## 1. Common Issues

### Module does not appear

Check:

- `modules.config.js` enabled flag.
- Manifest path.
- Import path.
- Browser console error.
- Permission/role configuration.

### Route does not open

Check:

- Route registered in module `routes.js`.
- Route path matches config.
- Hash path is correct.
- Module loader completed.

### Power Automate call fails

Check:

- Flow URL in config.
- HTTP method.
- Request payload envelope.
- Flow trigger schema.
- Flow run history.
- Response action.
- CORS/network restrictions if hosted in browser context.
- Authentication restrictions.

### Data appears malformed

Check:

- Module transformer.
- Shared transformer.
- Flow response shape.
- Response normalizer.

## 2. Rollback

Rollback options:

1. Revert changed module folder.
2. Disable module in `modules.config.js`.
3. Revert flow URL config.
4. Restore previous static file package.

## 3. Debug Mode

Enable only in non-production:

```js
export const AppConfig = {
  enableDebugLogs: true
};
```

## 4. Maintenance Tasks

Weekly or per release:

- Review flow failures.
- Review module errors.
- Update flow registry.
- Update module registry.
- Check duplicated shared logic.
- Confirm no external dependency was introduced.

## 5. Adding a New Flow

1. Create/update Power Automate flow.
2. Apply standard trigger schema.
3. Apply standard response envelope.
4. Register endpoint in `flows.config.js`.
5. Add wrapper in module `api.js`.
6. Test success and failure.
7. Update flow registry.

## 6. Adding a New Module

1. Copy `_template`.
2. Rename folder and manifest.
3. Add routes/views/components.
4. Register in `modules.config.js`.
5. Register flows if needed.
6. Test.
7. Update module registry.
