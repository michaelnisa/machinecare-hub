"""
MachineCare ERP Integration Platform - Automated Test Suite
Verifies Encryption Vault, Canonical Models, Mappers, Connectors, Sync Engine, Webhooks, and Error Queue.
"""

import unittest
import asyncio
from unittest.mock import MagicMock, patch

from backend.integrations.credentials.vault import CredentialVault
from backend.integrations.canonical.models import Asset, Part, PurchaseRequest, MaintenanceCost, ProductionOrder
from backend.integrations.core.identity import ExternalIdentityManager
from backend.integrations.mappings.transformer import ValueTransformer
from backend.integrations.mappings.engine import MappingEngine
from backend.integrations.sync.conflict import ConflictManager
from backend.integrations.sync.engine import SyncEngine
from backend.integrations.webhooks.signer import WebhookSigner
from backend.integrations.webhooks.receiver import WebhookReceiver
from backend.integrations.jobs.retry import RetryPolicy, ErrorCenterManager
from backend.integrations.connectors.registry import ConnectorRegistry

from backend.integrations.connectors.odoo.connector import OdooConnector
from backend.integrations.connectors.sap_business_one.connector import SapBusinessOneConnector
from backend.integrations.connectors.dynamics_365.connector import Dynamics365Connector

class TestCredentialVault(unittest.TestCase):
    def setUp(self):
        self.vault = CredentialVault(master_key="test-secure-master-key-machinecare")

    def test_encrypt_and_decrypt(self):
        creds = {"api_key": "odoo_secret_key_123", "username": "admin_bot"}
        ciphertext, iv, auth_tag = self.vault.encrypt(creds)
        
        self.assertNotEqual(ciphertext, "odoo_secret_key_123")
        decrypted = self.vault.decrypt(ciphertext, iv, auth_tag)
        self.assertEqual(decrypted["api_key"], "odoo_secret_key_123")
        self.assertEqual(decrypted["username"], "admin_bot")

    def test_tampering_detection(self):
        creds = {"password": "SuperSecretPassword"}
        ciphertext, iv, auth_tag = self.vault.encrypt(creds)
        # Tamper with the ciphertext
        tampered = ciphertext[:-4] + "AAAA"
        with self.assertRaises(Exception):
            self.vault.decrypt(tampered, iv, auth_tag)

    def test_masking(self):
        creds = {
            "api_key": "abcdef1234567890",
            "client_secret": "short",
            "username": "public_user",
            "server_url": "https://erp.com"
        }
        masked = CredentialVault.mask_credentials(creds)
        self.assertTrue("••••••" in masked["api_key"])
        self.assertEqual(masked["client_secret"], "••••••")
        self.assertEqual(masked["username"], "public_user")

class TestCanonicalModels(unittest.TestCase):
    def test_asset_canonical(self):
        asset = Asset(
            id="mc_asset_100",
            organization_id="org_1",
            name="Air Compressor 01",
            asset_code="AC-01",
            external_ids={"odoo": "458"},
            operating_hours=1420.5
        )
        self.assertEqual(asset.id, "mc_asset_100")
        self.assertEqual(asset.external_ids["odoo"], "458")
        self.assertEqual(asset.source_system, "machinecare")

    def test_part_canonical(self):
        part = Part(
            id="mc_part_200",
            organization_id="org_1",
            part_number="FLT-098",
            name="Heavy Duty Oil Filter",
            available_quantity=24.0,
            currency="TZS"
        )
        self.assertEqual(part.available_quantity, 24.0)
        self.assertEqual(part.currency, "TZS")

class TestExternalIdentity(unittest.TestCase):
    def test_idempotent_resolution(self):
        id_mgr = ExternalIdentityManager()
        # First resolution allocates an ID
        cid1, is_new1 = id_mgr.resolve_canonical_id(
            organization_id="org_1",
            source_system="odoo",
            external_entity_type="part",
            external_entity_id="1001",
            canonical_entity_type="part"
        )
        self.assertTrue(is_new1)
        self.assertTrue(cid1.startswith("mc_part_"))

        # Second resolution must return the EXACT same ID and is_new=False
        cid2, is_new2 = id_mgr.resolve_canonical_id(
            organization_id="org_1",
            source_system="odoo",
            external_entity_type="part",
            external_entity_id="1001",
            canonical_entity_type="part"
        )
        self.assertFalse(is_new2)
        self.assertEqual(cid1, cid2)

class TestMappingEngine(unittest.TestCase):
    def setUp(self):
        self.engine = MappingEngine()

    def test_enum_mapping(self):
        rules = [{
            "source_field": "state",
            "target_field": "status",
            "transform_type": "enum_map",
            "transform_config": {
                "mapping": {"confirmed": "planned", "done": "completed", "cancel": "cancelled"},
                "fallback": "planned"
            }
        }]
        mapped = self.engine.map_record({"state": "done"}, rules)
        self.assertEqual(mapped["status"], "completed")

    def test_unit_conversion(self):
        rules = [{
            "source_field": "weight_lbs",
            "target_field": "weight_kg",
            "transform_type": "unit_convert",
            "transform_config": {"from_unit": "LBS", "to_unit": "KG"}
        }]
        mapped = self.engine.map_record({"weight_lbs": 100}, rules)
        self.assertAlmostEqual(mapped["weight_kg"], 45.3592, places=3)

    def test_formula_transform(self):
        rules = [{
            "source_field": "qty",
            "target_field": "safety_stock",
            "transform_type": "formula",
            "transform_config": {"expression": "val * 1.2"}
        }]
        mapped = self.engine.map_record({"qty": 50}, rules)
        self.assertEqual(mapped["safety_stock"], 60.0)

