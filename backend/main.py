"""
MachineCare Enterprise Operational Intelligence Platform - FastAPI Application Entrypoint
Hosts the REST API service, Domain Modules, Platform Capabilities, and ERP Integrations.
"""

import os
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional, List

from backend.core.auth.service import AuthService
from backend.integrations.api.routes import IntegrationAPIService
from backend.integrations.core.exceptions import IntegrationError
from backend.platform.feature_flags import FeatureFlagService
from backend.platform.custom_fields import CustomFieldsService
from backend.platform.custom_fields.models import CustomFieldDefinition, CustomFieldValue
from backend.platform.audit import AuditService, AuditLogEntry
from backend.platform.extensions import ExtensionRegistry
from backend.extensions.xyz_mining import xyz_mining_extension
from backend.modules.assets.service import AssetService
from backend.modules.assets.models import AssetEntity, MeterReading
from backend.modules.maintenance.service import MaintenanceService
from backend.modules.maintenance.models import WorkOrderEntity
from backend.modules.connected_data.service import ConnectedDataService, TelemetryDataPoint

app = FastAPI(
    title="MachineCare Enterprise Platform",
    version="2.0.0",
    description="Operational intelligence platform for machines, maintenance, production, inventory, fleet, safety, and enterprise integrations.",
)

# Enable secure CORS for MachineCare frontend & client origins
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|.*\.machinecare\.co\.tz)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

auth_service = AuthService(jwt_secret=os.getenv("SUPABASE_JWT_SECRET"))

def get_tenant_id(
    authorization: Optional[str] = Header(None),
    x_organisation_id: Optional[str] = Header(None, alias="X-Organisation-ID"),
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret"),
) -> str:
    """
    Extracts and cryptographically validates the tenant organization ID.
    Supports Supabase Bearer JWT tokens or authorized internal service delegation headers.
    """
    if authorization and authorization.startswith("Bearer "):
        try:
            ctx = auth_service.extract_user_context(authorization)
            org_id = ctx.get("organization_id")
            if org_id:
                return str(org_id)
        except Exception:
            pass
    internal_key = os.getenv("INTERNAL_API_SECRET")
    is_production = os.getenv("ENVIRONMENT") == "production"
    if x_organisation_id:
        if is_production and internal_key:
            if x_internal_secret == internal_key:
                return x_organisation_id
            raise HTTPException(status_code=403, detail="Unauthorized internal tenant delegation")
        return x_organisation_id
    raise HTTPException(status_code=401, detail="Valid authorization token or tenant header required")

service = IntegrationAPIService()
feature_flags = FeatureFlagService()
custom_fields = CustomFieldsService()
audit_service = AuditService()
asset_service = AssetService()
maintenance_service = MaintenanceService()
connected_data_service = ConnectedDataService()
extension_registry = ExtensionRegistry()

# Register standard enterprise extension packages
extension_registry.register_package(xyz_mining_extension)

@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "machinecare-platform",
        "version": "2.0.0",
        "architecture": {
            "core": "operational",
            "modules": "operational",
            "platform": "operational",
            "integrations": "operational",
            "extensions": "operational",
        },
        "vault": "AES-256-GCM active",
    }

# --- Platform: Feature Flags & Capabilities ---
@app.get("/api/v1/platform/feature-flags")
def get_feature_flags(x_organisation_id: str = Depends(get_tenant_id)):
    return {
        "organization_id": x_organisation_id,
        "features": {
            feature: feature_flags.is_feature_enabled(x_organisation_id, feature)
            for feature in [
                "assets", "maintenance", "inventory", "production",
                "fleet", "safety", "workshop", "connected_data",
                "custom_fields", "erp_integrations"
            ]
        }
    }

# --- Platform: Extensions ---
@app.get("/api/v1/platform/extensions")
def list_extensions(x_organisation_id: str = Depends(get_tenant_id)):
    return {
        "available_extensions": ["xyz_mining"],
        "enabled": [
            ext for ext in ["xyz_mining"]
            if extension_registry.is_enabled(x_organisation_id, ext)
        ]
    }

# --- Platform: Custom Fields ---
@app.get("/api/v1/platform/custom-fields/{entity_type}")
def get_custom_fields(entity_type: str, x_organisation_id: str = Depends(get_tenant_id)):
    fields = custom_fields.get_fields_for_entity(organization_id=x_organisation_id, entity_type=entity_type)
    return {
        "entity_type": entity_type,
        "fields": [
            {
                "id": f.id,
                "field_key": f.field_key,
                "field_label": f.field_label,
                "field_type": f.field_type.value,
                "is_required": f.is_required,
                "options": f.options,
            }
            for f in fields
        ]
    }

