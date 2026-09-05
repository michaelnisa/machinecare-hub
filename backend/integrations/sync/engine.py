"""
MachineCare ERP Integration Platform - Core Synchronization Engine
Handles inbound ERP ingestion, outbound operational pushing, and bidirectional sync.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime
import uuid

from backend.integrations.core.base import ERPConnector
from backend.integrations.core.identity import ExternalIdentityManager
from backend.integrations.mappings.engine import MappingEngine
from backend.integrations.sync.conflict import ConflictManager
from backend.integrations.core.exceptions import IntegrationError, ConflictError

class SyncJobResult:
    def __init__(self, job_id: str, integration_id: str, entity_type: str, direction: str):
        self.job_id = job_id
        self.integration_id = integration_id
        self.entity_type = entity_type
        self.direction = direction
        self.status = "running"
        self.records_processed = 0
        self.records_created = 0
        self.records_updated = 0
        self.records_failed = 0
        self.errors: List[Dict[str, Any]] = []
        self.conflicts: List[Dict[str, Any]] = []
        self.synced_items: List[Dict[str, Any]] = []
        self.started_at = datetime.utcnow().isoformat() + "Z"
        self.completed_at: Optional[str] = None

    def finish(self, status: Optional[str] = None):
        self.completed_at = datetime.utcnow().isoformat() + "Z"
        if status:
            self.status = status
        elif self.records_failed > 0 and self.records_created + self.records_updated > 0:
            self.status = "completed_with_errors"
        elif self.records_failed > 0:
            self.status = "failed"
        else:
            self.status = "completed"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "integration_id": self.integration_id,
            "entity_type": self.entity_type,
            "direction": self.direction,
            "status": self.status,
            "records_processed": self.records_processed,
            "records_created": self.records_created,
            "records_updated": self.records_updated,
            "records_failed": self.records_failed,
            "errors": self.errors,
            "conflicts": self.conflicts,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
        }

class SyncEngine:
    """Orchestrates end-to-end synchronization workflows."""

    def __init__(
        self,
        identity_manager: Optional[ExternalIdentityManager] = None,
        mapping_engine: Optional[MappingEngine] = None,
    ):
        self.identity_mgr = identity_manager or ExternalIdentityManager()
        self.mapping_engine = mapping_engine or MappingEngine()
        # In-memory storage for test/demo environments
        self.canonical_store: Dict[str, Dict[str, Any]] = {}

    async def run_inbound_sync(
        self,
        connector: ERPConnector,
        integration_id: str,
        organization_id: str,
        source_system: str,
        entity_type: str,  # 'asset', 'part', 'inventory', 'customer', etc.
        mapping_rules: List[Dict[str, Any]],
        conflict_strategy: str = "erp_wins",
        limit: int = 100,
    ) -> SyncJobResult:
        """
        Executes ERP -> MachineCare inbound sync.
        """
        job_id = f"job_{uuid.uuid4().hex[:10]}"
        result = SyncJobResult(job_id, integration_id, entity_type, direction="erp_to_mc")

        try:
            # 1. Fetch raw data from ERP connector
            raw_records = []
            if entity_type == "asset":
                raw_records = await connector.fetch_assets(limit=limit)
            elif entity_type == "part":
                raw_records = await connector.fetch_parts(limit=limit)
            elif entity_type == "inventory":
                raw_records = await connector.fetch_inventory(limit=limit)
            elif entity_type == "customer":
                raw_records = await connector.fetch_customers(limit=limit)
            elif entity_type == "supplier":
                raw_records = await connector.fetch_suppliers(limit=limit)
            elif entity_type == "production_order":
                raw_records = await connector.fetch_production_orders(limit=limit)
            elif entity_type == "purchase_order":
                raw_records = await connector.fetch_purchase_orders(limit=limit)
            else:
                raise IntegrationError(f"Unsupported entity type for inbound sync: {entity_type}")

            # 2. Process each record
            for raw_record in raw_records:
                result.records_processed += 1
                try:
                    # Identify external ID
                    ext_id = str(raw_record.get("id") or raw_record.get("code") or raw_record.get("ItemCode") or "")
                    if not ext_id:
                        raise IntegrationError("Missing primary identifier on external record")

                    # Map fields to canonical model
                    canonical_payload = self.mapping_engine.map_record(raw_record, mapping_rules)

                    # Deduplicate and resolve MachineCare ID
                    canonical_id, is_new = self.identity_mgr.resolve_canonical_id(
                        organization_id=organization_id,
                        source_system=source_system,
                        external_entity_type=entity_type,
                        external_entity_id=ext_id,
                        canonical_entity_type=entity_type,
                    )

                    canonical_payload["id"] = canonical_id
                    canonical_payload["organization_id"] = organization_id
                    canonical_payload["source_system"] = source_system
                    canonical_payload["external_ids"] = {source_system: ext_id}
                    canonical_payload["last_synced_at"] = datetime.utcnow().isoformat() + "Z"

                    if is_new:
                        self.canonical_store[canonical_id] = canonical_payload
                        result.records_created += 1
                        action = "created"
                    else:
                        existing = self.canonical_store.get(canonical_id, {})
                        merged, has_conflict = ConflictManager.resolve(
                            strategy=conflict_strategy,
                            mc_record=existing,
                            erp_mapped_record=canonical_payload,
                        )
                        if has_conflict:
                            result.conflicts.append({
                                "canonical_id": canonical_id,
                                "external_id": ext_id,
                                "entity_type": entity_type,
                            })
                        self.canonical_store[canonical_id] = merged
                        result.records_updated += 1
                        action = "updated"

                    result.synced_items.append({
                        "canonical_id": canonical_id,
                        "external_id": ext_id,
                        "action": action,
                    })

                except Exception as rec_err:
                    result.records_failed += 1
                    result.errors.append({
                        "external_id": raw_record.get("id", "unknown"),
                        "entity_type": entity_type,
                        "error_message": str(rec_err),
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                    })

            result.finish()

        except Exception as e:
            result.records_failed += 1
            result.errors.append({
                "entity_type": entity_type,
                "error_message": f"Fatal sync job error: {str(e)}",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
            result.finish(status="failed")

        return result

    async def run_outbound_sync(
        self,
        connector: ERPConnector,
        integration_id: str,
        organization_id: str,
        target_system: str,
        entity_type: str,  # e.g. 'purchase_request', 'maintenance_cost'
        canonical_data: Dict[str, Any],
        mapping_rules: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Executes MachineCare -> ERP outbound sync.
        """
        # Transform canonical data to ERP format using reverse mapping
        erp_payload = self.mapping_engine.map_record(canonical_data, mapping_rules, reverse=True)

        if entity_type == "purchase_request":
            erp_response = await connector.create_purchase_request(erp_payload)
        elif entity_type == "maintenance_cost":
            erp_response = await connector.send_maintenance_cost(erp_payload)
        elif entity_type == "production_result":
            erp_response = await connector.push_production_result(erp_payload)
        else:
            raise IntegrationError(f"Unsupported outbound entity: {entity_type}")

        # Store external identity linkage
        ext_id = str(erp_response.get("id") or erp_response.get("DocEntry") or erp_response.get("number") or "")
        if ext_id and canonical_data.get("id"):
            self.identity_mgr.record_mapping(
                organization_id=organization_id,
                source_system=target_system,
                external_entity_type=entity_type,
                external_entity_id=ext_id,
                canonical_entity_type=entity_type,
                canonical_entity_id=canonical_data["id"],
            )

        return {
            "success": True,
            "canonical_id": canonical_data.get("id"),
            "external_id": ext_id,
            "erp_response": erp_response,
        }
