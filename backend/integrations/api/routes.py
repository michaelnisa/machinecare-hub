"""
MachineCare ERP Integration Platform - REST API Layer (/api/v1/integrations)
Provides endpoints for Marketplace, Connection management, Testing, Sync orchestration, Mappings, and Errors.
"""

from typing import Any, Dict, List, Optional
import uuid
import time
from datetime import datetime

from backend.integrations.connectors.registry import ConnectorRegistry
from backend.integrations.credentials.vault import CredentialVault
from backend.integrations.mappings.engine import MappingEngine
from backend.integrations.sync.engine import SyncEngine
from backend.integrations.jobs.retry import ErrorCenterManager
from backend.integrations.logs.logger import SafeStructuredLogger
from backend.integrations.core.exceptions import IntegrationError

class IntegrationAPIService:
    """Service handling all /api/v1/integrations API requests."""

    def __init__(self):
        self.vault = CredentialVault()
        self.mapping_engine = MappingEngine()
        self.sync_engine = SyncEngine()
        self.error_center = ErrorCenterManager()
        self.logger = SafeStructuredLogger()

        # In-memory storage for active integration connections
        self._integrations: Dict[str, Dict[str, Any]] = {}
        self._credentials: Dict[str, Dict[str, Any]] = {}
        self._mappings: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
        self._sync_history: List[Dict[str, Any]] = []

    # 1. GET /api/v1/integrations/marketplace
    def list_marketplace(self) -> List[Dict[str, Any]]:
        """Returns all available ERP catalog items."""
        return ConnectorRegistry.get_catalog()

    # 2. GET /api/v1/integrations
    def list_integrations(self, organization_id: str) -> List[Dict[str, Any]]:
        """Returns all registered integration instances for the organization."""
        results = []
        for int_id, int_data in self._integrations.items():
            if int_data.get("organization_id") == organization_id:
                safe_copy = dict(int_data)
                # Attach masked credentials preview
                if int_id in self._credentials:
                    decrypted = self._credentials[int_id]
                    safe_copy["credentials_preview"] = self.vault.mask_credentials(decrypted)
                results.append(safe_copy)
        return results

    # 3. POST /api/v1/integrations
    def create_integration(self, organization_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Creates or registers a new ERP connection."""
        connector_type = payload.get("connector_type")
        catalog_item = ConnectorRegistry.get_connector_info(connector_type)
        if not catalog_item:
            raise IntegrationError(f"Unknown connector type '{connector_type}'")

        integration_id = payload.get("id") or f"int_{uuid.uuid4().hex[:12]}"
        credentials = payload.get("credentials", {})

        # Encrypt credentials
        enc_payload, iv, auth_tag = self.vault.encrypt(credentials)

        integration_record = {
            "id": integration_id,
            "organization_id": organization_id,
            "name": payload.get("name", catalog_item["name"]),
            "connector_type": connector_type,
            "category": catalog_item.get("category", "ERP"),
            "status": "connected",
            "base_url": payload.get("base_url", ""),
            "environment": payload.get("environment", "production"),
            "company_identifier": payload.get("company_identifier", ""),
            "sync_frequency": payload.get("sync_frequency", "15m"),
            "conflict_strategy": payload.get("conflict_strategy", "erp_wins"),
            "is_active": True,
            "last_synced_at": None,
            "last_health_check_at": datetime.utcnow().isoformat() + "Z",
            "created_at": datetime.utcnow().isoformat() + "Z",
            "capabilities": catalog_item.get("capabilities", {}),
        }

        self._integrations[integration_id] = integration_record
        self._credentials[integration_id] = credentials
        # Initialize default mappings from catalog
        self._mappings[integration_id] = catalog_item.get("default_mappings", {})

        self.logger.log_operation(
            organization_id=organization_id,
            integration_id=integration_id,
            connector=connector_type,
            entity="system",
            operation="connect",
            status="success",
        )

        safe_record = dict(integration_record)
        safe_record["credentials_preview"] = self.vault.mask_credentials(credentials)
        return safe_record

    # 4. POST /api/v1/integrations/{id}/test
    async def test_integration(self, integration_id: str) -> Dict[str, Any]:
        """Runs live connection test against target ERP."""
        int_data = self._integrations.get(integration_id)
        if not int_data:
            raise IntegrationError(f"Integration {integration_id} not found")

        connector_cls = ConnectorRegistry.get_connector_class(int_data["connector_type"])
        if not connector_cls:
            raise IntegrationError(f"No connector implementation for {int_data['connector_type']}")

        credentials = self._credentials.get(integration_id, {})
        connector = connector_cls(config=int_data, credentials=credentials)

        test_result = await connector.test_connection()
        int_data["last_health_check_at"] = datetime.utcnow().isoformat() + "Z"
        int_data["status"] = "healthy" if test_result.success else "auth_failed"

        return {
            "success": test_result.success,
            "status_code": test_result.status_code,
            "message": test_result.message,
            "latency_ms": test_result.latency_ms,
            "company_name": test_result.company_name,
            "server_version": test_result.server_version,
            "details": test_result.details,
        }

    # 5. POST /api/v1/integrations/{id}/sync
    async def trigger_sync(self, integration_id: str, entity_type: str, limit: int = 100) -> Dict[str, Any]:
        """Triggers manual synchronization for an entity type."""
        int_data = self._integrations.get(integration_id)
        if not int_data:
            raise IntegrationError(f"Integration {integration_id} not found")

        connector_cls = ConnectorRegistry.get_connector_class(int_data["connector_type"])
        credentials = self._credentials.get(integration_id, {})
        connector = connector_cls(config=int_data, credentials=credentials)

        entity_mappings = self._mappings.get(integration_id, {}).get(entity_type, [])

        result = await self.sync_engine.run_inbound_sync(
            connector=connector,
            integration_id=integration_id,
            organization_id=int_data["organization_id"],
            source_system=int_data["connector_type"],
            entity_type=entity_type,
            mapping_rules=entity_mappings,
            conflict_strategy=int_data.get("conflict_strategy", "erp_wins"),
            limit=limit,
        )

        int_data["last_synced_at"] = datetime.utcnow().isoformat() + "Z"
        self._sync_history.insert(0, result.to_dict())

        # Log any errors to Error Center
        for err in result.errors:
            self.error_center.record_error(
                error_id=f"err_{uuid.uuid4().hex[:10]}",
                organisation_id=int_data["organization_id"],
                integration_id=integration_id,
                entity_type=entity_type,
                external_id=err.get("external_id", "unknown"),
                error_message=err.get("error_message", "Sync error"),
            )

        return result.to_dict()

    # 6. GET /api/v1/integrations/{id}/sync-history
    def get_sync_history(self, integration_id: str) -> List[Dict[str, Any]]:
        return [job for job in self._sync_history if job["integration_id"] == integration_id]

    # 7. GET /api/v1/integrations/{id}/mappings
    def get_mappings(self, integration_id: str) -> Dict[str, List[Dict[str, Any]]]:
        return self._mappings.get(integration_id, {})

    # 8. PUT /api/v1/integrations/{id}/mappings
    def update_mappings(self, integration_id: str, entity_type: str, rules: List[Dict[str, Any]]) -> Dict[str, Any]:
        if integration_id not in self._mappings:
            self._mappings[integration_id] = {}
        self._mappings[integration_id][entity_type] = rules
        return {"success": True, "entity_type": entity_type, "rule_count": len(rules)}

    # 9. POST /api/v1/integrations/{id}/test-mapping
    def test_mapping(self, source_sample: Dict[str, Any], rules: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self.mapping_engine.preview_mapping(source_sample, rules)
