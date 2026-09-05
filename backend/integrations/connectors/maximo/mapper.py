"""
MachineCare ERP Integration Platform - IBM Maximo OSLC Data Transformers & Mappings
Converts Maximo OSLC structures to MachineCare Canonical Models and vice versa.
"""

from typing import Dict, Any, List, Optional
from backend.integrations.canonical.models import (
    Asset,
    WorkOrder,
    Part,
    MeterReading,
    MaintenanceCost,
)

class MaximoMapper:
    """Transforms data between IBM Maximo OSLC and MachineCare canonical structures."""

    @staticmethod
    def maximo_asset_to_canonical(data: Dict[str, Any], org_id: str = "default") -> Asset:
        """Converts Maximo MXASSET OSLC payload to canonical Asset model."""
        assetnum = str(data.get("assetnum", ""))
        return Asset(
            id=f"maximo_{assetnum}",
            organization_id=org_id,
            source_system="maximo",
            external_ids={"maximo_assetnum": assetnum, "siteid": data.get("siteid")},
            name=data.get("description", assetnum),
            asset_code=assetnum,
            asset_type="equipment",
            manufacturer=data.get("vendor"),
            model=data.get("modelnum"),
            serial_number=data.get("serialnum"),
            status="active" if data.get("status") == "OPERATING" else "maintenance",
            location=data.get("location"),
            site_id=data.get("siteid"),
            department=data.get("department"),
            parent_asset_id=data.get("parent"),
            hierarchy_path=f"{data.get('siteid')}/{data.get('location')}/{assetnum}" if data.get("location") else assetnum,
            metadata={
                "orgid": data.get("orgid"),
                "installdate": data.get("installdate"),
                "totdowntime": data.get("totdowntime", 0.0),
            }
        )

    @staticmethod
    def maximo_wo_to_canonical(data: Dict[str, Any], org_id: str = "default") -> WorkOrder:
        """Converts Maximo MXWO OSLC payload to canonical WorkOrder model."""
        wonum = str(data.get("wonum", ""))
        status_map = {
            "WAPPR": "open",
            "APPR": "open",
            "INPRG": "in_progress",
            "COMP": "completed",
            "CLOSE": "closed",
            "CAN": "closed",
        }
        return WorkOrder(
            id=f"maximo_wo_{wonum}",
            organization_id=org_id,
            source_system="maximo",
            external_ids={"maximo_wonum": wonum, "siteid": data.get("siteid")},
            work_order_number=wonum,
            asset_id=f"maximo_{data.get('assetnum')}" if data.get("assetnum") else "",
            title=data.get("description", f"Maximo WO #{wonum}"),
            description=data.get("description"),
            status=status_map.get(data.get("status", "WAPPR"), "open"),
            work_type=data.get("worktype", "CM"),
            job_plan_id=data.get("jpnum"),
            pm_number=data.get("pmnum"),
            location_id=data.get("location"),
            assigned_to=data.get("lead") or data.get("owner"),
            start_date=data.get("schedstart"),
            completed_date=data.get("actfinish"),
            total_cost=float(data.get("acttotalcost") or 0.0),
            currency="USD",
            metadata={"siteid": data.get("siteid"), "maximo_status": data.get("status")}
        )

    @staticmethod
    def maximo_item_to_canonical(data: Dict[str, Any], org_id: str = "default") -> Part:
        """Converts Maximo MXITEM OSLC payload to canonical Part model."""
        itemnum = str(data.get("itemnum", ""))
        return Part(
            id=f"maximo_part_{itemnum}",
            organization_id=org_id,
            source_system="maximo",
            external_ids={"maximo_itemnum": itemnum, "itemsetid": data.get("itemsetid")},
            part_number=itemnum,
            name=data.get("description", itemnum),
            unit=data.get("issueunit") or data.get("orderunit") or "PCS",
            category=data.get("commoditygroup"),
            available_quantity=float(data.get("curbaltotal") or 0.0),
            unit_cost=float(data.get("lastcost") or 0.0),
        )

    @staticmethod
    def canonical_meter_to_maximo(reading: MeterReading, site_id: str = "BEDFORD", org_id: Optional[str] = None) -> Dict[str, Any]:
        """Converts MachineCare IoT/telemetry MeterReading to Maximo MXMETERDATA OSLC payload."""
        # Clean external ID if prefixed
        assetnum = reading.asset_id.replace("maximo_", "")
        payload = {
            "assetnum": assetnum,
            "metername": reading.meter_name,
            "newreading": reading.reading_value,
            "newreadingdate": reading.reading_date,
            "siteid": site_id,
            "inspector": reading.inspector_id or "MACHINECARE_IOT",
            "doroll": True,
        }
        if org_id:
            payload["orgid"] = org_id
        return payload

    @staticmethod
    def canonical_wo_to_maximo(wo: WorkOrder, site_id: str = "BEDFORD") -> Dict[str, Any]:
        """Converts canonical WorkOrder to Maximo MXWO update/create payload."""
        assetnum = wo.asset_id.replace("maximo_", "") if wo.asset_id else None
        return {
            "wonum": wo.work_order_number if wo.work_order_number else None,
            "description": wo.title,
            "assetnum": assetnum,
            "siteid": site_id,
            "worktype": wo.work_type,
            "status": "COMP" if wo.status == "completed" else "INPRG" if wo.status == "in_progress" else "APPR",
            "acttotalcost": wo.total_cost,
        }

