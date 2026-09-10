# MachineCare Developer & Architecture Contribution Guide

## Architectural Standards

### 1. Where Does Code Belong?
- **Core Platform Fundamentals:** `backend/core/` and `src/core/` (Auth, RBAC, Organizations).
- **Business Domain Logic:** `backend/modules/<domain>/` and `src/modules/<domain>/`.
- **Cross-Cutting Capabilities:** `backend/platform/` and `src/platform/` (Custom fields, feature flags, workflows).
- **ERP & Database Connectors:** `backend/integrations/`.
- **Customer Customizations:** `backend/extensions/<extension_name>/` registered via `ExtensionRegistry`.

### 2. Forbidden Anti-Patterns
- **NEVER** write `if (customer == "ABC")` or `if (org_id == "XYZ")`.
- **NEVER** create customer-specific branches or codebase copies.
- **NEVER** query another module's internal database directly from your module service.
- **NEVER** run destructive database commands in migrations.

### 3. Verification Before Submitting
1. Run backend unit tests:
   ```bash
   python3 -m unittest discover backend/tests
   ```
2. Run frontend unit tests:
   ```bash
   npm test -- --run
   ```
3. Run frontend production build:
   ```bash
   npm run build
   ```
