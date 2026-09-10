# MachineCare Platform Capabilities Guide

The **Platform Layer** (`backend/platform/` & `src/platform/`) provides cross-cutting, reusable operational capabilities available across all business domains.

---

## Capabilities

### 1. Custom Fields (`platform/custom_fields/`)
Allows tenants to attach schema-less fields (e.g. `pit_number`, `calibration_expiry`, `engine_displacement`) to standard entities without altering core database tables.
- **Frontend Renderer:** `<CustomFieldsRenderer fields={fields} values={values} onChange={...} />`
- **Supported Types:** text, number, decimal, boolean, date, datetime, select, multi_select, user, asset, part, file, url.

### 2. Feature Flags & Capabilities (`platform/feature_flags/`)
Replaces hardcoded customer conditionals with dynamic capability gates:
```typescript
const { isFeatureEnabled } = useFeatureFlags();
if (isFeatureEnabled("mining_operations")) { ... }
```

### 3. Workflows & Approvals (`platform/workflows/`)
Configurable trigger-condition-action pipeline:
- High maintenance cost threshold (> 5,000,000 TZS) automatically transitions work orders to `pending_approval` state.

### 4. Business Rules Engine (`platform/rules/`)
Evaluates IF-THEN conditions on runtime entity payloads.

### 5. Tenant Audit Logging (`platform/audit/`)
Maintains an immutable record of state changes across who, what, when, before, and after states.
