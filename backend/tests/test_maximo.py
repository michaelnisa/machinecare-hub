"""
MachineCare ERP Integration Platform - IBM Maximo EAM Test Suite
Validates Maximo Auth, OSLC client, Canonical Transformations, Meter Reading sync, and Connector execution.
"""

import unittest
import asyncio

from backend.integrations.connectors.maximo.auth import MaximoAuth
from backend.integrations.connectors.maximo.models import MaximoObjectStructures
from backend.integrations.connectors.maximo.mapper import MaximoMapper, get_maximo_default_mappings
from backend.integrations.connectors.maximo.connector import MaximoConnector
from backend.integrations.connectors.registry import ConnectorRegistry
from backend.integrations.canonical.models import MeterReading, WorkOrder, Asset

class TestMaximoAuth(unittest.TestCase):
    def test_api_key_auth(self):
        auth = MaximoAuth(api_key="maximo_test_key_123", site_id="MINE_SITE_01")
        headers = auth.get_headers()
        self.assertEqual(headers["apikey"], "maximo_test_key_123")
        self.assertEqual(headers["Accept"], "application/json")
        self.assertTrue(auth.validate())

    def test_basic_maxauth(self):
        auth = MaximoAuth(username="wilson", password="secret_password_123", site_id="MINE_SITE_01")
        headers = auth.get_headers()
        self.assertIn("maxauth", headers)
        self.assertIn("Authorization", headers)
        self.assertTrue(headers["Authorization"].startswith("Basic "))
        self.assertTrue(auth.validate())

    def test_invalid_auth(self):
        auth = MaximoAuth()
        self.assertFalse(auth.validate())

class TestMaximoMapper(unittest.TestCase):
    def test_maximo_asset_to_canonical(self):
        raw_maximo_asset = {
            "assetnum": "CAT-793D-01",
            "description": "Caterpillar 793D Haul Truck",
            "siteid": "NORTH_PIT",
            "orgid": "EAGLE_MINING",
            "serialnum": "CAT793D-98124",
            "status": "OPERATING",
            "location": "HAUL_ROUTE_A",
            "vendor": "CATERPILLAR",
            "installdate": "2024-01-15T08:00:00Z",
            "totdowntime": 14.5,
            "parent": "FLEET_HAUL_01",
        }

        canonical_asset = MaximoMapper.maximo_asset_to_canonical(raw_maximo_asset, org_id="test_org")
        self.assertEqual(canonical_asset.asset_code, "CAT-793D-01")
        self.assertEqual(canonical_asset.name, "Caterpillar 793D Haul Truck")
        self.assertEqual(canonical_asset.status, "active")
        self.assertEqual(canonical_asset.site_id, "NORTH_PIT")
        self.assertEqual(canonical_asset.parent_asset_id, "FLEET_HAUL_01")
        self.assertEqual(canonical_asset.external_ids["maximo_assetnum"], "CAT-793D-01")

    def test_maximo_wo_to_canonical(self):
        raw_wo = {
            "wonum": "WO-99410",
            "description": "Engine Oil Sampling and Pressure Sensor Check",
            "siteid": "NORTH_PIT",
            "status": "INPRG",
            "worktype": "CBM",
            "assetnum": "CAT-793D-01",
            "location": "HAUL_ROUTE_A",
            "schedstart": "2026-09-05T08:00:00Z",
            "acttotalcost": 840.50,
            "jpnum": "JP-ENGINE-CBM",
        }

        canonical_wo = MaximoMapper.maximo_wo_to_canonical(raw_wo, org_id="test_org")
        self.assertEqual(canonical_wo.work_order_number, "WO-99410")
        self.assertEqual(canonical_wo.status, "in_progress")
        self.assertEqual(canonical_wo.work_type, "CBM")
        self.assertEqual(canonical_wo.total_cost, 840.50)
        self.assertEqual(canonical_wo.job_plan_id, "JP-ENGINE-CBM")

    def test_canonical_meter_to_maximo(self):
        meter = MeterReading(
            id="read_01",
            organization_id="test_org",
            asset_id="maximo_CAT-793D-01",
            meter_name="RUNHOURS",
            reading_value=4820.5,
            reading_date="2026-09-05T10:00:00Z",
            inspector_id="IOT_TELEMETRY_BOX_4",
        )

        payload = MaximoMapper.canonical_meter_to_maximo(meter, site_id="NORTH_PIT", org_id="EAGLE_MINING")
        self.assertEqual(payload["assetnum"], "CAT-793D-01")
        self.assertEqual(payload["metername"], "RUNHOURS")
        self.assertEqual(payload["newreading"], 4820.5)
        self.assertEqual(payload["siteid"], "NORTH_PIT")
        self.assertEqual(payload["orgid"], "EAGLE_MINING")
        self.assertEqual(payload["inspector"], "IOT_TELEMETRY_BOX_4")

class TestMaximoConnector(unittest.TestCase):
    def setUp(self):
        self.config = {
            "base_url": "https://maximo.miningcorp.local",
            "company_identifier": "NORTH_PIT",
            "org_id": "EAGLE_MINING",
        }
        self.credentials = {
            "api_key": "maximo_secret_api_key_449",
        }
        self.connector = MaximoConnector(self.config, self.credentials)

    def test_capabilities(self):
        caps = self.connector.get_capabilities()
        self.assertIn("assets", caps.read)
        self.assertIn("work_orders", caps.read)
        self.assertIn("meter_readings", caps.write)
        self.assertIn("work_orders", caps.write)
        self.assertTrue(caps.supports_webhooks)

    def test_connection_test(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(self.connector.test_connection())
        loop.close()

        self.assertTrue(result.success)
        self.assertEqual(result.status_code, 200)
        self.assertIn("NORTH_PIT", result.company_name)

    def test_fetch_operations(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        assets = loop.run_until_complete(self.connector.fetch_assets(limit=5))
        work_orders = loop.run_until_complete(self.connector.fetch_work_orders(limit=5))
        parts = loop.run_until_complete(self.connector.fetch_parts(limit=5))
        loop.close()

        self.assertGreater(len(assets), 0)
        self.assertEqual(assets[0]["assetnum"], "CAT-793D-01")
        self.assertGreater(len(work_orders), 0)
        self.assertEqual(work_orders[0]["wonum"], "WO-104921")
        self.assertGreater(len(parts), 0)

    def test_post_meter_reading(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        res = loop.run_until_complete(self.connector.post_meter_reading({
            "assetnum": "CAT-793D-01",
            "metername": "ENG_HOURS",
            "newreading": 5200.0,
            "siteid": "NORTH_PIT",
        }))
        loop.close()

        self.assertEqual(res.get("status"), "success")

class TestMaximoRegistry(unittest.TestCase):
    def test_registry_contains_maximo(self):
        info = ConnectorRegistry.get_connector_info("maximo")
        self.assertIsNotNone(info)
        self.assertEqual(info["slug"], "maximo")
        self.assertEqual(info["category"], "EAM")
        self.assertEqual(info["status"], "available")
        
        connector_cls = ConnectorRegistry.get_connector_class("maximo")
        self.assertIsNotNone(connector_cls)
        self.assertEqual(connector_cls, MaximoConnector)

if __name__ == "__main__":
    unittest.main()
