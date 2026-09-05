# MachineCare ERP & Business Systems Integration Platform — Architecture

## 1. Executive Summary

MachineCare provides physical operations and operational intelligence for heavy equipment, plant machinery, workshops, and vehicle fleets. Enterprise organizations utilize ERP systems (such as Odoo, SAP Business One, and Microsoft Dynamics 365) as their commercial, financial, and administrative **system of record**.

MachineCare serves as the **operational layer connecting enterprise business systems to the physical world**:

```text
                                 ERP SYSTEM
                    (Financial & Commercial System of Record)
                                      |
                                      v
                                 MACHINECARE
                    (Operational Intelligence & Asset Execution)
                                      |
                     +----------------+----------------+
                     |                                 |
                     v                                 v
                 Machines                            People
                     |
                     v
       IoT / Sensors / PLC / CAN / GPS
```

---

## 2. Core Architectural Principle

To ensure long-term maintainability, scalability, and independence:

* **Strict Isolation**: ERP-specific logic is never embedded directly into Maintenance, Inventory, or Production core modules.
* **Canonical Domain Model**: MachineCare defines and owns its standard canonical schemas (`Asset`, `Part`, `InventoryBalance`, `ProductionOrder`, `PurchaseRequest`, `MaintenanceCost`).
* **Adapter Layer**: Every connector is an adapter translating between ERP protocols and the canonical domain model.
* **Idempotency & External Identities**: External ERP IDs are never used as MachineCare primary keys. Instead, dual-key resolution links `(organization_id, source_system, external_entity_type, external_entity_id)` to MachineCare canonical IDs.

```text
                  MACHINECARE CANONICAL LAYER
                               |
                     ERP INTEGRATION ENGINE
                               |
         +---------------------+---------------------+
         |                     |                     |
    ODOO CONNECTOR        SAP CONNECTOR      DYNAMICS CONNECTOR
   (JSON-2 REST API)     (Service Layer)       (OAuth 2.0 REST)
         |                     |                     |
     Odoo ERP          SAP Business One           D365 BC
```

---

## 3. Directory Structure

```text
backend/
  integrations/
    core/             # Base connector contract, external identity, exception taxonomy
    canonical/        # Standard MachineCare data entities
    credentials/      # AES-256-GCM encrypted vault
    connectors/       # Pluggable ERP connectors (Odoo, SAP B1, Dynamics 365, Registry)
    mappings/         # Field mapping & data transformation engine
    sync/             # Inbound, Outbound & Bidirectional sync engine, conflict resolver
    webhooks/         # Inbound listener & Outbound dispatcher with HMAC signing
    jobs/             # Retry queue with exponential backoff & dead-letter queue
    logs/             # Safe structured audit logger (zero plaintext secrets)
    api/              # REST API layer (/api/v1/integrations)
```

---

## 4. Multi-Tenancy & Security Guarantees

* **Tenant Scoping**: All database tables (`integrations`, `integration_credentials`, `integration_mappings`, `integration_sync_jobs`, `external_identities`) are enforced by PostgreSQL Row-Level Security (RLS) with `organisation_id = get_user_organisation_id()`.
* **Zero Plaintext Secrets**: Credentials (API keys, client secrets, passwords) are encrypted at rest using AES-256-GCM. Secret values are never returned to the frontend.
* **Audit Logging**: All sync runs, credential updates, and mapping adjustments are recorded in `integration_audit_logs`.
