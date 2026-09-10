# MachineCare Extension Framework Guide

## Why Extensions?
Enterprise customers often require custom business calculations, specialized regulatory forms, or industry-specific telemetry (e.g. mining haul-cycle metrics, gold mill vibration models).

Instead of creating customer-specific codebase forks, developers package these capabilities into **Extensions** inside `backend/extensions/` and mount points via `src/platform/extensions/`.

---

## Extension Architecture

1. **Developer-Controlled:**
   - Extensions are developed by the engineering team and committed to Git.
   - Customers never upload arbitrary executable code directly.
2. **Registration:**
   ```python
   from backend.platform.extensions import ExtensionPackage, ExtensionRegistry
   from backend.extensions.xyz_mining import xyz_mining_extension

   registry = ExtensionRegistry()
   registry.register_package(xyz_mining_extension)
   ```
3. **Tenant Activation:**
   ```python
   # Explicitly activated for an organization:
   registry.enable_for_organization("org_xyz", "xyz_mining")
   ```
4. **Runtime Execution:**
   - Standard organizations do not execute extension hooks or render extension slots.
   - Frontend UI wraps custom extension components inside `<ExtensionSlot extensionKey="xyz_mining">`.
