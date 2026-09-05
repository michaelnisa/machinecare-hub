# Canonical MachineCare Data Model

The canonical model decouples MachineCare's internal operations from proprietary ERP database structures.

## Base Entity Attributes

Every canonical entity inherits the following metadata envelope:

```json
{
  "id": "mc_asset_49f012b",
  "organization_id": "org_tz_mining",
  "source_system": "odoo",
  "external_ids": {
    "odoo": "458",
    "sap_business_one": null,
    "dynamics_365": null
  },
  "sync_status": "synced",
  "created_at": "2026-09-05T10:00:00Z",
  "updated_at": "2026-09-05T10:00:00Z",
  "last_synced_at": "2026-09-05T10:05:00Z",
  "metadata": {}
}
```

---

## Canonical Entities

### 1. Asset (Equipment & Machinery)
```json
{
  "id": "mc_asset_101",
  "name": "Cat 336D Hydraulic Excavator",
  "asset_code": "EXC-014",
  "asset_type": "excavator",
  "manufacturer": "Caterpillar",
  "model": "336D L",
  "serial_number": "CAT0336DK70192",
  "commission_date": "2024-03-15",
  "status": "active",
  "location": "North Pit Quarry",
  "operating_hours": 3840.5
}
```

### 2. Part (Master Inventory Item)
```json
{
  "id": "mc_part_201",
  "part_number": "1R-0716",
  "name": "Cat Engine Oil Filter Standard Efficiency",
  "description": "Engine lubrication oil filter element",
  "unit": "PCS",
  "available_quantity": 48.0,
  "reserved_quantity": 4.0,
  "min_reorder_level": 12.0,
  "unit_cost": 45000.0,
  "currency": "TZS",
  "barcode": "085923007161"
}
```

### 3. Inventory Balance
```json
{
  "part_id": "mc_part_201",
  "warehouse_id": "wh_main_spares",
  "available_quantity": 48.0,
  "reserved_quantity": 4.0,
  "on_order_quantity": 24.0,
  "last_updated_at": "2026-09-05T10:00:00Z"
}
```

### 4. Purchase Request (MachineCare -> ERP Outbound)
```json
{
  "id": "mc_pr_501",
  "request_number": "PR-2026-0812",
  "requested_by": "John Doe (Chief Mechanic)",
  "priority": "high",
  "status": "pending",
  "source": "machinecare",
  "currency": "TZS",
  "items": [
    {
      "part_number": "1R-0716",
      "name": "Cat Engine Oil Filter",
      "quantity": 12,
      "unit": "PCS",
      "estimated_cost": 45000.0
    }
  ]
}
```

### 5. Maintenance Cost (Work Order Operational Costing)
```json
{
  "work_order_id": "wo_9021",
  "asset_id": "mc_asset_101",
  "parts_cost": 450000.0,
  "labor_cost": 150000.0,
  "external_cost": 50000.0,
  "total_cost": 650000.0,
  "currency": "TZS",
  "cost_center_id": "cc_mining_heavy",
  "date": "2026-09-05T08:30:00Z"
}
```

### 6. Production Order
```json
{
  "id": "mc_prod_301",
  "order_number": "PO-10092",
  "product_id": "PRD-GOLD-DORE",
  "target_quantity": 10000.0,
  "actual_quantity": 9420.0,
  "scrap_quantity": 120.0,
  "downtime_minutes": 86.0,
  "status": "completed"
}
```
