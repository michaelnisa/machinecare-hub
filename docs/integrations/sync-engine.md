# Synchronization Engine Specification

## 1. Synchronization Flow

```text
ERP Source Record
        ↓
Connector.fetch_*()
        ↓
Field Mapping Engine (Rename, Enum Map, Unit Convert)
        ↓
Canonical Model Envelope
        ↓
External Identity Resolver (Deduplication Check)
        ↓
Conflict Manager (Evaluate diff against MachineCare state)
        ↓
Canonical Store / Database Upsert
        ↓
Audit Log & Record Diffs
```

## 2. Conflict Resolution Strategies

1. **`erp_wins`** (Default): When differences occur, ERP values overwrite MachineCare attributes.
2. **`machinecare_wins`**: MachineCare values take priority; only missing fields are merged.
3. **`newest_wins`**: Modification timestamps (`updated_at`) determine the winning record.
4. **`manual`**: Divergent records are quarantined in the **Error Center** until reviewed by an admin.

## 3. Idempotency & Deduplication

A composite key guarantee prevents duplicate records:
`UNIQUE(organisation_id, source_system, external_entity_type, external_entity_id)`
resolving to an immutable `canonical_entity_id` (e.g. `mc_part_1001`).