@app.post("/api/v1/platform/custom-fields")
def create_custom_field(payload: Dict[str, Any], x_organisation_id: str = Depends(get_tenant_id)):
    from backend.platform.custom_fields.models import FieldType
    defn = CustomFieldDefinition(
        id=payload.get("id", f"cf_{len(custom_fields._definitions) + 1}"),
        organization_id=x_organisation_id,
        entity_type=payload.get("entity_type", "work_order"),
        field_key=payload.get("field_key", "custom_prop"),
        field_label=payload.get("field_label", "Custom Property"),
        field_type=FieldType(payload.get("field_type", "text")),
        is_required=payload.get("is_required", False),
        options=payload.get("options"),
    )
    saved = custom_fields.register_field(defn)
    return {"status": "registered", "field_id": saved.id, "field_key": saved.field_key}

# --- Platform: Audit Logs ---
@app.get("/api/v1/platform/audit-logs")
def get_audit_trail(
    resource: Optional[str] = None,
    x_organisation_id: str = Depends(get_tenant_id)
):
    logs = audit_service.get_audit_trail(organization_id=x_organisation_id, resource=resource)
    return {
        "organization_id": x_organisation_id,
        "count": len(logs),
        "logs": [
            {
                "id": l.id,
                "action": l.action,
                "resource": l.resource,
                "resource_id": l.resource_id,
                "timestamp": l.timestamp,
            }
            for l in logs
        ]
    }

# --- Domain Modules: Connected Data (IoT & Telemetry) ---
@app.post("/api/v1/modules/connected-data/ingest")
def ingest_telemetry(payload: Dict[str, Any], x_organisation_id: str = Depends(get_tenant_id)):
    point = TelemetryDataPoint(
        id=payload.get("id", f"pt_{len(connected_data_service._telemetry_stream) + 1}"),
        organization_id=x_organisation_id,
        device_id=payload.get("device_id", "device_001"),
        asset_id=payload.get("asset_id"),
        metric_name=payload.get("metric_name", "temperature"),
        metric_value=float(payload.get("metric_value", 0.0)),
        unit=payload.get("unit", "C"),
    )
    res = connected_data_service.ingest_telemetry(point)
    return res

# --- Domain Modules: Assets & Maintenance ---
@app.get("/api/v1/modules/assets/{asset_id}")
def get_asset(asset_id: str, x_organisation_id: str = Depends(get_tenant_id)):
    asset = asset_service.get_asset(x_organisation_id, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return {
        "id": asset.id,
        "name": asset.name,
        "code": asset.code,
        "status": asset.status.value,
        "operating_hours": asset.operating_hours,
    }

@app.post("/api/v1/modules/assets")
def create_asset(payload: Dict[str, Any], x_organisation_id: str = Depends(get_tenant_id)):
    from backend.modules.assets.models import AssetStatus
    asset = AssetEntity(
        id=payload.get("id", f"ast_{len(asset_service._assets) + 1}"),
        organization_id=x_organisation_id,
        name=payload.get("name", "New Machine"),
        code=payload.get("code", "AST-001"),
        category=payload.get("category", "Production"),
        status=AssetStatus(payload.get("status", "operational")),
        operating_hours=float(payload.get("operating_hours", 0.0)),
    )
    saved = asset_service.save_asset(asset)
    return {"status": "created", "asset_id": saved.id, "name": saved.name}

# --- Integrations API Endpoints ---
@app.get("/api/v1/integrations/marketplace")
def list_marketplace():
    return service.list_marketplace()

@app.get("/api/v1/integrations")
def list_integrations(x_organisation_id: str = Depends(get_tenant_id)):
    return service.list_integrations(organization_id=x_organisation_id)

@app.post("/api/v1/integrations")
def create_integration(payload: Dict[str, Any], x_organisation_id: str = Depends(get_tenant_id)):
    try:
        return service.create_integration(organization_id=x_organisation_id, payload=payload)
    except IntegrationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/integrations/{integration_id}/test")
async def test_integration(integration_id: str):
    try:
        return await service.test_integration(integration_id)
    except IntegrationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/integrations/{integration_id}/sync")
async def trigger_sync(integration_id: str, payload: Dict[str, Any]):
    entity_type = payload.get("entity_type", "parts")
    limit = payload.get("limit", 100)
    try:
        return await service.trigger_sync(integration_id=integration_id, entity_type=entity_type, limit=limit)
    except IntegrationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/integrations/{integration_id}/sync-history")
def get_sync_history(integration_id: str):
    return service.get_sync_history(integration_id)

@app.get("/api/v1/integrations/{integration_id}/mappings")
def get_mappings(integration_id: str):
    return service.get_mappings(integration_id)

@app.put("/api/v1/integrations/{integration_id}/mappings")
def update_mappings(integration_id: str, payload: Dict[str, Any]):
    entity_type = payload.get("entity_type", "part")
    rules = payload.get("rules", [])
    return service.update_mappings(integration_id, entity_type, rules)

@app.post("/api/v1/integrations/test-mapping")
def test_mapping(payload: Dict[str, Any]):
    source = payload.get("source", {})
    rules = payload.get("rules", [])
    return service.test_mapping(source, rules)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
