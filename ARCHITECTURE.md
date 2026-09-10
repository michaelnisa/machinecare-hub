# MachineCare Target Enterprise Architecture

## Overview
MachineCare is an Operational Intelligence Platform for industrial enterprises, manufacturing facilities, fleets, workshops, and connected IoT assets.

This architecture enables:
- **One Product & One Codebase**
- **Multiple Configurations**
- **Bounded Domain Modules**
- **Reusable Platform Capabilities**
- **Pluggable ERP & Database Integrations**
- **Dynamic Customer Extensions (Zero Code Forks)**
- **Multi-Tenant Isolation by Design**

---

## Architectural Layers

```
machinecare/
├── backend/
│   ├── core/                  # Fundamentals: Auth, Organizations, Users, Permissions, Configuration
│   ├── modules/               # Bounded Domains: Assets, Maintenance, Production, Inventory, Fleet, Safety, Workshop, Connected Data
│   ├── platform/              # Capabilities: Custom Fields, Workflows, Rules, Dashboards, Reports, Feature Flags, Audit
│   ├── integrations/          # Enterprise Connectors: Odoo, SAP B1, Maximo, Dynamics 365, Database Gateway
│   └── extensions/            # Customer & Industry Extensions: e.g. xyz_mining, abc_manufacturing
│
└── frontend/ (src/)
    ├── core/                  # AuthContext, Permissions RBAC, TenantContext, Layouts, Base API
    ├── modules/               # Domain modules contracts, services, and views
    ├── platform/              # Dynamic feature flags, custom field renderer, extension slots
    └── integrations/          # Supabase cloud schema, types, and client
```

---

## The Golden Rules of MachineCare Architecture

1. **No Customer Forks:** Never create `machinecare_customer_a` or duplicate codebases for different clients.
2. **No Hardcoded Customer Conditionals:** Never write `if (customer == "XYZ")` or `if (organization_id == "ABC")`. Feature capabilities must be enabled via `useFeatureFlags` or the `ExtensionRegistry`.
3. **Strict Layer Hierarchy:**
   - **Core:** Fundamental platform services. Must never depend on business modules.
   - **Modules:** High-cohesion domain packages. Can depend on Core and Platform, but never manipulate another module's internal database directly.
   - **Platform:** Generic cross-cutting capabilities (Custom fields, audit trails, dynamic workflows).
   - **Integrations:** Translate external ERPs/databases into canonical models.
   - **Extensions:** Isolated plug-ins registered at runtime for specific tenant organizations.
4. **Data Preservation:** Zero destructive database operations (`DROP TABLE`, `TRUNCATE`). All migrations are non-breaking and additive.
