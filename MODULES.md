# MachineCare Domain Modules Guide

## Bounded Contexts

MachineCare organizes business logic into 8 distinct domain modules:

| Module | Purpose | Key Entities |
| :--- | :--- | :--- |
| **`assets`** | Asset registry, health condition, and hierarchy | `AssetEntity`, `MeterReading` |
| **`maintenance`** | Corrective & preventive work orders, PM schedules | `WorkOrderEntity`, `PMScheduleEntity` |
| **`production`** | Manufacturing orders, line downtime, and OEE | `ProductionOrderEntity`, `DowntimeEventEntity` |
| **`inventory`** | Spare parts stock, material requests, reorder points | `PartEntity`, `MaterialRequestEntity` |
| **`fleet`** | Vehicle fleet, drivers, trips, fuel, and tyres | `VehicleEntity`, `TripEntity` |
| **`safety`** | HSE incident reporting, Risk Assessments, Permits to Work | `IncidentReportEntity`, `PermitToWorkEntity` |
| **`workshop`** | Commercial garage jobs, mechanics, estimates, invoices | `JobEntity`, `InvoiceEntity` |
| **`connected_data`** | IoT telemetry ingestion, sensor alarms, threshold checks | `TelemetryDataPoint` |

---

## Inter-Module Communication Rules

1. **Service Interfaces Over SQL Queries:**
   - When the **Maintenance** module needs to verify part availability, it must call:
     ```python
     inventory_service.check_part_availability(organization_id, part_id, qty)
     ```
   - Maintenance **must not** query or update inventory tables directly.
2. **Asynchronous Events:**
   - Domain state transitions (e.g. Work Order completed, Low Stock detected) trigger Workflow events routed by the Platform layer.
3. **Frontend Alignment:**
   - Module interfaces in `src/modules/<domain>/index.ts` define public TypeScript contracts consumed across the frontend application.
