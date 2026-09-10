"""
Unit Tests for Database Connector & MachineCare Data Gateway
"""

import unittest
import asyncio
from backend.integrations.connectors.database.connector import ReadOnlyDatabaseConnector
from backend.integrations.gateway.client import MachineCareDataGateway, GatewayMessage
from backend.integrations.core.exceptions import IntegrationError

class TestDatabaseConnectorAndGateway(unittest.TestCase):
    def test_database_connector_capabilities(self):
        connector = ReadOnlyDatabaseConnector(
            config={"database_type": "postgres", "host": "localhost", "port": 5432, "database": "prod_db"},
            credentials={"username": "ro_user", "password": "secret_password"}
        )
        caps = connector.get_capabilities()
        self.assertEqual(caps.write, [])  # Strictly read-only
        self.assertIn("assets", caps.read)

    def test_database_connector_safety_guard(self):
        connector = ReadOnlyDatabaseConnector(config={}, credentials={})
        
        # Valid read queries pass
        connector.validate_safe_query("SELECT id, name FROM vw_assets WHERE status = 'active'")

        # Unsafe destructive queries are blocked
        with self.assertRaises(IntegrationError):
            connector.validate_safe_query("DROP TABLE assets CASCADE")

        with self.assertRaises(IntegrationError):
            connector.validate_safe_query("DELETE FROM work_orders WHERE id = 1")

        with self.assertRaises(IntegrationError):
            connector.validate_safe_query("TRUNCATE TABLE parts")

        # Multi-statement injection blocked
        with self.assertRaises(IntegrationError):
            connector.validate_safe_query("SELECT id FROM vw_assets; DROP TABLE users;")

        # SQL comment obfuscation blocked
        with self.assertRaises(IntegrationError):
            connector.validate_safe_query("SELECT * FROM vw_assets -- comment")

        # Stored procedure execution blocked
        with self.assertRaises(IntegrationError):
            connector.validate_safe_query("EXEC sp_msforeachtable 'DROP TABLE ?'")

        # System security catalog access blocked
        with self.assertRaises(IntegrationError):
            connector.validate_safe_query("SELECT * FROM pg_shadow")

        # Push records is blocked
        with self.assertRaises(IntegrationError):
            asyncio.run(connector.push_records("parts", [{"name": "New Part"}]))

        # SSRF cloud metadata blocked
        with self.assertRaises(IntegrationError):
            connector.validate_host("169.254.169.254")

    def test_data_gateway(self):
        gw = MachineCareDataGateway()
        secret = "super_secret_plant_key_999"
        gw.register_gateway(gateway_id="gw_plant_1", organization_id="org_safari", name="Safari Plant Gateway", secret_key=secret)

        msg = GatewayMessage(
            gateway_id="gw_plant_1",
            organization_id="org_safari",
            source_database_type="postgres",
            entity_type="meters",
            payload=[{"meter_id": "MTR_01", "val": 120.4}],
        )
        msg.signature = MachineCareDataGateway.compute_signature(secret, msg)

        res = gw.receive_gateway_batch(msg)
        self.assertEqual(res["status"], "RECEIVED")
        self.assertEqual(res["records_processed"], 1)

        # Tampered signature fails
        bad_sig_msg = GatewayMessage(
            gateway_id="gw_plant_1",
            organization_id="org_safari",
            source_database_type="postgres",
            entity_type="meters",
            payload=[{"meter_id": "MTR_01", "val": 120.4}],
            signature="tampered_signature_hex",
        )
        with self.assertRaises(PermissionError):
            gw.receive_gateway_batch(bad_sig_msg)

        # Batch limit defense
        huge_msg = GatewayMessage(
            gateway_id="gw_plant_1",
            organization_id="org_safari",
            source_database_type="postgres",
            entity_type="meters",
            payload=[{"i": i} for i in range(5001)],
        )
        with self.assertRaises(ValueError):
            gw.receive_gateway_batch(huge_msg)

        # Cross-tenant tampering fails
        bad_msg = GatewayMessage(
            gateway_id="gw_plant_1",
            organization_id="org_other",
            source_database_type="postgres",
            entity_type="meters",
            payload=[],
        )
        with self.assertRaises(PermissionError):
            gw.receive_gateway_batch(bad_msg)

    def test_database_connector_full_api_flow(self):
        """Tests full end-to-end create, test, and sync flow for Database connector."""
        from backend.integrations.api.routes import IntegrationAPIService

        service = IntegrationAPIService()
        org_id = "org_mining_corp"

        # 1. Create database connection
        created = service.create_integration(
            organization_id=org_id,
            payload={
                "name": "On-Premises SQL Asset DB",
                "connector_type": "database",
                "base_url": "postgres://db.corp:5432",
                "company_identifier": "assets_db",
                "credentials": {"username": "ro_sync", "password": "secure_password"},
            }
        )
        int_id = created["id"]
        self.assertEqual(created["connector_type"], "database")
        self.assertEqual(created["status"], "connected")

        # 2. Test connection
        test_res = asyncio.run(service.test_integration(int_id))
        self.assertTrue(test_res["success"])
        self.assertIn("assets_db", test_res["message"])

        # 3. Trigger inbound sync for parts
        sync_res = asyncio.run(service.trigger_sync(integration_id=int_id, entity_type="part", limit=5))
        self.assertEqual(sync_res["status"], "completed")
        self.assertGreater(sync_res["records_processed"], 0)
        self.assertEqual(sync_res["records_failed"], 0)

        # 4. Trigger inbound sync for assets
        sync_asset_res = asyncio.run(service.trigger_sync(integration_id=int_id, entity_type="asset", limit=5))
        self.assertEqual(sync_asset_res["status"], "completed")
        self.assertGreater(sync_asset_res["records_processed"], 0)
        self.assertEqual(sync_asset_res["records_failed"], 0)

if __name__ == "__main__":
    unittest.main()
