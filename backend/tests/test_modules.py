"""
Unit Tests for MachineCare Business Modules & Inter-Module Boundaries
"""

import unittest
from backend.modules.assets import AssetEntity, MeterReading, AssetService
from backend.modules.inventory import PartEntity, InventoryService
from backend.modules.maintenance import WorkOrderEntity, MaintenanceService
from backend.modules.production import ProductionOrderEntity, DowntimeEventEntity, ProductionService
from backend.modules.fleet import VehicleEntity, TripEntity, FleetService
from backend.modules.safety import IncidentReportEntity, PermitToWorkEntity, SafetyService
from backend.modules.workshop import JobEntity, WorkshopService
from backend.modules.connected_data import TelemetryDataPoint, ConnectedDataService

class TestBusinessModules(unittest.TestCase):
    def test_assets_and_meter_readings(self):
        asset_svc = AssetService()
        asset = AssetEntity(id="ast_1", organization_id="org_1", name="CNC Milling", asset_code="CNC-01")
        asset_svc.save_asset(asset)

        reading = MeterReading(id="mr_1", organization_id="org_1", asset_id="ast_1", reading_value=125.5)
        asset_svc.record_reading(reading)
        
        updated = asset_svc.get_asset("org_1", "ast_1")
        self.assertEqual(updated.operating_hours, 125.5)

    def test_maintenance_inventory_loose_coupling(self):
        """Verify Section 7: Maintenance requests parts via InventoryService interface."""
        asset_svc = AssetService()
        asset_svc.save_asset(AssetEntity(id="ast_10", organization_id="org_1", name="Pump", asset_code="P-01"))

        inv_svc = InventoryService()
        inv_svc.save_part(PartEntity(id="prt_1", organization_id="org_1", part_number="BRG-01", name="Bearing", quantity_on_hand=5))

        maint_svc = MaintenanceService(asset_service=asset_svc, inventory_service=inv_svc)

        # Check part availability via public service
        self.assertTrue(maint_svc.check_spare_parts_available("org_1", "prt_1", 2))
        self.assertFalse(maint_svc.check_spare_parts_available("org_1", "prt_1", 10))

        # Create work order with high cost triggering approval workflow (Section 11)
        wo = WorkOrderEntity(
            id="wo_1",
            organization_id="org_1",
            work_order_number="WO-0001",
            asset_id="ast_10",
            title="Overhaul",
            estimated_cost=6_000_000,
        )
        created = maint_svc.create_work_order(wo)
        self.assertTrue(created.requires_approval)
        self.assertEqual(created.status, "pending_approval")

        # Manager approves
        approved = maint_svc.approve_work_order("wo_1", approved_by_user_id="mgr_99")
        self.assertFalse(approved.requires_approval)
        self.assertEqual(approved.status, "open")

    def test_production_and_oee(self):
        prod_svc = ProductionService()
        oee = prod_svc.calculate_oee(availability=0.90, performance=0.85, quality=0.98)
        self.assertEqual(oee, 74.97)

    def test_fleet_service(self):
        fleet = FleetService()
        fleet.save_vehicle(VehicleEntity(id="veh_1", organization_id="org_1", plate_number="T123ABC", make="Toyota", model="Hilux"))
        
        trip = TripEntity(id="trip_1", organization_id="org_1", vehicle_id="veh_1", driver_name="John Doe", start_odometer=10000)
        fleet.start_trip(trip)
        self.assertEqual(fleet._vehicles["veh_1"].status, "on_trip")

        fleet.complete_trip("trip_1", end_odometer=10150)
        self.assertEqual(fleet._vehicles["veh_1"].status, "available")
        self.assertEqual(fleet._vehicles["veh_1"].current_odometer, 10150)

    def test_safety_ptw(self):
        safety = SafetyService()
        ptw = PermitToWorkEntity(
            id="ptw_1",
            organization_id="org_1",
            permit_number="PTW-001",
            work_order_id="wo_1",
            permit_type="hot_work",
        )
        safety.create_ptw(ptw)
        approved = safety.approve_ptw("ptw_1", approver_id="hse_lead")
        self.assertEqual(approved.status, "approved")

    def test_workshop_invoicing(self):
        ws = WorkshopService()
        job = JobEntity(id="job_1", organization_id="org_1", job_number="JOB-01", customer_name="Acme Corp", vehicle_plate="T999ZZZ", description="Brake replacement")
        ws.create_job(job)
        inv = ws.generate_invoice("job_1", subtotal=100000.0, tax_percent=18.0)
        self.assertEqual(inv.total, 118000.0)
        self.assertEqual(ws._jobs["job_1"].status, "invoiced")

    def test_connected_data_alarms(self):
        cd = ConnectedDataService()
        # Ingest normal temperature
        res1 = cd.ingest_telemetry(TelemetryDataPoint(
            id="dp_1", organization_id="org_1", device_id="dev_1", asset_id="ast_1",
            metric_name="temperature", metric_value=72.0, unit="C"
        ))
        self.assertFalse(res1["alarm_triggered"])

        # Ingest high temperature
        res2 = cd.ingest_telemetry(TelemetryDataPoint(
            id="dp_2", organization_id="org_1", device_id="dev_1", asset_id="ast_1",
            metric_name="temperature", metric_value=98.5, unit="C"
        ))
        self.assertTrue(res2["alarm_triggered"])

if __name__ == "__main__":
    unittest.main()
