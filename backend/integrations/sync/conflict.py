"""
MachineCare ERP Integration Platform - Conflict Management
Handles field-level differences and implements conflict strategies.
"""

from typing import Any, Dict, Optional, Tuple
from datetime import datetime
from backend.integrations.core.exceptions import ConflictError

class ConflictManager:
    """Detects and resolves data discrepancies during bidirectional synchronization."""

    STRATEGIES = {"erp_wins", "machinecare_wins", "newest_wins", "manual"}

    @staticmethod
    def detect_diff(mc_record: Dict[str, Any], erp_mapped_record: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """
        Compares common attributes between MachineCare record and transformed ERP record.
        Returns dictionary of conflicting fields: {field: {"mc": val, "erp": val}}
        """
        diff = {}
        # Ignore system timestamps and internal keys during diff check
        ignore_keys = {"id", "created_at", "updated_at", "last_synced_at", "metadata", "external_ids"}

        for key, erp_val in erp_mapped_record.items():
            if key in ignore_keys:
                continue
            mc_val = mc_record.get(key)
            if mc_val is not None and erp_val is not None and mc_val != erp_val:
                diff[key] = {
                    "machinecare": mc_val,
                    "erp": erp_val,
                }
        return diff

    @classmethod
    def resolve(
        cls,
        strategy: str,
        mc_record: Dict[str, Any],
        erp_mapped_record: Dict[str, Any],
        mc_updated_at: Optional[str] = None,
        erp_updated_at: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Applies chosen conflict strategy.
        Returns:
            (winning_record, has_conflict_logged)
        """
        diff = cls.detect_diff(mc_record, erp_mapped_record)
        if not diff:
            # Clean match, merge ERP record on top of MC record
            merged = {**mc_record, **erp_mapped_record}
            return merged, False

        if strategy == "erp_wins":
            merged = {**mc_record, **erp_mapped_record}
            return merged, True

        elif strategy == "machinecare_wins":
            # Retain MC values, only populate missing fields from ERP
            merged = {**erp_mapped_record, **mc_record}
            return merged, True

        elif strategy == "newest_wins":
            t_mc = datetime.fromisoformat(mc_updated_at.replace("Z", "+00:00")) if mc_updated_at else datetime.min
            t_erp = datetime.fromisoformat(erp_updated_at.replace("Z", "+00:00")) if erp_updated_at else datetime.min
            if t_erp >= t_mc:
                merged = {**mc_record, **erp_mapped_record}
            else:
                merged = {**erp_mapped_record, **mc_record}
            return merged, True

        elif strategy == "manual":
            # Defer update, keep existing MC record and flag for manual resolution
            raise ConflictError(
                "Manual resolution required for conflicting record update",
                entity_type=mc_record.get("asset_type") or "entity",
                canonical_id=mc_record.get("id", "unknown"),
                external_id=erp_mapped_record.get("id", "unknown"),
                diff=diff,
            )
        else:
            merged = {**mc_record, **erp_mapped_record}
            return merged, False
