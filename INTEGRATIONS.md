# MachineCare Integration Platform & Data Gateway

## Architecture

```
Third-Party ERP / Legacy DB
             ↓
[Secure Outbound Connection]
             ↓
MachineCare Data Gateway / Connectors
             ↓
Canonical Data Models (Canonical Entities)
             ↓
MachineCare Domain Modules
```

---

## Supported Connectors

1. **Odoo (v19.0+ JSON-2)**: Work orders, inventory parts, purchase requests.
2. **SAP Business One (v10.0 FP2105+ Service Layer)**: Inventory balances, items, production orders.
3. **Microsoft Dynamics 365 Business Central (REST API v2.0)**: Production orders, vendors, purchase orders.
4. **IBM Maximo (MAS 8.11+ OSLC REST)**: Enterprise Asset Management, IoT meters, PM schedules.
5. **Direct SQL Database Connector**: Safe, read-only connectivity to external PostgreSQL, MySQL, or SQL Server replicas.

---

## Canonical Data Models
All inbound and outbound records translate into canonical representations:
- `Asset`, `Part`, `InventoryItem`, `Warehouse`, `WorkOrder`, `ProductionOrder`, `Telemetry`.

## External Identity Management
`ExternalIdentityManager` prevents duplicate records during bidirectional synchronizations by maintaining external-to-canonical identity mappings.