def get_maximo_default_mappings() -> Dict[str, List[Dict[str, Any]]]:
    """Default field mappings between Maximo OSLC and MachineCare."""
    return {
        "asset": [
            {"source_field": "assetnum", "target_field": "asset_code", "transform_type": "direct", "is_required": True},
            {"source_field": "description", "target_field": "name", "transform_type": "direct", "is_required": True},
            {"source_field": "serialnum", "target_field": "serial_number", "transform_type": "direct"},
            {"source_field": "vendor", "target_field": "manufacturer", "transform_type": "direct"},
            {"source_field": "location", "target_field": "location", "transform_type": "direct"},
            {"source_field": "siteid", "target_field": "site_id", "transform_type": "direct"},
            {"source_field": "status", "target_field": "status", "transform_type": "enum_map", "transform_config": {"OPERATING": "active", "NOT READY": "maintenance", "DECOMMISSIONED": "retired"}},
        ],
        "work_order": [
            {"source_field": "wonum", "target_field": "work_order_number", "transform_type": "direct", "is_required": True},
            {"source_field": "description", "target_field": "title", "transform_type": "direct", "is_required": True},
            {"source_field": "assetnum", "target_field": "asset_id", "transform_type": "direct"},
            {"source_field": "status", "target_field": "status", "transform_type": "enum_map", "transform_config": {"WAPPR": "open", "APPR": "open", "INPRG": "in_progress", "COMP": "completed", "CLOSE": "closed"}},
            {"source_field": "worktype", "target_field": "work_type", "transform_type": "direct"},
            {"source_field": "acttotalcost", "target_field": "total_cost", "transform_type": "direct", "default_value": 0},
        ],
        "meter_reading": [
            {"source_field": "asset_id", "target_field": "assetnum", "transform_type": "direct", "is_required": True},
            {"source_field": "meter_name", "target_field": "metername", "transform_type": "direct", "is_required": True},
            {"source_field": "reading_value", "target_field": "newreading", "transform_type": "direct", "is_required": True},
            {"source_field": "reading_date", "target_field": "newreadingdate", "transform_type": "direct", "is_required": True},
            {"source_field": "site_id", "target_field": "siteid", "transform_type": "direct", "is_required": True},
        ],
        "part": [
            {"source_field": "itemnum", "target_field": "part_number", "transform_type": "direct", "is_required": True},
            {"source_field": "description", "target_field": "name", "transform_type": "direct", "is_required": True},
            {"source_field": "issueunit", "target_field": "unit", "transform_type": "direct", "default_value": "PCS"},
        ]
    }