class TestConflictManager(unittest.TestCase):
    def test_erp_wins(self):
        mc = {"id": "1", "model": "X200", "status": "active"}
        erp = {"id": "1", "model": "X210", "status": "active"}
        res, has_conflict = ConflictManager.resolve("erp_wins", mc, erp)
        self.assertTrue(has_conflict)
        self.assertEqual(res["model"], "X210")

    def test_mc_wins(self):
        mc = {"id": "1", "model": "X200", "status": "active"}
        erp = {"id": "1", "model": "X210", "status": "active"}
        res, has_conflict = ConflictManager.resolve("machinecare_wins", mc, erp)
        self.assertTrue(has_conflict)
        self.assertEqual(res["model"], "X200")

class TestOdooConnector(unittest.TestCase):
    def test_odoo_fetch_and_mapping(self):
        mock_client = MagicMock()
        mock_client.search_read.return_value = [
            {
                "id": 4829,
                "default_code": "FLT-001",
                "name": "Cat Oil Filter",
                "qty_available": 14,
                "uom_name": "PCS",
                "standard_price": 45000.0,
            }
        ]

        connector = OdooConnector(
            config={"base_url": "https://test.odoo.com", "company_identifier": "test_db"},
            credentials={"api_key": "test_key", "username": "test_user"},
            client=mock_client
        )

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        parts = loop.run_until_complete(connector.fetch_parts())

        self.assertEqual(len(parts), 1)
        self.assertEqual(parts[0]["default_code"], "FLT-001")

        # Test mapping
        engine = MappingEngine()
        catalog_info = ConnectorRegistry.get_connector_info("odoo")
        rules = catalog_info["default_mappings"]["part"]
        canonical_part = engine.map_record(parts[0], rules)
        self.assertEqual(canonical_part["part_number"], "FLT-001")
        self.assertEqual(canonical_part["available_quantity"], 14)

class TestSapBusinessOneConnector(unittest.TestCase):
    def test_sap_fetch(self):
        mock_client = MagicMock()
        mock_client.get.return_value = [
            {
                "ItemCode": "ITEM-99",
                "ItemName": "Bearing 6205",
                "InventoryUOM": "PCS",
                "QuantityOnStock": 35.0,
                "AvgStdPrice": 12500.0
            }
        ]

        connector = SapBusinessOneConnector(
            config={"base_url": "https://sap.local:50000/b1s/v1", "company_identifier": "DEMO"},
            credentials={"username": "manager", "password": "pwd"},
            client=mock_client
        )

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        items = loop.run_until_complete(connector.fetch_parts())
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["ItemCode"], "ITEM-99")

class TestDynamics365Connector(unittest.TestCase):
    def test_dynamics_fetch(self):
        mock_client = MagicMock()
        mock_client.get.return_value = [
            {
                "id": "guid-1",
                "number": "ITEM-D365-1",
                "displayName": "Hydraulic Hose",
                "inventory": 8.0,
                "unitCost": 85000.0
            }
        ]

        connector = Dynamics365Connector(
            config={"base_url": "https://api.businesscentral.dynamics.com", "environment": "prod"},
            credentials={"tenant_id": "tid", "client_id": "cid", "client_secret": "csec"},
            client=mock_client
        )

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        items = loop.run_until_complete(connector.fetch_parts())
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["number"], "ITEM-D365-1")

class TestWebhooks(unittest.TestCase):
    def test_hmac_sign_and_verify(self):
        secret = "super_webhook_secret_key"
        timestamp = "1725518400"
        payload = {"event": "asset.updated", "asset_id": "mc_asset_100"}

        sig = WebhookSigner.sign_payload(payload, secret, timestamp)
        self.assertTrue(sig.startswith("v1="))

        is_valid = WebhookSigner.verify_signature(payload, secret, timestamp, sig)
        self.assertTrue(is_valid)

        # Tampered payload fails verification
        tampered_payload = {"event": "asset.updated", "asset_id": "mc_asset_TAMPERED"}
        is_tampered_valid = WebhookSigner.verify_signature(tampered_payload, secret, timestamp, sig)
        self.assertFalse(is_tampered_valid)

class TestErrorCenter(unittest.TestCase):
    def test_retry_policy(self):
        self.assertTrue(RetryPolicy.is_retryable("Network connection timeout 504"))
        self.assertFalse(RetryPolicy.is_retryable("Unit of measure could not be mapped (mapping_failed)"))

    def test_error_lifecycle(self):
        mgr = ErrorCenterManager()
        entry = mgr.record_error(
            error_id="err_1",
            organisation_id="org_1",
            integration_id="int_1",
            entity_type="part",
            external_id="4829",
            error_message="Connection timed out",
            max_retries=2
        )
        self.assertEqual(entry["retry_count"], 0)
        self.assertEqual(entry["status"], "open")

        # Retry 1
        updated1 = mgr.retry_error("err_1")
        self.assertEqual(updated1["retry_count"], 1)
        self.assertEqual(updated1["status"], "retrying")

        # Retry 2 -> exceeds max_retries, moves to dead letter
        updated2 = mgr.retry_error("err_1")
        self.assertEqual(updated2["retry_count"], 2)
        self.assertEqual(updated2["status"], "dead_letter")

if __name__ == "__main__":
    unittest.main()
